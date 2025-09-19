import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * ✅ NUEVO: API para procesamiento inmediato de pagos
 * Se ejecuta cuando el usuario regresa del checkout de MercadoPago
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

    console.log(`🚀 [IMMEDIATE-PROCESS] Procesamiento inmediato para: ${session.user.email}, ref: ${externalReference}`);

    // Buscar el pago pendiente
    const payment = await Payment.findOne({
      userEmail: session.user.email,
      externalReference: externalReference,
      status: 'pending'
    });

    if (!payment) {
      console.log(`⚠️ [IMMEDIATE-PROCESS] No se encontró pago pendiente para: ${externalReference}`);
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    // Buscar el usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // ✅ PROCESAMIENTO INMEDIATO: Asumir que el pago es exitoso si el usuario regresó
    console.log(`✅ [IMMEDIATE-PROCESS] Procesando pago inmediatamente: ${payment._id}`);

    // Actualizar el pago
    payment.status = 'approved';
    payment.mercadopagoPaymentId = paymentId || `immediate_${Date.now()}`;
    payment.paymentMethodId = 'immediate_processing';
    payment.paymentTypeId = 'immediate_processing';
    payment.installments = 1;
    payment.transactionDate = new Date();
    payment.updatedAt = new Date();
    
    // Agregar metadata de procesamiento inmediato
    if (!payment.metadata) {
      payment.metadata = {};
    }
    payment.metadata.processedImmediately = true;
    payment.metadata.immediateProcessingDate = new Date();
    payment.metadata.processedOnReturn = true;

    await payment.save();

    // Procesar la suscripción según el tipo de servicio
    const service = payment.service;
    const isSubscription = ['TraderCall', 'SmartMoney', 'CashFlow'].includes(service);
    const isTraining = ['SwingTrading', 'DowJones'].includes(service);

    if (isSubscription) {
      // Procesar suscripción inmediatamente
      await user.renewSubscription(
        service,
        payment.amount,
        payment.currency,
        payment.mercadopagoPaymentId
      );
      
      console.log(`✅ [IMMEDIATE-PROCESS] Suscripción ${service} procesada para: ${user.email}`);
      
    } else if (isTraining) {
      // Procesar entrenamiento inmediatamente
      const nuevoEntrenamiento = {
        tipo: service,
        fechaInscripcion: new Date(),
        progreso: 0,
        activo: true,
        precio: payment.amount,
        metodoPago: 'mercadopago',
        transactionId: payment.mercadopagoPaymentId
      };

      user.entrenamientos.push(nuevoEntrenamiento);
      await user.save();
      
      console.log(`✅ [IMMEDIATE-PROCESS] Entrenamiento ${service} procesado para: ${user.email}`);
    }

    console.log(`🎉 [IMMEDIATE-PROCESS] Pago ${payment._id} procesado inmediatamente`);

    return res.status(200).json({
      success: true,
      message: 'Pago procesado inmediatamente',
      service: service,
      isSubscription: isSubscription,
      isTraining: isTraining
    });

  } catch (error) {
    console.error('❌ [IMMEDIATE-PROCESS] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
