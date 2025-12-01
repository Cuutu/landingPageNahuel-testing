// Plantillas de email sin dependencias de servidor para preview
// Estas son versiones separadas para evitar problemas de compilación en el cliente

// Importar la función de notificaciones
import { createNotificationEmailTemplate } from './emailService';

// Plantilla HTML mejorada para emails
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
}) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                margin-top: 20px;
                margin-bottom: 20px;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            .logo-container {
                margin-bottom: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .logo {
                max-width: 120px;
                height: auto;
                border-radius: 12px;
                box-shadow: 0 8px 25px rgba(0, 255, 136, 0.3);
                background: rgba(255, 255, 255, 0.1);
                padding: 8px;
                backdrop-filter: blur(10px);
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .header p {
                margin: 10px 0 0 0;
                font-size: 16px;
                opacity: 0.95;
            }
            .content {
                padding: 40px 30px;
            }
            .message-content {
                font-size: 16px;
                line-height: 1.8;
                color: #4a5568;
                margin-bottom: 30px;
            }
            .message-content p {
                margin: 0 0 15px 0;
            }
            .cta-section {
                text-align: center;
                margin: 30px 0;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transition: transform 0.2s ease;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
            }
            .divider {
                height: 1px;
                background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
                margin: 30px 0;
            }
            .footer {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                padding: 35px 30px;
                text-align: center;
                border-top: 1px solid rgba(59, 130, 246, 0.1);
            }
            .footer p {
                margin: 0 0 15px 0;
                font-size: 14px;
                color: #475569;
                font-weight: 500;
            }
            .footer p:first-child {
                font-weight: 700;
                color: #1e293b;
                font-size: 15px;
            }
            .social-links {
                margin: 25px 0;
                text-align: center;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 15px;
                flex-wrap: wrap;
            }
            .social-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                color: #64748b;
                border-radius: 14px;
                text-decoration: none;
                font-size: 18px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 
                           0 0 0 1px rgba(59, 130, 246, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.1);
                font-weight: 500;
            }
            .social-link:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: #ffffff;
                border-color: rgba(59, 130, 246, 0.3);
            }
            .social-link:nth-child(1):hover {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
            }
            .social-link:nth-child(2):hover {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
            }
            .social-link:nth-child(3):hover {
                background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);
            }
            .social-link:nth-child(4):hover {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                box-shadow: 0 8px 25px rgba(239, 68, 68, 0.3);
            }
            .disclaimer {
                margin-top: 25px;
                padding-top: 25px;
                border-top: 1px solid rgba(59, 130, 246, 0.1);
                font-size: 12px;
                color: #94a3b8;
                line-height: 1.6;
            }
            .disclaimer p {
                margin: 0 0 8px 0;
                font-size: 12px;
                color: #94a3b8;
            }
            .disclaimer a {
                color: #3b82f6;
                text-decoration: none;
                font-weight: 600;
            }
            .disclaimer a:hover {
                text-decoration: underline;
            }
            @media only screen and (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 8px;
                }
                .header {
                    padding: 30px 20px;
                }
                .logo {
                    max-width: 100px;
                }
                .header h1 {
                    font-size: 24px;
                }
                .content {
                    padding: 30px 20px;
                }
                .footer {
                    padding: 25px 20px;
                }
                .social-links {
                    gap: 12px;
                }
                .social-link {
                    width: 44px;
                    height: 44px;
                    font-size: 16px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-container">
                    <img src="https://lozanonahuel.vercel.app/logos/LOGOTIPO NARANJA SIN FONDO.png" 
                         alt="Nahuel Lozano Trading" 
                         class="logo"
                         style="max-width: 120px; height: auto; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 255, 136, 0.3); background: rgba(255, 255, 255, 0.1); padding: 8px; backdrop-filter: blur(10px);">
                </div>
                <h1>📈 Nahuel Lozano</h1>
                <p>Trading & Estrategias de Inversión</p>
            </div>
            
            <div class="content">
                <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">${title}</h2>
                <div class="message-content">
                    ${content.split('\n').map(paragraph => 
                        paragraph.trim() ? `<p>${paragraph}</p>` : ''
                    ).join('')}
                </div>
                
                ${buttonText && buttonUrl ? `
                    <div class="cta-section">
                        <a href="${buttonUrl}" class="cta-button">${buttonText}</a>
                    </div>
                ` : ''}
                
                <div class="divider"></div>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0; color: #4a5568; font-size: 14px;">
                        <strong>💡 Consejo:</strong> Mantente actualizado con las últimas estrategias de trading y análisis de mercado visitando nuestra plataforma regularmente.
                    </p>
                </div>
            </div>
            
            <div class="footer">
                <p>Este email fue enviado desde la plataforma de Nahuel Lozano</p>
                <p>Tu fuente confiable para estrategias de trading e inversión</p>
                
                <div class="social-links">
                    <a href="https://lozanonahuel.vercel.app" class="social-link" title="Sitio Web">🌐</a>
                    <a href="mailto:${process.env.ADMIN_EMAIL || 'info@lozanonahuel.com'}" class="social-link" title="Email">📧</a>
                    <a href="https://lozanonahuel.vercel.app/alertas" class="social-link" title="Alertas">📊</a>
                    <a href="https://lozanonahuel.vercel.app/recursos" class="social-link" title="Recursos">📚</a>
                </div>
                
                <div class="disclaimer">
                    <p>Si tienes preguntas, contáctanos en: <a href="mailto:${process.env.ADMIN_EMAIL || 'info@lozanonahuel.com'}">${process.env.ADMIN_EMAIL || 'info@lozanonahuel.com'}</a></p>
                    <p>© ${new Date().getFullYear()} Nahuel Lozano Trading Platform. Todos los derechos reservados.</p>
                    <p>Este email fue enviado porque eres parte de nuestra comunidad de trading. Si no deseas recibir más emails, <a href="https://lozanonahuel.vercel.app/perfil">puedes gestionar tus preferencias aquí</a>.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
}

