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
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    };

    // Obtener suscripciones activas del usuario
    const activeSubscriptions = await UserSubscription.find({
      userId: user._id,
      status: 'active',
      endDate: { $gt: now }
    }).lean();

    // Crear array con los tipos de alertas permitidos según suscripciones
    const allowedAlertTypes: string[] = ['todos']; // Todos los usuarios ven 'todos'

    // Filtrar por tipo de usuario
    if (userRole === 'admin') {
      // Admin ve todo
      query.targetUsers = { 
        $in: ['todos', 'admin', 'alertas_trader', 'alertas_smart', 'alertas_cashflow'] 
      };
    } else {
      // Para usuarios normales y suscriptores, verificar suscripciones activas
      if (userRole === 'suscriptor') {
        allowedAlertTypes.push('suscriptores');
      }

      // Agregar tipos de alertas según suscripciones activas
      for (const subscription of activeSubscriptions) {
        if (subscription.serviceType === 'TraderCall') {
          allowedAlertTypes.push('alertas_trader');
        } else if (subscription.serviceType === 'SmartMoney') {
          allowedAlertTypes.push('alertas_smart');
        } else if (subscription.serviceType === 'CashFlow') {
          allowedAlertTypes.push('alertas_cashflow');
        }
      }

      // Solo mostrar notificaciones de tipos permitidos
      query.targetUsers = { $in: allowedAlertTypes };
    }

    // Filtros adicionales
    if (type) {
      query.type = type;
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

    // Obtener notificaciones
    const notifications = await Notification.find(query)
      .sort({ priority: -1, createdAt: -1 }) // Prioridad alta primero, luego por fecha
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Contar total para paginación
    const total = await Notification.countDocuments(query);

    // Contar no leídas
    const unreadQuery = { ...query, readBy: { $ne: userEmail } };
    const unreadCount = await Notification.countDocuments(unreadQuery);

    // Formatear las notificaciones
    const formattedNotifications = notifications.map(notification => ({
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