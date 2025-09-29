import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Notification from '@/models/Notification';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    // Verificar si ya tiene notificaciones automáticas recientes
    const existingNotifications = await Notification.find({
      createdBy: 'sistema',
      isAutomatic: true,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
    }).limit(1);

    if (existingNotifications.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Notificaciones ya generadas recientemente',
        notifications: existingNotifications.length
      });
    }

    // Obtener pagos del usuario
    const payments = await Payment.find({ 
      userId: user._id,
      status: 'approved'
    }).sort({ transactionDate: -1 }).limit(5);

    // Obtener suscripciones activas
    const activeSubscriptions = [];
    const now = new Date();

    // Verificar suscripciones en diferentes arrays
    if (user.subscriptions && user.subscriptions.length > 0) {
      for (const subscription of user.subscriptions) {
        if (subscription.activa && (!subscription.fechaFin || new Date(subscription.fechaFin) > now)) {
          activeSubscriptions.push({
            service: subscription.tipo,
            expiryDate: subscription.fechaFin,
            startDate: subscription.fechaInicio
          });
        }
      }
    }

    if (user.suscripciones && user.suscripciones.length > 0) {
      for (const suscripcion of user.suscripciones) {
        if (suscripcion.activa && (!suscripcion.fechaVencimiento || new Date(suscripcion.fechaVencimiento) > now)) {
          activeSubscriptions.push({
            service: suscripcion.servicio,
            expiryDate: suscripcion.fechaVencimiento,
            startDate: suscripcion.fechaInicio
          });
        }
      }
    }

    if (user.activeSubscriptions && user.activeSubscriptions.length > 0) {
      for (const activeSub of user.activeSubscriptions) {
        if (activeSub.isActive && (!activeSub.expiryDate || new Date(activeSub.expiryDate) > now)) {
          activeSubscriptions.push({
            service: activeSub.service,
            expiryDate: activeSub.expiryDate,
            startDate: activeSub.startDate
          });
        }
      }
    }

    const createdNotifications = [];

    // 1. Crear notificaciones de pagos recientes
    for (const payment of payments.slice(0, 2)) {
      const daysAgo = Math.floor((now.getTime() - payment.transactionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysAgo <= 30) { // Solo pagos de los últimos 30 días
        const notification = new Notification({
          title: `💳 Pago procesado exitosamente`,
          message: `Tu suscripción a ${payment.service} ha sido renovada por $${payment.amount} ${payment.currency}`,
          type: 'pago',
          priority: 'alta',
          targetUsers: 'todos',
          icon: '💳',
          actionUrl: '/perfil',
          actionText: 'Ver Detalles',
          isActive: true,
          createdBy: 'sistema',
          isAutomatic: true,
          createdAt: payment.transactionDate,
          metadata: {
            paymentId: payment._id,
            service: payment.service,
            amount: payment.amount,
            currency: payment.currency,
            transactionDate: payment.transactionDate,
            automatic: true
          }
        });

        await notification.save();
        createdNotifications.push(notification);
      }
    }

    // 2. Crear notificaciones de suscripciones activas
    for (const subscription of activeSubscriptions) {
      if (subscription.expiryDate) {
        const daysUntilExpiry = Math.ceil((new Date(subscription.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
          // Notificación de vencimiento próximo
          const notification = new Notification({
            title: `⚠️ Próximo vencimiento`,
            message: `Tu suscripción a ${subscription.service} vence en ${daysUntilExpiry} día${daysUntilExpiry > 1 ? 's' : ''}`,
            type: 'advertencia',
            priority: 'alta',
            targetUsers: 'todos',
            icon: '⚠️',
            actionUrl: '/perfil',
            actionText: 'Renovar',
            isActive: true,
            createdBy: 'sistema',
            isAutomatic: true,
            metadata: {
              service: subscription.service,
              expiryDate: subscription.expiryDate,
              daysUntilExpiry,
              automatic: true
            }
          });

          await notification.save();
          createdNotifications.push(notification);
        }
      }
    }

    // 3. Crear notificaciones de contenido nuevo (si tiene suscripciones activas)
    if (activeSubscriptions.length > 0) {
      const services = activeSubscriptions.map(sub => sub.service);
      
      if (services.includes('TraderCall')) {
        const notification = new Notification({
          title: `📊 Nuevo análisis disponible`,
          message: `Se ha publicado un nuevo análisis en Trader Call. ¡Revisa las últimas oportunidades de trading!`,
          type: 'novedad',
          priority: 'media',
          targetUsers: 'todos',
          icon: '📊',
          actionUrl: '/alertas/trader-call',
          actionText: 'Ver Análisis',
          isActive: true,
          createdBy: 'sistema',
          isAutomatic: true,
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
          metadata: {
            service: 'TraderCall',
            automatic: true
          }
        });

        await notification.save();
        createdNotifications.push(notification);
      }

      if (services.includes('SmartMoney')) {
        const notification = new Notification({
          title: `🧠 Nuevo análisis Smart Money`,
          message: `Se ha publicado un nuevo análisis de flujo institucional en Smart Money. ¡Descubre las oportunidades del dinero inteligente!`,
          type: 'novedad',
          priority: 'media',
          targetUsers: 'todos',
          icon: '🧠',
          actionUrl: '/alertas/smart-money',
          actionText: 'Ver Análisis',
          isActive: true,
          createdBy: 'sistema',
          isAutomatic: true,
          createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Hace 1 día
          metadata: {
            service: 'SmartMoney',
            automatic: true
          }
        });

        await notification.save();
        createdNotifications.push(notification);
      }
    }

    // 4. Crear notificación de bienvenida si es usuario nuevo
    const userCreatedDaysAgo = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (userCreatedDaysAgo <= 7) {
      const notification = new Notification({
        title: `👋 ¡Bienvenido a Nahuel Lozano Trading!`,
        message: `Gracias por unirte a nuestra comunidad. Explora nuestros servicios y comienza tu journey en el trading profesional.`,
        type: 'bienvenida',
        priority: 'alta',
        targetUsers: 'todos',
        icon: '👋',
        actionUrl: '/',
        actionText: 'Explorar Servicios',
        isActive: true,
        createdBy: 'sistema',
        isAutomatic: true,
        createdAt: user.createdAt,
        metadata: {
          welcome: true,
          automatic: true
        }
      });

      await notification.save();
      createdNotifications.push(notification);
    }

    return res.status(200).json({
      success: true,
      message: `Se generaron ${createdNotifications.length} notificaciones automáticas`,
      notifications: createdNotifications.map(n => ({
        id: n._id,
        title: n.title,
        type: n.type,
        createdAt: n.createdAt
      })),
      userData: {
        payments: payments.length,
        activeSubscriptions: activeSubscriptions.length,
        userCreatedDaysAgo
      }
    });

  } catch (error) {
    console.error('Error generando notificaciones automáticas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
