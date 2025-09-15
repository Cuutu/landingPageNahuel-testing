import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { sendEmail, createNotificationEmailTemplate } from '@/lib/emailService';
import User from '@/models/User';

interface AutoConvertCronResponse {
  success: boolean;
  message: string;
  conversion?: {
    processed: number;
    details: Array<{
      symbol: string;
      oldRange: string;
      newPrice: number;
    }>;
  };
  timestamp: string;
}

/**
 * CRON JOB: Conversión automática de rangos
 * Se ejecuta automáticamente cada día a las 6:30 PM EST/EDT (lunes a viernes)
 * Convierte TODOS los rangos a precios fijos sin importar el estado del mercado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertCronResponse>) {
  // Permitir POST y GET (GET para Vercel cron, POST para servicios externos)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido',
      timestamp: new Date().toISOString()
    });
  }

  // TEMPORAL: Deshabilitar autenticación para cron-job.org
  console.log('🔓 [CRON] Autenticación deshabilitada para cron-job.org');
  
  // Verificar token de seguridad para cron jobs (opcional)
  // const cronToken = req.headers.authorization?.replace('Bearer ', '');
  // const expectedToken = process.env.CRON_SECRET_TOKEN;
  
  // if (expectedToken && cronToken !== expectedToken) {
  //   console.log('❌ [CRON] Token de autorización inválido');
  //   return res.status(401).json({
  //     success: false,
  //     message: 'No autorizado',
  //     timestamp: new Date().toISOString()
  //   });
  // }

  try {
    console.log('🤖 CRON: Iniciando conversión automática de rangos...');
    
    await dbConnect();

    // ✅ FORZAR CONVERSIÓN: Siempre convertir rangos sin importar el estado del mercado
    console.log('🔄 CRON: Iniciando conversión automática de rangos (forzada)...');

    // Obtener alertas con rango que necesitan conversión
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { tipoAlerta: 'rango' },
        { precioMinimo: { $exists: true, $ne: null } }
      ]
    });

    console.log(`🔍 CRON: Encontradas ${alertsWithRange.length} alertas con rango para convertir`);

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      console.log(`📊 CRON: Procesando ${alert.symbol}:`, {
        entryPriceRange: alert.entryPriceRange,
        entryPrice: alert.entryPrice,
        currentPrice: alert.currentPrice,
        precioMinimo: alert.precioMinimo,
        precioMaximo: alert.precioMaximo,
        tipoAlerta: alert.tipoAlerta
      });

      // Usar el precio actual como precio de entrada fijo
      const closePrice = alert.currentPrice;
      
      if (!closePrice || closePrice <= 0) {
        console.warn(`⚠️ CRON: ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
        continue;
      }
      
      console.log(`💰 CRON: ${alert.symbol}: Precio actual ${closePrice} -> Precio de entrada fijo`);

      // Determinar el rango anterior para el log
      let oldRange = 'N/A';
      if (alert.entryPriceRange) {
        oldRange = `$${alert.entryPriceRange.min}-$${alert.entryPriceRange.max}`;
      } else if (alert.precioMinimo && alert.precioMaximo) {
        oldRange = `$${alert.precioMinimo}-$${alert.precioMaximo}`;
      }

      // Actualizar entryPrice al precio actual Y eliminar campos de rango en una sola operación
      await Alert.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            entryPrice: closePrice,
            tipoAlerta: 'precio' // Cambiar a tipo precio fijo
          },
          $unset: { 
            entryPriceRange: 1,
            precioMinimo: 1,
            precioMaximo: 1
          }
        }
      );

      conversionDetails.push({
        symbol: alert.symbol,
        oldRange: oldRange,
        newPrice: closePrice
      });

      console.log(`✅ CRON: ${alert.symbol}: Rango ${oldRange} convertido a precio fijo $${closePrice}`);

      // 📧 NUEVO: Enviar email de notificación al usuario
      try {
        await sendRangeConversionEmail(alert, closePrice, oldRange);
        console.log(`📧 CRON: Email enviado para ${alert.symbol} - Precio final: $${closePrice}`);
      } catch (emailError) {
        console.error(`❌ CRON: Error enviando email para ${alert.symbol}:`, emailError);
        // No fallar el proceso si el email falla
      }
    }

    console.log(`🎉 CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`);

    return res.status(200).json({
      success: true,
      message: `Conversión automática completada: ${conversionDetails.length} alertas procesadas`,
      conversion: {
        processed: conversionDetails.length,
        details: conversionDetails
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ CRON: Error en conversión automática:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 📧 NUEVO: Envía email de notificación cuando se convierte una alerta de rango
 */
