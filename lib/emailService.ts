import nodemailer from 'nodemailer';

// Configuración del transportador de email
const createEmailTransporter = () => {
  // Verificar que las variables de entorno estén configuradas
  const requiredEnvVars = [
    'SMTP_HOST',
    'SMTP_PORT', 
    'SMTP_USER',
    'SMTP_PASS'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Variables de entorno faltantes para email: ${missingVars.join(', ')}`);
    console.warn('📧 Modo simulación activado - emails no se enviarán realmente');
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Configuraciones adicionales para diferentes proveedores
      ...(process.env.SMTP_HOST?.includes('gmail') && {
        service: 'gmail',
      }),
      // Configuración de seguridad mejorada
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('📧 Transportador de email configurado correctamente');
    return transporter;
  } catch (error) {
    console.error('❌ Error configurando transportador de email:', error);
    return null;
  }
};

// Instancia global del transportador
let emailTransporter: any = null;

// Inicializar transportador
const initializeEmailService = () => {
  if (!emailTransporter) {
    emailTransporter = createEmailTransporter();
  }
  return emailTransporter;
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Envía un email individual con mejor manejo de errores
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  const { to, subject, html, from } = options;
  
  console.log(`📧 [EMAIL SERVICE] Enviando email a: ${to}`);
  console.log(`📧 [EMAIL SERVICE] Asunto: ${subject}`);
  
  // Verificar configuración
  const isConfigured = await verifyEmailConfiguration();
  
  if (!isConfigured) {
    console.log('⚠️ [EMAIL SERVICE] Modo simulación - email no se enviará realmente');
    console.log('📧 [EMAIL SERVICE] SIMULACIÓN - Email que se enviaría:');
    console.log('📧 [EMAIL SERVICE] Para:', to);
    console.log('📧 [EMAIL SERVICE] Asunto:', subject);
    console.log('📧 [EMAIL SERVICE] HTML preview:', html.substring(0, 200) + '...');
    
    // En modo simulación, simular éxito
    return;
  }
  
  try {
    console.log('✅ [EMAIL SERVICE] Configuración SMTP válida, enviando email real...');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    const mailOptions = {
      from: from || `${process.env.EMAIL_FROM_NAME || 'Nahuel Lozano'} <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}>`,
      to,
      subject,
      html
    };
    
    console.log('📧 [EMAIL SERVICE] Enviando con opciones:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: mailOptions.html.length
    });
    
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ [EMAIL SERVICE] Email enviado exitosamente:', {
      messageId: result.messageId,
      to: to
    });
    
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error enviando email:', error);
    console.error('❌ [EMAIL SERVICE] Stack trace:', error instanceof Error ? error.stack : 'No stack available');
    
    // Arrojar el error para que se maneje en sendBulkEmails
    throw error;
  }
}

/**
 * Envía emails masivos con mejor manejo de errores
 */
export async function sendBulkEmails(options: {
  recipients: string[];
  subject: string;
  html: string;
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { recipients, subject, html } = options;
  
  console.log('📧 [EMAIL SERVICE] Iniciando envío masivo...');
  console.log('📧 [EMAIL SERVICE] Destinatarios:', recipients.length);
  console.log('📧 [EMAIL SERVICE] Asunto:', subject);
  console.log('📧 [EMAIL SERVICE] HTML generado:', html.length, 'caracteres');
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  
  console.log('🔍 [EMAIL SERVICE] Verificando configuración SMTP...');
  const isConfigured = await verifyEmailConfiguration();
  console.log('🔍 [EMAIL SERVICE] Configuración SMTP válida:', isConfigured);
  
  if (!isConfigured) {
    console.log('⚠️ [EMAIL SERVICE] Modo simulación activado - emails no se enviarán realmente');
    console.log('📧 [EMAIL SERVICE] SIMULACIÓN - Email que se enviaría:');
    console.log('📧 [EMAIL SERVICE] Para:', recipients.slice(0, 3).join(', '), recipients.length > 3 ? '...' : '');
    console.log('📧 [EMAIL SERVICE] Asunto:', subject);
    console.log('📧 [EMAIL SERVICE] HTML preview:', html.substring(0, 200) + '...');
    
    // En modo simulación, simular éxito
    return {
      sent: recipients.length,
      failed: 0,
      errors: [`Modo simulación: ${recipients.length} emails simulados exitosamente`]
    };
  }
  
  console.log('✅ [EMAIL SERVICE] Configuración SMTP válida, enviando emails reales...');
  
  // Procesar en lotes para evitar sobrecargar el servidor
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }
  
  console.log('📦 [EMAIL SERVICE] Procesando', batches.length, 'lotes de', batchSize, 'emails cada uno');
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`📦 [EMAIL SERVICE] Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} emails)`);
    
    const batchPromises = batch.map(async (email) => {
      try {
        console.log(` [EMAIL SERVICE] Enviando a: ${email}`);
        await sendEmail({
          to: email,
          subject,
          html
        });
        console.log(`✅ [EMAIL SERVICE] Enviado exitosamente a: ${email}`);
        sent++;
      } catch (error) {
        console.error(`❌ [EMAIL SERVICE] Error enviando a ${email}:`, error);
        failed++;
        errors.push(`${email}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Pequeña pausa entre lotes
    if (batchIndex < batches.length - 1) {
      console.log('⏰ [EMAIL SERVICE] Pausa de 1 segundo entre lotes...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('✅ [EMAIL SERVICE] Envío masivo completado');
  console.log('📊 [EMAIL SERVICE] Resultados finales:', { sent, failed, errorsCount: errors.length });
  
  return { sent, failed, errors };
}

/**
 * Verifica la configuración del servicio de email
 */
export async function verifyEmailConfiguration(): Promise<boolean> {
  try {
    const transporter = initializeEmailService();
    
    if (!transporter) {
      console.log('📧 Configuración de email no disponible - usando modo simulación');
      return false;
    }

    console.log('🔍 Verificando configuración de email...');
    await transporter.verify();
    
    console.log('✅ Configuración de email verificada correctamente');
    return true;

  } catch (error) {
    console.error('❌ Error verificando configuración de email:', error);
    return false;
  }
}

/**
 * Obtiene información sobre el estado del servicio de email
 */
export function getEmailServiceStatus(): {
  configured: boolean;
  provider: string | null;
  fromAddress: string | null;
} {
  const configured = !!(
    process.env.SMTP_HOST && 
    process.env.SMTP_PORT && 
    process.env.SMTP_USER && 
    process.env.SMTP_PASS
  );

  return {
    configured,
    provider: process.env.SMTP_HOST || null,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'
  };
}

// PLANTILLAS DE EMAIL CONSOLIDADAS

/**
 * Plantilla base para todos los emails - Diseño compatible y moderno
 */
export function createEmailTemplate({
  title,
  content,
  buttonText,
  buttonUrl
}: {
  title: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <!--[if mso]>
        <style type="text/css">
        table, td, div, h1, p { font-family: Arial, sans-serif; }
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
            <tr>
                <td align="center" style="padding: 20px;">
                    <!-- Main Container -->
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        
                        <!-- Header -->
                        <tr>
                            <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 30px; text-align: center;">
                                <!-- Logo -->
                                <img src="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/logos/logo%20notificaciones.png" 
                                     alt="Nahuel Lozano Trading" 
                                     width="120" 
                                     height="auto" 
                                     style="display: block; margin: 0 auto 20px; border-radius: 12px; background: rgba(255, 255, 255, 0.1); padding: 8px;">
                                
                                <!-- Title -->
                                <h1 style="color: #00ff88; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em;">
                                    Nahuel Lozano
                                </h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <!-- Main Title -->
                                <h2 style="color: #1a202c; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; text-align: center; line-height: 1.3;">
                                    ${title}
                                </h2>
                                
                                <!-- Content -->
                                <div style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                    ${typeof content === 'string' && content.includes('<') ? content : content.split('\n').map(paragraph => 
                                        paragraph.trim() ? `<p style="margin: 0 0 16px 0;">${paragraph}</p>` : ''
                                    ).join('')}
                                </div>
                                
                                <!-- CTA Button -->
                                ${buttonText && buttonUrl ? `
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td align="center" style="padding: 20px 0;">
                                                <a href="${buttonUrl}" 
                                                   style="display: inline-block; background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); color: #000000; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; letter-spacing: 0.025em; box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);">
                                                    ${buttonText}
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                ` : ''}
                                
                                <!-- Divider -->
                                <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%); margin: 30px 0;"></div>
                                
                                <!-- Tip -->
                                <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                    <p style="margin: 0; color: #1e3a8a; font-size: 14px; font-weight: 500; text-align: center;">
                                        💡 <strong>Consejo:</strong> Mantente actualizado visitando nuestra plataforma regularmente para no perderte las últimas estrategias de trading.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">
                                    Este email fue enviado desde la plataforma de Nahuel Lozano
                                </p>
                                <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
                                    Tu fuente confiable para estrategias de trading e inversión
                                </p>
                                
                                <!-- Social Links -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                    <tr>
                                        <td style="padding: 0 8px;">
                                            <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                🌐
                                            </a>
                                        </td>
                                        <td style="padding: 0 8px;">
                                            <a href="mailto:${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                📧
                                            </a>
                                        </td>
                                        <td style="padding: 0 8px;">
                                            <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                📊
                                            </a>
                                        </td>
                                        <td style="padding: 0 8px;">
                                            <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/recursos" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                📚
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Disclaimer -->
                                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0;">
                                        Si tienes preguntas, contáctanos en: 
                                        <a href="mailto:${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}" style="color: #3b82f6; text-decoration: none;">
                                            ${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}
                                        </a>
                                    </p>
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0;">
                                        © ${new Date().getFullYear()} Nahuel Lozano Trading Platform. Todos los derechos reservados.
                                    </p>
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                                        Este email fue enviado porque eres parte de nuestra comunidad de trading. 
                                        <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil" style="color: #3b82f6; text-decoration: none;">
                                            Gestiona tus preferencias aquí
                                        </a>.
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
}

/**
 * Plantilla específica para notificaciones de informes - Diseño simplificado y moderno
 */
export function generateReportEmailTemplate(
  notification: any,
  user: any
): string {
  // Información del servicio basada en la categoría
  const serviceInfo: Record<string, { name: string; emoji: string; color: string }> = {
    'trader-call': { name: 'Trader Call', emoji: '🚨', color: '#8b5cf6' },
    'smart-money': { name: 'Smart Money', emoji: '🎯', color: '#10b981' },

  };

  const category = notification.metadata?.reportCategory || 'trader-call';
  const service = serviceInfo[category as keyof typeof serviceInfo] || serviceInfo['trader-call'];

  // Extraer el título del informe del metadata, del título de la notificación, o usar fallback
  const getReportTitle = (): string => {
    // Primero intentar desde metadata
    if (notification.metadata?.reportTitle) {
      return notification.metadata.reportTitle;
    }
    // Si no está en metadata, intentar extraer del título de la notificación
    // Formato esperado: "📰 Nuevo Informe TraderCall: Título del Informe"
    if (notification.title) {
      const match = notification.title.match(/:\s*(.+)$/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    // Fallback final
    return 'Nuevo Informe';
  };

  const reportTitle = getReportTitle();

  const reportDetailsHtml = notification.metadata ? `
    <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <span style="font-size: 20px;">${service.emoji}</span>
        <h3 style="margin: 0; font-size: 18px; color: #1e293b; font-weight: 600;">
          Detalles del Informe
        </h3>
      </div>
      
      <div style="margin: 8px 0 16px;">
        <div style="font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 4px;">Título</div>
        <div style="font-size: 14px; color: #111827; font-weight: 700;">${reportTitle}</div>
      </div>
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="8" border="0">
        ${notification.metadata.serviceType ? `
          <tr>
            <td style="font-size: 14px; color: #64748b; font-weight: 600; width: 30%;">Servicio:</td>
            <td style="font-size: 14px; color: #1e293b; font-weight: 700;">
              <span style="background-color: ${service.color}; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px;">
                ${service.name}
              </span>
            </td>
          </tr>
        ` : ''}
        ${notification.metadata.reportCategory ? `
          <tr>
            <td style="font-size: 14px; color: #64748b; font-weight: 600;">Categoría:</td>
            <td style="font-size: 14px; color: #1e293b; font-weight: 600; text-transform: capitalize;">
              ${notification.metadata.reportCategory.replace('-', ' ')}
            </td>
          </tr>
        ` : ''}
        ${notification.metadata.reportType ? `
          <tr>
            <td style="font-size: 14px; color: #64748b; font-weight: 600;">Tipo:</td>
            <td style="font-size: 14px; color: #1e293b; font-weight: 600; text-transform: capitalize;">
              ${notification.metadata.reportType}
            </td>
          </tr>
        ` : ''}
      </table>
    </div>
  ` : '';

  const contentHtml = `
    <!-- Saludo personalizado -->
    <div style="text-align: center; margin-bottom: 30px;">
      <h3 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 700;">
        ¡Hola ${user.name || user.email.split('@')[0]}! 👋
      </h3>
      <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.5;">
        Tienes un nuevo informe de análisis disponible en tu cuenta.
      </p>
    </div>
    
    <!-- Badge del servicio -->
    <div style="text-align: center; margin-bottom: 25px;">
      <div style="display: inline-block; background-color: ${service.color}; color: white; padding: 8px 20px; border-radius: 25px; font-weight: 600; font-size: 14px;">
        ${service.emoji} ${service.name} - Nuevo Contenido
      </div>
    </div>
    
    <!-- Contenido principal -->
    <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 25px; margin: 20px 0; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 15px;">📊</div>
      <h4 style="margin: 0 0 15px; font-size: 18px; color: #1e293b; font-weight: 700;">
        ${reportTitle}
      </h4>
      
      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 15px 0;">
        <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
          ${notification.message}
        </p>
      </div>
    </div>
    
    ${reportDetailsHtml}
    
    <!-- Sección de acceso rápido -->
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">⚡</span>
        <div>
          <h5 style="margin: 0 0 5px; font-size: 14px; color: #92400e; font-weight: 600;">
            Acceso Inmediato
          </h5>
          <p style="margin: 0; font-size: 13px; color: #b45309; line-height: 1.4;">
            El informe está disponible ahora en tu área de recursos.
          </p>
        </div>
      </div>
    </div>
  `;

  // Construir título del email sin repetición
  // El título del email debe ser simple: solo indicar que hay un nuevo informe del servicio
  // El título específico del informe ya aparece en el contenido del email
  // Esto evita títulos repetitivos como "Nuevo Trader Call: Nuevo Informe Trader Call"
  const emailTitle = `${service.emoji} Nuevo Informe ${service.name}`;

  return createNotificationEmailTemplate({
    title: emailTitle,
    content: contentHtml,
    notificationType: 'info',
    urgency: 'normal',
    buttonText: notification.actionText || 'Leer Informe',
    buttonUrl: notification.actionUrl ? `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}${notification.actionUrl}` : undefined
  });
}

/**
 * Plantilla mejorada para notificaciones de alertas
 */
export function generateAlertEmailTemplate(
  notification: any, 
  user: any
): string {
  // Si es una notificación de informe, usar la plantilla específica
  if (notification.type === 'actualizacion' || notification.metadata?.reportTitle) {
    return generateReportEmailTemplate(notification, user);
  }

  const alertDetails = notification.metadata ? `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
        ${notification.metadata.alertSymbol ? `
          <div style="text-align: center; min-width: 80px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Símbolo</div>
            <div style="font-size: 16px; color: #1e293b; font-weight: 700;">${notification.metadata.alertSymbol}</div>
          </div>
        ` : ''}
        ${notification.metadata.alertAction ? `
          <div style="text-align: center; min-width: 80px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Acción</div>
            <div style="font-size: 16px; color: ${notification.metadata.alertAction === 'BUY' ? '#22c55e' : '#ef4444'}; font-weight: 700;">${notification.metadata.alertAction}</div>
          </div>
        ` : ''}
        ${notification.metadata.alertPrice || notification.metadata.priceRange ? `
          <div style="text-align: center; min-width: 120px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Precio</div>
            <div style="font-size: 16px; color: #1e293b; font-weight: 700;">
              ${notification.metadata.priceRange && notification.metadata.priceRange.min != null && notification.metadata.priceRange.max != null && !isNaN(Number(notification.metadata.priceRange.min)) && !isNaN(Number(notification.metadata.priceRange.max))
                ? `$${Number(notification.metadata.priceRange.min).toFixed(2)} - $${Number(notification.metadata.priceRange.max).toFixed(2)}`
                : (typeof notification.metadata.alertPrice === 'string' && notification.metadata.alertPrice.includes('-')
                  ? `$${notification.metadata.alertPrice.split('-').map((p: string) => Number(p.trim()).toFixed(2)).join(' - $')}`
                  : notification.metadata.alertPrice != null && !isNaN(Number(notification.metadata.alertPrice))
                  ? `$${Number(notification.metadata.alertPrice).toFixed(2)}`
                  : 'N/A')
              }
            </div>
          </div>
        ` : ''}
        ${notification.metadata.participationPercentage != null ? `
          <div style="text-align: center; min-width: 120px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">% Cartera</div>
            <div style="font-size: 16px; color: #22c55e; font-weight: 700;">${notification.metadata.participationPercentage}%</div>
          </div>
        ` : ''}
        ${notification.metadata.liquidityPercentage && notification.metadata.alertAction === 'BUY' ? `
          <div style="text-align: center; min-width: 120px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">% Comprado</div>
            <div style="font-size: 16px; color: #22c55e; font-weight: 700;">${notification.metadata.liquidityPercentage}%</div>
          </div>
        ` : ''}
        ${notification.metadata.soldPercentage && notification.metadata.alertAction === 'SELL' ? `
          <div style="text-align: center; min-width: 120px;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">% Vendido</div>
            <div style="font-size: 16px; color: #ef4444; font-weight: 700;">${notification.metadata.soldPercentage}%</div>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  const imageBlock = notification.metadata?.imageUrl ? `
    <div style="margin: 20px 0; text-align: center;">
      <img src="${notification.metadata.imageUrl}" alt="Imagen de la alerta" style="max-width: 100%; border-radius: 10px; border: 1px solid #e2e8f0;" />
    </div>
  ` : '';

  return createNotificationEmailTemplate({
    title: `${notification.icon} ${notification.title}`,
    content: `
      <div style="text-align: center; margin-bottom: 25px;">
        <h2 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 600;">
          ¡Hola ${user.name || user.email.split('@')[0]}! 👋
        </h2>
        <p style="margin: 0; font-size: 16px; color: #64748b;">
          Tienes una nueva alerta de trading disponible en tu cuenta.
        </p>
      </div>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #00ff88;">
        <h3 style="margin: 0 0 15px; font-size: 18px; color: #1e293b; font-weight: 600;">
          📊 Detalles de la Alerta
        </h3>
        <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6; white-space: pre-wrap;">
          ${notification.message.replace(/\n/g, '<br>')}
        </p>
        ${imageBlock}
        ${alertDetails}
      </div>
      
      <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 25px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 500;">
          ⚡ <strong>Acción Requerida:</strong> Esta es una alerta de alta prioridad. Te recomendamos revisar los detalles completos en la plataforma lo antes posible.
        </p>
      </div>
    `,
    notificationType: 'alert',
    urgency: 'high',
    buttonText: notification.actionText || 'Ver Alertas',
    buttonUrl: notification.actionUrl ? `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}${notification.actionUrl}` : undefined
  });
}

/**
 * Plantilla para confirmación de entrenamientos
 */
export function createTrainingConfirmationTemplate(
  userEmail: string,
  userName: string,
  trainingDetails: {
    type: string;
    date: string;
    time: string;
    duration: number;
    meetLink?: string;
  }
): string {
  const meetLinkSection = trainingDetails.meetLink ? `
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
      <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px;">🔗 Link de Google Meet</h3>
      <p style="color: white; margin: 0 0 15px 0; font-size: 14px;">Tu reunión ya está configurada. Haz clic en el botón para unirte:</p>
      <a href="${trainingDetails.meetLink}" target="_blank" style="display: inline-block; background: white; color: #3b82f6; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        🎥 Unirse a la Reunión
      </a>
      <p style="color: rgba(255,255,255,0.8); margin: 15px 0 0 0; font-size: 12px;">
        El link estará activo 5 minutos antes del horario programado
      </p>
    </div>
  ` : `
    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
      <h3 style="color: #92400e; margin-top: 0;">⏳ Link de Reunión</h3>
      <p style="color: #92400e; margin: 0;">Recibirás el link de Google Meet 24 horas antes de la sesión.</p>
    </div>
  `;

  return createEmailTemplate({
    title: `🎯 Entrenamiento Confirmado`,
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          ✅ Reserva Confirmada
        </div>
      </div>
      
      <p>Hola <strong>${userName}</strong>,</p>
      <p>¡Tu entrenamiento ha sido confirmado exitosamente!</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">📋 Detalles del Entrenamiento:</h3>
        <p style="margin: 8px 0;"><strong>👤 Participante:</strong> ${userName}</p>
        <p style="margin: 8px 0;"><strong>📚 Tipo:</strong> ${trainingDetails.type}</p>
        <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${trainingDetails.date}</p>
        <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${trainingDetails.time}</p>
        <p style="margin: 8px 0;"><strong>⏱️ Duración:</strong> ${trainingDetails.duration} minutos</p>
      </div>
      
      ${meetLinkSection}
      
      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #00ff88; margin: 20px 0;">
        <h3 style="color: #1a1a1a; margin-top: 0;">📋 Próximos Pasos:</h3>
        <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Asegúrate de tener una conexión estable a internet</li>
          <li>Prepara tus preguntas específicas sobre trading</li>
          <li>Ten a mano tu plataforma de trading si quieres revisarla</li>
          <li>Únete a la reunión 5 minutos antes del horario programado</li>
        </ul>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
        Si necesitas reprogramar o cancelar, contáctanos con al menos 24 horas de anticipación.
      </p>
    `,
    buttonText: 'Ver Mi Perfil',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
  });
}

/**
 * Plantilla para confirmación de asesorías
 */
export function createAdvisoryConfirmationTemplate(
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
): string {
  const meetLinkSection = advisoryDetails.meetLink ? `
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
      <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px;">🔗 Link de Google Meet</h3>
      <p style="color: white; margin: 0 0 15px 0; font-size: 14px;">Tu reunión ya está configurada. Haz clic en el botón para unirte:</p>
      <a href="${advisoryDetails.meetLink}" target="_blank" style="display: inline-block; background: white; color: #3b82f6; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        🎥 Unirse a la Reunión
      </a>
      <p style="color: rgba(255,255,255,0.8); margin: 15px 0 0 0; font-size: 12px;">
        El link estará activo 5 minutos antes del horario programado
      </p>
    </div>
  ` : `
    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
      <h3 style="color: #92400e; margin-top: 0;">⏳ Link de Reunión</h3>
      <p style="color: #92400e; margin: 0;">Recibirás el link de Google Meet 24 horas antes de la sesión.</p>
    </div>
  `;

  return createEmailTemplate({
    title: `🩺 Asesoría Confirmada`,
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          ✅ Consulta Agendada
        </div>
      </div>
      
      <p>Hola <strong>${userName}</strong>,</p>
      <p>¡Tu asesoría ha sido agendada exitosamente!</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">📋 Detalles de la Asesoría:</h3>
        <p style="margin: 8px 0;"><strong>👤 Cliente: </strong> ${userName}</p>
        <p style="margin: 8px 0;"><strong>🩺 Servicio: </strong> ${advisoryDetails.type}</p>
        <p style="margin: 8px 0;"><strong>📅 Fecha: </strong> ${advisoryDetails.date}</p>
        <p style="margin: 8px 0;"><strong>⏰ Hora: </strong> ${advisoryDetails.time}</p>
        <p style="margin: 8px 0;"><strong>⏱️ Duración: </strong> ${advisoryDetails.duration} minutos</p>
        ${advisoryDetails.price ? `<p style="margin: 8px 0;"><strong>💰 Precio: </strong> $${advisoryDetails.price.toLocaleString('es-AR')} ARS</p>` : ''}
      </div>
      
      ${meetLinkSection}
      
      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #00ff88; margin: 20px 0;">
        <h3 style="color: #1a1a1a; margin-top: 0;">📋 Qué Incluye tu Asesoría:</h3>
        <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>🔍 Diagnóstico integral de tu cartera</li>
          <li>🎯 Plan de acción personalizado</li>
          <li>💼 Estrategia de inversión ajustada a tu perfil</li>
          <li>🧭 Recomendaciones claras y accionables</li>
          <li>📄 Informe post sesión con próximos pasos</li>
        </ul>
      </div>
      
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
        <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px;">📝 Formulario Pre-Asesoría</h3>
        <p style="color: white; margin: 0 0 15px 0; font-size: 14px;">Para optimizar tu sesión, completá este formulario con información sobre tu situación financiera actual:</p>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSc_cddpfII-pibgEJsmcaWTrQchUgkKwLq0bQO1asATYQ6AeA/viewform?usp=preview" target="_blank" style="display: inline-block; background: white; color: #3b82f6; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          📋 Completar Formulario
        </a>
        <p style="color: rgba(255,255,255,0.8); margin: 15px 0 0 0; font-size: 12px;">
          Este formulario nos ayudará a preparar mejor tu asesoría personalizada
        </p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <h3 style="color: #1a1a1a; margin-top: 0;">📝 Antes de la sesión, tené a mano lo siguiente:</h3>
        <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>💰 Detalle completo de su cartera actual</li>
          <li>📊 Porcentajes y montos invertidos por activo</li>
          <li>🧭 Objetivos financieros y horizonte temporal</li>
          <li>⚖ Nivel de riesgo y liquidez disponible</li>
          <li>❓ Dudas puntuales o decisiones a resolver</li>
        </ul>
      </div>
    `,
    buttonText: 'Ver Mi Perfil',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
  });
}

/**
 * Plantilla para notificaciones al admin
 */
export function createAdminNotificationTemplate(
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
): string {
  const typeEmoji = bookingDetails.type === 'training' ? '🎯' : '🩺';
  const typeLabel = bookingDetails.type === 'training' ? 'Entrenamiento' : 'Asesoría';
  
  return createEmailTemplate({
    title: `${typeEmoji} Nueva Reserva de ${typeLabel}`,
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          🔔 Nueva Reserva
        </div>
      </div>
      
      <p>Se ha realizado una nueva reserva en la plataforma.</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">📋 Detalles de la Reserva:</h3>
        <p style="margin: 8px 0;"><strong>👤 Usuario:</strong> ${bookingDetails.userName} (${bookingDetails.userEmail})</p>
        <p style="margin: 8px 0;"><strong>📚 Tipo:</strong> ${typeLabel}</p>
        <p style="margin: 8px 0;"><strong>🔧 Servicio:</strong> ${bookingDetails.serviceType}</p>
        <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${bookingDetails.date}</p>
        <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${bookingDetails.time}</p>
        <p style="margin: 8px 0;"><strong>⏱️ Duración:</strong> ${bookingDetails.duration} minutos</p>
        ${bookingDetails.price ? `<p style="margin: 8px 0;"><strong>💰 Precio:</strong> $${bookingDetails.price.toLocaleString('es-AR')} ARS</p>` : ''}
      </div>
      
      ${bookingDetails.meetLink ? `
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
          <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px;">🔗 Google Meet Creado Automáticamente</h3>
          <p style="color: white; margin: 0 0 15px 0; font-size: 14px;">El link de reunión ya está configurado:</p>
          <a href="${bookingDetails.meetLink}" target="_blank" style="display: inline-block; background: white; color: #3b82f6; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            🎥 Unirse a la Reunión
          </a>
          <p style="color: rgba(255,255,255,0.8); margin: 15px 0 0 0; font-size: 12px;">
            El link estará activo 5 minutos antes del horario programado
          </p>
        </div>
      ` : ''}
      
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
        <h3 style="color: #92400e; margin-top: 0;">📋 Acciones Requeridas:</h3>
        <ul style="color: #92400e; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Confirmar disponibilidad para la fecha y hora</li>
          ${bookingDetails.meetLink ? '<li>✅ Google Meet ya creado automáticamente</li>' : '<li>Enviar link de Google Meet 24 horas antes</li>'}
          <li>Revisar el perfil del usuario si es necesario</li>
          <li>Preparar material específico según el tipo de sesión</li>
        </ul>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
        Puedes gestionar esta reserva desde el panel de administración.
      </p>
    `,
    buttonText: 'Ir al Panel Admin',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/admin`
  });
}

/**
 * Plantilla para notificación de nuevo suscriptor (alertas)
 */
export function createAdminNewSubscriberTemplate(details: {
  userEmail: string;
  userName: string;
  service: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  amount?: number;
  currency?: string;
  paymentId?: string;
  transactionDate?: Date;
  expiryDate?: Date | string;
}): string {
  const serviceNames: { [key: string]: { label: string; emoji: string } } = {
    TraderCall: { label: 'Trader Call', emoji: '📈' },
    SmartMoney: { label: 'Smart Money', emoji: '💡' },
    CashFlow: { label: 'Cash Flow', emoji: '💵' }
  };
  const serviceInfo = serviceNames[details.service] || { label: details.service, emoji: '🔔' };

  const timezone = process.env.TZ || 'America/Montevideo';
  const dateStr = details.transactionDate
    ? new Date(details.transactionDate).toLocaleString('es-AR', { timeZone: timezone, year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('es-AR', { timeZone: timezone });
  const expiryStr = details.expiryDate
    ? new Date(details.expiryDate).toLocaleDateString('es-AR', { timeZone: timezone, year: 'numeric', month: 'long', day: 'numeric' })
    : undefined;

  return createEmailTemplate({
    title: `${serviceInfo.emoji} Nuevo Suscriptor - ${serviceInfo.label}`,
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          🔔 Alta de Suscripción
        </div>
      </div>

      <p>Se registró un <strong>nuevo suscriptor</strong> al servicio <strong>${serviceInfo.label}</strong>.</p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">👤 Datos del Usuario</h3>
        <p style="margin: 8px 0;"><strong>Nombre:</strong> ${details.userName || details.userEmail}</p>
        <p style="margin: 8px 0;"><strong>Email:</strong> ${details.userEmail}</p>
      </div>

      <div style="background-color: #eef2ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">📦 Detalles de la Suscripción</h3>
        <p style="margin: 8px 0;"><strong>Servicio:</strong> ${serviceInfo.label}</p>
        <p style="margin: 8px 0;"><strong>Fecha de activación:</strong> ${dateStr}</p>
        ${details.amount ? `<p style=\"margin: 8px 0;\"><strong>Monto:</strong> $${details.amount} ${details.currency || ''}</p>` : ''}
        ${details.paymentId ? `<p style=\"margin: 8px 0;\"><strong>ID de pago:</strong> ${details.paymentId}</p>` : ''}
        ${expiryStr ? `<p style=\"margin: 8px 0;\"><strong>Vence:</strong> ${expiryStr}</p>` : ''}
      </div>

      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
        <h3 style="color: #92400e; margin-top: 0;">📋 Acciones Recomendadas</h3>
        <ul style="color: #92400e; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Verificar acceso del usuario al módulo correspondiente</li>
          <li>Agregar a lista de difusión si aplica</li>
          <li>Monitorear primeras alertas recibidas</li>
        </ul>
      </div>
    `,
    buttonText: 'Ir al Panel Admin',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/admin`
  });
}

/**
 * Plantilla para notificaciones de contacto al admin
 */
export function createAdminContactNotificationTemplate(
  contactDetails: {
    userEmail: string;
    userName: string;
    userLastName: string;
    message: string;
    timestamp: number;
  }
): string {
  const fullName = `${contactDetails.userName} ${contactDetails.userLastName}`;
  const messageDate = new Date(contactDetails.timestamp).toLocaleString('es-ES', {
    timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return createEmailTemplate({
    title: '📧 Nuevo Mensaje de Contacto',
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          📧 Nuevo Mensaje
        </div>
      </div>
      
      <p>Se ha recibido un nuevo mensaje de contacto en la plataforma.</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">📋 Información del Contacto:</h3>
        <p style="margin: 8px 0;"><strong>👤 Usuario:</strong> ${fullName}</p>
        <p style="margin: 8px 0;"><strong>📧 Email:</strong> ${contactDetails.userEmail}</p>
        <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${messageDate}</p>
      </div>
      
      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #00ff88; margin: 20px 0;">
        <h3 style="color: #1a1a1a; margin-top: 0;">💬 Mensaje:</h3>
        <p style="color: #333; line-height: 1.6; margin: 0; font-style: italic; white-space: pre-wrap;">
          "${contactDetails.message}"
        </p>
      </div>
      
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
        <h3 style="color: #92400e; margin-top: 0;">📋 Acciones Requeridas:</h3>
        <ul style="color: #92400e; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Revisar el mensaje y evaluar el tipo de consulta</li>
          <li>Responder al email del usuario en un plazo de 24 horas</li>
          <li>Si es necesario, programar una llamada o reunión</li>
          <li>Registrar el seguimiento en el CRM</li>
        </ul>
      </div>
      
      <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
        <h3 style="color: #1e3a8a; margin-top: 0;">🔗 Respuesta Rápida:</h3>
        <p style="color: #1e3a8a; margin: 0 0 15px 0;">Puedes responder directamente haciendo clic en el botón:</p>
        <a href="mailto:${contactDetails.userEmail}?subject=Re: Consulta desde LozanoNahuel.com&body=Hola ${contactDetails.userName},%0A%0AGracias por tu mensaje.%0A%0A" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          📧 Responder al Usuario
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
        Puedes gestionar todos los mensajes desde el panel de administración.
      </p>
    `,
    buttonText: 'Ir al Panel Admin',
    buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/admin`
  });
}

/**
 * Plantilla para emails de bienvenida
 */
export function createWelcomeEmailTemplate({
  userName,
  content,
  buttonText,
  buttonUrl
}: {
  userName: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
}): string {
  return createEmailTemplate({
    title: `¡Bienvenido a bordo, ${userName}! 🚀`,
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          🎉 ¡Cuenta Activada!
        </div>
      </div>
      
      <p>Hola <strong>${userName}</strong>,</p>
      
      ${content}
      
      <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #0ea5e9;">
        <h3 style="margin: 0 0 12px 0; color: #0c4a6e; font-size: 18px;">🎯 Próximos pasos:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #0f172a;">
          <li style="margin-bottom: 8px;">Completa tu perfil en la plataforma</li>
          <li style="margin-bottom: 8px;">Explora nuestras alertas de trading</li>
          <li style="margin-bottom: 8px;">Únete a nuestra comunidad</li>
          <li>Revisa los recursos educativos</li>
        </ul>
      </div>
    `,
    buttonText: buttonText || 'Comenzar Mi Viaje',
    buttonUrl: buttonUrl || `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
  });
}

/**
 * Plantilla para emails promocionales
 */
export function createPromotionalEmailTemplate({
  title,
  content,
  offer,
  buttonText,
  buttonUrl,
  expiryDate
}: {
  title: string;
  content: string;
  offer?: string;
  buttonText?: string;
  buttonUrl?: string;
  expiryDate?: string;
}): string {
  return createEmailTemplate({
    title: title,
    content: `
      ${offer ? `
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 16px 24px; border-radius: 12px; margin-bottom: 20px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; right: 0; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 0 12px 0 12px; font-size: 12px; font-weight: bold;">
              OFERTA ESPECIAL
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">${offer}</h3>
            ${expiryDate ? `<p style="margin: 0; font-size: 14px; opacity: 0.9;">Válido hasta: ${expiryDate}</p>` : ''}
          </div>
        </div>
      ` : ''}
      
      ${content}
      
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin: 24px 0; border-left: 4px solid #f59e0b;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 20px; margin-right: 12px;">⭐</span>
          <strong style="color: #92400e; font-size: 16px;">¿Por qué elegir Nahuel Lozano?</strong>
        </div>
        <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px;">
          <li style="margin-bottom: 6px;">Estrategias probadas y rentables</li>
          <li style="margin-bottom: 6px;">Alertas en tiempo real</li>
          <li style="margin-bottom: 6px;">Comunidad activa de traders</li>
          <li>Soporte personalizado</li>
        </ul>
      </div>
    `,
    buttonText: buttonText || 'Aprovechar Oferta',
    buttonUrl: buttonUrl || `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}`
  });
} 

/**
 * Plantilla específica para notificaciones con diseño moderno y simple
 */
export function createNotificationEmailTemplate({
  title,
  content,
  notificationType = 'info',
  buttonText,
  buttonUrl,
  urgency = 'normal'
}: {
  title: string;
  content: string;
  notificationType?: 'info' | 'alert' | 'success' | 'warning';
  buttonText?: string;
  buttonUrl?: string;
  urgency?: 'low' | 'normal' | 'high';
}): string {
  const urgencyColors = {
    low: '#10b981',
    normal: '#3b82f6', 
    high: '#ef4444'
  };

  const typeIcons = {
    info: '📊',
    alert: '🚨',
    success: '✅',
    warning: '⚠️'
  };

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <!--[if mso]>
        <style type="text/css">
        table, td, div, h1, p { font-family: Arial, sans-serif; }
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc;">
            <tr>
                <td align="center" style="padding: 20px;">
                    <!-- Main Container -->
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); overflow: hidden;">
                        
                        <!-- Header -->
                        <tr>
                            <td align="center" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 30px; text-align: center;">
                                <!-- Logo -->
                                <img src="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/logos/logo%20notificaciones.png" 
                                     alt="Nahuel Lozano Trading" 
                                     width="120" 
                                     height="auto" 
                                     style="display: block; margin: 0 auto 20px; border-radius: 12px; background: rgba(255, 255, 255, 0.1); padding: 8px;">
                                
                                <!-- Badge -->
                                <div style="display: inline-block; background-color: ${urgencyColors[urgency]}; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px;">
                                    ${typeIcons[notificationType]} ${notificationType.toUpperCase()}
                                </div>
                                
                                <!-- Title -->
                                <h1 style="color: #00ff88; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em;">
                                    Nahuel Lozano
                                </h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <!-- Main Title -->
                                <h2 style="color: #1a202c; font-size: 24px; font-weight: 700; margin: 0 0 20px 0; text-align: center; line-height: 1.3;">
                                    ${title}
                                </h2>
                                
                                <!-- Content -->
                                <div style="color: #4a5568; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                                    ${content}
                                </div>
                                
                                <!-- CTA Button -->
                                ${buttonText && buttonUrl ? `
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td align="center" style="padding: 20px 0;">
                                                <a href="${buttonUrl}" 
                                                   style="display: inline-block; background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%); color: #000000; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; letter-spacing: 0.025em; box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);">
                                                    ${buttonText}
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                ` : ''}
                                
                                <!-- Divider -->
                                <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%); margin: 30px 0;"></div>
                                
                                <!-- Tip -->
                                <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                    <p style="margin: 0; color: #1e3a8a; font-size: 14px; font-weight: 500; text-align: center;">
                                        💡 <strong>Consejo:</strong> Mantente actualizado visitando nuestra plataforma regularmente para no perderte las últimas estrategias de trading.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">
                                    Este email fue enviado desde la plataforma de Nahuel Lozano
                                </p>
                                <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
                                    Tu fuente confiable para estrategias de trading e inversión
                                </p>
                                
                                <!-- Social Links -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                    <tr>
                                        <td style="padding: 0 8px;">
                                            <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                🌐
                                            </a>
                                        </td>
                                        <td style="padding: 0 8px;">
                                            <a href="mailto:${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                📧
                                            </a>
                                        </td>
                                        <td style="padding: 0 8px;">
                                            <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                📊
                                            </a>
                                        </td>
                                        <td style="padding: 0 8px;">
                                            <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/recursos" 
                                               style="display: inline-block; width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; border-radius: 50%; text-align: center; line-height: 40px; font-size: 16px;">
                                                📚
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Disclaimer -->
                                <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0;">
                                        Si tienes preguntas, contáctanos en: 
                                        <a href="mailto:${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}" style="color: #3b82f6; text-decoration: none;">
                                            ${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'soporte@lozanonahuel.com'}
                                        </a>
                                    </p>
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 8px 0;">
                                        © ${new Date().getFullYear()} Nahuel Lozano Trading Platform. Todos los derechos reservados.
                                    </p>
                                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                                        Este email fue enviado porque eres parte de nuestra comunidad de trading. 
                                        <a href="${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil" style="color: #3b82f6; text-decoration: none;">
                                            Gestiona tus preferencias aquí
                                        </a>.
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
} 

/**
 * Plantilla para confirmación de suscripción al usuario
 */
export function createSubscriptionConfirmationTemplate(details: {
  userName: string;
  service: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  expiryDate?: Date | string;
  featuresUrl?: string;
}): string {
  const serviceInfo: Record<string, { name: string; emoji: string; url: string }> = {
    TraderCall: { name: 'Trader Call', emoji: '📈', url: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas/trader-call` },
    SmartMoney: { name: 'Smart Money', emoji: '💡', url: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas/smart-money` },
    CashFlow: { name: 'Cash Flow', emoji: '💵', url: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas` }
  };
  const svc = serviceInfo[details.service] || { name: details.service, emoji: '🔔', url: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas` };
  const timezone = process.env.TZ || 'America/Montevideo';
  const expiryStr = details.expiryDate ? new Date(details.expiryDate).toLocaleDateString('es-AR', { timeZone: timezone, year: 'numeric', month: 'long', day: 'numeric' }) : undefined;

  const featuresHtml = `
    <ul style="margin: 0; padding-left: 20px;">
      <li>🔔 Notificaciones en tiempo real de nuevas alertas</li>
      <li>📊 Tablero con métricas y rendimiento histórico</li>
      <li>🗂️ Acceso a informes y análisis recientes</li>
      <li>⚙️ Preferencias personalizables de notificación</li>
    </ul>
  `;

  return createNotificationEmailTemplate({
    title: `${svc.emoji} Suscripción Activa: ${svc.name}`,
    content: `
      <p>¡Gracias por suscribirte, <strong>${details.userName}</strong>! 🎉</p>
      <p>Tu suscripción a <strong>${svc.name}</strong> fue activada exitosamente.</p>
      ${expiryStr ? `<p><strong>Vencimiento:</strong> ${expiryStr}</p>` : ''}

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 10px; color: #1e293b;">Funciones para suscriptores</h4>
        ${featuresHtml}
      </div>

      <p>Podés acceder desde aquí:</p>
    `,
    notificationType: 'success',
    urgency: 'normal',
    buttonText: `Ir a ${svc.name}`,
    buttonUrl: svc.url
  });
}