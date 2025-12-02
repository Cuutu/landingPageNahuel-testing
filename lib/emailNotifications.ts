import { sendEmail, createTrainingConfirmationTemplate, createAdvisoryConfirmationTemplate, createAdminNotificationTemplate, createAdminContactNotificationTemplate } from '@/lib/emailService';
import { createAdminNewSubscriberTemplate } from '@/lib/emailService';
import { createSubscriptionConfirmationTemplate } from '@/lib/emailService';
import { createNotificationEmailTemplate } from '@/lib/emailService';

/**
 * Envía email de confirmación para entrenamiento
 */
export async function sendTrainingConfirmationEmail(
  userEmail: string,
  userName: string,
  trainingDetails: {
    type: string;
    date: string;
    time: string;
    duration: number;
    meetLink?: string;
  }
) {
  try {
    console.log('📧 Enviando email de confirmación de entrenamiento a:', userEmail);

    const html = createTrainingConfirmationTemplate(userEmail, userName, trainingDetails);
    
    await sendEmail({
      to: userEmail,
      subject: '✅ Confirmación de Entrenamiento - Nahuel Lozano Trading',
      html
    });

    console.log('✅ Email de confirmación de entrenamiento enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de confirmación de entrenamiento:', error);
    throw error;
  }
}

/**
 * Envía email de confirmación para asesoría
 */
export async function sendAdvisoryConfirmationEmail(
  userEmail: string,
  userName: string,
  advisoryDetails: {
    type: string;
    date: string;
    time: string;
    duration: number;
    price?: number;
    meetLink?: string;
  }
) {
  try {
    console.log('📧 Enviando email de confirmación de asesoría a:', userEmail);

    const html = createAdvisoryConfirmationTemplate(userEmail, userName, advisoryDetails);
    
    await sendEmail({
      to: userEmail,
      subject: '✅ Confirmación de Asesoría - Consultorio Financiero',
      html
    });

    console.log('✅ Email de confirmación de asesoría enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de confirmación de asesoría:', error);
    throw error;
  }
}

/**
 * Envía email de confirmación para suscripción mensual de entrenamiento
 */
