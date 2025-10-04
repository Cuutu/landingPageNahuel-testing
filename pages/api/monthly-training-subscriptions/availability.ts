import { NextApiRequest, NextApiResponse } from 'next';
import MonthlyTrainingSubscription from '../../../models/MonthlyTrainingSubscription';
import { z } from 'zod';
import dbConnect from '../../../lib/mongodb';

// Wrapper para timeout de operaciones de base de datos
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs)
    )
  ]);
};

// Validación de entrada
const availabilitySchema = z.object({
  trainingType: z.enum(['SwingTrading', 'DayTrading', 'DowJones']).default('SwingTrading'),
  year: z.string().transform(val => parseInt(val)).optional(),
  month: z.string().transform(val => parseInt(val)).optional(),
  maxSubscribers: z.string().transform(val => parseInt(val)).default('10')
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Conectar a la base de datos
    await dbConnect();
    
    // Validar query parameters
    const validationResult = availabilitySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos', 
        details: validationResult.error.errors 
      });
    }

    const { trainingType, year, month, maxSubscribers } = validationResult.data;

    // Si no se especifica mes/año, obtener disponibilidad para los próximos 6 meses
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const monthsToCheck = [];
    
    if (year && month) {
      // Verificar mes específico
      monthsToCheck.push({ month, year });
    } else {
      // Verificar próximos 6 meses
      for (let i = 0; i < 6; i++) {
        const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
        monthsToCheck.push({
          month: targetDate.getMonth() + 1,
          year: targetDate.getFullYear()
        });
      }
    }

    // Obtener disponibilidad para cada mes con timeout
    const availabilityData = await Promise.all(
      monthsToCheck.map(async ({ month: checkMonth, year: checkYear }) => {
        const availability = await withTimeout(
          (MonthlyTrainingSubscription as any).checkAvailability(
            trainingType,
            checkYear,
            checkMonth,
            maxSubscribers
          )
        );
        
        return {
          month: checkMonth,
          year: checkYear,
          monthName: new Date(checkYear, checkMonth - 1).toLocaleString('es-ES', { month: 'long' }),
          ...(availability || { available: false, currentSubscribers: 0, maxSubscribers, remainingSlots: 0 })
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: availabilityData,
      trainingType,
      maxSubscribers
    });

  } catch (error) {
    console.error('Error checking monthly training availability:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
