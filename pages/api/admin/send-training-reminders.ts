import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import User from '@/models/User';
import { sendEmail } from '@/lib/emailService';
import { getGlobalTimezone, getGlobalReminderHour } from '@/lib/timeConfig';

/**
 * Envía recordatorios a usuarios suscritos a entrenamientos mensuales
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar autenticación y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }

    const { 
      year = new Date().getFullYear(), 
      month = new Date().getMonth() + 1,
      trainingType = 'all',
      message = '',
      sendToAll = false
    } = req.body;

    // Construir filtros para obtener usuarios suscritos
    const filters: any = {
      subscriptionYear: parseInt(year),
      subscriptionMonth: parseInt(month),
      paymentStatus: 'completed',
      isActive: true
    };

    if (trainingType !== 'all') {
      filters.trainingType = trainingType;
    }

    // Obtener suscripciones activas
    const subscriptions = await MonthlyTrainingSubscription.find(filters)
      .sort({ createdAt: -1 })
      .lean();

    if (subscriptions.length === 0) {
      return res.status(404).json({ 
        error: 'No se encontraron usuarios suscritos para el período seleccionado' 
      });
    }

    // Obtener información de usuarios
    const userIds = subscriptions.map(sub => sub.userId);
    const users = await User.find({ googleId: { $in: userIds } })
      .select('googleId name email')
      .lean();

    const userMap = new Map(users.map(user => [user.googleId, user]));

    // Obtener fechas de entrenamiento con links de Meet para el mes
    const TrainingDate = (await import('@/models/TrainingDate')).default;
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    
    const trainingDates = await TrainingDate.find({
      date: { $gte: startOfMonth, $lte: endOfMonth },
      isActive: true,
      meetLink: { $exists: true, $ne: null }
    }).lean();

    // Crear mapa de fechas por tipo de entrenamiento
    const meetLinksByType = new Map<string, string[]>();
    trainingDates.forEach(date => {
      if (!meetLinksByType.has(date.trainingType)) {
        meetLinksByType.set(date.trainingType, []);
      }
      if (date.meetLink) {
        meetLinksByType.get(date.trainingType)!.push(date.meetLink);
      }
    });

    // Preparar datos para envío
    const recipients = subscriptions.map(sub => {
      const user = userMap.get(sub.userId);
      const meetLinks = meetLinksByType.get(sub.trainingType) || [];
      return {
        email: user?.email || sub.userEmail,
        name: user?.name || sub.userName,
        trainingType: sub.trainingType,
        subscriptionId: sub._id,
        meetLinks: meetLinks
      };
    });

    // Filtrar emails únicos para evitar duplicados
    const uniqueRecipients = recipients.filter((recipient, index, self) => 
      index === self.findIndex(r => r.email === recipient.email)
    );

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Enviar emails
    const tz = getGlobalTimezone();
    const reminderHour = getGlobalReminderHour();

    for (const recipient of uniqueRecipients) {
      try {
        const trainingName = getTrainingDisplayName(recipient.trainingType);
        const monthName = getMonthName(parseInt(month));
        
        const html = createTrainingReminderTemplate({
          userName: recipient.name,
          trainingName,
          month: monthName,
          year: parseInt(year),
          customMessage: message || `Te enviaremos recordatorios alrededor de las ${reminderHour}:00 (${tz}).`,
          meetLinks: recipient.meetLinks
        });

        await sendEmail({
          to: recipient.email,
          subject: `📚 Recordatorio: Clases de ${trainingName} - ${monthName} ${year}`,
          html
        });

        results.sent++;
        console.log(`✅ Recordatorio enviado a: ${recipient.email}`);

      } catch (error) {
        results.failed++;
        const errorMsg = `Error enviando a ${recipient.email}: ${error instanceof Error ? error.message : 'Error desconocido'}`;
        results.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Log de la acción
    console.log(`📧 Recordatorios de entrenamiento enviados:`, {
      total: uniqueRecipients.length,
      sent: results.sent,
      failed: results.failed,
      month: `${month}/${year}`,
      trainingType,
      sentBy: session.user.email
    });

    res.status(200).json({
      success: true,
      message: `Recordatorios enviados exitosamente`,
      results: {
        totalRecipients: uniqueRecipients.length,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('Error enviando recordatorios de entrenamiento:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * Obtiene el nombre de display para el tipo de entrenamiento
 */
function getTrainingDisplayName(trainingType: string): string {
  const names: { [key: string]: string } = {
    'SwingTrading': 'Swing Trading',
    'DayTrading': 'Day Trading',
    'DowJones': 'Dow Jones'
  };
  return names[trainingType] || trainingType;
}

/**
 * Obtiene el nombre del mes en español
 */
function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || 'Mes';
}

/**
 * Crea el template HTML para el recordatorio de entrenamiento
 */
