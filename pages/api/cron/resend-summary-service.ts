import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import CronNotificationJob from '@/models/CronNotificationJob';
import { enviarResumenOperaciones } from './auto-convert-ranges';

/**
 * Endpoint para re-enviar el resumen de operaciones para un servicio específico
 * 
 * Uso:
 * GET /api/cron/resend-summary-service?service=TraderCall
 * GET /api/cron/resend-summary-service?service=SmartMoney&jobId=6945a7c19d0512eb32728f64
 * 
 * Si no se proporciona jobId, usa el último job de tipo AUTO_CONVERT_RANGES_SUMMARY
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido. Use GET.',
    });
  }

  // Auth: permitir cron-job.org o Bearer token
  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'] || '';
  const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}` && !isCronJobOrg) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado',
      });
    }
  } else {
    if (!isCronJobOrg) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado (cron secret no configurado)',
      });
    }
  }

  const { service, jobId } = req.query;

  if (!service || typeof service !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Falta el parámetro "service" (SmartMoney o TraderCall)',
    });
  }

  if (service !== 'SmartMoney' && service !== 'TraderCall') {
    return res.status(400).json({
      success: false,
      error: 'El servicio debe ser "SmartMoney" o "TraderCall"',
    });
  }

  try {
    await dbConnect();

    let job;

    if (jobId && typeof jobId === 'string') {
      // Buscar job específico
      job = await CronNotificationJob.findById(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: `No se encontró el job con ID ${jobId}`,
        });
      }
    } else {
      // Buscar el último job de tipo AUTO_CONVERT_RANGES_SUMMARY
      job = await CronNotificationJob.findOne({
        type: 'AUTO_CONVERT_RANGES_SUMMARY',
      })
        .sort({ createdAt: -1 })
        .exec();

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró ningún job de notificaciones',
        });
      }
    }

    const acciones: any[] = Array.isArray(job.payload?.acciones) ? job.payload.acciones : [];

    if (acciones.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El job no tiene acciones para re-enviar',
      });
    }

    // Filtrar acciones solo del servicio solicitado
    const accionesServicio = acciones.filter(
      (accion: any) => accion.alertaTipo === service
    );

    if (accionesServicio.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No hay acciones de ${service} en este job`,
        jobId: job._id.toString(),
        totalAcciones: acciones.length,
        accionesDisponibles: acciones.map((a: any) => a.alertaTipo),
      });
    }

    console.log(`📧 [RE-ENVÍO] Re-enviando resumen para ${service}...`);
    console.log(`📊 [RE-ENVÍO] ${accionesServicio.length} acciones de ${service} del job ${job._id.toString()}`);

    // Re-enviar solo las acciones del servicio solicitado
    await enviarResumenOperaciones(accionesServicio);

    console.log(`✅ [RE-ENVÍO] Resumen re-enviado exitosamente para ${service}`);

    return res.status(200).json({
      success: true,
      message: `Resumen re-enviado exitosamente para ${service}`,
      details: {
        service,
        jobId: job._id.toString(),
        accionesEnviadas: accionesServicio.length,
        acciones: accionesServicio.map((a: any) => ({
          symbol: a.symbol,
          tipo: a.tipo,
          alertaTipo: a.alertaTipo,
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ [RE-ENVÍO] Error re-enviando resumen:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error?.message || String(error),
    });
  }
}
