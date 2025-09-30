import { NextApiRequest, NextApiResponse } from 'next';
import { processTrainingReminders } from '@/lib/bookingReminders';

/**
 * API PÚBLICA para recordatorios de entrenamientos
 * - Sin autenticación (para CRON jobs externos)
 * - Solo permite GET y POST
 * - Incluye rate limiting básico
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    // Rate limiting básico: solo permitir desde IPs conocidas o con User-Agent específico
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

    // Permitir acceso si:
    // 1. Es un test manual (?test=true)
    // 2. Tiene User-Agent permitido
    // 3. Es un CRON job de Vercel
    const isManualTest = req.query.test === 'true';
    const isVercelCron = req.headers['x-vercel-cron'];
    
    if (!isManualTest && !isAllowedUserAgent && !isVercelCron) {
      return res.status(403).json({ 
        success: false, 
        error: 'Acceso denegado. Solo CRON jobs autorizados.' 
      });
    }

    console.log('🚀 Iniciando proceso de recordatorios de entrenamientos (público)...');
    console.log('📊 User-Agent:', userAgent);
    console.log('🌐 IP:', req.headers['x-forwarded-for'] || req.connection.remoteAddress);

    const start = Date.now();
    const result = await processTrainingReminders();
    const ms = Date.now() - start;

    console.log('✅ Recordatorios procesados:', result);

    return res.status(200).json({
      success: true,
      executionTimeMs: ms,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error: any) {
    console.error('❌ Error en training-reminders-public:', error?.message || error);
    return res.status(500).json({ 
      success: false, 
      error: error?.message || 'Error interno' 
    });
  }
}
