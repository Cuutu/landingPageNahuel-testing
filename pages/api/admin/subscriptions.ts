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

    // Verificar sesión y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar si es admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || adminUser.role !== 'admin') {
      console.log('❌ [SUBSCRIPTIONS] Acceso denegado:', {
        email: session.user.email,
        userFound: !!adminUser,
        userRole: adminUser?.role,
        isAdmin: adminUser?.role === 'admin'
      });
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    console.log('✅ [SUBSCRIPTIONS] Acceso de admin confirmado:', session.user.email);

    // ✅ IMPORTANTE: Obtener suscripciones de AMBAS fuentes
    
    // 1. Obtener todos los pagos aprobados (método anterior)
    const payments = await Payment.find({ 
      status: 'approved'
    })
    .populate('userId', 'name email')
    .sort({ transactionDate: -1 });

    // 2. ✅ NUEVO: Obtener usuarios con activeSubscriptions activas
    const usersWithActiveSubscriptions = await User.find({
      'activeSubscriptions.0': { $exists: true }, // Tiene al menos 1 suscripción
      'activeSubscriptions.isActive': true
    }).select('name email activeSubscriptions');

    // Procesar suscripciones activas
    const subscriptions = [];
    const now = new Date();
    const services = ['TraderCall', 'SmartMoney', 'CashFlow', 'SwingTrading', 'DowJones'];

    // ✅ NUEVO: Procesar activeSubscriptions de usuarios
    for (const user of usersWithActiveSubscriptions) {
      for (const activeSub of user.activeSubscriptions || []) {
        if (!activeSub.isActive) continue;
        
        const expiryDate = new Date(activeSub.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const status = expiryDate > now ? 'active' : 'expired';

        subscriptions.push({
          id: activeSub._id || `active_${user._id}_${activeSub.service}`,
          userEmail: user.email,
          userName: user.name || user.email.split('@')[0],
          service: activeSub.service,
          status,
          startDate: activeSub.startDate.toISOString(),
          expiryDate: activeSub.expiryDate.toISOString(),
          amount: activeSub.amount || 0,
          currency: activeSub.currency || 'ARS',
          paymentMethod: activeSub.mercadopagoPaymentId ? 'MercadoPago' : 'Manual',
          transactionId: activeSub.mercadopagoPaymentId || 'N/A',
          daysUntilExpiry,
          source: 'activeSubscriptions' // Para debug
        });
      }
    }

    for (const payment of payments) {
      if (payment.expiryDate > now) {
        const daysUntilExpiry = Math.ceil((payment.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        subscriptions.push({
          id: payment._id.toString(),
          userEmail: payment.userEmail,
          userName: payment.userId?.name || 'Usuario',
          service: payment.service,
          status: 'active' as const,
          startDate: payment.transactionDate,
          expiryDate: payment.expiryDate,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: 'MercadoPago',
          transactionId: payment.mercadopagoPaymentId,
          daysUntilExpiry
        });
      }
    }

    // Obtener suscripciones expiradas recientemente (últimos 30 días)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiredPayments = await Payment.find({
      status: 'approved',
      expiryDate: { $lt: now, $gt: thirtyDaysAgo }
    })
    .populate('userId', 'name email')
    .sort({ expiryDate: -1 });

    for (const payment of expiredPayments) {
      const daysSinceExpiry = Math.ceil((now.getTime() - payment.expiryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      subscriptions.push({
        id: payment._id.toString(),
        userEmail: payment.userEmail,
        userName: payment.userId?.name || 'Usuario',
        service: payment.service,
        status: 'expired' as const,
        startDate: payment.transactionDate,
        expiryDate: payment.expiryDate,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: 'MercadoPago',
        transactionId: payment.mercadopagoPaymentId,
        daysUntilExpiry: -daysSinceExpiry
      });
    }

    // Calcular estadísticas
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'active');
    const expiringSoon = activeSubscriptions.filter(sub => sub.daysUntilExpiry <= 7).length;
    
    const totalRevenue = payments.reduce((total, payment) => total + payment.amount, 0);
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.transactionDate);
      return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
    });
    const monthlyRevenue = monthlyPayments.reduce((total, payment) => total + payment.amount, 0);

    const pendingPayments = await Payment.countDocuments({ status: 'pending' });

    const stats = {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      expiringSoon,
      totalRevenue,
      monthlyRevenue,
      pendingPayments
    };

    return res.status(200).json({
      success: true,
      subscriptions,
      stats
    });

  } catch (error) {
    console.error('Error obteniendo suscripciones:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
}