// Plantilla especializada para emails de bienvenida
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
}) {
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
    buttonUrl: buttonUrl || 'https://lozanonahuel.vercel.app/perfil'
  });
}

// Plantilla especializada para alertas de trading
export function createAlertEmailTemplate({
  alertType,
  title,
  content,
  urgency = 'medium',
  buttonText,
  buttonUrl
}: {
  alertType: string;
  title: string;
  content: string;
  urgency?: 'low' | 'medium' | 'high';
  buttonText?: string;
  buttonUrl?: string;
}) {
  const urgencyConfig = {
    low: { emoji: '📊', color: '#3b82f6', bg: '#eff6ff' },
    medium: { emoji: '⚡', color: '#f59e0b', bg: '#fffbeb' },
    high: { emoji: '🚨', color: '#ef4444', bg: '#fef2f2' }
  };
  
  const config = urgencyConfig[urgency];
  
  return createEmailTemplate({
    title: `${config.emoji} ${title}`,
    content: `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: ${config.color}; color: white; padding: 8px 16px; border-radius: 50px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
          ${alertType} • ${urgency.toUpperCase()}
        </div>
      </div>
      
      ${content}
      
      <div style="background: ${config.bg}; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid ${config.color}33;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 20px; margin-right: 12px;">${config.emoji}</span>
          <strong style="color: ${config.color}; font-size: 16px;">Información Importante</strong>
        </div>
        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
          Esta alerta ha sido generada en base a nuestro análisis técnico y fundamental. Recuerda siempre hacer tu propia investigación antes de tomar decisiones de inversión.
        </p>
      </div>
    `,
    buttonText: buttonText || 'Ver Detalles Completos',
    buttonUrl: buttonUrl || 'https://lozanonahuel.vercel.app/alertas'
  });
}

// Plantilla para emails promocionales/marketing
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
}) {
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
    buttonUrl: buttonUrl || 'https://lozanonahuel.vercel.app'
  });
} 

