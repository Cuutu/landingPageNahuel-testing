import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Crear notificaciones de ejemplo
    const sampleNotifications = [
      {
        title: "¡Nueva actualización de Smart Money!",
        message: "Hemos agregado nuevos análisis de mercado y señales mejoradas para ayudarte a tomar mejores decisiones de inversión.",
        type: "actualizacion",
        priority: "alta",
        targetUsers: "todos",
        createdBy: session.user.email,
        icon: "🚀",
        actionUrl: "/alertas/smart-money",
        actionText: "Ver Smart Money"
      },
      {
        title: "Nuevo curso disponible: Trading Avanzado",
        message: "Aprende estrategias avanzadas de trading con nuestro nuevo curso. Técnicas profesionales para maximizar tus ganancias.",
        type: "novedad",
        priority: "media",
        targetUsers: "todos",
        createdBy: session.user.email,
        icon: "📚",
        actionUrl: "/entrenamientos/swing-trading",
        actionText: "Ver Curso"
      },
      {
        title: "¡Descuento especial en Trader Call!",
        message: "Por tiempo limitado, obtén un 20% de descuento en tu suscripción a Trader Call. No te pierdas esta oportunidad.",
        type: "promocion",
        priority: "alta",
        targetUsers: "todos",
        createdBy: session.user.email,
        icon: "🎉",
        actionUrl: "/alertas/trader-call",
        actionText: "Aprovechar Oferta"
      },
      {
        title: "Mantenimiento programado del sistema",
        message: "El sistema estará en mantenimiento el domingo de 2:00 AM a 4:00 AM. Durante este tiempo, algunas funciones podrían no estar disponibles.",
        type: "sistema",
        priority: "media",
        targetUsers: "todos",
        createdBy: session.user.email,
        icon: "⚙️"
      },
      {
        title: "Webinar: Análisis de mercado semanal",
        message: "Únete a nuestro webinar gratuito todos los viernes para analizar las tendencias del mercado y oportunidades de inversión.",
        type: "novedad",
        priority: "baja",
        targetUsers: "todos",
        createdBy: session.user.email,
        icon: "📊",
        actionUrl: "/recursos",
        actionText: "Más Información"
      }
    ];

    // Crear las notificaciones en la base de datos
    const createdNotifications = await Notification.insertMany(sampleNotifications);

    return res.status(200).json({
      message: 'Notificaciones de ejemplo creadas exitosamente',
      count: createdNotifications.length,
      notifications: createdNotifications
    });

  } catch (error) {
    console.error('❌ Error al crear notificaciones:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
} 