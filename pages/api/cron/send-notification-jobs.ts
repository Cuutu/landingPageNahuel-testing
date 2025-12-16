import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import CronNotificationJob from '@/models/CronNotificationJob';

type SendJobsResponse =
  | {
      success: true;
      message: string;
      job?: {
        id: string;
        type: string;
        status: string;
        attempts: number;
        maxAttempts: number;
      };
      timestamp: string;
    }
  | {
      success: false;
      error: string;
      timestamp: string;
    };

function getBackoffMs(attempt: number): number {
  // attempt empieza en 1
  const scheduleSeconds = [60, 180, 600, 1800, 3600, 7200]; // 1m, 3m, 10m, 30m, 1h, 2h
  const idx = Math.min(Math.max(attempt - 1, 0), scheduleSeconds.length - 1);
  return scheduleSeconds[idx] * 1000;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SendJobsResponse>) {
  // Permitir GET para cronjobs externos (cron-job.org) y POST para uso interno
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Use GET o POST.',
      timestamp: new Date().toISOString(),
    });
  }

  // Auth: permitir cron-job.org o Bearer token si existe
  const authHeader = req.headers.authorization;
  const userAgent = req.headers['user-agent'] || '';
  const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;

  const isManualTest = req.query.test === 'true' && process.env.NODE_ENV === 'development';

  if (!isManualTest) {
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}` && !isCronJobOrg) {
        return res.status(401).json({
          success: false,
          error: 'No autorizado',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Si no hay secret configurado, solo permitir cron-job.org
      if (!isCronJobOrg) {
        return res.status(401).json({
          success: false,
          error: 'No autorizado (cron secret no configurado)',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  if (isCronJobOrg) {
    console.log('🌐 CRON PÚBLICO DETECTADO (send-notification-jobs):', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.url,
    });
  }

  try {
    await dbConnect();

    const now = new Date();
    const lockId = `${now.getTime()}_${Math.random().toString(16).slice(2)}`;

    // Claim atómico de un job pendiente
    const job = (await CronNotificationJob.findOneAndUpdate(
      {
        status: 'PENDING',
        nextAttemptAt: { $lte: now },
      },
      {
        $set: {
          status: 'PROCESSING',
          lockedAt: now,
          lockId,
          lastError: null,
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true }
    ).lean()) as any;

    if (!job) {
      return res.status(200).json({
        success: true,
        message: 'No hay jobs pendientes para procesar',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📨 [JOBS] Procesando job ${job._id} (${job.type}) intento ${job.attempts}/${job.maxAttempts}`);

    try {
      if (job.type === 'AUTO_CONVERT_RANGES_SUMMARY') {
        const acciones: any[] = Array.isArray(job.payload?.acciones) ? job.payload.acciones : [];
        const sendNoOperations = job.payload?.sendNoOperations === true;

        // Reutilizar la lógica existente del cron
        const { enviarResumenOperaciones, enviarNotificacionSinOperaciones } = await import('./auto-convert-ranges');

        if (acciones.length > 0) {
          await enviarResumenOperaciones(acciones as any);
        } else if (sendNoOperations) {
          await enviarNotificacionSinOperaciones();
        } else {
          console.log('ℹ️ [JOBS] Job sin acciones y sin flag sendNoOperations; no se envía nada.');
        }
      } else {
        console.warn(`⚠️ [JOBS] Tipo de job no soportado: ${job.type}`);
      }

      await CronNotificationJob.updateOne(
        { _id: job._id, lockId },
        {
          $set: {
            status: 'SENT',
            sentAt: new Date(),
            lockedAt: null,
            lockId: null,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Job procesado y enviado correctamente',
        job: {
          id: job._id.toString(),
          type: job.type,
          status: 'SENT',
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (sendError: any) {
      const errorMsg = sendError?.message || String(sendError);
      console.error('❌ [JOBS] Error enviando notificación:', sendError);

      const attempts = job.attempts || 1;
      const maxAttempts = job.maxAttempts || 5;
      const shouldFailPermanently = attempts >= maxAttempts;

      if (shouldFailPermanently) {
        await CronNotificationJob.updateOne(
          { _id: job._id, lockId },
          {
            $set: {
              status: 'FAILED',
              lastError: errorMsg,
              lockedAt: null,
              lockId: null,
            },
          }
        );
        return res.status(200).json({
          success: true,
          message: `Job falló definitivamente luego de ${attempts} intentos`,
          job: {
            id: job._id.toString(),
            type: job.type,
            status: 'FAILED',
            attempts,
            maxAttempts,
          },
          timestamp: new Date().toISOString(),
        });
      }

      const nextAttemptAt = new Date(Date.now() + getBackoffMs(attempts));
      await CronNotificationJob.updateOne(
        { _id: job._id, lockId },
        {
          $set: {
            status: 'PENDING',
            nextAttemptAt,
            lastError: errorMsg,
            lockedAt: null,
            lockId: null,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: `Job falló; reintentará en ${Math.round((nextAttemptAt.getTime() - Date.now()) / 1000)}s`,
        job: {
          id: job._id.toString(),
          type: job.type,
          status: 'PENDING',
          attempts,
          maxAttempts,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('❌ [JOBS] Error general procesando jobs:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error interno',
      timestamp: new Date().toISOString(),
    });
  }
}

