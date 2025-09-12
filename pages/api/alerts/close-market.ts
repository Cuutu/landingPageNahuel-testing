/**
 * API para cerrar el mercado y procesar alertas de rango
 * Solo los administradores pueden ejecutar esta acción
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import { sendEmail } from '@/lib/emailService';

interface CloseMarketResponse {
  success?: boolean;
  message?: string;
  processedAlerts?: number;
  emailsSent?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CloseMarketResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Obtener información del usuario y verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Solo administradores pueden cerrar el mercado
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Permisos insuficientes. Solo los administradores pueden cerrar el mercado.' 
      });
    }

    console.log('🔄 Iniciando proceso de cierre de mercado...');

    // Obtener todas las alertas de rango activas que no han sido procesadas
    const activeRangeAlerts = await Alert.find({
      tipoAlerta: 'rango',
      status: 'ACTIVE',
      'emailsSent.marketClose': false
    }).populate('createdBy', 'name email');

    console.log(`📊 Encontradas ${activeRangeAlerts.length} alertas de rango activas`);

    let processedAlerts = 0;
    let emailsSent = 0;

    // Procesar cada alerta de rango
    for (const alert of activeRangeAlerts) {
      try {
        // Obtener el precio actual del mercado (simulado por ahora)
        // TODO: Integrar con API real de precios de mercado
        const currentMarketPrice = await getCurrentMarketPrice(alert.symbol);
        
        if (!currentMarketPrice) {
          console.warn(`⚠️ No se pudo obtener precio para ${alert.symbol}`);
          continue;
        }

        // Verificar si el precio actual está dentro del rango
        const isInRange = currentMarketPrice >= alert.precioMinimo! && 
                         currentMarketPrice <= alert.precioMaximo!;

        // Actualizar la alerta con el precio final
        alert.finalPrice = currentMarketPrice;
        alert.finalPriceSetAt = new Date();
        alert.currentPrice = currentMarketPrice;
        alert.setFinalPrice(currentMarketPrice);

        // Marcar como cerrada si está en rango
        if (isInRange) {
          alert.status = 'CLOSED';
        }

        // Marcar email de cierre como enviado
        alert.emailsSent.marketClose = true;

        await alert.save();
        processedAlerts++;

        // Enviar email de cierre de mercado
        try {
          await sendMarketCloseEmail(alert, currentMarketPrice, isInRange);
          emailsSent++;
          console.log(`✅ Email enviado para alerta ${alert._id}`);
        } catch (emailError) {
          console.error(`❌ Error al enviar email para alerta ${alert._id}:`, emailError);
        }

      } catch (alertError) {
        console.error(`❌ Error procesando alerta ${alert._id}:`, alertError);
      }
    }

    console.log(`✅ Proceso de cierre completado: ${processedAlerts} alertas procesadas, ${emailsSent} emails enviados`);

    return res.status(200).json({
      success: true,
      message: 'Cierre de mercado procesado exitosamente',
      processedAlerts,
      emailsSent
    });

  } catch (error) {
    console.error('❌ Error en cierre de mercado:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudo procesar el cierre de mercado'
    });
  }
}

/**
 * Obtener precio actual del mercado (simulado)
 * TODO: Integrar con API real de precios
 */
async function getCurrentMarketPrice(symbol: string): Promise<number | null> {
  try {
    // Por ahora, simular un precio aleatorio dentro de un rango
    // En producción, aquí iría la llamada a la API real de precios
    const basePrice = 100; // Precio base simulado
    const variation = Math.random() * 20 - 10; // Variación de ±10%
    return Math.max(0, basePrice + variation);
  } catch (error) {
    console.error(`Error obteniendo precio para ${symbol}:`, error);
    return null;
  }
}

/**
 * Enviar email de cierre de mercado
 */
async function sendMarketCloseEmail(alert: any, finalPrice: number, isInRange: boolean) {
  const user = alert.createdBy;
  
  const subject = `Cierre de Mercado - Alerta ${alert.symbol}`;
  const status = isInRange ? '✅ ACTIVADA' : '❌ NO ACTIVADA';
  const statusColor = isInRange ? '#10b981' : '#ef4444';
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">📈 Cierre de Mercado</h1>
        <p style="color: white; margin: 10px 0 0 0;">Alerta ${alert.symbol}</p>
      </div>
      
      <div style="padding: 20px; background: #f8fafc;">
        <h2 style="color: #1e293b; margin-top: 0;">Hola ${user.name || 'Usuario'}!</h2>
        
        <p>El mercado ha cerrado y aquí tienes el resultado de tu alerta:</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="margin-top: 0; color: #1e293b;">📊 Detalles de la Alerta</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Símbolo:</td>
              <td style="padding: 8px 0;">${alert.symbol}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Acción:</td>
              <td style="padding: 8px 0;">${alert.action}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Rango:</td>
              <td style="padding: 8px 0;">$${alert.precioMinimo} - $${alert.precioMaximo}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Precio Final:</td>
              <td style="padding: 8px 0; font-weight: bold;">$${finalPrice.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Estado:</td>
              <td style="padding: 8px 0; color: ${statusColor}; font-weight: bold;">${status}</td>
            </tr>
          </table>
        </div>
        
        ${isInRange ? `
          <div style="background: #dcfce7; border: 1px solid #16a34a; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #16a34a; margin-top: 0;">🎉 ¡Alerta Activada!</h3>
            <p style="margin: 0;">El precio final ($${finalPrice.toFixed(2)}) está dentro de tu rango objetivo. ¡Excelente timing!</p>
          </div>
        ` : `
          <div style="background: #fef2f2; border: 1px solid #dc2626; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #dc2626; margin-top: 0;">📉 Alerta No Activada</h3>
            <p style="margin: 0;">El precio final ($${finalPrice.toFixed(2)}) está fuera de tu rango objetivo. Sigue monitoreando el mercado.</p>
          </div>
        `}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://lozanonahuel.vercel.app/alertas/trader-call" 
             style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Ver Todas las Alertas
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          Este email fue enviado automáticamente al cierre del mercado.<br>
          Si tienes preguntas, no dudes en contactarnos.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject,
    html: htmlContent
  });
}
