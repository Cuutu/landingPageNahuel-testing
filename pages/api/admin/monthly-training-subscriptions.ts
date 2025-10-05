import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import User from '@/models/User';

/**
 * Obtiene usuarios suscritos a entrenamientos mensuales con filtros
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar autenticación y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }

    const { 
      year = new Date().getFullYear(), 
      month = new Date().getMonth() + 1,
      trainingType = 'all',
      status = 'completed'
    } = req.query;

    // Construir filtros
    const filters: any = {
      subscriptionYear: parseInt(year as string),
      subscriptionMonth: parseInt(month as string),
      paymentStatus: status as string
    };

    if (trainingType !== 'all') {
      filters.trainingType = trainingType;
    }

    // Obtener suscripciones con información del usuario
    const subscriptions = await MonthlyTrainingSubscription.find(filters)
      .sort({ createdAt: -1 })
      .lean();

    // Obtener estadísticas
    const stats = await MonthlyTrainingSubscription.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$trainingType',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$paymentAmount' },
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          }
        }
      }
    ]);

    // Obtener información adicional de usuarios
    const userIds = subscriptions.map(sub => sub.userId);
    const users = await User.find({ googleId: { $in: userIds } })
      .select('googleId name email phone')
      .lean();

    const userMap = new Map(users.map(user => [user.googleId, user]));

    // Obtener fechas de entrenamiento con links de Meet para el mes
    const TrainingDate = (await import('@/models/TrainingDate')).default;
    const startOfMonth = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
    const endOfMonth = new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59);
    
    console.log('🔍 Debug: Buscando TrainingDate para:', {
      year: year as string,
      month: month as string,
      startOfMonth,
      endOfMonth,
      trainingType: trainingType
    });
    
    // Primero buscar todas las fechas del mes para debug
    const allTrainingDates = await TrainingDate.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
      isActive: true
    }).lean();
    
    console.log('🔍 Debug: Todas las fechas encontradas:', allTrainingDates.length, allTrainingDates);
    
    const trainingDates = await TrainingDate.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
      isActive: true,
      meetLink: { $exists: true, $ne: null }
    }).lean();
    
    console.log('🔍 Debug: Fechas con meetLink:', trainingDates.length, trainingDates);

    // Crear mapa de fechas por tipo de entrenamiento
    const meetLinksByType = new Map<string, string[]>();
    trainingDates.forEach(date => {
      if (!meetLinksByType.has(date.trainingType)) {
        meetLinksByType.set(date.trainingType, []);
      }
      if (date.meetLink) {
        meetLinksByType.get(date.trainingType)!.push(date.meetLink);
      }
    });
    
    console.log('🔍 Debug: meetLinksByType final:', Object.fromEntries(meetLinksByType));

    // Enriquecer suscripciones con datos del usuario y links de Meet
    const enrichedSubscriptions = subscriptions.map(sub => ({
      ...sub,
      user: userMap.get(sub.userId) || {
        name: sub.userName,
        email: sub.userEmail,
        phone: null
      },
      meetLinks: meetLinksByType.get(sub.trainingType) || []
    }));

    // Calcular estadísticas generales
    const totalSubscriptions = subscriptions.length;
    const totalRevenue = subscriptions.reduce((sum, sub) => sum + sub.paymentAmount, 0);
    const activeSubscriptions = subscriptions.filter(sub => sub.isActive).length;

    res.status(200).json({
      success: true,
      data: {
        subscriptions: enrichedSubscriptions,
        stats: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          revenue: totalRevenue,
          byType: stats,
          meetLinksAvailable: Object.fromEntries(meetLinksByType)
        },
        filters: {
          year: parseInt(year as string),
          month: parseInt(month as string),
          trainingType,
          status
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo suscripciones mensuales:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
