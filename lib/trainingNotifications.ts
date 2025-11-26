import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import User from '@/models/User';
import { sendEmail } from '@/lib/emailService';

/**
 * Crea notificación cuando un usuario se inscribe a un entrenamiento
 */
export async function createTrainingEnrollmentNotification(
  userEmail: string,
  userName: string,
  trainingType: string,
  trainingName: string,
  price: number
): Promise<void> {
  try {
    await dbConnect();
    
    console.log('🎓 [TRAINING ENROLLMENT] Creando notificación de inscripción:', {
      userEmail,
      trainingType,
      trainingName,
      price
    });

    // Crear notificación para el usuario
    const userNotification = new Notification({
      title: `🎓 ¡Bienvenido al entrenamiento ${trainingName}!`,
      message: `Tu inscripción al entrenamiento ${trainingName} ha sido confirmada. Ya tienes acceso completo a todo el contenido y las clases en vivo.`,
      type: 'novedad',
      priority: 'alta',
      targetUsers: 'todos', // Se mostrará solo al usuario específico
      icon: '🎓',
      actionUrl: `/entrenamientos/zero2trader`,
      actionText: 'Ir al Entrenamiento',
      isActive: true,
      createdBy: 'sistema',
      isAutomatic: true,
      metadata: {
        trainingType,
        trainingName,
        price,
        enrollmentDate: new Date(),
        automatic: true
      }
    });

    await userNotification.save();
    console.log('✅ [TRAINING ENROLLMENT] Notificación de usuario creada:', userNotification._id);

    // Enviar email de bienvenida al usuario
    try {
      const welcomeEmailHtml = createTrainingWelcomeEmailTemplate(userName, trainingName, trainingType, price);
      
      await sendEmail({
        to: userEmail,
        subject: `🎓 ¡Bienvenido al entrenamiento ${trainingName}! - Nahuel Lozano Trading`,
        html: welcomeEmailHtml
      });

      console.log('✅ [TRAINING ENROLLMENT] Email de bienvenida enviado a:', userEmail);
    } catch (emailError) {
      console.error('❌ [TRAINING ENROLLMENT] Error enviando email de bienvenida:', emailError);
    }

    // Crear notificación para el administrador
    const adminNotification = new Notification({
      title: `🎓 Nueva inscripción: ${trainingName}`,
      message: `${userName} (${userEmail}) se ha inscrito al entrenamiento ${trainingName}. Precio: $${price}`,
      type: 'sistema',
      priority: 'media',
      targetUsers: 'admin',
      icon: '👤',
      actionUrl: `/admin/users`,
      actionText: 'Ver Usuario',
      isActive: true,
      createdBy: 'sistema',
      isAutomatic: true,
      metadata: {
        userEmail,
        userName,
        trainingType,
        trainingName,
        price,
        enrollmentDate: new Date(),
        automatic: true
      }
    });

    await adminNotification.save();
    console.log('✅ [TRAINING ENROLLMENT] Notificación de admin creada:', adminNotification._id);

    // Enviar email al administrador
    try {
      const adminRecipients = [
        ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
        ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean) : [])
      ];
      if (adminRecipients.length > 0) {
        const adminEmailHtml = createAdminEnrollmentNotificationTemplate(userName, userEmail, trainingName, price);
        for (const to of adminRecipients) {
          await sendEmail({ to, subject: `🎓 Nueva inscripción: ${trainingName} - ${userName}`, html: adminEmailHtml });
        }
        console.log('✅ [TRAINING ENROLLMENT] Email de notificación enviado a administradores');
      }
    } catch (adminEmailError) {
      console.error('❌ [TRAINING ENROLLMENT] Error enviando email al admin:', adminEmailError);
    }

  } catch (error) {
    console.error('❌ [TRAINING ENROLLMENT] Error creando notificaciones de inscripción:', error);
  }
}

/**
 * Crea notificación cuando el admin crea un nuevo horario de entrenamiento
 */
