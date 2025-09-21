import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import User from '@/models/User';
import { logger } from '@/lib/logger';

/**
 * API para reintentar un pago fallido
 * POST: Crear nuevo intento de pago basado en uno fallido
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

    const { originalPaymentId, service, amount, currency } = req.body;
    
    if (!originalPaymentId || !service || !amount || !currency) {
      return res.status(400).json({ 
        success: false,
        error: 'Datos requeridos: originalPaymentId, service, amount, currency' 
      });
    }

    await dbConnect();

    logger.info('RETRY start', { 
      module: 'payments', 
      step: 'start', 
      user: session.user.email, 
      originalPaymentId,
      service,
      amount 
    });

    // Buscar el pago original
    const originalPayment = await Payment.findOne({
      _id: originalPaymentId,
      userEmail: session.user.email,
      status: 'rejected'
    });

    if (!originalPayment) {
      logger.warn('RETRY original payment not found', { 
        module: 'payments', 
        step: 'find_original', 
        user: session.user.email, 
        originalPaymentId 
      });
      return res.status(404).json({
        success: false,
        error: 'Pago original no encontrado o no es elegible para reintento'
      });
    }

    // Verificar que no haya un pago exitoso reciente para el mismo servicio
    const recentSuccessfulPayment = await Payment.findOne({
      userEmail: session.user.email,
      service: service,
      status: 'approved',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
    });

    if (recentSuccessfulPayment) {
      logger.warn('RETRY recent successful payment exists', { 
        module: 'payments', 
        step: 'check_recent', 
        user: session.user.email, 
        service,
        recentPaymentId: recentSuccessfulPayment._id.toString()
      });
      return res.status(400).json({
        success: false,
        error: 'Ya tienes un pago exitoso reciente para este servicio',
        existingPaymentId: recentSuccessfulPayment._id.toString()
      });
    }

    // Crear nuevo pago para reintento
    const retryPayment = new Payment({
      userEmail: session.user.email,
      userId: originalPayment.userId,
      service: service,
      amount: amount,
      currency: currency,
      status: 'pending',
      externalReference: `retry_${Date.now()}_${originalPaymentId}`,
      metadata: {
        isRetry: true,
        originalPaymentId: originalPaymentId,
        retryReason: 'User requested retry after failed payment',
        retryDate: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await retryPayment.save();

    logger.info('RETRY payment created', { 
      module: 'payments', 
      step: 'payment_created', 
      retryPaymentId: retryPayment._id.toString(),
      originalPaymentId: originalPaymentId
    });

    // Marcar el pago original como "retried"
    originalPayment.metadata = originalPayment.metadata || {};
    originalPayment.metadata.retried = true;
    originalPayment.metadata.retryPaymentId = retryPayment._id.toString();
    originalPayment.metadata.retryDate = new Date();
    await originalPayment.save();

    // Determinar la URL de checkout según el servicio
    let checkoutUrl = '';
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    if (['TraderCall', 'SmartMoney', 'CashFlow'].includes(service)) {
      checkoutUrl = `${baseUrl}/checkout?service=${service}&amount=${amount}&retry=${retryPayment._id}`;
    } else if (['SwingTrading', 'DowJones'].includes(service)) {
      checkoutUrl = `${baseUrl}/checkout-training?service=${service}&amount=${amount}&retry=${retryPayment._id}`;
    } else if (service.includes('booking')) {
      checkoutUrl = `${baseUrl}/reservas?retry=${retryPayment._id}`;
    } else {
      checkoutUrl = `${baseUrl}/`;
    }

    logger.info('RETRY completed', { 
      module: 'payments', 
      step: 'completed', 
      retryPaymentId: retryPayment._id.toString(),
      checkoutUrl: checkoutUrl
    });

    return res.status(200).json({
      success: true,
      message: 'Pago de reintento creado exitosamente',
      retryPaymentId: retryPayment._id.toString(),
      checkoutUrl: checkoutUrl,
      service: service,
      amount: amount,
      currency: currency
    });

  } catch (error) {
    console.error('❌ [RETRY-PAYMENT] Error:', error);
    logger.error('RETRY error', { 
      module: 'payments', 
      step: 'error', 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
