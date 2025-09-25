import { NextApiRequest, NextApiResponse } from 'next';
import { processSubscriptionNotifications, cleanupOldNotifications } from '../../../lib/subscriptionNotifications';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitir GET para cronjobs externos (cron-job.org)
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Método no permitido. Use GET para cronjobs.',
      timestamp: new Date().toISOString()
    });
  }

  // Verificar token de seguridad para cron jobs (opcional)
  const cronToken = req.headers.authorization?.replace('Bearer ', '');
  const expectedToken = process.env.CRON_SECRET_TOKEN;
  
  if (expectedToken && cronToken !== expectedToken) {
    console.log('❌ [CRON] Token de autorización inválido');
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    console.log('🕐 [CRON] Iniciando procesamiento automático de notificaciones de suscripciones...');
    
    // Procesar notificaciones
    const result = await processSubscriptionNotifications();
    
    // Limpiar notificaciones antiguas (una vez por día)
    const now = new Date();
    const isFirstRunOfDay = now.getHours() === 0 && now.getMinutes() < 5; // Entre 00:00 y 00:05
    
    let cleanupResult = null;
    if (isFirstRunOfDay) {
      console.log('🧹 [CRON] Ejecutando limpieza diaria de notificaciones antiguas...');
      const deletedCount = await cleanupOldNotifications();
      cleanupResult = { deletedCount };
    }

    console.log('✅ [CRON] Procesamiento automático completado:', {
      warningsSent: result.warningsSent,
      expiredSent: result.expiredSent,
      errors: result.errors.length,
      cleanupResult
    });

    return res.status(200).json({
      success: true,
      message: 'Notificaciones procesadas automáticamente',
      timestamp: new Date().toISOString(),
      result,
      cleanupResult
    });

  } catch (error) {
    console.error('❌ [CRON] Error en procesamiento automático:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
}
