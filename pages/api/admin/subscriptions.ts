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

    // 2. ✅ Obtener usuarios con activeSubscriptions (activas O expiradas recientemente)
    const usersWithActiveSubscriptions = await User.find({
      'activeSubscriptions.0': { $exists: true }
    }).select('name email activeSubscriptions');

    // 3. ✅ NUEVO: Obtener usuarios con subscriptions del admin (activas O expiradas recientemente)
    const usersWithAdminSubscriptions = await User.find({
      'subscriptions.0': { $exists: true }
    }).select('name email subscriptions');

    // Procesar suscripciones activas
    const subscriptions: any[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const services = ['TraderCall', 'SmartMoney', 'CashFlow', 'SwingTrading', 'DowJones'];

    // ✅ Procesar activeSubscriptions de usuarios (activas y expiradas recientes)
    for (const user of usersWithActiveSubscriptions) {
      for (const activeSub of user.activeSubscriptions || []) {
        const expiryDate = new Date(activeSub.expiryDate);
        const isExpired = expiryDate < now;
        const expiredRecently = expiryDate > thirtyDaysAgo;
        
        // Incluir si está activa O si expiró recientemente
        if (activeSub.isActive || (isExpired && expiredRecently)) {
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const status = isExpired ? 'expired' : 'active';

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
            source: 'activeSubscriptions'
          });
        }
      }
    }

    // ✅ NUEVO: Procesar subscriptions del admin (activas y expiradas recientes)
    for (const user of usersWithAdminSubscriptions) {
      for (const adminSub of user.subscriptions || []) {
        const expiryDate = adminSub.fechaFin ? new Date(adminSub.fechaFin) : null;
        if (!expiryDate) continue;
        
        const isExpired = expiryDate < now;
        const expiredRecently = expiryDate > thirtyDaysAgo;
        
        // Verificar si ya existe en subscriptions (evitar duplicados)
        const alreadyExists = subscriptions.some(
          s => s.userEmail === user.email && s.service === adminSub.tipo
        );
        
        // Incluir si está activa O si expiró recientemente (y no es duplicada)
        if (!alreadyExists && (adminSub.activa || (isExpired && expiredRecently))) {
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const status = isExpired ? 'expired' : 'active';

          subscriptions.push({
            id: adminSub._id || `admin_${user._id}_${adminSub.tipo}`,
            userEmail: user.email,
            userName: user.name || user.email.split('@')[0],
            service: adminSub.tipo,
            status,
            startDate: adminSub.fechaInicio.toISOString(),
            expiryDate: expiryDate.toISOString(),
            amount: adminSub.precio || 0,
            currency: 'ARS',
            paymentMethod: 'Manual',
            transactionId: 'N/A',
            daysUntilExpiry,
            source: 'subscriptions (admin)'
          });
        }
      }
    }

    for (const payment of payments) {
      if (payment.expiryDate > now) {
        // Evitar duplicados si ya existe desde activeSubscriptions o subscriptions
        const alreadyExists = subscriptions.some(
          s => s.userEmail === payment.userEmail && s.service === payment.service
        );
        if (alreadyExists) continue;
        
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

    // Obtener suscripciones expiradas recientemente desde Payments (últimos 30 días)
    // (thirtyDaysAgo ya está definido arriba)
    const expiredPayments = await Payment.find({
      status: 'approved',
      expiryDate: { $lt: now, $gt: thirtyDaysAgo }
    })
    .populate('userId', 'name email')
    .sort({ expiryDate: -1 });

    for (const payment of expiredPayments) {
      // Evitar duplicados si ya existe desde activeSubscriptions o subscriptions
      const alreadyExists = subscriptions.some(
        s => s.userEmail === payment.userEmail && s.service === payment.service
      );
      if (alreadyExists) continue;
      
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
