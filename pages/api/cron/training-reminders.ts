import { NextApiRequest, NextApiResponse } from 'next';
import { processTrainingReminders } from '@/lib/bookingReminders';

/**
 * API PÚBLICA para enviar recordatorios de entrenamientos (SwingTrading) 24h y 1h antes
 * - Público para CRON jobs externos (sin token)
 * - Rate limiting por User-Agent
 * - Idempotente por flags en Booking (reminder24hSent, reminder1hSent)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    // Seguridad: solo verificar User-Agent para CRON jobs externos
    const userAgent = req.headers['user-agent'] || '';
    const allowedUserAgents = [
      'cron-job.org',
      'uptimerobot',
      'vercel-cron',
      'curl'
    ];
    
    const isAllowedUserAgent = allowedUserAgents.some(agent => 
      userAgent.toLowerCase().includes(agent.toLowerCase())
    );
    const isManualTest = req.query.test === 'true';

    // Permitir acceso si:
    // 1. Es un test manual (?test=true)
    // 2. Tiene User-Agent permitido
    if (!isManualTest && !isAllowedUserAgent) {
      return res.status(403).json({ 
        success: false, 
        error: 'Acceso denegado. Solo CRON jobs autorizados.' 
      });
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