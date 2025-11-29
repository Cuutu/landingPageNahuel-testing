import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail, createNotificationEmailTemplate } from '@/lib/emailService';

/**
 * Envía notificaciones a todos los suscriptores con 7 días o menos restantes
 */
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
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Obtener todos los usuarios con suscripciones activas
    const users = await User.find({
      'activeSubscriptions.isActive': true
    }).select('name email activeSubscriptions');

    const now = new Date();
    const results = {
      total: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Mapear nombres de servicios
    const serviceNames: { [key: string]: string } = {
      'TraderCall': 'Trader Call',
      'SmartMoney': 'Smart Money',
      'CashFlow': 'Cash Flow',
      'SwingTrading': 'Zero 2 Trader',
      'DowJones': 'Dow Jones'
    };

    // Procesar cada usuario
    for (const user of users) {
      if (!user.activeSubscriptions || user.activeSubscriptions.length === 0) continue;

      for (const sub of user.activeSubscriptions) {
        if (!sub.isActive) continue;

        const expiryDate = new Date(sub.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Solo enviar a suscriptores con 7 días o menos restantes
        if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
          results.total++;

          try {
            const serviceName = serviceNames[sub.service] || sub.service;
            const emailSubject = `⏰ Tu suscripción a ${serviceName} vence pronto`;

            const emailContent = `
              <div style="text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 600;">
                  ¡Hola ${user.name || 'Usuario'}! 👋
                </h2>
                <p style="margin: 0; font-size: 16px; color: #64748b;">
                  Tu suscripción está por vencer pronto.
                </p>
              </div>
              
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #fbbf24; border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                <h3 style="margin: 0 0 15px; font-size: 18px; color: #92400e; font-weight: 600;">
                  ⚠️ Tu suscripción vence en ${daysUntilExpiry} día${daysUntilExpiry !== 1 ? 's' : ''}
                </h3>
                <p style="margin: 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  Tu suscripción a <strong>${serviceName}</strong> vence el ${expiryDate.toLocaleDateString('es-AR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}.
                </p>
                <p style="margin: 15px 0 0; font-size: 16px; color: #78350f; line-height: 1.6;">
                  Para continuar disfrutando de todos los beneficios, renueva tu suscripción ahora.
                </p>
              </div>
              
              <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; color: #0c4a6e; font-weight: 500;">
                  💡 <strong>Consejo:</strong> Renueva ahora para no perder acceso a tus alertas y contenido exclusivo.
                </p>
              </div>
            `;

            const emailHtml = createNotificationEmailTemplate({
              title: `⏰ Renueva tu suscripción - ${serviceName}`,
              content: emailContent,
              notificationType: 'warning',
              urgency: 'high',
              buttonText: 'Renovar Suscripción',
              buttonUrl: `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`
            });

            // Enviar email
            await sendEmail({
              to: user.email,
              subject: emailSubject,
              html: emailHtml
            });

            results.sent++;
            console.log(`✅ Notificación enviada a ${user.email} para servicio ${sub.service}`);
          } catch (error) {
            results.failed++;
            const errorMsg = `Error enviando a ${user.email}: ${error instanceof Error ? error.message : 'Error desconocido'}`;
            results.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`, error);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Notificaciones enviadas: ${results.sent} exitosas, ${results.failed} fallidas de ${results.total} totales`,
      results
    });

  } catch (error) {
    console.error('❌ Error en envío masivo de notificaciones:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor' 
    });
  }
}

