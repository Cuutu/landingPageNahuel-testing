import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { sendEmail, verifyEmailConfiguration } from '@/lib/emailService';
import { sendAdvisoryConfirmationEmail, sendAdminNotificationEmail } from '@/lib/emailNotifications';
import { verifyAdminAPI } from '@/lib/adminAuth';

/**
 * API para enviar email de prueba (solo admin)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar que el usuario sea admin
  const adminCheck = await verifyAdminAPI(req, res);
  if (!adminCheck.isAdmin) {
    return res.status(401).json({ error: adminCheck.error || 'No autorizado. Se requieren permisos de administrador.' });
  }

  try {
    const { testType, email } = req.body;

    console.log('📧 Iniciando test de email:', testType);
    console.log('📧 Email destino:', email);
    
    // AGREGADO: Debug de variables de entorno
    const hasBrevo = !!process.env.BREVO_API_KEY;
    const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
    
    console.log('📧 Variables de entorno de email:', {
      BREVO_API_KEY: hasBrevo ? '✅ Configurada' : '❌ No configurada',
      BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || 'No configurado',
      BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || 'No configurado',
      SMTP_HOST: process.env.SMTP_HOST || 'No configurado',
      SMTP_PORT: process.env.SMTP_PORT || 'No configurado',
      SMTP_USER: process.env.SMTP_USER || 'No configurado',
      EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || 'No configurado',
      EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'No configurado',
      EMAIL_TESTING_MODE: process.env.EMAIL_TESTING_MODE || 'false'
    });

    // Verificar configuración
    const isConfigured = await verifyEmailConfiguration();
    const provider = hasBrevo ? 'Brevo API' : (hasSmtp ? 'SMTP' : 'Ninguno');
    console.log(`📧 Configuración de email (${provider}):`, isConfigured ? '✅ Válida' : '❌ Inválida');

    if (!isConfigured) {
      return res.status(400).json({ 
        error: 'Configuración de email no válida',
        details: hasBrevo 
          ? 'Revisa BREVO_API_KEY y BREVO_SENDER_EMAIL'
          : 'Revisa las variables de entorno SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS o configura Brevo',
        provider
      });
    }

    let result;

    switch (testType) {
      case 'advisory_confirmation':
        console.log('📧 Enviando test de confirmación de asesoría...');
        await sendAdvisoryConfirmationEmail(
          email,
          'Usuario de Prueba',
          {
            type: 'Consultorio Financiero',
            date: 'lunes, 8 de julio de 2025',
            time: '16:00',
            duration: 60,
            price: 199
          }
        );
        result = { message: 'Email de confirmación de asesoría enviado exitosamente' };
        break;

      case 'admin_notification':
        console.log('📧 Enviando test de notificación al admin...');
        await sendAdminNotificationEmail({
          userEmail: email,
          userName: 'Usuario de Prueba',
          type: 'advisory',
          serviceType: 'Consultorio Financiero',
          date: 'lunes, 8 de julio de 2025',
          time: '16:00',
          duration: 60,
          price: 199
        });
        result = { message: 'Email de notificación al admin enviado exitosamente' };
        break;

      case 'simple':
      default:
        console.log('📧 Enviando email simple de prueba...');
        await sendEmail({
          to: email,
          subject: '🧪 Test de Email - Sistema de Reservas',
          html: `
            <h2>¡Test de Email Exitoso!</h2>
            <p>Este es un email de prueba del sistema de reservas.</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
            <p><strong>Sistema:</strong> Notificaciones de Reservas</p>
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>✅ Configuración de Email Funcionando</h3>
              <p>Tu sistema de email está configurado correctamente y funcionando.</p>
              <p><strong>Proveedor:</strong> ${hasBrevo ? 'Brevo API' : 'SMTP'}</p>
              ${process.env.EMAIL_TESTING_MODE === 'true' ? '<p style="color: #f59e0b;"><strong>⚠️ Modo Testing:</strong> Solo se envían emails a administradores</p>' : ''}
            </div>
          `
        });
        result = { message: 'Email de prueba enviado exitosamente' };
        break;
    }

    console.log('✅ Test de email completado exitosamente');
    return res.status(200).json({
      ...result,
      provider: hasBrevo ? 'Brevo API' : 'SMTP',
      testingMode: process.env.EMAIL_TESTING_MODE === 'true'
    });

  } catch (error) {
    console.error('❌ Error en test de email:', error);
    return res.status(500).json({ 
      error: 'Error al enviar email de prueba',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 