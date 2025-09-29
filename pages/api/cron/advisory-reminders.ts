import { NextApiRequest, NextApiResponse } from 'next';
import { processAdvisoryReminders } from '@/lib/bookingReminders';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método no permitido. Use GET para cronjobs.',
      timestamp: new Date().toISOString()
    });
  }

  // Token opcional para cron externo
  const cronToken = req.headers.authorization?.replace('Bearer ', '');
  const expectedToken = process.env.CRON_SECRET_TOKEN;
  if (expectedToken && cronToken !== expectedToken) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const result = await processAdvisoryReminders();

    return res.status(200).json({
      success: true,
      message: 'Recordatorios de asesorías procesados',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error: any) {
    console.error('❌ [CRON] Error procesando recordatorios de asesorías:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error?.message || 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
} 