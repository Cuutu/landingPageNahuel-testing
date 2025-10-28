import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import User from '@/models/User';
import { sendEmail } from '@/lib/emailService';
import { z } from 'zod';

// Schema de validación
const notifySchema = z.object({
  paymentId: z.string().min(1, 'ID de pago es requerido'),
  userEmail: z.string().email('Email inválido'),
  userName: z.string().min(1, 'Nombre es requerido'),
  tradingViewUser: z.string().optional()
});

/**
 * Envía notificación al usuario confirmando que fue dado de alta en el servicio de indicadores
 * POST: Envía email al usuario con confirmación de alta
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/admin/indicators/notify`);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    // Verificar acceso de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    // Validar datos de entrada
    const validatedData = notifySchema.parse(req.body);
    const { paymentId, userEmail, userName, tradingViewUser } = validatedData;

    await dbConnect();

    // Buscar el pago
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Pago no encontrado' });
    }

    // Verificar que el pago sea del servicio de indicadores
    if (payment.service !== 'MediasMovilesAutomaticas') {
      return res.status(400).json({ 
        success: false, 
        error: 'El pago no corresponde al servicio de indicadores' 
      });
    }

    // Ya no requerimos el usuario de TradingView como obligatorio

    // Crear template HTML profesional para el email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>✅ Acceso Habilitado - Indicador Medias Móviles Automáticas</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff;
          }
          .header { 
            background: linear-gradient(135deg, #10b981, #059669); 
            color: white; 
            padding: 30px 20px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .content { 
            background: #f8f9fa; 
            padding: 30px 20px; 
          }
          .info-box { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 15px 0; 
            border-left: 4px solid #10b981;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .info-box h3 {
            margin: 0 0 10px 0;
            color: #10b981;
            font-size: 18px;
          }
          .info-box p {
            margin: 0;
            color: #555;
            font-size: 15px;
          }
          .highlight-box {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 2px solid #10b981;
          }
          .highlight-box p {
            margin: 0;
            color: #055934;
            font-size: 16px;
            font-weight: 600;
          }
          .instructions {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
          }
          .instructions h3 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 18px;
          }
          .instructions ol {
            margin: 0;
            padding-left: 20px;
          }
          .instructions li {
            margin: 10px 0;
            color: #555;
            font-size: 15px;
          }
          .footer { 
            text-align: center; 
            padding: 20px; 
            color: #666; 
            font-size: 14px;
            background: #f8f9fa;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 15px 0;
            font-size: 15px;
          }
          .tradingview-user {
            background: #e6f7ff;
            padding: 10px 15px;
            border-radius: 6px;
            font-family: monospace;
            font-weight: 600;
            color: #1890ff;
            margin: 10px 0;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Acceso Habilitado</h1>
            <p>Indicador Medias Móviles Automáticas</p>
          </div>
          
          <div class="content">
            <div class="info-box">
              <h3>👋 ¡Hola ${userName}!</h3>
              <p>Te confirmamos que tu acceso al indicador ha sido habilitado correctamente.</p>
            </div>
            
            ${tradingViewUser ? `
            <div class="highlight-box">
              <p>🎯 Tu usuario de TradingView ha sido configurado: <strong>${tradingViewUser}</strong></p>
            </div>
            ` : `
            <div class="highlight-box">
              <p>🎯 Tu acceso ha sido habilitado. El indicador ya está disponible en tu cuenta de TradingView.</p>
            </div>
            `}

            <div class="instructions">
              <h3>📋 Cómo acceder a tu indicador:</h3>
              <ol>
                ${tradingViewUser ? `<li>Inicia sesión en TradingView en tu cuenta: <span class="tradingview-user">${tradingViewUser}</span></li>` : `<li>Inicia sesión en tu cuenta de TradingView</li>`}
                <li>Dirígete a la sección "Productos" y abre los "Supergráficos"</li>
                <li>En el apartado de "Indicadores", busca "Requiere invitación"</li>
                <li>Allí encontrarás el indicador "Medias Móviles Automáticas"</li>
                <li>Puedes hacer clic en la "estrella" para agregarlo a favoritos</li>
                <li>¡Listo! Ya puedes usar el indicador en tus gráficos</li>
              </ol>
            </div>

            <div style="text-align: center;">
              <a href="https://www.tradingview.com" class="button">Ir a TradingView</a>
            </div>

            <div class="info-box">
              <h3>💡 Recordatorios importantes:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #555;">
                <li>El indicador funciona en gráficos diarios y semanales</li>
                <li>Puedes usarlo con cualquier plan de TradingView</li>
                <li>Tu acceso es <strong>vitalicio</strong> - no expira</li>
                <li>Si tienes dudas, escribinos a: lozanonahuel@gmail.com</li>
              </ul>
            </div>

            <div class="info-box">
              <h3>📊 Detalles de tu compra:</h3>
              <p><strong>Servicio:</strong> Medias Móviles Automáticas</p>
              ${tradingViewUser ? `<p><strong>Usuario TradingView:</strong> ${tradingViewUser}</p>` : ''}
              <p><strong>Fecha de alta:</strong> ${new Date().toLocaleString('es-AR')}</p>
              <p><strong>Email de contacto:</strong> ${userEmail}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Este email fue generado automáticamente desde el sistema de administración.</p>
            <p>© ${new Date().getFullYear()} Nahuel Lozano - Trading Profesional</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email al usuario
    await sendEmail({
      to: userEmail,
      subject: '✅ Acceso Habilitado - Indicador Medias Móviles Automáticas',
      html
    });

    // Actualizar el pago con la información de que se envió la notificación
    if (!payment.metadata) {
      payment.metadata = {};
    }
    payment.metadata.notificationSent = true;
    payment.metadata.notificationSentAt = new Date();
    payment.metadata.notificationSentBy = session.user.email;

    await payment.save();

    console.log('✅ Notificación enviada exitosamente:', {
      userEmail,
      userName,
      tradingViewUser,
      paymentId
    });

    return res.status(200).json({
      success: true,
      message: 'Notificación enviada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en /api/admin/indicators/notify:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