// Plantillas para notificaciones de suscripciones
export function createSubscriptionExpiryWarningTemplate({
  userName,
  serviceName,
  expiryDate,
  daysLeft,
  renewalUrl
}: {
  userName: string;
  serviceName: string;
  expiryDate: string;
  daysLeft: number;
  renewalUrl: string;
}) {
  const urgencyColor = daysLeft === 1 ? '#dc2626' : '#f59e0b';
  const urgencyText = daysLeft === 1 ? 'URGENTE' : 'IMPORTANTE';
  
  const emailContent = `
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 600;">
        ¡Hola ${userName}! 👋
      </h2>
      <p style="margin: 0; font-size: 16px; color: #64748b;">
        Tu suscripción está próxima a vencer.
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid ${urgencyColor}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px; color: #92400e; font-size: 18px;">
        ⚠️ ${urgencyText}: Tu suscripción vence pronto
      </h3>
      <p style="margin: 0; color: #78350f; font-weight: 500;">
        Tu suscripción a <strong>${serviceName}</strong> vence el <strong>${expiryDate}</strong>.
      </p>
      <p style="margin: 10px 0 0; color: #78350f; font-weight: 500;">
        Te quedan <strong>${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}</strong> para renovar.
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #00ff88;">
      <h3 style="margin: 0 0 15px; font-size: 18px; color: #1e293b; font-weight: 600;">
        💡 ¿Por qué renovar?
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.6;">
        <li style="margin-bottom: 8px;">Mantén acceso a todas las alertas y análisis</li>
        <li style="margin-bottom: 8px;">No pierdas las estrategias exclusivas</li>
        <li style="margin-bottom: 8px;">Continúa con tu desarrollo profesional</li>
        <li>Evita interrupciones en tu trading</li>
      </ul>
    </div>
    
    <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 25px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 500;">
        ⏰ <strong>Acción Requerida:</strong> Renueva tu suscripción antes de que expire para mantener acceso continuo.
      </p>
    </div>
  `;

  return createNotificationEmailTemplate({
    title: `⚠️ Tu suscripción a ${serviceName} vence pronto`,
    content: emailContent,
    notificationType: 'warning',
    urgency: daysLeft === 1 ? 'high' : 'normal',
    buttonText: 'Renovar Suscripción',
    buttonUrl: renewalUrl
  });
}

export function createSubscriptionExpiredTemplate({
  userName,
  serviceName,
  expiryDate,
  renewalUrl
}: {
  userName: string;
  serviceName: string;
  expiryDate: string;
  renewalUrl: string;
}) {
  const emailContent = `
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 600;">
        ¡Hola ${userName}! 👋
      </h2>
      <p style="margin: 0; font-size: 16px; color: #64748b;">
        Tu suscripción ha expirado.
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px; color: #991b1b; font-size: 18px;">
        ❌ Tu suscripción ha expirado
      </h3>
      <p style="margin: 0; color: #7f1d1d; font-weight: 500;">
        Tu suscripción a <strong>${serviceName}</strong> expiró el <strong>${expiryDate}</strong>.
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #00ff88;">
      <h3 style="margin: 0 0 15px; font-size: 18px; color: #1e293b; font-weight: 600;">
        💡 ¿Por qué renovar?
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.6;">
        <li style="margin-bottom: 8px;">Recupera acceso a todas las alertas y análisis</li>
        <li style="margin-bottom: 8px;">No pierdas las estrategias exclusivas</li>
        <li style="margin-bottom: 8px;">Continúa con tu desarrollo profesional</li>
        <li>Evita interrupciones en tu trading</li>
      </ul>
    </div>
    
    <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 25px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 500;">
        ⚡ <strong>Acción Requerida:</strong> Renueva tu suscripción para recuperar acceso inmediato.
      </p>
    </div>
  `;

  return createNotificationEmailTemplate({
    title: `❌ Tu suscripción a ${serviceName} ha expirado`,
    content: emailContent,
    notificationType: 'alert',
    urgency: 'high',
    buttonText: 'Renovar Suscripción',
    buttonUrl: renewalUrl
  });
} 