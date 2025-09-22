import { sendEmail, createTrainingConfirmationTemplate, createAdvisoryConfirmationTemplate, createAdminNotificationTemplate, createAdminContactNotificationTemplate } from '@/lib/emailService';
import { createAdminNewSubscriberTemplate } from '@/lib/emailService';
import { createSubscriptionConfirmationTemplate } from '@/lib/emailService';

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

    const advisoryDetails = {
      type: serviceType,
      date: startDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: startDate.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      }),
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
}) {
  try {
    console.log('📧 Enviando confirmación de suscripción a usuario:', params.userEmail);
    const html = createSubscriptionConfirmationTemplate({
      userName: params.userName,
      service: params.service,
      expiryDate: params.expiryDate
    });
    await sendEmail({
      to: params.userEmail,
      subject: `✅ Suscripción Activa - ${params.service}`,
      html
    });
    console.log('✅ Confirmación de suscripción enviada al usuario');
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
      'TraderCall': 'TraderCall Premium',
      'SmartMoney': 'SmartMoney Alerts',
      'CashFlow': 'CashFlow Analysis',
      'SwingTrading': 'Entrenamiento Swing Trading',
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
          .next-steps { background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .next-steps h3 { color: #1976d2; margin-top: 0; }
          .next-steps ul { margin: 0; padding-left: 20px; }
          .next-steps li { margin-bottom: 8px; color: #1565c0; }
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
                  timeZone: 'America/Montevideo'
                })}</span>
              </div>
              ${paymentDetails.paymentMethod ? `
              <div class="detail-row">
                <span class="detail-label">Método de Pago:</span>
                <span class="detail-value">${paymentDetails.paymentMethod}</span>
              </div>
              ` : ''}
            </div>
            
            <div class="next-steps">
              <h3>🚀 ¿Qué sigue ahora?</h3>
              ${['TraderCall', 'SmartMoney', 'CashFlow'].includes(paymentDetails.service) ? `
                <ul>
                  <li>Recibirás notificaciones de nuevas alertas en tiempo real</li>
                  <li>Acceso completo a todos los recursos y análisis</li>
                  <li>Soporte prioritario durante tu suscripción</li>
                  <li>Puedes acceder desde cualquier dispositivo</li>
                </ul>
              ` : ''}
              ${['SwingTrading', 'DowJones'].includes(paymentDetails.service) ? `
                <ul>
                  <li>Acceso completo al entrenamiento y materiales</li>
                  <li>Videos y recursos descargables disponibles</li>
                  <li>Soporte durante todo el curso</li>
                  <li>Certificado de finalización</li>
                </ul>
              ` : ''}
              ${paymentDetails.service.includes('booking') ? `
                <ul>
                  <li>Recibirás un email de confirmación con el link de Google Meet</li>
                  <li>Recordatorio 24 horas antes de tu cita</li>
                  <li>Acceso a materiales preparatorios</li>
                  <li>Seguimiento personalizado</li>
                </ul>
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
              <p>Si tienes alguna pregunta sobre tu compra o necesitas asistencia, no dudes en contactarnos en <strong>soporte@nahuellozano.com</strong></p>
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
      'TraderCall': 'TraderCall Premium',
      'SmartMoney': 'SmartMoney Alerts',
      'CashFlow': 'CashFlow Analysis',
      'SwingTrading': 'Entrenamiento Swing Trading',
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
              <p>Si el problema persiste, nuestro equipo de soporte está aquí para ayudarte. Contáctanos en <strong>soporte@nahuellozano.com</strong> o por WhatsApp.</p>
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