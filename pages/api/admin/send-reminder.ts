import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, createNotificationEmailTemplate } from '@/lib/emailService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar sesión y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar si es admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { userEmail, service } = req.body;

    if (!userEmail || !service) {
      return res.status(400).json({ error: 'Email y servicio son requeridos' });
    }

    // Buscar usuario
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Mapear nombres de servicios
    const serviceNames: { [key: string]: string } = {
      'TraderCall': 'Trader Call',
      'SmartMoney': 'Smart Money',
      'CashFlow': 'Cash Flow',
      'SwingTrading': 'Zero 2 Trader',
      'DowJones': 'Dow Jones'
    };

    const serviceName = serviceNames[service] || service;

    // Crear contenido del email usando la nueva plantilla con logo
    const emailSubject = `Recordatorio: Tu suscripción a ${serviceName}`;
    
    const emailContent = `
      <div style="text-align: center; margin-bottom: 25px;">
        <h2 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 600;">
          ¡Hola ${user.name}! 👋
        </h2>
        <p style="margin: 0; font-size: 16px; color: #64748b;">
          Te escribimos para recordarte sobre tu suscripción.
        </p>
      </div>
      
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #00ff88;">
        <h3 style="margin: 0 0 15px; font-size: 18px; color: #1e293b; font-weight: 600;">
          📋 Recordatorio de Suscripción
        </h3>
        <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
          Te recordamos que tienes una suscripción activa a <strong>${serviceName}</strong>.
        </p>
        <p style="margin: 15px 0 0; font-size: 16px; color: #374151; line-height: 1.6;">
          Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos. Estamos aquí para ayudarte.
        </p>
      </div>
      
      <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 25px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 500;">
          💡 <strong>Consejo:</strong> Revisa tu perfil regularmente para mantener tus suscripciones actualizadas.
        </p>
      </div>
    `;

    const emailHtml = createNotificationEmailTemplate({
      title: `⏰ Recordatorio - ${serviceName}`,
      content: emailContent,
      notificationType: 'warning',
      urgency: 'normal',
      buttonText: 'Ver Mi Perfil',
      buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
    });

    // Enviar email
    await sendEmail({
      to: userEmail,
      subject: emailSubject,
      html: emailHtml
    });

    console.log(`✅ Email de recordatorio enviado a ${userEmail} para servicio ${service}`);

    return res.status(200).json({
      success: true,
      message: 'Email de recordatorio enviado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error enviando email de recordatorio:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
}