function createTrainingReminderTemplate(params: {
  userName: string;
  trainingName: string;
  month: string;
  year: number;
  customMessage?: string;
  meetLinks?: string[];
}): string {
  const { userName, trainingName, month, year, customMessage, meetLinks = [] } = params;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recordatorio de Entrenamiento - Nahuel Lozano Trading</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f4f4f4; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          border-radius: 10px; 
          overflow: hidden; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
          font-weight: 700; 
        }
        .content { 
          padding: 30px; 
        }
        .reminder-badge { 
          display: inline-block; 
          background: #e0f2fe; 
          color: #0369a1; 
          padding: 8px 16px; 
          border-radius: 9999px; 
          font-weight: 700; 
          font-size: 12px; 
          margin-bottom: 20px; 
        }
        .training-info { 
          background: #f8f9fa; 
          border-radius: 8px; 
          padding: 20px; 
          margin: 20px 0; 
          border-left: 4px solid #3b82f6; 
        }
        .training-info h3 { 
          color: #1d4ed8; 
          margin-top: 0; 
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 10px; 
          padding-bottom: 10px; 
          border-bottom: 1px solid #e9ecef; 
        }
        .info-row:last-child { 
          border-bottom: none; 
          margin-bottom: 0; 
          padding-bottom: 0; 
        }
        .info-label { 
          font-weight: 600; 
          color: #495057; 
        }
        .info-value { 
          color: #6c757d; 
        }
        .custom-message { 
          background: #fff3cd; 
          border-radius: 8px; 
          padding: 20px; 
          margin: 20px 0; 
          border-left: 4px solid #ffc107; 
        }
        .custom-message h4 { 
          color: #856404; 
          margin-top: 0; 
        }
        .custom-message p { 
          color: #856404; 
          margin-bottom: 0; 
        }
        .next-steps { 
          background: #e3f2fd; 
          border-radius: 8px; 
          padding: 20px; 
          margin: 20px 0; 
        }
        .next-steps h3 { 
          color: #1976d2; 
          margin-top: 0; 
        }
        .next-steps ul { 
          margin: 0; 
          padding-left: 20px; 
        }
        .next-steps li { 
          margin-bottom: 8px; 
          color: #1565c0; 
        }
        .cta-button { 
          display: inline-block; 
          background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
          color: white; 
          padding: 15px 30px; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: 600; 
          margin: 20px 0; 
        }
        .footer { 
          background: #f8f9fa; 
          padding: 20px; 
          text-align: center; 
          color: #6c757d; 
          font-size: 14px; 
        }
        .support { 
          background: #e3f2fd; 
          border: 1px solid #2196f3; 
          border-radius: 8px; 
          padding: 15px; 
          margin: 20px 0; 
        }
        .support h4 { 
          color: #1976d2; 
          margin-top: 0; 
        }
        .support p { 
          color: #1976d2; 
          margin-bottom: 0; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📚 Recordatorio de Entrenamiento</h1>
          <p>¡Las clases están por comenzar!</p>
        </div>
        
        <div class="content">
          <div style="text-align: center; margin-bottom: 20px;">
            <div class="reminder-badge">Recordatorio de Clases</div>
          </div>
          
          <h2>¡Hola ${userName}!</h2>
          <p>Te recordamos que tienes suscripción activa para las <strong>clases de ${trainingName}</strong> del mes de <strong>${month} ${year}</strong>.</p>
          
          <div class="training-info">
            <h3>📅 Información de tu Entrenamiento</h3>
            <div class="info-row">
              <span class="info-label">Tipo de Entrenamiento:</span>
              <span class="info-value">${trainingName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Período:</span>
              <span class="info-value">${month} ${year}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Estado:</span>
              <span class="info-value" style="color: #22c55e; font-weight: 600;">✅ Activo</span>
            </div>
          </div>
          
          ${customMessage ? `
            <div class="custom-message">
              <h4>💬 Mensaje del Instructor</h4>
              <p>${customMessage}</p>
            </div>
          ` : ''}
          
          ${meetLinks.length > 0 ? `
            <div class="meet-links" style="background: #DCFCE7; border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #166534; margin-top: 0;">🔗 Links de las Clases</h4>
              <p style="color: #166534; margin-bottom: 16px;">Aquí tienes los links de Google Meet para las clases de este mes:</p>
              ${meetLinks.map((link, index) => `
                <div style="margin-bottom: 12px;">
                  <a href="${link}" target="_blank" style="display: inline-block; background: #16a34a; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 8px;">
                    📹 Clase ${index + 1}
                  </a>
                  <span style="color: #166534; font-size: 12px;">${link}</span>
                </div>
              `).join('')}
              <p style="color: #166534; font-size: 12px; margin-top: 12px; margin-bottom: 0;">
                💡 Los links estarán activos 5 minutos antes de cada clase.
              </p>
            </div>
          ` : `
            <div style="background: #FEF9C3; border-left: 4px solid #EAB308; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #854d0e; margin-top: 0;">📅 Links de Clases</h4>
              <p style="color: #854d0e; margin-bottom: 0;">Los links de Google Meet se enviarán por email antes de cada clase.</p>
            </div>
          `}
          
          <div class="next-steps">
            <h3>🚀 ¿Qué sigue ahora?</h3>
            <ul>
              <li>Revisa tu email regularmente para recibir los links de las clases</li>
              <li>Las clases se realizarán según el cronograma establecido</li>
              <li>Recibirás recordatorios 24 horas antes de cada sesión</li>
              <li>Tendrás acceso a todos los materiales y recursos</li>
              <li>Podrás hacer preguntas durante las sesiones en vivo</li>
            </ul>
          </div>
          
          <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/entrenamientos" class="cta-button">Ver Mis Entrenamientos</a>
          
          <div class="support">
            <h4>💬 ¿Necesitas ayuda?</h4>
            <p>Si tienes alguna pregunta sobre tu entrenamiento o necesitas asistencia, no dudes en contactarnos en <strong>soporte@nahuellozano.com</strong></p>
          </div>
        </div>
        
        <div class="footer">
          <p>© 2024 Nahuel Lozano Trading. Todos los derechos reservados.</p>
          <p>Este es un email automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
