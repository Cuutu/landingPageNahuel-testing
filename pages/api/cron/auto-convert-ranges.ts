import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertCronResponse>) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido',
      timestamp: new Date().toISOString()
    });
  }

  try {
    await dbConnect();
    console.log('🔄 CRON: Iniciando conversión automática de alertas de rango...');

    // Buscar alertas activas con rangos de precio
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { precioMinimo: { $exists: true, $ne: null }, precioMaximo: { $exists: true, $ne: null } }
      ]
    });

    console.log(`📊 CRON: Encontradas ${alertsWithRange.length} alertas con rangos para convertir`);

    if (alertsWithRange.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay alertas de rango para convertir',
        conversion: {
          processed: 0,
          details: []
        },
        timestamp: new Date().toISOString()
      });
    }

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      console.log(`📊 Procesando ${alert.symbol}:`, {
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
        console.warn(`⚠️ ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
        continue;
      }
      
      console.log(`💰 ${alert.symbol}: Precio actual ${closePrice} -> Precio de entrada fijo`);

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

      // 📧 NUEVO: Enviar notificación a TODOS los suscriptores
      try {
        await sendRangeConversionNotification(alert, closePrice, oldRange);
        console.log(`📧 CRON: Notificación enviada a suscriptores para ${alert.symbol} - Precio final: $${closePrice}`);
      } catch (emailError) {
        console.error(`❌ CRON: Error enviando notificación para ${alert.symbol}:`, emailError);
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
 * 📧 NUEVO: Envía notificación a TODOS los suscriptores cuando se convierte una alerta de rango
 */
async function sendRangeConversionNotification(alert: any, finalPrice: number, oldRange: string) {
  try {
    // Importar la función de notificaciones
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    console.log(`📧 CRON: Enviando notificación de conversión de rango para ${alert.symbol}`);
    console.log(`📧 CRON: Rango anterior: ${oldRange} -> Precio final: $${finalPrice}`);
    
    // Crear una notificación usando el sistema existente que envía a TODOS los suscriptores
    await createAlertNotification(alert, {
      message: `🎯 Alerta convertida: ${alert.symbol} - Rango ${oldRange} convertido a precio fijo $${finalPrice}`,
      price: finalPrice,
      action: alert.action
    });
    
    console.log(`✅ CRON: Notificación de conversión enviada a todos los suscriptores de ${alert.tipo}`);
    
  } catch (error) {
    console.error(`❌ CRON: Error enviando notificación de conversión:`, error);
    throw error;
  }
}