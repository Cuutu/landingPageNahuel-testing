import { NextApiRequest, NextApiResponse } from 'next';
import { processSubscriptionNotifications, cleanupOldNotifications } from '../../../lib/subscriptionNotifications';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitir GET para cronjobs externos (cron-job.org) y POST para Vercel
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método no permitido. Use GET o POST para cronjobs.',
      timestamp: new Date().toISOString()
    });
  }

  // ✅ MEJORADO: Verificar autorización con protección mejorada
  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'] || '';
  const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
  
  // ✅ CORREGIDO: Requerir autenticación adecuada
  // Permitir solo si:
  // 1. Viene de Vercel Cron (confiable)
  // 2. Tiene token válido en header Authorization
  const hasValidToken = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isAuthorized = isVercelCron || hasValidToken;
  
  if (!isAuthorized) {
    console.log('❌ [CRON] Token de autorización inválido o faltante', {
      hasVercelCron: isVercelCron,
      hasValidToken: !!hasValidToken,
      isCronJobOrg,
      hasCronSecret: !!cronSecret,
      userAgent: userAgent.substring(0, 100)
    });
    return res.status(401).json({ 
      error: 'No autorizado',
      message: 'Se requiere token de autorización válido o ejecución desde Vercel Cron'
    });
  }
  
  // ✅ DESHABILITADO: Cronjob deshabilitado temporalmente
  console.log('⚠️ [CRON] Cronjob de notificaciones de suscripción DESHABILITADO - retornando sin ejecutar');
  return res.status(200).json({
    success: true,
    message: 'Cronjob de notificaciones de suscripción está deshabilitado',
    disabled: true,
    timestamp: new Date().toISOString()
  });

  /* CÓDIGO DESHABILITADO - Descomentar para reactivar
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
  */
}
