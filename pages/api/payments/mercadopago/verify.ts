import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import { getMercadoPagoPayment } from '@/lib/mercadopago';

/**
 * API para verificar el estado de un pago
 * GET: Verificar estado de pago por referencia
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/payments/mercadopago/verify`);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();
    console.log('✅ Conectado a MongoDB');

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.log('❌ No hay sesión activa');
      return res.status(401).json({ 
        success: false,
        error: 'Debes iniciar sesión para verificar el pago' 
      });
    }

    console.log('✅ Sesión verificada:', session.user.email);

    const { reference } = req.query;

    if (!reference || typeof reference !== 'string') {
      console.log('❌ Referencia de pago no válida:', reference);
      return res.status(400).json({ 
        success: false,
        error: 'Referencia de pago requerida' 
      });
    }

    console.log('🔍 Buscando pago con referencia:', reference);

    // Buscar el pago en nuestra base de datos
    const payment = await Payment.findOne({ 
      externalReference: reference,
      userEmail: session.user.email
    });

    if (!payment) {
      console.log('❌ Pago no encontrado en la base de datos');
      return res.status(404).json({ 
        success: false,
        error: 'Pago no encontrado' 
      });
    }

    console.log('✅ Pago encontrado:', {
      id: payment._id,
      status: payment.status,
      mercadopagoPaymentId: payment.mercadopagoPaymentId
    });

    // Si el pago ya tiene un ID de MercadoPago, verificar su estado
    if (payment.mercadopagoPaymentId) {
      try {
        console.log('🔍 Verificando pago en MercadoPago:', payment.mercadopagoPaymentId);
        const paymentResult = await getMercadoPagoPayment(payment.mercadopagoPaymentId);
        
        if (!paymentResult.success) {
          throw new Error(paymentResult.error || 'Error obteniendo información del pago');
        }

        const paymentInfo = paymentResult.payment;
        
        if (!paymentInfo) {
          throw new Error('Información del pago no disponible');
        }
        
        console.log('✅ Estado del pago en MercadoPago:', paymentInfo.status);
        
        // Actualizar estado en nuestra base de datos si cambió
        if (payment.status !== paymentInfo.status) {
          payment.status = paymentInfo.status;
          payment.updatedAt = new Date();
          await payment.save();
          console.log('✅ Estado del pago actualizado en la base de datos');
        }

        return res.status(200).json({
          success: true,
          status: paymentInfo.status,
          paymentId: paymentInfo.id,
          amount: paymentInfo.transaction_amount,
          currency: paymentInfo.currency_id,
          externalReference: paymentInfo.external_reference,
          message: 'Estado del pago verificado'
        });

      } catch (error) {
        console.error('❌ Error verificando pago en MercadoPago:', error);
        
        // Si no podemos verificar en MercadoPago, devolver el estado local
        return res.status(200).json({
          success: true,
          status: payment.status,
          paymentId: payment.mercadopagoPaymentId,
          amount: payment.amount,
          currency: payment.currency,
          externalReference: payment.externalReference,
          message: 'Estado del pago (local)'
        });
      }
    } else {
      // Si no tiene ID de MercadoPago, devolver estado pendiente
      console.log('⏳ Pago pendiente de procesamiento');
      return res.status(200).json({
        success: true,
        status: 'pending',
        paymentId: null,
        amount: payment.amount,
        currency: payment.currency,
        externalReference: payment.externalReference,
        message: 'Pago pendiente de procesamiento'
      });
    }

  } catch (error) {
    console.error('❌ Error verificando pago:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Inténtalo nuevamente.',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 