export async function sendMonthlyTrainingConfirmationEmail(params: {
  userEmail: string;
  userName: string;
  trainingType: string;
  subscriptionMonth: number;
  subscriptionYear: number;
  startDate: Date;
  endDate: Date;
  classes: Array<{
    date: string;
    startTime: string;
    title: string;
    meetingLink?: string;
  }>;
  price: number;
}) {
  try {
    const { userEmail, userName, trainingType, subscriptionMonth, subscriptionYear, classes, price } = params;
    console.log('📧 Enviando email de confirmación de suscripción mensual a:', userEmail);

    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const monthName = monthNames[subscriptionMonth - 1];

    const trainingDisplayName = trainingType === 'SwingTrading' ? 'Zero 2 Trader' : trainingType;

    // Crear HTML del email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmación de Suscripción Mensual</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">¡Bienvenido al Entrenamiento Mensual!</h1>
            <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Tu suscripción ha sido confirmada</p>
          </div>

          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
              Hola <strong>${userName}</strong>,
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin: 0 0 30px 0;">
              ¡Excelente noticia! Tu suscripción al entrenamiento <strong>${trainingDisplayName}</strong> para el mes de <strong>${monthName} ${subscriptionYear}</strong> ha sido confirmada exitosamente.
            </p>

            <!-- Classes Section -->
            <div style="background-color: #f8f9fa; border-radius: 12px; padding: 24px; margin: 30px 0;">
              <h2 style="color: #333333; font-size: 20px; margin: 0 0 20px 0; font-weight: 600;">
                📅 Clases Programadas
              </h2>
              
              ${classes.length > 0 ? `
                <div style="margin-bottom: 20px;">
                  ${classes.map((cls, index) => `
                    <div style="background-color: #ffffff; border-left: 4px solid #667eea; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px;">
                          <h3 style="color: #333333; font-size: 16px; margin: 0 0 8px 0; font-weight: 600;">
                            ${cls.title}
                          </h3>
                          <p style="color: #666666; font-size: 14px; margin: 0 0 4px 0;">
                            📅 ${cls.date}
                          </p>
                          <p style="color: #666666; font-size: 14px; margin: 0;">
                            🕐 ${cls.startTime}
                          </p>
                        </div>
                        ${cls.meetingLink ? `
                          <div style="margin-top: 12px;">
                            <a href="${cls.meetingLink}" 
                               style="display: inline-block; background-color: #667eea; color: #ffffff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
                              Unirse a la Clase
                            </a>
                          </div>
                        ` : `
                          <div style="margin-top: 12px;">
                            <span style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                              Link Próximamente
                            </span>
                          </div>
                        `}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p style="color: #666666; font-size: 14px; margin: 0; padding: 20px; text-align: center; background-color: #ffffff; border-radius: 8px;">
                  📅 Las clases para este mes se programarán próximamente. Te notificaremos cuando estén disponibles.
                </p>
              `}
            </div>

            <!-- Info Box -->
            <div style="background-color: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 20px; margin: 30px 0; border-radius: 8px;">
              <h3 style="color: #0369a1; font-size: 16px; margin: 0 0 12px 0; font-weight: 600;">
                ℹ️ Información Importante
              </h3>
              <ul style="color: #0369a1; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Tu acceso al entrenamiento es válido durante todo el mes de <strong>${monthName} ${subscriptionYear}</strong></li>
                <li>Recibirás recordatorios 24 horas y 1 hora antes de cada clase</li>
                <li>Los links de Google Meet se compartirán automáticamente</li>
                <li>Si tienes preguntas, puedes contactarnos en soporte@lozanonahuel.com</li>
              </ul>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/entrenamientos/zero2trader" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Ver Detalles del Entrenamiento
              </a>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                <strong>Monto Pagado:</strong> $${price.toLocaleString('es-AR')} ARS
              </p>
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0;">
                <strong>Período de Acceso:</strong> ${monthName} ${subscriptionYear}
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">
              ¿Necesitas ayuda? Contáctanos en <a href="mailto:soporte@lozanonahuel.com" style="color: #667eea; text-decoration: none;">soporte@lozanonahuel.com</a>
            </p>
            <p style="color: #999999; font-size: 12px; margin: 10px 0 0 0;">
              © ${new Date().getFullYear()} Nahuel Lozano Trading. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: userEmail,
      subject: `✅ Confirmación de Suscripción - ${trainingDisplayName} ${monthName} ${subscriptionYear}`,
      html
    });

    console.log('✅ Email de confirmación de suscripción mensual enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de confirmación de suscripción mensual:', error);
    throw error;
  }
}

/**
 * Envía email de recordatorio para asesoría al usuario
 */
export async function sendAdvisoryReminderEmail(params: {
  userEmail: string;
  userName: string;
  serviceType: string;
  startDate: Date;
  durationMinutes: number;
  meetLink?: string;
  reminderType: '24h' | '1h';
}): Promise<void> {
  const { userEmail, userName, serviceType, startDate, durationMinutes, meetLink, reminderType } = params;
  console.log(`📧 Enviando recordatorio (${reminderType}) de asesoría a:`, userEmail);

  const tz = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
  const formattedDate = startDate.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz
  });
  const formattedTime = startDate.toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', timeZone: tz
  });

  const content = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="display:inline-block; background:#e0f2fe; color:#0369a1; padding:8px 16px; border-radius:9999px; font-weight:700; font-size:12px;">Recordatorio ${reminderType === '24h' ? '24 horas' : '1 hora'}</div>
    </div>
    <p>Hola <strong>${userName}</strong>,</p>
    <p>Te recordamos tu <strong>asesoría de ${serviceType}</strong> programada para:</p>
    <ul>
      <li><strong>Fecha:</strong> ${formattedDate}</li>
      <li><strong>Hora:</strong> ${formattedTime}</li>
      <li><strong>Duración:</strong> ${durationMinutes} minutos</li>
    </ul>
    ${meetLink ? `
      <div style="background:#DCFCE7; border-left:4px solid #22c55e; padding:16px; border-radius:8px; margin:16px 0;">
        <div style="font-weight:700; color:#166534; margin-bottom:8px;">Link de reunión</div>
        <a href="${meetLink}" target="_blank" style="display:inline-block; background:#16a34a; color:white; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">Unirme a la reunión</a>
        <p style="margin:8px 0 0; color:#166534; font-size:12px;">El link estará activo 5 minutos antes.</p>
      </div>
    ` : `
      <div style="background:#FEF9C3; border-left:4px solid #EAB308; padding:16px; border-radius:8px; margin:16px 0;">
        <div style="font-weight:700; color:#854d0e;">Link de reunión</div>
        <p style="margin:8px 0 0; color:#854d0e;">Recibirás el link por email antes de la sesión.</p>
      </div>
`}
    <p style="margin-top:16px;">Si necesitas reprogramar o cancelar, por favor avísanos con 24 horas de anticipación.</p>
  `;

  const html = createNotificationEmailTemplate({
    title: '⏰ Recordatorio de Asesoría',
    content,
    notificationType: 'info',
    urgency: reminderType === '1h' ? 'high' : 'normal',
    buttonText: 'Ver Mi Reserva',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
  });

  await sendEmail({
    to: userEmail,
    subject: `⏰ Recordatorio ${reminderType === '24h' ? '24h' : '1h'} - ${serviceType}`,
    html
  });
  console.log(`✅ Recordatorio (${reminderType}) enviado a ${userEmail}`);
}

/**
 * Envía email de recordatorio para entrenamiento al usuario
 */
export async function sendTrainingReminderEmail(params: {
  userEmail: string;
  userName: string;
  trainingName: string;
  startDate: Date;
  durationMinutes: number;
  meetLink?: string;
  reminderType: '24h' | '1h';
}): Promise<void> {
  const { userEmail, userName, trainingName, startDate, durationMinutes, meetLink, reminderType } = params;
  console.log(`📧 Enviando recordatorio (${reminderType}) de entrenamiento a:`, userEmail);

  const tz = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
  const formattedDate = startDate.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz
  });
  const formattedTime = startDate.toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit', timeZone: tz
  });

  const content = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="display:inline-block; background:#e0f2fe; color:#0369a1; padding:8px 16px; border-radius:9999px; font-weight:700; font-size:12px;">Recordatorio ${reminderType === '24h' ? '24 horas' : '1 hora'}</div>
    </div>
    <p>Hola <strong>${userName}</strong>,</p>
    <p>Te recordamos tu <strong>clase de ${trainingName}</strong> programada para:</p>
    <ul>
      <li><strong>Fecha:</strong> ${formattedDate}</li>
      <li><strong>Hora:</strong> ${formattedTime}</li>
      <li><strong>Duración:</strong> ${durationMinutes} minutos</li>
    </ul>
    ${meetLink ? `
      <div style="background:#DCFCE7; border-left:4px solid #22c55e; padding:16px; border-radius:8px; margin:16px 0;">
        <div style="font-weight:700; color:#166534; margin-bottom:8px;">Link de reunión</div>
        <a href="${meetLink}" target="_blank" style="display:inline-block; background:#16a34a; color:white; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">Unirme a la reunión</a>
        <p style="margin:8px 0 0; color:#166534; font-size:12px;">El link estará activo 5 minutos antes.</p>
      </div>
    ` : `
      <div style="background:#FEF9C3; border-left:4px solid #EAB308; padding:16px; border-radius:8px; margin:16px 0;">
        <div style="font-weight:700; color:#854d0e;">Link de reunión</div>
        <p style="margin:8px 0 0; color:#854d0e;">Recibirás el link por email antes de la clase.</p>
      </div>
`}
    <p style="margin-top:16px;">Si necesitas reprogramar o cancelar, por favor avísanos con 24 horas de anticipación.</p>
  `;

  const html = createNotificationEmailTemplate({
    title: '⏰ Recordatorio de Entrenamiento',
    content,
    notificationType: 'info',
    urgency: reminderType === '1h' ? 'high' : 'normal',
    buttonText: 'Ver Mis Entrenamientos',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
  });

  await sendEmail({
    to: userEmail,
    subject: `⏰ Recordatorio ${reminderType === '24h' ? '24h' : '1h'} - ${trainingName}`,
    html
  });
  console.log(`✅ Recordatorio (${reminderType}) enviado a ${userEmail}`);
}

/**
 * Envía email de confirmación para reserva (booking)
 */
export async function sendBookingConfirmationEmail(
  userEmail: string,
  userName: string,
  serviceType: string,
  startDate: Date,
  endDate: Date,
  amount: number
) {
  try {
    console.log('📧 Enviando email de confirmación de reserva a:', userEmail);

    // Usar la MISMA lógica de formateo que createAdvisoryEvent
    const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';

    const advisoryDetails = {
      type: serviceType,
      date: new Intl.DateTimeFormat('es-ES', {
        timeZone: timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(startDate),
      time: new Intl.DateTimeFormat('es-ES', {
        timeZone: timeZone,
        hour: '2-digit',
        minute: '2-digit'
      }).format(startDate),
      duration: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)),
      price: amount
    };

    const html = createAdvisoryConfirmationTemplate(userEmail, userName, advisoryDetails);
    
    await sendEmail({
      to: userEmail,
      subject: '✅ Confirmación de Reserva - Consultorio Financiero',
      html
    });

    console.log('✅ Email de confirmación de reserva enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de confirmación de reserva:', error);
    throw error;
  }
}

/**
 * Envía notificación al admin sobre nueva reserva
 */
export async function sendAdminNotificationEmail(
  bookingDetails: {
    userEmail: string;
    userName: string;
    type: 'training' | 'advisory';
    serviceType: string;
    date: string;
    time: string;
    duration: number;
    price?: number;
    meetLink?: string;
  }
) {
  try {
    console.log('📧 Enviando notificación al admin sobre nueva reserva');

    const html = createAdminNotificationTemplate(bookingDetails);
    
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    
    if (!adminEmail) {
      console.error('❌ No se encontró email válido para el administrador');
      console.error('📧 Variables disponibles:', {
        ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
        SMTP_USER: !!process.env.SMTP_USER,
        EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS
      });
      throw new Error('Email del administrador no configurado');
    }
    
    console.log('📧 Enviando notificación al admin:', adminEmail);
    
    await sendEmail({
      to: adminEmail,
      subject: `🔔 Nueva Reserva: ${bookingDetails.type === 'training' ? 'Entrenamiento' : 'Asesoría'} - ${bookingDetails.userName}`,
      html
    });

    console.log('✅ Email de notificación al admin enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar notificación al admin:', error);
    throw error;
  }
}

/**
 * Envía email de confirmación al usuario que envió el mensaje de contacto
 */
export async function sendUserContactConfirmationEmail(
  contactDetails: {
    userEmail: string;
    userName: string;
    userLastName: string;
    message: string;
    timestamp: number;
  }
) {
  try {
    console.log('📧 Enviando email de confirmación de contacto al usuario:', contactDetails.userEmail);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Mensaje Enviado Correctamente - Nahuel Lozano Trading</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f8f9fa;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
            color: white; 
            padding: 30px 20px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content { 
            padding: 30px 20px; 
          }
          .success-icon {
            text-align: center;
            margin-bottom: 20px;
          }
          .success-icon .icon {
            display: inline-block;
            background: #10b981;
            color: white;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            line-height: 60px;
            font-size: 24px;
            margin-bottom: 15px;
          }
          .info-box { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #3b82f6; 
          }
          .label { 
            font-weight: 600; 
            color: #555; 
            display: block;
            margin-bottom: 5px;
          }
          .value { 
            color: #333; 
            margin-bottom: 15px;
          }
          .message-preview {
            background: #f1f5f9;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            font-style: italic;
            color: #64748b;
            margin: 15px 0;
          }
          .next-steps {
            background: #ecfdf5;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #10b981;
            margin: 20px 0;
          }
          .next-steps h3 {
            margin: 0 0 10px 0;
            color: #065f46;
            font-size: 18px;
          }
          .next-steps ul {
            margin: 0;
            padding-left: 20px;
            color: #047857;
          }
          .footer { 
            background: #f8f9fa;
            padding: 20px;
            text-align: center; 
            color: #666; 
            font-size: 14px; 
            border-top: 1px solid #e5e7eb;
          }
          .footer a {
            color: #3b82f6;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Mensaje Enviado Correctamente</h1>
            <p>Tu consulta ha sido recibida</p>
          </div>
          
          <div class="content">
            <div class="success-icon">
              <div class="icon">✓</div>
              <h2 style="margin: 0; color: #10b981;">¡Gracias por contactarnos!</h2>
            </div>
            
            <p>Hola <strong>${contactDetails.userName} ${contactDetails.userLastName}</strong>,</p>
            
            <p>Hemos recibido tu mensaje correctamente y te responderemos a la brevedad.</p>
            
            <div class="info-box">
              <div class="label">📧 Email:</div>
              <div class="value">${contactDetails.userEmail}</div>
              
              <div class="label">📅 Fecha de envío:</div>
              <div class="value">${new Date(contactDetails.timestamp).toLocaleString('es-ES', {
                timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
              
              <div class="label">💬 Tu mensaje:</div>
              <div class="message-preview">"${contactDetails.message.substring(0, 150)}${contactDetails.message.length > 150 ? '...' : ''}"</div>
            </div>
            
            <div class="next-steps">
              <h3>📋 Próximos pasos:</h3>
              <ul>
                <li>Revisaremos tu mensaje en las próximas 24 horas</li>
                <li>Te responderemos directamente a este email</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Este email fue generado automáticamente al recibir tu mensaje de contacto.</p>
            <p>
              <a href="https://lozanonahuel.vercel.app">Nahuel Lozano Trading</a> | 
              <a href="https://lozanonahuel.vercel.app/recursos">Recursos</a> | 
              <a href="https://lozanonahuel.vercel.app/asesorias">Asesorías</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmail({
      to: contactDetails.userEmail,
      subject: '✅ Mensaje Enviado Correctamente - Nahuel Lozano Trading',
      html
    });

    console.log('✅ Email de confirmación de contacto al usuario enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de confirmación de contacto al usuario:', error);
    throw error;
  }
}

/**
 * Envía notificación al admin sobre nuevo mensaje de contacto
 */
export async function sendAdminContactNotificationEmail(
  contactDetails: {
    userEmail: string;
    userName: string;
    userLastName: string;
    message: string;
    timestamp: number;
  }
) {
  try {
    console.log('📧 Enviando notificación al admin sobre nuevo mensaje de contacto');

    const html = createAdminContactNotificationTemplate(contactDetails);
    
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    
    if (!adminEmail) {
      console.error('❌ No se encontró email válido para el administrador');
      console.error('📧 Variables disponibles:', {
        ADMIN_EMAIL: !!process.env.ADMIN_EMAIL,
        SMTP_USER: !!process.env.SMTP_USER,
        EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS
      });
      throw new Error('Email del administrador no configurado');
    }
    
    console.log('📧 Enviando notificación al admin:', adminEmail);
    
    await sendEmail({
      to: adminEmail,
      subject: `📧 Nuevo Mensaje de Contacto: ${contactDetails.userName} ${contactDetails.userLastName}`,
      html
    });

    console.log('✅ Email de notificación de contacto al admin enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar notificación de contacto al admin:', error);
    throw error;
  }
}

/**
 * Envía notificación al admin sobre nuevo suscriptor de alertas
 */
export async function sendAdminNewSubscriberEmail(details: {
  userEmail: string;
  userName: string;
  service: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  amount?: number;
  currency?: string;
  paymentId?: string;
  transactionDate?: Date;
  expiryDate?: Date | string;
}) {
  try {
    console.log('📧 Enviando notificación al admin sobre nuevo suscriptor');

    const html = createAdminNewSubscriberTemplate(details);
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    if (!adminEmail) {
      console.error('❌ No se encontró email válido para el administrador');
      throw new Error('Email del administrador no configurado');
    }

    await sendEmail({
      to: adminEmail,
      subject: `🔔 Nuevo Suscriptor - ${details.service} - ${details.userName || details.userEmail}`,
      html
    });

    console.log('✅ Email de nuevo suscriptor enviado al admin');
  } catch (error) {
    console.error('❌ Error enviando email de nuevo suscriptor al admin:', error);
  }
}

/**
 * Envía email de confirmación de suscripción al usuario
 */
export async function sendSubscriptionConfirmationEmail(params: {
  userEmail: string;
  userName: string;
  service: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  expiryDate?: Date | string;
  startDate?: Date | string;
  isRenewal?: boolean;
  previousExpiry?: Date | string | null;
  isTrial?: boolean; // ✅ NUEVO: Indicar si es prueba gratis
}) {
  try {
    console.log('📧 Enviando confirmación de suscripción a usuario:', params.userEmail, {
      isRenewal: params.isRenewal,
      isTrial: params.isTrial,
      previousExpiry: params.previousExpiry
    });
    const html = createSubscriptionConfirmationTemplate({
      userName: params.userName,
      service: params.service,
      expiryDate: params.expiryDate,
      startDate: params.startDate,
      isRenewal: params.isRenewal,
      previousExpiry: params.previousExpiry || undefined,
      isTrial: params.isTrial // ✅ NUEVO: Pasar parámetro isTrial
    });
    
    // ✅ NUEVO: Asunto personalizado para trials
    const subject = params.isTrial 
      ? `🎁 Prueba Gratis Activada - ${params.service}`
      : `✅ ${params.isRenewal ? 'Renovación Exitosa' : 'Suscripción Activa'} - ${params.service}`;
    
    await sendEmail({
      to: params.userEmail,
      subject,
      html
    });
    console.log(`✅ Confirmación de ${params.isTrial ? 'trial' : 'suscripción'} enviada al usuario`);
  } catch (error) {
    console.error('❌ Error enviando confirmación de suscripción al usuario:', error);
  }
}

/**
 * Envía email de confirmación de pago exitoso
 */
export async function sendPaymentSuccessEmail(
  userEmail: string,
  userName: string,
  paymentDetails: {
    service: string;
    amount: number;
    currency: string;
    paymentId: string;
    transactionDate: Date;
    paymentMethod?: string;
  }
) {
  try {
    console.log('📧 Enviando email de confirmación de pago exitoso a:', userEmail);

    const serviceNames: { [key: string]: string } = {
      'TraderCall': 'TraderCall',
      'SmartMoney': 'SmartMoney',
      'CashFlow': 'CashFlow Analysis',
      'SwingTrading': 'Entrenamiento Zero 2 Trader',
      'DowJones': 'Entrenamiento Dow Jones',
      'ConsultorioFinanciero': 'Consultoría Financiera'
    };

    const serviceName = serviceNames[paymentDetails.service] || paymentDetails.service;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pago Confirmado - Nahuel Lozano Trading</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; color: #10b981; text-align: center; margin-bottom: 20px; }
          .payment-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e9ecef; }
          .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .detail-label { font-weight: 600; color: #495057; }
          .detail-value { color: #6c757d; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
          .support { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .support h4 { color: #856404; margin-top: 0; }
          .support p { color: #856404; margin-bottom: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Pago Confirmado</h1>
            <p>¡Gracias por tu compra!</p>
          </div>
          
          <div class="content">
            <div class="success-icon">🎉</div>
            
            <h2>¡Hola ${userName}!</h2>
            <p>Tu pago ha sido procesado exitosamente. Ya tienes acceso completo a <strong>${serviceName}</strong>.</p>
            
            <div class="payment-details">
              <h3>Detalles del Pago</h3>
              <div class="detail-row">
                <span class="detail-label">Servicio:</span>
                <span class="detail-value">${serviceName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Monto:</span>
                <span class="detail-value">$${paymentDetails.amount} ${paymentDetails.currency}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">ID de Transacción:</span>
                <span class="detail-value">${paymentDetails.paymentId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha:</span>
                <span class="detail-value">${paymentDetails.transactionDate.toLocaleDateString('es-ES', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Argentina/Buenos_Aires'
                })}</span>
              </div>
              ${paymentDetails.paymentMethod ? `
              <div class="detail-row">
                <span class="detail-label">Método de Pago:</span>
                <span class="detail-value">${paymentDetails.paymentMethod}</span>
              </div>
              ` : ''}
            </div>
            
            ${['TraderCall', 'SmartMoney', 'CashFlow'].includes(paymentDetails.service) ? `
              <a href="${process.env.NEXTAUTH_URL}/alertas" class="cta-button">Ir a las Alertas</a>
            ` : ''}
            ${['SwingTrading', 'DowJones'].includes(paymentDetails.service) ? `
              <a href="${process.env.NEXTAUTH_URL}/entrenamientos" class="cta-button">Acceder al Entrenamiento</a>
            ` : ''}
            ${paymentDetails.service.includes('booking') ? `
              <a href="${process.env.NEXTAUTH_URL}/reservas" class="cta-button">Ver Mis Reservas</a>
            ` : ''}
            
            <div class="support">
              <h4>💬 ¿Necesitas ayuda?</h4>
              <p>Si tienes alguna pregunta sobre tu compra o necesitas asistencia, no dudes en contactarnos en <strong>Soporte@lozanonahuel.com</strong></p>
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
    
    await sendEmail({
      to: userEmail,
      subject: `✅ Pago Confirmado - ${serviceName} - Nahuel Lozano Trading`,
      html
    });

    console.log('✅ Email de confirmación de pago exitoso enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de confirmación de pago exitoso:', error);
    throw error;
  }
}

/**
 * Envía email de notificación de pago fallido
 */
export async function sendPaymentFailedEmail(
  userEmail: string,
  userName: string,
  paymentDetails: {
    service: string;
    amount: number;
    currency: string;
    errorCode?: string;
    errorMessage?: string;
    externalReference: string;
  }
) {
  try {
    console.log('📧 Enviando email de notificación de pago fallido a:', userEmail);

    const serviceNames: { [key: string]: string } = {
      'TraderCall': 'TraderCall',
      'SmartMoney': 'SmartMoney',
      'CashFlow': 'CashFlow Analysis',
      'SwingTrading': 'Entrenamiento Zero 2 Trader',
      'DowJones': 'Entrenamiento Dow Jones',
      'ConsultorioFinanciero': 'Consultoría Financiera'
    };

    const serviceName = serviceNames[paymentDetails.service] || paymentDetails.service;
    
    const getErrorMessage = (errorCode?: string) => {
      if (!errorCode) return 'Tu pago no pudo ser procesado. Por favor, intenta nuevamente.';
      
      const errorMessages: { [key: string]: string } = {
        'cc_rejected_insufficient_amount': 'Fondos insuficientes en tu tarjeta',
        'cc_rejected_bad_filled_card_number': 'Número de tarjeta inválido',
        'cc_rejected_bad_filled_date': 'Fecha de vencimiento inválida',
        'cc_rejected_bad_filled_security_code': 'Código de seguridad inválido',
        'cc_rejected_other_reason': 'Tarjeta rechazada por el banco',
        'cc_rejected_call_for_authorize': 'Debes autorizar el pago con tu banco',
        'cc_rejected_duplicated_payment': 'Pago duplicado',
        'cc_rejected_high_risk': 'Transacción de alto riesgo',
        'cc_rejected_max_attempts': 'Máximo de intentos excedido',
        'cc_rejected_invalid_installments': 'Número de cuotas inválido',
        'cc_rejected_blacklist': 'Tarjeta en lista negra',
        'cc_rejected_insufficient_data': 'Datos insuficientes',
        'cc_rejected_bad_filled_other': 'Datos de la tarjeta incorrectos',
        'cc_rejected_do_not_honor': 'Banco no autoriza la transacción',
        'cc_rejected_expired': 'Tarjeta expirada',
        'cc_rejected_restricted': 'Tarjeta restringida',
        'cc_rejected_stealing_suspect': 'Transacción sospechosa',
        'cc_rejected_use_other_card': 'Usa otra tarjeta',
        'cc_rejected_use_other_payment_method': 'Usa otro método de pago'
      };
      
      return errorMessages[errorCode] || paymentDetails.errorMessage || 'Error desconocido';
    };
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pago No Procesado - Nahuel Lozano Trading</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { padding: 30px; }
          .error-icon { font-size: 48px; color: #ef4444; text-align: center; margin-bottom: 20px; }
          .payment-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ef4444; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e9ecef; }
          .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .detail-label { font-weight: 600; color: #495057; }
          .detail-value { color: #6c757d; }
          .troubleshooting { background: #fff3cd; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .troubleshooting h3 { color: #856404; margin-top: 0; }
          .troubleshooting ul { margin: 0; padding-left: 20px; }
          .troubleshooting li { margin-bottom: 8px; color: #856404; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
          .support { background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .support h4 { color: #1976d2; margin-top: 0; }
          .support p { color: #1976d2; margin-bottom: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Pago No Procesado</h1>
            <p>No te preocupes, podemos solucionarlo</p>
          </div>
          
          <div class="content">
            <div class="error-icon">💳</div>
            
            <h2>Hola ${userName}</h2>
            <p>Tu intento de pago para <strong>${serviceName}</strong> no pudo ser procesado.</p>
            
            <div class="payment-details">
              <h3>Detalles del Intento de Pago</h3>
              <div class="detail-row">
                <span class="detail-label">Servicio:</span>
                <span class="detail-value">${serviceName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Monto:</span>
                <span class="detail-value">$${paymentDetails.amount} ${paymentDetails.currency}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado:</span>
                <span class="detail-value" style="color: #ef4444; font-weight: 600;">Rechazado</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Motivo:</span>
                <span class="detail-value">${getErrorMessage(paymentDetails.errorCode)}</span>
              </div>
            </div>
            
            <div class="troubleshooting">
              <h3>🔧 ¿Qué puedes hacer?</h3>
              <ul>
                <li>Verifica que los datos de tu tarjeta sean correctos</li>
                <li>Asegúrate de tener fondos suficientes</li>
                <li>Intenta con otra tarjeta o método de pago</li>
                <li>Contacta a tu banco si el problema persiste</li>
                <li>Verifica que tu tarjeta no esté bloqueada</li>
              </ul>
            </div>
            
            <a href="${process.env.NEXTAUTH_URL}/payment/failed?reference=${paymentDetails.externalReference}" class="cta-button">Intentar Nuevamente</a>
            
            <div class="support">
              <h4>💬 ¿Necesitas ayuda?</h4>
              <p>Si el problema persiste, nuestro equipo de soporte está aquí para ayudarte. Contáctanos en <strong>Soporte@lozanonahuel.com</strong>.</p>
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
    
    await sendEmail({
      to: userEmail,
      subject: `❌ Pago No Procesado - ${serviceName} - Nahuel Lozano Trading`,
      html
    });

    console.log('✅ Email de notificación de pago fallido enviado exitosamente');

  } catch (error) {
    console.error('❌ Error al enviar email de notificación de pago fallido:', error);
    throw error;
  }
}