async function sendRangeConversionEmail(alert: any, finalPrice: number, oldRange: string) {
  try {
    // Obtener información del usuario que creó la alerta
    const user = await User.findById(alert.createdBy);
    
    if (!user || !user.email) {
      console.log(`⚠️ CRON: Usuario no encontrado para alerta ${alert._id}, saltando email`);
      return;
    }

    // Calcular el porcentaje de ganancia/pérdida
    const profitPercentage = ((finalPrice - (alert.entryPriceRange?.min || alert.precioMinimo || 0)) / (alert.entryPriceRange?.min || alert.precioMinimo || 0)) * 100;
    const profitColor = profitPercentage >= 0 ? '#22c55e' : '#ef4444';
    const profitIcon = profitPercentage >= 0 ? '📈' : '📉';

    const html = createNotificationEmailTemplate({
      title: `🔄 Alerta Convertida: ${alert.symbol}`,
      content: `
        <div style="text-align: center; margin-bottom: 30px;">
          <h3 style="margin: 0 0 10px; font-size: 20px; color: #1e293b; font-weight: 700;">
            ¡Hola ${user.name || user.email.split('@')[0]}! 👋
          </h3>
          <p style="margin: 0; font-size: 16px; color: #64748b; line-height: 1.5;">
            Tu alerta de rango ha sido convertida automáticamente a precio fijo.
          </p>
        </div>
        
        <!-- Badge de conversión -->
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 8px 20px; border-radius: 25px; font-weight: 600; font-size: 14px;">
            🔄 Conversión Automática Completada
          </div>
        </div>
        
        <!-- Detalles de la conversión -->
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #e2e8f0; border-radius: 16px; padding: 25px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 20px; font-size: 18px; color: #1e293b; font-weight: 600; text-align: center;">
            📊 Detalles de la Conversión
          </h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Símbolo</div>
              <div style="font-size: 20px; color: #1e293b; font-weight: 700;">${alert.symbol}</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Acción</div>
              <div style="font-size: 20px; color: ${alert.action === 'BUY' ? '#22c55e' : '#ef4444'}; font-weight: 700;">${alert.action}</div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Rango Anterior</div>
              <div style="font-size: 16px; color: #1e293b; font-weight: 600;">${oldRange}</div>
            </div>
            <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Precio Final</div>
              <div style="font-size: 20px; color: #1e293b; font-weight: 700;">$${finalPrice.toFixed(2)}</div>
            </div>
          </div>
          
          <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px;">Rendimiento</div>
            <div style="font-size: 18px; color: ${profitColor}; font-weight: 700;">
              ${profitIcon} ${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%
            </div>
          </div>
        </div>
        
        <!-- Información adicional -->
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">ℹ️</span>
            <div>
              <h5 style="margin: 0 0 5px; font-size: 14px; color: #92400e; font-weight: 600;">
                ¿Qué significa esto?
              </h5>
              <p style="margin: 0; font-size: 13px; color: #b45309; line-height: 1.4;">
                Tu alerta de rango ha sido convertida automáticamente al precio actual del mercado. Ahora puedes hacer seguimiento del rendimiento con un precio fijo de entrada.
              </p>
            </div>
          </div>
        </div>
      `,
      notificationType: 'success',
      urgency: 'normal',
      buttonText: 'Ver Mis Alertas',
      buttonUrl: '/alertas'
    });

    await sendEmail({
      to: user.email,
      subject: `🔄 Alerta Convertida: ${alert.symbol} - Precio Final: $${finalPrice.toFixed(2)}`,
      html
    });

    console.log(`✅ CRON: Email de conversión enviado a ${user.email} para ${alert.symbol}`);

  } catch (error) {
    console.error('❌ CRON: Error enviando email de conversión:', error);
    throw error;
  }
}

