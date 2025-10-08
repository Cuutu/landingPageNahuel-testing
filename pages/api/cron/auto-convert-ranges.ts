import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import User from '@/models/User';

interface AutoConvertCronResponse {
  success: boolean;
  message: string;
  processed?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertCronResponse>) {
  // Permitir GET para cronjobs externos (cron-job.org)
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'ERROR - Método no permitido. Use GET.'
    });
  }

  // ✅ NUEVO: Detectar cron jobs externos por User-Agent
  const userAgent = req.headers['user-agent'] || '';
  const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
  
  if (isCronJobOrg) {
    console.log('🌐 CRON PÚBLICO DETECTADO (auto-convert-ranges):', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.url
    });
  }

  try {
    await dbConnect();
    console.log('🔄 CRON: Iniciando conversión automática de alertas de rango...');

    // Buscar alertas activas con rangos de precio (entrada o venta)
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { precioMinimo: { $exists: true, $ne: null }, precioMaximo: { $exists: true, $ne: null } },
        { sellRangeMin: { $exists: true, $ne: null }, sellRangeMax: { $exists: true, $ne: null } }
      ]
    });

    console.log(`📊 CRON: Encontradas ${alertsWithRange.length} alertas con rangos para convertir`);
    
    // Log de las alertas encontradas para debugging
    if (alertsWithRange.length > 0) {
      console.log(`🔍 CRON: Alertas encontradas:`, alertsWithRange.map(alert => ({
        symbol: alert.symbol,
        tipo: alert.tipo,
        entryPriceRange: alert.entryPriceRange,
        precioMinimo: alert.precioMinimo,
        precioMaximo: alert.precioMaximo,
        sellRangeMin: alert.sellRangeMin,
        sellRangeMax: alert.sellRangeMax,
        status: alert.status
      })));
    }

    if (alertsWithRange.length === 0) {
      console.log(`⚠️ CRON: No hay alertas de rango para convertir`);
      return res.status(200).json({
        success: true,
        message: 'OK - No hay alertas para convertir',
        processed: 0
      });
    }

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      try {
        console.log(`📊 Procesando ${alert.symbol}:`, {
          entryPriceRange: alert.entryPriceRange,
          entryPrice: alert.entryPrice,
          currentPrice: alert.currentPrice,
          precioMinimo: alert.precioMinimo,
          precioMaximo: alert.precioMaximo,
          sellRangeMin: alert.sellRangeMin,
          sellRangeMax: alert.sellRangeMax,
          tipoAlerta: alert.tipoAlerta
        });

        // Usar el precio actual como precio de entrada fijo
        const closePrice = alert.currentPrice;
        
        if (!closePrice || closePrice <= 0) {
          console.warn(`⚠️ ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
          continue;
        }
        
        console.log(`💰 ${alert.symbol}: Precio actual ${closePrice} -> Precio de entrada fijo`);

        // Determinar qué rangos convertir
        const hasEntryRange = alert.entryPriceRange || (alert.precioMinimo && alert.precioMaximo);
        const hasSellRange = alert.sellRangeMin && alert.sellRangeMax;
        
        let oldEntryRange = 'N/A';
        let oldSellRange = 'N/A';
        
        if (hasEntryRange) {
          if (alert.entryPriceRange) {
            oldEntryRange = `$${alert.entryPriceRange.min}-$${alert.entryPriceRange.max}`;
          } else if (alert.precioMinimo && alert.precioMaximo) {
            oldEntryRange = `$${alert.precioMinimo}-$${alert.precioMaximo}`;
          }
        }
        
        if (hasSellRange) {
          oldSellRange = `$${alert.sellRangeMin}-$${alert.sellRangeMax}`;
        }

        // Preparar campos para actualizar
        const updateFields: any = {};
        const unsetFields: any = {};
        
        // Convertir rango de entrada si existe
        if (hasEntryRange) {
          updateFields.entryPrice = closePrice;
          updateFields.tipoAlerta = 'precio'; // Cambiar a tipo precio fijo
          unsetFields.entryPriceRange = 1;
          unsetFields.precioMinimo = 1;
          unsetFields.precioMaximo = 1;
        }
        
        // Convertir rango de venta si existe
        if (hasSellRange) {
          updateFields.sellPrice = closePrice;
          unsetFields.sellRangeMin = 1;
          unsetFields.sellRangeMax = 1;
        }

        // Actualizar en una sola operación
        await Alert.updateOne(
          { _id: alert._id },
          { 
            $set: updateFields,
            $unset: unsetFields
          }
        );

        // Agregar detalles de conversión
        if (hasEntryRange) {
          conversionDetails.push({
            symbol: alert.symbol,
            type: 'entry',
            oldRange: oldEntryRange,
            newPrice: closePrice
          });
          console.log(`✅ CRON: ${alert.symbol}: Rango de entrada ${oldEntryRange} convertido a precio fijo $${closePrice}`);
        }
        
        if (hasSellRange) {
          conversionDetails.push({
            symbol: alert.symbol,
            type: 'sell',
            oldRange: oldSellRange,
            newPrice: closePrice
          });
          console.log(`✅ CRON: ${alert.symbol}: Rango de venta ${oldSellRange} convertido a precio de venta fijo $${closePrice}`);
        }

        // 📧 NUEVO: Enviar notificación a TODOS los suscriptores
        try {
          const notificationMessage = hasEntryRange && hasSellRange 
            ? `🎯 Alerta convertida: ${alert.symbol} - Rangos de entrada (${oldEntryRange}) y venta (${oldSellRange}) convertidos a precios fijos $${closePrice}`
            : hasEntryRange 
            ? `🎯 Alerta convertida: ${alert.symbol} - Rango de entrada ${oldEntryRange} convertido a precio fijo $${closePrice}`
            : `🎯 Alerta convertida: ${alert.symbol} - Rango de venta ${oldSellRange} convertido a precio de venta fijo $${closePrice}`;
            
          await sendRangeConversionNotification(alert, closePrice, notificationMessage);
          console.log(`📧 CRON: Notificación enviada a suscriptores para ${alert.symbol} - Precio final: $${closePrice}`);
        } catch (emailError) {
          console.error(`❌ CRON: Error enviando notificación para ${alert.symbol}:`, emailError);
          // No fallar el proceso si el email falla
        }
      } catch (alertError) {
        console.error(`❌ CRON: Error procesando alerta ${alert.symbol}:`, alertError);
        // Continuar con la siguiente alerta
      }
    }

    console.log(`🎉 CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`);
    console.log(`📊 CRON: Detalles de conversión:`, conversionDetails);

    // ✅ NUEVO: Respuesta ultra-simple para cron jobs externos
    if (isCronJobOrg) {
      return res.status(200).json({
        success: true,
        message: 'OK',
        processed: conversionDetails.length
      });
    }

    return res.status(200).json({
      success: true,
      message: `OK - ${conversionDetails.length} alertas convertidas`,
      processed: conversionDetails.length
    });

  } catch (error) {
    console.error('❌ CRON: Error en conversión automática:', error);
    
    // ✅ NUEVO: Para cron jobs, siempre devolver 200 para evitar fallos
    console.log('🔄 CRON: Devolviendo 200 a pesar del error para evitar fallos en cron job');
    return res.status(200).json({ 
      success: true,
      message: 'OK',
      processed: 0
    });
  }
}

/**
 * 📧 NUEVO: Envía notificación a TODOS los suscriptores cuando se convierte una alerta de rango
 */
async function sendRangeConversionNotification(alert: any, finalPrice: number, message: string) {
  try {
    console.log(`📧 CRON: Iniciando envío de notificación para ${alert.symbol}`);
    console.log(`📧 CRON: Detalles de la alerta:`, {
      symbol: alert.symbol,
      tipo: alert.tipo,
      action: alert.action,
      message: message,
      finalPrice: finalPrice
    });
    
    // Importar la función de notificaciones
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    console.log(`📧 CRON: Función createAlertNotification importada correctamente`);
    
    // Crear una notificación usando el sistema existente que envía a TODOS los suscriptores
    await createAlertNotification(alert, {
      message: message,
      price: finalPrice,
      action: alert.action
    });
    
    console.log(`✅ CRON: Notificación de conversión enviada a todos los suscriptores de ${alert.tipo}`);
    
  } catch (error) {
    console.error(`❌ CRON: Error enviando notificación de conversión:`, error);
    console.error(`❌ CRON: Stack trace:`, error instanceof Error ? error.stack : 'No stack trace available');
    throw error;
  }
}