export async function createTrainingScheduleNotification(
  trainingType: string,
  trainingName: string,
  scheduleDetails: {
    dayOfWeek: number;
    hour: number;
    minute: number;
    duration: number;
    price: number;
  }
): Promise<void> {
  try {
    await dbConnect();
    
    console.log('📅 [TRAINING SCHEDULE] Creando notificación de nuevo horario:', {
      trainingType,
      trainingName,
      scheduleDetails
    });

    // Buscar usuarios inscritos en este entrenamiento
    const enrolledUsers = await User.find({
      'entrenamientos': {
        $elemMatch: {
          tipo: trainingType,
          activo: true
        }
      }
    }, 'email name');

    console.log(`👥 [TRAINING SCHEDULE] Encontrados ${enrolledUsers.length} usuarios inscritos en ${trainingType}`);

    if (enrolledUsers.length === 0) {
      console.log('ℹ️ [TRAINING SCHEDULE] No hay usuarios inscritos para notificar');
      return;
    }

    // Formatear información del horario
    const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayName = daysOfWeek[scheduleDetails.dayOfWeek];
    const timeString = `${scheduleDetails.hour.toString().padStart(2, '0')}:${scheduleDetails.minute.toString().padStart(2, '0')}`;
    const durationHours = Math.floor(scheduleDetails.duration / 60);
    const durationMinutes = scheduleDetails.duration % 60;
    const durationString = durationMinutes > 0 ? `${durationHours}h ${durationMinutes}min` : `${durationHours}h`;

    // Crear notificación global para usuarios inscritos
    const scheduleNotification = new Notification({
      title: `📅 Nuevo horario disponible: ${trainingName}`,
      message: `Se ha agregado un nuevo horario para ${trainingName}: ${dayName}s a las ${timeString} (${durationString}). ¡Reserva tu lugar ahora!`,
      type: 'actualizacion',
      priority: 'alta',
      targetUsers: 'suscriptores', // Se mostrará a usuarios inscritos
      icon: '📅',
      actionUrl: `/entrenamientos/zero2trader`,
      actionText: 'Reservar Clase',
      isActive: true,
      createdBy: 'admin',
      isAutomatic: true,
      metadata: {
        trainingType,
        trainingName,
        scheduleDetails,
        dayName,
        timeString,
        durationString,
        automatic: true
      }
    });

    await scheduleNotification.save();
    console.log('✅ [TRAINING SCHEDULE] Notificación global creada:', scheduleNotification._id);

    // Enviar emails a usuarios inscritos
    let emailsSent = 0;
    const emailErrors: string[] = [];

    for (const user of enrolledUsers) {
      try {
        const scheduleEmailHtml = createTrainingScheduleEmailTemplate(
          user.name || user.email,
          trainingName,
          dayName,
          timeString,
          durationString,
          scheduleDetails.price
        );

        await sendEmail({
          to: user.email,
          subject: `📅 Nuevo horario disponible: ${trainingName} - ${dayName}s ${timeString}`,
          html: scheduleEmailHtml
        });

        emailsSent++;
        console.log(`✅ [TRAINING SCHEDULE] Email enviado a: ${user.email}`);

      } catch (emailError) {
        console.error(`❌ [TRAINING SCHEDULE] Error enviando email a ${user.email}:`, emailError);
        emailErrors.push(`${user.email}: ${emailError}`);
      }
    }

    console.log(`📊 [TRAINING SCHEDULE] Resumen de emails: ${emailsSent} enviados, ${emailErrors.length} errores`);
    if (emailErrors.length > 0) {
      console.error('❌ [TRAINING SCHEDULE] Errores de email:', emailErrors);
    }

    // Enviar resumen a administradores
    try {
      const adminRecipients = [
        ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
        ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean) : [])
      ];
      if (adminRecipients.length > 0) {
        const adminHtml = `
          <h2>Nuevo horario creado: ${trainingName}</h2>
          <p>Día: <strong>${dayName}</strong></p>
          <p>Hora: <strong>${timeString}</strong></p>
          <p>Duración: <strong>${durationString}</strong></p>
          <p>Usuarios notificados: <strong>${enrolledUsers.length}</strong>, emails enviados: <strong>${emailsSent}</strong></p>
        `;
        for (const adminEmail of adminRecipients) {
          await sendEmail({ to: adminEmail, subject: `📅 Nuevo horario: ${trainingName} - ${dayName} ${timeString}`, html: adminHtml });
        }
      }
    } catch (e) {
      console.error('⚠️ Error enviando resumen a administradores:', e);
    }

  } catch (error) {
    console.error('❌ [TRAINING SCHEDULE] Error creando notificación de horario:', error);
  }
}

