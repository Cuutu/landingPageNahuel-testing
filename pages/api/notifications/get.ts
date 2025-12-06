import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import User from '@/models/User';
import UserSubscription from '@/models/UserSubscription';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetNotifications(req, res);
  } else if (req.method === 'POST') {
    return handleMarkAsRead(req, res);
  } else {
    return res.status(405).json({ message: 'Método no permitido' });
  }
}

async function handleGetNotifications(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    await dbConnect();

    // Obtener parámetros de query
    const { 
      page = '1', 
      limit = '10', 
      type,
      priority,
      unreadOnly = 'false'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Obtener información del usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const userRole = user.role || 'normal';
    const userEmail = session.user.email;
    const userCreatedAt = user.createdAt; // Fecha de creación de la cuenta del usuario

    // Construir query base
    const now = new Date();
    let query: any = {
      isActive: true,
      createdAt: { $gte: userCreatedAt }, // Solo notificaciones creadas después del registro del usuario
      $and: [
        // Filtro de expiración
        {
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } }
          ]
        }
      ]
    };

    // ✅ CORREGIDO: Obtener suscripciones activas de AMBAS fuentes
    // 1. UserSubscription (modelo separado) - usa userEmail, no userId
    const userSubscriptions = await UserSubscription.find({
      userEmail: user.email.toLowerCase().trim(),
    }).lean();

    // 2. User.activeSubscriptions (suscripciones de MercadoPago)
    const userActiveSubscriptions = user.activeSubscriptions || [];
    
    // ✅ CORREGIDO: Combinar suscripciones de ambas fuentes
    const allActiveSubscriptions: Array<{ serviceType: string }> = [];
    
    // Agregar de UserSubscription si tiene suscripciones activas
    userSubscriptions.forEach((us: any) => {
      if (us.subscriptions?.alertas_trader) {
        allActiveSubscriptions.push({ serviceType: 'TraderCall' });
      }
      if (us.subscriptions?.alertas_smart) {
        allActiveSubscriptions.push({ serviceType: 'SmartMoney' });
      }
      if (us.subscriptions?.alertas_cashflow) {
        allActiveSubscriptions.push({ serviceType: 'CashFlow' });
      }
    });
    
    // ✅ CORREGIDO: Agregar de User.activeSubscriptions (MercadoPago)
    userActiveSubscriptions.forEach((activeSub: any) => {
      if (activeSub.isActive && new Date(activeSub.expiryDate) >= now) {
        // Evitar duplicados
        const alreadyExists = allActiveSubscriptions.some(
          sub => sub.serviceType === activeSub.service
        );
        if (!alreadyExists) {
          allActiveSubscriptions.push({ serviceType: activeSub.service });
        }
      }
    });
    
    // ✅ CORREGIDO: También verificar suscripciones legacy en User
    if (user.suscripciones && Array.isArray(user.suscripciones)) {
      user.suscripciones.forEach((sub: any) => {
        if (sub.activa && new Date(sub.fechaVencimiento) >= now) {
          const alreadyExists = allActiveSubscriptions.some(
            s => s.serviceType === sub.servicio
          );
          if (!alreadyExists) {
            allActiveSubscriptions.push({ serviceType: sub.servicio });
          }
        }
      });
    }
    
    // ✅ CORREGIDO: También verificar subscriptions intermedio en User
    if (user.subscriptions && Array.isArray(user.subscriptions)) {
      user.subscriptions.forEach((sub: any) => {
        if (sub.activa && (!sub.fechaFin || new Date(sub.fechaFin) >= now)) {
          const alreadyExists = allActiveSubscriptions.some(
            s => s.serviceType === sub.tipo
          );
          if (!alreadyExists) {
            allActiveSubscriptions.push({ serviceType: sub.tipo });
          }
        }
      });
    }

    console.log(`📊 [NOTIFICATIONS GET] Usuario: ${user.email}, Rol: ${userRole}`);
    console.log(`📊 [NOTIFICATIONS GET] Suscripciones activas encontradas:`, allActiveSubscriptions.map(s => s.serviceType));

    // Crear array con los tipos de alertas permitidos según suscripciones
    const allowedAlertTypes: string[] = ['todos']; // Todos los usuarios ven 'todos'

    // Filtrar por tipo de usuario
    if (userRole === 'admin') {
      // ✅ CORREGIDO: Admin ve todo, pero sin duplicados
      // Si el admin también tiene suscripciones, no duplicar los tipos
      query.targetUsers = { 
        $in: ['todos', 'admin', 'alertas_trader', 'alertas_smart', 'alertas_cashflow'] 
      };
    } else {
      // Para usuarios normales y suscriptores, verificar suscripciones activas
      if (userRole === 'suscriptor') {
        allowedAlertTypes.push('suscriptores');
      }

      // ✅ CORREGIDO: Agregar tipos de alertas según suscripciones activas de TODAS las fuentes
      for (const subscription of allActiveSubscriptions) {
        if (subscription.serviceType === 'TraderCall' && !allowedAlertTypes.includes('alertas_trader')) {
          allowedAlertTypes.push('alertas_trader');
        } else if (subscription.serviceType === 'SmartMoney' && !allowedAlertTypes.includes('alertas_smart')) {
          allowedAlertTypes.push('alertas_smart');
        } else if (subscription.serviceType === 'CashFlow' && !allowedAlertTypes.includes('alertas_cashflow')) {
          allowedAlertTypes.push('alertas_cashflow');
        }
      }

      console.log(`📊 [NOTIFICATIONS GET] Tipos de alertas permitidos para ${user.email}:`, allowedAlertTypes);

      // Solo mostrar notificaciones de tipos permitidos
      query.targetUsers = { $in: allowedAlertTypes };
    }

    // Filtros adicionales
    if (type) {
      // ✅ CORREGIDO: Si el usuario no es admin y pide ver sistema/pago, no devolver nada
      if (userRole !== 'admin' && ['sistema', 'pago'].includes(type as string)) {
        query.type = { $in: [] }; // Query imposible - no devolverá resultados
      } else {
        query.type = type;
      }
    } else if (userRole !== 'admin') {
      // ✅ CORREGIDO: Las notificaciones de sistema/pago solo se muestran a administradores
      // Si no hay filtro de tipo específico y el usuario no es admin, excluir sistema y pago
      query.type = { $nin: ['sistema', 'pago'] };
    }

    if (priority) {
      query.priority = priority;
    }

    // Excluir notificaciones descartadas por el usuario
    query.dismissedBy = { $ne: userEmail };

    // Filtro para solo no leídas
    if (unreadOnly === 'true') {
      query.readBy = { $ne: userEmail };
    }

    // ✅ CORREGIDO: Obtener notificaciones sin duplicados
    // Usar distinct para evitar duplicados por ID
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 }) // Ordenar por tiempo de creación (más recientes primero)
      .limit(limitNum)
      .skip(skip)
      .lean();
    
    // ✅ CORREGIDO: Eliminar duplicados por _id (por si acaso hay algún problema en la query)
    const uniqueNotifications = notifications.filter((notif: any, index: number, self: any[]) => 
      index === self.findIndex((n: any) => String(n._id) === String(notif._id))
    );

    // Contar total para paginación (usar query sin duplicados)
    const total = uniqueNotifications.length;

    // Contar no leídas
    const unreadQuery = { ...query, readBy: { $ne: userEmail } };
    const unreadNotifications = await Notification.find(unreadQuery).lean();
    const uniqueUnreadNotifications = unreadNotifications.filter((notif: any, index: number, self: any[]) => 
      index === self.findIndex((n: any) => String(n._id) === String(notif._id))
    );
    const unreadCount = uniqueUnreadNotifications.length;

    // Formatear las notificaciones (usar uniqueNotifications)
    const formattedNotifications = uniqueNotifications.map(notification => ({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      icon: notification.icon,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
      isRead: notification.readBy?.includes(userEmail) || false,
      isAutomatic: notification.isAutomatic || false,
      // Calcular tiempo relativo
      timeAgo: getTimeAgo(notification.createdAt),
      // Información adicional para administradores
      ...(userRole === 'admin' && {
        targetUsers: notification.targetUsers,
        isActive: notification.isActive,
        createdBy: notification.createdBy,
        totalReads: notification.totalReads || 0,
        relatedAlertId: notification.relatedAlertId
      })
    }));

    return res.status(200).json({
      notifications: formattedNotifications,
      pagination: {
        current: pageNum,
        total: Math.ceil(total / limitNum),
        hasMore: skip + limitNum < total,
        totalItems: total
      },
      unreadCount,
      userRole // Devolver el rol para que el frontend sepa si es admin
    });

  } catch (error) {
    console.error('❌ Error al obtener notificaciones:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}

async function handleMarkAsRead(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    await dbConnect();

    const { notificationId, markAllAsRead = false } = req.body;
    const userEmail = session.user.email;

    // Obtener información del usuario para filtrar por fecha de creación
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    const userCreatedAt = user.createdAt;

    if (markAllAsRead) {
      // Marcar todas las notificaciones como leídas (solo las creadas después del registro del usuario)
      await Notification.updateMany(
        { 
          readBy: { $ne: userEmail },
          isActive: true,
          createdAt: { $gte: userCreatedAt } // Solo notificaciones posteriores al registro
        },
        { 
          $addToSet: { readBy: userEmail },
          $inc: { totalReads: 1 }
        }
      );

      return res.status(200).json({ 
        message: 'Todas las notificaciones marcadas como leídas' 
      });
    } else {
      // Marcar notificación específica como leída
      if (!notificationId) {
        return res.status(400).json({ message: 'ID de notificación requerido' });
      }

      const notification = await Notification.findById(notificationId);
      if (!notification) {
        return res.status(404).json({ message: 'Notificación no encontrada' });
      }

      // Usar el método del modelo para marcar como leída
      await notification.markAsRead(userEmail);

      return res.status(200).json({ 
        message: 'Notificación marcada como leída',
        isRead: true
      });
    }

  } catch (error) {
    console.error('❌ Error al marcar notificación como leída:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}

// Función helper para calcular tiempo relativo
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Hace unos segundos';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  } else {
    return new Date(date).toLocaleDateString('es-ES');
  }
} 