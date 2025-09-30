import { NextApiRequest, NextApiResponse } from 'next';
import { processTrainingReminders } from '@/lib/bookingReminders';

/**
 * API para enviar recordatorios de entrenamientos (SwingTrading) 24h y 1h antes
 * - Seguro con token (Authorization: Bearer CRON_SECRET_TOKEN)
 * - Idempotente por flags en Booking (reminder24hSent, reminder1hSent)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    // Seguridad: token en header
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    const isManualTest = req.query.test === 'true' && process.env.NODE_ENV !== 'production';

    if (!isManualTest && token !== process.env.CRON_SECRET_TOKEN) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    console.log('🚀 Iniciando proceso de recordatorios de entrenamientos...');

    const start = Date.now();
    const result = await processTrainingReminders();
    const ms = Date.now() - start;

    console.log('✅ Recordatorios procesados:', result);

    return res.status(200).json({
      success: true,
      executionTimeMs: ms,
      ...result
    });
  } catch (error: any) {
    console.error('❌ Error en training-reminders:', error?.message || error);
    return res.status(500).json({ success: false, error: error?.message || 'Error interno' });
  }
} 