import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { sendBulkEmails, createEmailTemplate, createPromotionalEmailTemplate } from '@/lib/emailService';
import User from '@/models/User';
import EmailList from '@/models/EmailList';
import dbConnect from '@/lib/mongodb';

/**
 * API para envío masivo de emails
 * POST: Enviar email a grupo de usuarios seleccionado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('📧 [API] Bulk Email - método:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Verificar que el usuario sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    console.log('✅ [BULK EMAIL] Acceso de admin confirmado para:', session.user.email);
    console.log('📦 [BULK EMAIL] Procesando datos del request...');
    console.log('📦 [BULK EMAIL] req.body:', JSON.stringify(req.body, null, 2));

    const { 
      recipients, 
      recipientType, 
      subject, 
      message, 
      emailType = 'general',
      offer,
      expiryDate,
      buttonText,
      buttonUrl
    } = req.body;

    // Manejar diferentes formatos de datos del frontend
    // El frontend puede enviar 'recipients' o 'recipientType'
    let finalRecipientType = recipientType;
    let finalRecipients = recipients;
    
    // Si recipients es un string, entonces es el tipo de destinatario
    if (typeof recipients === 'string' && !recipientType) {
      finalRecipientType = recipients;
      finalRecipients = [];
    }
    
    // Si recipients es un array, entonces es personalizado
    if (Array.isArray(recipients) && !recipientType) {
      finalRecipientType = 'custom';
      finalRecipients = recipients;
    }
    
    console.log('📋 [BULK EMAIL] Datos extraídos y corregidos:', {
      originalRecipientType: recipientType,
      originalRecipients: recipients,
      finalRecipientType,
      finalRecipients: Array.isArray(finalRecipients) ? finalRecipients : 'N/A',
      subject: subject?.substring(0, 50) + '...',
      message: message?.substring(0, 50) + '...',
      emailType,
      hasOffer: !!offer,
      hasButtonText: !!buttonText,
      hasButtonUrl: !!buttonUrl
    });

    // Validaciones
    console.log('🔍 [BULK EMAIL] Validando datos requeridos...');
    if (!subject || !message) {
      console.error('❌ [BULK EMAIL] Faltan datos requeridos:', { 
        hasSubject: !!subject, 
        hasMessage: !!message 
      });
      return res.status(400).json({ error: 'Asunto y mensaje son requeridos' });
    }
    
    if (!finalRecipientType) {
      console.error('❌ [BULK EMAIL] Tipo de destinatario no especificado');
      return res.status(400).json({ error: 'Tipo de destinatario es requerido' });
    }
    
    console.log('✅ [BULK EMAIL] Validación de datos requeridos completada');

    let targetEmails: string[] = [];

    console.log('👥 [BULK EMAIL] Determinando destinatarios para tipo:', finalRecipientType);

    // Determinar destinatarios usando la nueva base de datos de emails
    if (finalRecipientType === 'all') {
      console.log('👥 [BULK EMAIL] Obteniendo todos los emails de la lista...');
      const emailList = await (EmailList as any).getActiveEmails();
      targetEmails = emailList.map((item: any) => item.email);
      console.log('👥 [BULK EMAIL] Emails encontrados en la lista:', emailList.length);
    } else if (finalRecipientType === 'custom' && finalRecipients) {
      console.log('👥 [BULK EMAIL] Validando emails personalizados...');
      // Validar emails individuales
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      targetEmails = finalRecipients.filter((email: string) => emailRegex.test(email));
      console.log('👥 [BULK EMAIL] Emails válidos de la lista personalizada:', targetEmails.length, 'de', finalRecipients.length);
    } else if (finalRecipientType === 'subscribers' || finalRecipientType === 'suscriptores') {
      console.log('👥 [BULK EMAIL] Obteniendo emails de suscriptores...');
      // Buscar emails de usuarios con role 'suscriptor' O con suscripciones activas
      const subscribers = await User.find({
        $or: [
          { role: 'suscriptor' },
          { 'activeSubscriptions.isActive': true },
          { 'subscriptions.activa': true },
          { 'suscripciones.activa': true }
        ]
      }, 'email');
      
      // Obtener emails de la lista que coincidan con suscriptores
      const subscriberEmails = subscribers.map((user: any) => user.email);
      const emailList = await EmailList.find({
        email: { $in: subscriberEmails },
        isActive: true
      });
      targetEmails = emailList.map((item: any) => item.email);
      console.log('👥 [BULK EMAIL] Emails de suscriptores encontrados:', emailList.length);
    } else if (finalRecipientType === 'admins' || finalRecipientType === 'administradores') {
      console.log('👥 [BULK EMAIL] Obteniendo emails de administradores...');
      // Solo administradores
      const admins = await User.find({ role: 'admin' }, 'email');
      const adminEmails = admins.map((user: any) => user.email);
      
      // Obtener emails de la lista que coincidan con administradores
      const emailList = await EmailList.find({
        email: { $in: adminEmails },
        isActive: true
      });
      targetEmails = emailList.map((item: any) => item.email);
      console.log('👥 [BULK EMAIL] Emails de administradores encontrados:', emailList.length);
    } else {
      console.error('❌ [BULK EMAIL] Tipo de destinatario no válido:', finalRecipientType);
      console.error('❌ [BULK EMAIL] Tipos válidos: all, custom, subscribers/suscriptores, admins/administradores');
      return res.status(400).json({ 
        error: `Tipo de destinatario no válido: ${finalRecipientType}`,
        validTypes: ['all', 'custom', 'subscribers', 'suscriptores', 'admins', 'administradores']
      });
    }

    console.log('👥 [BULK EMAIL] Total de emails objetivo:', targetEmails.length);
    console.log('👥 [BULK EMAIL] Lista de emails:', targetEmails.slice(0, 5), targetEmails.length > 5 ? '...' : '');

    if (targetEmails.length === 0) {
      console.error('❌ [BULK EMAIL] No se encontraron destinatarios válidos');
      return res.status(400).json({ error: 'No se encontraron destinatarios válidos' });
    }

    console.log(`📧 [BULK EMAIL] Preparando envío masivo a ${targetEmails.length} destinatarios`);
    console.log('🎨 [BULK EMAIL] Creando plantilla de email tipo:', emailType);

    // Crear HTML del email basado en el tipo
    let emailHtml: string;
    
    switch (emailType) {
      case 'promotional':
        console.log('🎨 [BULK EMAIL] Creando plantilla promocional...');
        emailHtml = createPromotionalEmailTemplate({
          title: subject,
          content: message,
          offer,
          expiryDate,
          buttonText,
          buttonUrl
        });
        break;
      
      case 'alert':
        console.log('🎨 [BULK EMAIL] Creando plantilla de alerta...');
        emailHtml = createEmailTemplate({
          title: `🚨 ${subject}`,
          content: `
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">⚠️ Alerta Importante</h3>
              <p style="margin: 0; color: #92400e;">
                ${message}
              </p>
            </div>
          `,
          buttonText,
          buttonUrl
        });
        break;

      case 'newsletter':
        console.log('🎨 [BULK EMAIL] Creando plantilla de newsletter...');
        emailHtml = createEmailTemplate({
          title: `📰 ${subject}`,
          content: `
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
              <h3 style="color: #1e3a8a; margin-top: 0;">📧 Newsletter</h3>
              <div style="color: #1e3a8a;">
                ${message.split('\n').map((paragraph: string) => 
                  paragraph.trim() ? `<p style="margin: 0 0 12px 0;">${paragraph}</p>` : ''
                ).join('')}
              </div>
            </div>
          `,
          buttonText,
          buttonUrl
        });
        break;

      default: // general
        console.log('🎨 [BULK EMAIL] Creando plantilla general...');
        emailHtml = createEmailTemplate({
          title: subject,
          content: message,
          buttonText,
          buttonUrl
        });
    }

    console.log('✅ [BULK EMAIL] Plantilla HTML creada, longitud:', emailHtml.length, 'caracteres');
    console.log('📧 [BULK EMAIL] Iniciando envío masivo...');

    // Enviar emails masivos
    const results = await sendBulkEmails({
      recipients: targetEmails,
      subject,
      html: emailHtml
    });

    console.log('✅ [BULK EMAIL] Envío masivo completado');
    console.log('📊 [BULK EMAIL] Resultados detallados:', {
      sent: results.sent,
      failed: results.failed,
      total: targetEmails.length,
      errorsCount: results.errors.length
    });

    if (results.errors.length > 0) {
      console.error('❌ [BULK EMAIL] Errores durante el envío:', results.errors.slice(0, 3));
    }

    // Marcar emails como usados en la base de datos
    try {
      await (EmailList as any).markAsUsed(targetEmails);
      console.log('✅ [BULK EMAIL] Emails marcados como usados en la base de datos');
    } catch (markError) {
      console.error('⚠️ [BULK EMAIL] Error marcando emails como usados:', markError);
      // No fallar el envío si no se pueden marcar como usados
    }

    console.log(`📊 [BULK EMAIL] Envío masivo completado: ${results.sent} enviados, ${results.failed} fallidos`);

    return res.status(200).json({
      success: true,
      message: `Emails enviados exitosamente a ${results.sent} destinatarios`,
      results: {
        sent: results.sent,
        failed: results.failed,
        total: targetEmails.length,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('❌ [BULK EMAIL] Error en envío masivo:', error);
    console.error('❌ [BULK EMAIL] Stack trace:', error instanceof Error ? error.stack : 'No stack available');
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 