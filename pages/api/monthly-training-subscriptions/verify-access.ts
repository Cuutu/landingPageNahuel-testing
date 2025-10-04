import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import MonthlyTrainingSubscription from '../../../models/MonthlyTrainingSubscription';
import { z } from 'zod';
import dbConnect from '../../../lib/mongodb';

// Wrapper para timeout de operaciones de base de datos
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 25000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs)
    )
  ]);
};

// Validación de entrada
const verifyAccessSchema = z.object({
  trainingType: z.enum(['SwingTrading', 'DayTrading', 'DowJones']).default('SwingTrading'),
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2024).max(2030).optional()
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Conectar a la base de datos
    await dbConnect();
    
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!(session as any)?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Validar query parameters
    const validationResult = verifyAccessSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        details: validationResult.error.errors 
      });
    }

    const { trainingType, month, year } = validationResult.data;

    // Si no se especifica mes/año, verificar acceso para el mes actual
    const now = new Date();
    const checkMonth = month || (now.getMonth() + 1);
    const checkYear = year || now.getFullYear();

    // Buscar suscripción activa para el mes/año especificado con timeout
    const activeSubscription = await withTimeout(
      MonthlyTrainingSubscription.findOne({
        userId: (session as any).user.id || (session as any).user.email, // Usar email como fallback
        trainingType,
        subscriptionMonth: checkMonth,
        subscriptionYear: checkYear,
        isActive: true,
        paymentStatus: 'completed',
        accessGranted: true
      })
    );

    if (!activeSubscription) {
      return res.status(200).json({
        success: true,
        hasAccess: false,
        message: 'No tienes acceso a este entrenamiento para el mes especificado',
        subscription: null
      });
    }

    // Verificar si la suscripción está actualmente activa
    const isCurrentlyActive = activeSubscription.isCurrentlyActive();
    const hasExpired = activeSubscription.hasExpired();

    return res.status(200).json({
      success: true,
      hasAccess: isCurrentlyActive,
      message: isCurrentlyActive 
        ? 'Tienes acceso activo a este entrenamiento' 
        : hasExpired 
          ? 'Tu suscripción ha expirado' 
          : 'Tu suscripción aún no está activa',
      subscription: {
        _id: activeSubscription._id,
        trainingType: activeSubscription.trainingType,
        subscriptionMonth: activeSubscription.subscriptionMonth,
        subscriptionYear: activeSubscription.subscriptionYear,
        monthName: new Date(activeSubscription.subscriptionYear, activeSubscription.subscriptionMonth - 1).toLocaleString('es-ES', { month: 'long' }),
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.endDate,
        paymentAmount: activeSubscription.paymentAmount,
        isCurrentlyActive,
        hasExpired,
        daysRemaining: isCurrentlyActive ? Math.ceil((activeSubscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0
      }
    });

  } catch (error) {
    console.error('Error verifying monthly training access:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