/**
 * Template para email de bienvenida al entrenamiento
 */
function createTrainingWelcomeEmailTemplate(
  userName: string,
  trainingName: string,
  trainingType: string,
  price: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>¡Bienvenido al entrenamiento ${trainingName}!</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #8B0000 0%, #A52A2A 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px;">🎓 ¡Bienvenido al entrenamiento ${trainingName}!</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Tu inscripción ha sido confirmada exitosamente</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
        <h2 style="color: #8B0000; margin-top: 0;">✅ Inscripción Confirmada</h2>
        <p><strong>Hola ${userName},</strong></p>
        <p>¡Felicitaciones! Tu inscripción al entrenamiento <strong>${trainingName}</strong> ha sido procesada exitosamente.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8B0000;">
          <h3 style="margin-top: 0; color: #8B0000;">📋 Detalles de tu inscripción:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Entrenamiento:</strong> ${trainingName}</li>
            <li><strong>Precio pagado:</strong> $${price}</li>
            <li><strong>Estado:</strong> Activo</li>
            <li><strong>Acceso:</strong> Inmediato</li>
          </ul>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
        <h2 style="color: #92400e; margin-top: 0;">🚀 ¿Qué puedes hacer ahora?</h2>
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 24px; margin-right: 15px;">📚</span>
          <div>
            <strong style="color: #92400e;">Acceder al contenido</strong><br>
            <span style="color: #92400e; font-size: 14px;">Explora las lecciones y módulos disponibles</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 24px; margin-right: 15px;">📅</span>
          <div>
            <strong style="color: #92400e;">Reservar clases en vivo</strong><br>
            <span style="color: #92400e; font-size: 14px;">Participa en sesiones interactivas con Nahuel</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 24px; margin-right: 15px;">💬</span>
          <div>
            <strong style="color: #92400e;">Comunidad de estudiantes</strong><br>
            <span style="color: #92400e; font-size: 14px;">Conecta con otros traders</span>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://lozanonahuel.com'}/entrenamientos/zero2trader" 
           style="background: linear-gradient(135deg, #8B0000 0%, #A52A2A 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          🎓 Comenzar Entrenamiento
        </a>
      </div>

      <div style="background: #e8f4fd; padding: 20px; border-radius: 12px; margin-top: 30px;">
        <h3 style="color: #1e40af; margin-top: 0;">📞 ¿Necesitas ayuda?</h3>
        <p style="margin-bottom: 10px;">Si tienes alguna pregunta sobre tu entrenamiento, no dudes en contactarnos:</p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>📧 Email: ${process.env.SMTP_USER || 'Soporte@lozanonahuel.com'}</li>
          <li>💬 WhatsApp: +54 9 11 1234-5678</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
        <p>© 2024 Nahuel Lozano Trading. Todos los derechos reservados.</p>
        <p>Este email fue enviado a ${userName} como confirmación de su inscripción.</p>
      </div>

    </body>
    </html>
  `;
}

/**
 * Template para email de notificación al admin sobre nueva inscripción
 */
function createAdminEnrollmentNotificationTemplate(
  userName: string,
  userEmail: string,
  trainingName: string,
  price: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nueva inscripción: ${trainingName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px;">🎓 Nueva inscripción recibida</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Un nuevo estudiante se ha inscrito a un entrenamiento</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
        <h2 style="color: #1e40af; margin-top: 0;">👤 Detalles del estudiante</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af;">
          <h3 style="margin-top: 0; color: #1e40af;">📋 Información de inscripción:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Nombre:</strong> ${userName}</li>
            <li><strong>Email:</strong> ${userEmail}</li>
            <li><strong>Entrenamiento:</strong> ${trainingName}</li>
            <li><strong>Precio:</strong> $${price}</li>
            <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES', { 
              timeZone: process.env.TZ || 'America/Montevideo',
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</li>
          </ul>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://lozanonahuel.com'}/admin/users" 
           style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          👥 Ver Usuario en Admin
        </a>
      </div>

      <div style="background: #e8f4fd; padding: 20px; border-radius: 12px; margin-top: 30px;">
        <h3 style="color: #1e40af; margin-top: 0;">📊 Acciones recomendadas</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Revisar el perfil del usuario</li>
          <li>Verificar el pago en MercadoPago</li>
          <li>Enviar email de bienvenida personalizado</li>
          <li>Agregar a grupos de WhatsApp si aplica</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
        <p>© 2024 Nahuel Lozano Trading. Notificación automática del sistema.</p>
      </div>

    </body>
    </html>
  `;
}

