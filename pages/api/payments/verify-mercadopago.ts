import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { logger } from '@/lib/logger';

/**
 * API para verificar el estado real de un pago en MercadoPago
 * Esto evita que se aprueben pagos que no fueron realmente procesados
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false,
        error: 'No autorizado' 
      });
    }

    const { externalReference, paymentId } = req.body;
    
    if (!externalReference) {
      return res.status(400).json({ 
        success: false,
        error: 'External reference requerido' 
      });
    }

    await dbConnect();

    logger.info('VERIFY start', { module: 'payments', step: 'start', user: session.user.email, reference: externalReference });

    // Buscar el pago pendiente
    const payment = await Payment.findOne({
      userEmail: session.user.email,
      externalReference: externalReference,
      status: { $in: ['pending', 'in_process'] }
    });

    if (!payment) {
      logger.warn('VERIFY payment not found', { module: 'payments', step: 'find_payment', user: session.user.email, reference: externalReference });
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    // Verificar con MercadoPago usando el paymentId si está disponible
    let mercadopagoStatus = 'pending';
    let mercadopagoPaymentId = paymentId;

    if (paymentId) {
      try {
        // Importar MercadoPago SDK dinámicamente
        const { MercadoPagoConfig, Payment } = await import('mercadopago');
        
        const client = new MercadoPagoConfig({
          accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
          options: { timeout: 5000 }
        });

        const paymentApi = new Payment(client);
        
        // Obtener el estado real del pago desde MercadoPago
        const mercadopagoPayment = await paymentApi.get({ id: paymentId });
        
        mercadopagoStatus = mercadopagoPayment.status || 'pending';
        mercadopagoPaymentId = mercadopagoPayment.id?.toString() || paymentId;
        
        logger.info('VERIFY mercadopago status', { 
          module: 'payments', 
          step: 'mercadopago_check', 
          paymentId, 
          status: mercadopagoStatus,
          mercadopagoPaymentId 
        });

      } catch (mercadopagoError) {
        logger.error('VERIFY mercadopago error', { 
          module: 'payments', 
          step: 'mercadopago_error', 
          error: mercadopagoError instanceof Error ? mercadopagoError.message : 'Unknown error',
          paymentId 
        });
        
        // Si hay error con MercadoPago, no aprobar el pago
        return res.status(400).json({
          success: false,
          error: 'No se pudo verificar el estado del pago con MercadoPago',
          shouldRetry: true
        });
      }
    }

    // Solo aprobar si el estado de MercadoPago es 'approved'
    if (mercadopagoStatus !== 'approved') {
      logger.warn('VERIFY payment not approved', { 
        module: 'payments', 
        step: 'not_approved', 
        paymentId, 
        status: mercadopagoStatus 
      });
      
      return res.status(400).json({
        success: false,
        error: `El pago no ha sido aprobado. Estado actual: ${mercadopagoStatus}`,
        status: mercadopagoStatus,
        shouldRetry: mercadopagoStatus === 'pending' || mercadopagoStatus === 'in_process'
      });
    }

    // Actualizar el pago con el estado verificado
    payment.status = 'approved';
    payment.mercadopagoPaymentId = mercadopagoPaymentId;
    payment.paymentMethodId = 'verified_mercadopago';
    payment.paymentTypeId = 'verified_mercadopago';
    payment.installments = 1;
    payment.transactionDate = new Date();
    payment.updatedAt = new Date();
    
    // Agregar metadata de verificación
    if (!payment.metadata) {
      payment.metadata = {};
    }
    payment.metadata.verifiedWithMercadoPago = true;
    payment.metadata.verificationDate = new Date();
    payment.metadata.mercadopagoStatus = mercadopagoStatus;
    payment.metadata.mercadopagoPaymentId = mercadopagoPaymentId;

    await payment.save();
    logger.info('VERIFY payment approved', { 
      module: 'payments', 
      step: 'payment_approved', 
      paymentId: payment._id.toString(), 
      status: payment.status,
      mercadopagoStatus 
    });

    return res.status(200).json({
      success: true,
      message: 'Pago verificado y aprobado correctamente',
      payment: {
        id: payment._id,
        status: payment.status,
        service: payment.service,
        amount: payment.amount,
        currency: payment.currency,
        mercadopagoPaymentId: mercadopagoPaymentId,
        verified: true
      }
    });

  } catch (error) {
    logger.error('VERIFY error', { 
      module: 'payments', 
      step: 'error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    return res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor al verificar el pago',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
