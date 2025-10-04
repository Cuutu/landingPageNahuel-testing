import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import MonthlyTrainingSubscription from '../../../models/MonthlyTrainingSubscription';
import { z } from 'zod';

// Validación para consultas
const querySchema = z.object({
  trainingType: z.enum(['SwingTrading', 'DayTrading', 'DowJones']).optional(),
  month: z.string().transform(val => parseInt(val)).optional(),
  year: z.string().transform(val => parseInt(val)).optional(),
  status: z.enum(['active', 'expired', 'all']).default('active')
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!(session as any)?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Validar query parameters
    const validationResult = querySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        details: validationResult.error.errors 
      });
    }

    const { trainingType, month, year, status } = validationResult.data;

    // Construir query
    const query: any = {
      userId: (session as any).user.id
    };

    if (trainingType) {
      query.trainingType = trainingType;
    }

    if (month && year) {
      query.subscriptionMonth = month;
      query.subscriptionYear = year;
    }

    // Filtrar por estado
    const now = new Date();
    if (status === 'active') {
      query.isActive = true;
      query.paymentStatus = 'completed';
      query.accessGranted = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    }

    // Obtener suscripciones
    const subscriptions = await MonthlyTrainingSubscription.find(query)
      .sort({ subscriptionYear: -1, subscriptionMonth: -1, createdAt: -1 });

    // Formatear respuesta
    const formattedSubscriptions = subscriptions.map(sub => ({
      _id: sub._id,
      trainingType: sub.trainingType,
      subscriptionMonth: sub.subscriptionMonth,
      subscriptionYear: sub.subscriptionYear,
      monthName: new Date(sub.subscriptionYear, sub.subscriptionMonth - 1).toLocaleString('es-ES', { month: 'long' }),
      startDate: sub.startDate,
      endDate: sub.endDate,
      paymentAmount: sub.paymentAmount,
      paymentStatus: sub.paymentStatus,
      isActive: sub.isActive,
      accessGranted: sub.accessGranted,
      isCurrentlyActive: sub.isCurrentlyActive(),
      hasExpired: sub.hasExpired(),
      createdAt: sub.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: formattedSubscriptions,
      count: formattedSubscriptions.length
    });

  } catch (error) {
    console.error('Error fetching monthly training subscriptions:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
