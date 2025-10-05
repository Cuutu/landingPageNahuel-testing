import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar sesión y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar si es admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || adminUser.role !== 'admin') {
      console.log('❌ [PAYMENTS] Acceso denegado:', {
        email: session.user.email,
        userFound: !!adminUser,
        userRole: adminUser?.role,
        isAdmin: adminUser?.role === 'admin'
      });
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    console.log('✅ [PAYMENTS] Acceso de admin confirmado:', session.user.email);

    // Obtener pagos del modelo Payment (aprobados)
    const payments = await Payment.find({ status: 'approved' })
      .populate('userId', 'name email phone cuit')
      .sort({ userEmail: 1, transactionDate: -1 })
      .limit(5000);

    // Obtener suscripciones mensuales completadas
    const monthlySubscriptions = await MonthlyTrainingSubscription.find({ 
      paymentStatus: 'completed' 
    })
      .sort({ userEmail: 1, createdAt: -1 })
      .limit(5000);

    // Procesar pagos del modelo Payment
    const processedPayments = payments.map(payment => ({
      id: payment._id.toString(),
      userEmail: payment.userEmail,
      userName: (payment as any).userId?.name || 'Usuario',
      userPhone: (payment as any).userId?.phone || '',
      userCuit: (payment as any).userId?.cuit || (payment as any).userId?.cuil || '',
      service: payment.service,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status as 'approved' | 'pending' | 'rejected' | 'cancelled',
      transactionDate: payment.transactionDate,
      expiryDate: payment.expiryDate,
      paymentMethod: 'MercadoPago',
      mercadopagoPaymentId: payment.mercadopagoPaymentId,
      reason: payment.metadata?.reason || payment.metadata?.type || payment.service,
      source: 'payment' // Indicador de origen
    }));

    // Procesar suscripciones mensuales como pagos
    const processedSubscriptions = await Promise.all(monthlySubscriptions.map(async (subscription) => {
      // Buscar información del usuario
      const user = await User.findOne({ email: subscription.userEmail });
      
      return {
        id: subscription._id.toString(),
        userEmail: subscription.userEmail,
        userName: user?.name || subscription.userName || 'Usuario',
        userPhone: user?.phone || '',
        userCuit: user?.cuit || user?.cuil || '',
        service: `${subscription.trainingType}-Monthly`, // Ej: SwingTrading-Monthly
        amount: subscription.paymentAmount,
        currency: 'ARS',
        status: 'approved' as const,
        transactionDate: subscription.createdAt,
        expiryDate: subscription.endDate,
        paymentMethod: 'MercadoPago',
        mercadopagoPaymentId: subscription.mercadopagoPaymentId || '',
        reason: `Suscripción Mensual - ${getMonthName(subscription.subscriptionMonth)} ${subscription.subscriptionYear}`,
        source: 'monthly-subscription' // Indicador de origen
      };
    }));

    // Combinar ambos arrays y ordenar por fecha
    const allPayments = [...processedPayments, ...processedSubscriptions]
      .sort((a, b) => {
        const dateA = new Date(a.transactionDate).getTime();
        const dateB = new Date(b.transactionDate).getTime();
        return dateB - dateA; // Más recientes primero
      });

    return res.status(200).json({
      success: true,
      payments: allPayments,
      total: allPayments.length,
      breakdown: {
        regularPayments: processedPayments.length,
        monthlySubscriptions: processedSubscriptions.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
}

// Helper function para obtener nombre del mes
function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || 'Mes desconocido';
}
