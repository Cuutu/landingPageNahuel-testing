import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import connectDB from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';

/**
 * Endpoint para reenviar notificaciones de un informe existente
 * POST /api/admin/reports/[id]/resend
 * 
 * Body opcional:
 * - sendTelegram: boolean (default: true)
 * - sendEmail: boolean (default: true)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: `Método ${req.method} no permitido` 
    });
  }

  try {
    await connectDB();

    // Verificar autenticación y que sea admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false, 
        message: 'Debes estar autenticado' 
      });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Solo administradores pueden reenviar notificaciones' 
      });
    }

    const { id } = req.query;
    const { sendTelegram = true, sendEmail = true } = req.body;

    // Buscar el informe
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: 'Informe no encontrado' 
      });
    }

    console.log(`🔄 [RESEND] Reenviando notificaciones para informe: ${report.title} (${id})`);

    const results = {
      telegram: { sent: false, error: null as string | null },
      email: { sent: 0, total: 0, error: null as string | null }
    };

    // Enviar a Telegram
    if (sendTelegram) {
      try {
        const { sendReportToTelegram } = await import('@/lib/telegramBot');
        const telegramResult = await sendReportToTelegram(report);
        results.telegram.sent = telegramResult;
        
        if (!telegramResult) {
          results.telegram.error = 'TELEGRAM_ENABLED puede estar en false o no hay canal configurado';
        }
        
        console.log(`📱 [RESEND] Telegram: ${telegramResult ? '✅ Enviado' : '❌ No enviado'}`);
      } catch (telegramError) {
        console.error('❌ [RESEND] Error enviando a Telegram:', telegramError);
        results.telegram.error = telegramError instanceof Error ? telegramError.message : 'Error desconocido';
      }
    }

    // Enviar emails
    if (sendEmail) {
      try {
        const { sendEmailNotification } = await import('@/lib/notificationUtils');
        const Notification = (await import('@/models/Notification')).default;

        // Determinar el tipo de servicio basado en la categoría
        let serviceType = 'TraderCall';
        if (report.category === 'smart-money') {
          serviceType = 'SmartMoney';
        }

        // Buscar usuarios suscritos
        const now = new Date();
        const subscribedUsers = await User.find({
          $or: [
            {
              'activeSubscriptions': {
                $elemMatch: {
                  service: serviceType,
                  isActive: true,
                  expiryDate: { $gte: now }
                }
              }
            },
            {
              'suscripciones': {
                $elemMatch: {
                  servicio: serviceType,
                  activa: true,
                  fechaVencimiento: { $gte: now }
                }
              }
            }
          ]
        }, 'email name role').lean();

        results.email.total = subscribedUsers.length;

        // Verificar si hay una notificación existente para este informe
        let notification = await Notification.findOne({
          relatedReportId: report._id
        });

        // Si no existe, crear una temporal para el email
        if (!notification) {
          notification = {
            title: `📰 Nuevo Informe ${serviceType}: ${report.title}`,
            message: `Se ha publicado un nuevo informe de análisis para ${serviceType}. ${report.content?.substring(0, 100)}...`,
            type: 'actualizacion',
            actionUrl: `/reports/${report._id}`,
            actionText: 'Leer Informe',
            icon: '📰'
          };
        }

        // Enviar emails con rate limiting
        const TESTING_MODE = process.env.EMAIL_TESTING_MODE === 'true';
        const usersToEmail = TESTING_MODE 
          ? subscribedUsers.filter((u: any) => u.role === 'admin')
          : subscribedUsers;

        console.log(`📧 [RESEND] Enviando emails a ${usersToEmail.length} usuarios${TESTING_MODE ? ' (MODO TESTING - solo admins)' : ''}`);

        for (const targetUser of usersToEmail) {
          try {
            const emailSuccess = await sendEmailNotification(targetUser, notification);
            if (emailSuccess) {
              results.email.sent++;
            }
            // Pausa entre emails
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (emailError) {
            console.error(`❌ Error enviando email a ${targetUser.email}:`, emailError);
          }
        }

        console.log(`📧 [RESEND] Emails enviados: ${results.email.sent}/${usersToEmail.length}`);
      } catch (emailError) {
        console.error('❌ [RESEND] Error enviando emails:', emailError);
        results.email.error = emailError instanceof Error ? emailError.message : 'Error desconocido';
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Notificaciones reenviadas',
      data: {
        reportId: id,
        reportTitle: report.title,
        results,
        config: {
          TELEGRAM_ENABLED: process.env.TELEGRAM_ENABLED === 'true',
          EMAIL_TESTING_MODE: process.env.EMAIL_TESTING_MODE === 'true'
        }
      }
    });

  } catch (error) {
    console.error('❌ [RESEND] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
