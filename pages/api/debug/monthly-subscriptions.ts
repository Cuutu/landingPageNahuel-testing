import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Obtener todas las suscripciones mensuales
    const subscriptions = await MonthlyTrainingSubscription.find({})
      .sort({ createdAt: -1 })
      .limit(50);

    // Obtener estadísticas por mes/año
    const stats = await MonthlyTrainingSubscription.aggregate([
      {
        $group: {
          _id: {
            year: '$subscriptionYear',
            month: '$subscriptionMonth',
            trainingType: '$trainingType'
          },
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0]
            }
          },
          active: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Verificar disponibilidad para octubre 2025
    const october2025 = await MonthlyTrainingSubscription.find({
      trainingType: 'SwingTrading',
      subscriptionYear: 2025,
      subscriptionMonth: 10,
      paymentStatus: 'completed',
      isActive: true
    });

    return res.status(200).json({
      success: true,
      data: {
        totalSubscriptions: subscriptions.length,
        subscriptions: subscriptions.map(sub => ({
          id: sub._id,
          userEmail: sub.userEmail,
          trainingType: sub.trainingType,
          subscriptionMonth: sub.subscriptionMonth,
          subscriptionYear: sub.subscriptionYear,
          paymentStatus: sub.paymentStatus,
          isActive: sub.isActive,
          accessGranted: sub.accessGranted,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt
        })),
        stats,
        october2025Count: october2025.length,
        october2025Details: october2025.map(sub => ({
          id: sub._id,
          userEmail: sub.userEmail,
          paymentStatus: sub.paymentStatus,
          isActive: sub.isActive,
          accessGranted: sub.accessGranted,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt
        }))
      }
    });

  } catch (error) {
    console.error('Error en debug monthly subscriptions:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