/**
 * Template para email de nuevo horario disponible
 */
function createTrainingScheduleEmailTemplate(
  userName: string,
  trainingName: string,
  dayName: string,
  timeString: string,
  durationString: string,
  price: number
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nuevo horario disponible: ${trainingName}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px;">📅 Nuevo horario disponible</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Se ha agregado un nuevo horario para tu entrenamiento</p>
      </div>

      <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
        <h2 style="color: #059669; margin-top: 0;">🎓 ${trainingName}</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #059669;">📋 Detalles del nuevo horario:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Día:</strong> ${dayName}s</li>
            <li><strong>Hora:</strong> ${timeString}</li>
            <li><strong>Duración:</strong> ${durationString}</li>
            <li><strong>Precio:</strong> $${price}</li>
            <li><strong>Modalidad:</strong> Clase en vivo</li>
          </ul>
        </div>
      </div>

      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
        <h2 style="color: #92400e; margin-top: 0;">⚡ ¡Reserva tu lugar ahora!</h2>
        <p style="color: #92400e; margin-bottom: 20px;">Los cupos son limitados y se llenan rápidamente. Asegúrate de reservar tu lugar lo antes posible.</p>
        
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 24px; margin-right: 15px;">🎯</span>
          <div>
            <strong style="color: #92400e;">Clases interactivas</strong><br>
            <span style="color: #92400e; font-size: 14px;">Aprende directamente con Nahuel</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 24px; margin-right: 15px;">💬</span>
          <div>
            <strong style="color: #92400e;">Preguntas en vivo</strong><br>
            <span style="color: #92400e; font-size: 14px;">Resuelve tus dudas en tiempo real</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 24px; margin-right: 15px;">📱</span>
          <div>
            <strong style="color: #92400e;">Acceso desde cualquier dispositivo</strong><br>
            <span style="color: #92400e; font-size: 14px;">Participa desde tu celular o computadora</span>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://lozanonahuel.com'}/entrenamientos" 
           style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          📅 Reservar Clase
        </a>
      </div>

      <div style="background: #e8f4fd; padding: 20px; border-radius: 12px; margin-top: 30px;">
        <h3 style="color: #1e40af; margin-top: 0;">💡 Consejos para aprovechar al máximo tu clase:</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Llega 5 minutos antes para configurar tu conexión</li>
          <li>Ten preparadas tus preguntas</li>
          <li>Usa auriculares para mejor audio</li>
          <li>Participa activamente en la clase</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
        <p>© 2024 Nahuel Lozano Trading. Todos los derechos reservados.</p>
        <p>Este email fue enviado a ${userName} como notificación de nuevo horario disponible.</p>
      </div>

    </body>
    </html>
  `;
} 