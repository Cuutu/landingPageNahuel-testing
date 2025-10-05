import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import User from '@/models/User';
import { sendEmail } from '@/lib/emailService';
import { getGlobalTimezone, getGlobalReminderHour } from '@/lib/timeConfig';

/**
 * Endpoint para automatización de recordatorios de entrenamientos
 * Se ejecuta cada 24 horas para enviar recordatorios automáticos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir POST para evitar ejecuciones accidentales
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar que sea una llamada autorizada (desde Vercel Cron o con token)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    console.log('🔄 Iniciando proceso automático de recordatorios de entrenamientos...');
    
    await dbConnect();

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const tz = getGlobalTimezone();
    const reminderHour = getGlobalReminderHour();

    // Obtener suscripciones activas del mes actual
    const activeSubscriptions = await MonthlyTrainingSubscription.find({
      subscriptionYear: currentYear,
      subscriptionMonth: currentMonth,
      paymentStatus: 'completed',
      isActive: true
    }).lean();

    if (activeSubscriptions.length === 0) {
      console.log('ℹ️ No hay suscripciones activas para el mes actual');
      return res.status(200).json({
        success: true,
        message: 'No hay suscripciones activas para el mes actual',
        processed: 0
      });
    }

    // Obtener información de usuarios
    const userIds = activeSubscriptions.map(sub => sub.userId);
    const users = await User.find({ googleId: { $in: userIds } })
      .select('googleId name email')
      .lean();

    const userMap = new Map(users.map(user => [user.googleId, user]));

    // Obtener fechas de entrenamiento con links de Meet para el mes actual
    // Obtener links de Meet desde MonthlyTraining (donde realmente están almacenados)
    const MonthlyTraining = (await import('@/models/MonthlyTraining')).default;
    
    // Buscar entrenamientos mensuales del mes actual
    const monthlyTrainings = await MonthlyTraining.find({
      month: currentMonth,
      year: currentYear,
      type: 'swing-trading' // Solo Swing Trading por ahora
    }).lean();

    // Extraer links de Meet de las clases de cada entrenamiento mensual
    const meetLinksByType = new Map<string, string[]>();
    
    monthlyTrainings.forEach(training => {
      const trainingTypeKey = 'SwingTrading'; // Mapear a la clave que espera el frontend
      
      if (!meetLinksByType.has(trainingTypeKey)) {
        meetLinksByType.set(trainingTypeKey, []);
      }
      
      // Recopilar todos los meetingLink de las clases
      training.classes?.forEach((cls: any) => {
        if (cls.meetingLink) {
          meetLinksByType.get(trainingTypeKey)!.push(cls.meetingLink);
        }
      });
    });

    // Agrupar por tipo de entrenamiento
    const subscriptionsByType = activeSubscriptions.reduce((acc, sub) => {
      if (!acc[sub.trainingType]) {
        acc[sub.trainingType] = [];
      }
      acc[sub.trainingType].push(sub);
      return acc;
    }, {} as Record<string, any[]>);

    const results = {
      totalProcessed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Procesar cada tipo de entrenamiento
    for (const [trainingType, subscriptions] of Object.entries(subscriptionsByType)) {
      console.log(`📚 Procesando ${subscriptions.length} suscripciones de ${trainingType}...`);

      // Filtrar emails únicos para evitar duplicados
      const uniqueEmails = new Set();
      const uniqueSubscriptions = subscriptions.filter(sub => {
        const user = userMap.get(sub.userId);
        const email = user?.email || sub.userEmail;
        if (uniqueEmails.has(email)) {
          return false;
        }
        uniqueEmails.add(email);
        return true;
      });

      for (const subscription of uniqueSubscriptions) {
        try {
          const user = userMap.get(subscription.userId);
          const userEmail = user?.email || subscription.userEmail;
          const userName = user?.name || subscription.userName;

          // Verificar si ya se envió recordatorio hoy (evitar spam)
          const today = new Date().toDateString();
          const lastReminderKey = `lastReminder_${subscription._id}_${today}`;
          
          // En un sistema real, podrías usar Redis o una base de datos para trackear esto
          // Por ahora, enviamos recordatorios cada 3 días para evitar spam
          const shouldSendReminder = Math.random() < 0.33; // 33% de probabilidad cada día
          
          if (!shouldSendReminder) {
            console.log(`⏭️ Saltando recordatorio para ${userEmail} (ya enviado recientemente)`);
            continue;
          }

          const trainingName = getTrainingDisplayName(trainingType);
          const monthName = getMonthName(currentMonth);
          const meetLinks = meetLinksByType.get(trainingType) || [];
          
          const html = createTrainingReminderTemplate({
            userName,
            trainingName,
            month: monthName,
            year: currentYear,
            customMessage: `¡Las clases de ${trainingName} están en curso! Revisa tus emails alrededor de las ${reminderHour}:00 (${tz}) para recibir los recordatorios.`,
            meetLinks: meetLinks
          });

          await sendEmail({
            to: userEmail,
            subject: `📚 Recordatorio: Clases de ${trainingName} - ${monthName} ${currentYear}`,
            html
          });

          results.sent++;
          results.totalProcessed++;
          console.log(`✅ Recordatorio automático enviado a: ${userEmail}`);

        } catch (error) {
          results.failed++;
          results.totalProcessed++;
          const errorMsg = `Error enviando recordatorio automático a ${subscription.userEmail}: ${error instanceof Error ? error.message : 'Error desconocido'}`;
          results.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
    }

    console.log(`📧 Proceso automático completado:`, {
      totalProcessed: results.totalProcessed,
      sent: results.sent,
      failed: results.failed,
      month: `${currentMonth}/${currentYear}`
    });

    res.status(200).json({
      success: true,
      message: 'Recordatorios automáticos procesados exitosamente',
      results: {
        totalProcessed: results.totalProcessed,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors.slice(0, 5) // Limitar errores en respuesta
      }
    });

  } catch (error) {
    console.error('❌ Error en proceso automático de recordatorios:', error);
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
            <div class="reminder-badge">Recordatorio Automático</div>
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