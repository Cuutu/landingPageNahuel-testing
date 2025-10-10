import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener historial de pagos
    const payments = await Payment.find({ 
      userId: user._id,
      status: { $in: ['approved', 'pending', 'rejected', 'cancelled'] }
    })
    .sort({ transactionDate: -1 })
    .limit(50);

    // Procesar suscripciones activas
    const activeSubscriptions = [];
    const now = new Date();

    // Verificar suscripciones activas en el array 'subscriptions'
    if (user.subscriptions && user.subscriptions.length > 0) {
      for (const subscription of user.subscriptions) {
        if (subscription.activa) {
          // Verificar si la suscripción no ha expirado
          const isExpired = subscription.fechaFin && new Date(subscription.fechaFin) < now;
          
          if (!isExpired) {
            activeSubscriptions.push({
              service: subscription.tipo,
              status: 'active' as const,
              startDate: subscription.fechaInicio,
              expiryDate: subscription.fechaFin || new Date(subscription.fechaInicio.getTime() + 30 * 24 * 60 * 60 * 1000),
              amount: subscription.precio || 0,
              currency: 'ARS',
              paymentMethod: 'Asignación Manual',
              transactionId: undefined
            });
          }
        }
      }
    }

    // También verificar en el array 'suscripciones' (legacy)
    if (user.suscripciones && user.suscripciones.length > 0) {
      for (const suscripcion of user.suscripciones) {
        if (suscripcion.activa) {
          // Verificar si la suscripción no ha expirado
          const isExpired = suscripcion.fechaVencimiento && new Date(suscripcion.fechaVencimiento) < now;
          
          if (!isExpired) {
            // Verificar si ya no existe en activeSubscriptions
            const alreadyExists = activeSubscriptions.some(sub => sub.service === suscripcion.servicio);
            
            if (!alreadyExists) {
              activeSubscriptions.push({
                service: suscripcion.servicio,
                status: 'active' as const,
                startDate: suscripcion.fechaInicio,
                expiryDate: suscripcion.fechaVencimiento,
                amount: 0, // No hay precio en el array legacy
                currency: 'ARS',
                paymentMethod: 'Sistema Anterior',
                transactionId: undefined
              });
            }
          }
        }
      }
    }

    // ✅ IMPORTANTE: Verificar también en activeSubscriptions (MercadoPago)
    if (user.activeSubscriptions && user.activeSubscriptions.length > 0) {
      for (const activeSub of user.activeSubscriptions) {
        if (activeSub.isActive) {
          // Verificar si la suscripción no ha expirado
          const isExpired = activeSub.expiryDate && new Date(activeSub.expiryDate) < now;
          
          if (!isExpired) {
            // Verificar si ya no existe en activeSubscriptions
            const alreadyExists = activeSubscriptions.some(sub => sub.service === activeSub.service);
            
            if (!alreadyExists) {
              activeSubscriptions.push({
                service: activeSub.service,
                status: 'active' as const,
                startDate: activeSub.startDate,
                expiryDate: activeSub.expiryDate,
                amount: activeSub.amount || 0,
                currency: activeSub.currency || 'ARS',
                paymentMethod: 'MercadoPago',
                transactionId: activeSub.mercadopagoPaymentId || 'mp-subscription'
              });
            }
          }
        }
      }
    }

    // Procesar historial de pagos
    const paymentHistory = payments.map(payment => ({
      id: payment._id.toString(),
      service: payment.service,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status as 'approved' | 'pending' | 'rejected' | 'cancelled',
      transactionDate: payment.transactionDate,
      expiryDate: payment.expiryDate,
      paymentMethod: 'MercadoPago',
      mercadopagoPaymentId: payment.mercadopagoPaymentId
    }));

    // Obtener suscripciones expiradas recientemente
    const expiredSubscriptions = payments
      .filter(payment => 
        payment.status === 'approved' && 
        payment.expiryDate < now &&
        payment.expiryDate > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
      )
      .map(payment => ({
        service: payment.service,
        status: 'expired' as const,
        startDate: payment.transactionDate,
        expiryDate: payment.expiryDate,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: 'MercadoPago',
        transactionId: payment.mercadopagoPaymentId
      }));

    const allSubscriptions = [...activeSubscriptions, ...expiredSubscriptions];

    return res.status(200).json({
      success: true,
      subscriptions: allSubscriptions,
      paymentHistory,
      stats: {
        activeCount: activeSubscriptions.length,
        totalPayments: paymentHistory.length,
        totalSpent: paymentHistory
          .filter(p => p.status === 'approved')
          .reduce((total, p) => total + p.amount, 0)
      }
    });

  } catch (error) {
    console.error('Error obteniendo suscripciones:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
}
