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

  // Detectar cron jobs externos por User-Agent
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
    
    if (alertsWithRange.length > 0) {
      console.log(`🔍 CRON: Alertas encontradas:`, alertsWithRange.map(alert => ({
        symbol: alert.symbol,
        tipo: alert.tipo,
        entryPriceRange: alert.entryPriceRange,
        precioMinimo: alert.precioMinimo,
        precioMaximo: alert.precioMaximo,
        sellRangeMin: alert.sellRangeMin,
        sellRangeMax: alert.sellRangeMax,
        status: alert.status,
        participationPercentage: alert.participationPercentage
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

    // ✅ Buscar admin por ROL en lugar de por email
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.warn('⚠️ CRON: No se encontró ningún usuario admin por rol');
    } else {
      console.log(`✅ CRON: Usuario admin encontrado: ${adminUser.email}`);
    }

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      try {
        console.log(`📊 Procesando ${alert.symbol}:`, {
          entryPriceRange: alert.entryPriceRange,
          entryPrice: alert.entryPrice,
          currentPrice: alert.currentPrice,
          sellRangeMin: alert.sellRangeMin,
          sellRangeMax: alert.sellRangeMax,
          participationPercentage: alert.participationPercentage
        });

        const closePrice = alert.currentPrice;
        
        if (!closePrice || closePrice <= 0) {
          console.warn(`⚠️ ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
          continue;
        }

        // Determinar qué rangos convertir
        const hasEntryRange = alert.entryPriceRange?.min && alert.entryPriceRange?.max;
        const hasSellRange = alert.sellRangeMin && alert.sellRangeMax;
        
        let oldEntryRange = 'N/A';
        let oldSellRange = 'N/A';
        
        if (hasEntryRange) {
          oldEntryRange = `$${alert.entryPriceRange.min}-$${alert.entryPriceRange.max}`;
        }
        
        if (hasSellRange) {
          oldSellRange = `$${alert.sellRangeMin}-$${alert.sellRangeMax}`;
        }

        // Preparar campos para actualizar
        const updateFields: any = {};
        const unsetFields: any = {};
        
        // Convertir rango de entrada si existe
        if (hasEntryRange) {
          const entryRangeMin = alert.entryPriceRange.min;
          const entryRangeMax = alert.entryPriceRange.max;
          
          // Verificar si el precio está dentro del rango de entrada
          if (closePrice < entryRangeMin || closePrice > entryRangeMax) {
            console.log(`❌ ${alert.symbol}: Precio $${closePrice} está FUERA del rango ${oldEntryRange} - DESCARTANDO`);
            
            await Alert.updateOne(
              { _id: alert._id },
              { 
                $set: { 
                  status: 'DESCARTADA', 
                  descartadaAt: new Date(),
                  descartadaMotivo: `Precio $${closePrice} fuera del rango de entrada ${oldEntryRange}`,
                  descartadaPrecio: closePrice
                }
              }
            );

            conversionDetails.push({
              symbol: alert.symbol,
              type: 'discarded',
              oldRange: oldEntryRange,
              newPrice: closePrice,
              reason: 'Precio fuera de rango'
            });
            
            continue;
          }
          
          console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango ${oldEntryRange} - Convirtiendo`);
          
          updateFields.entryPrice = closePrice;
          updateFields.tipoAlerta = 'precio';
          updateFields.finalPrice = closePrice;
          updateFields.finalPriceSetAt = new Date();
          unsetFields.entryPriceRange = 1;
          unsetFields.precioMinimo = 1;
          unsetFields.precioMaximo = 1;
        }
        
        // Procesar rango de venta si existe
        if (hasSellRange) {
          const sellRangeMin = alert.sellRangeMin;
          const sellRangeMax = alert.sellRangeMax;
          
          // Verificar si el precio está dentro del rango de venta
          if (closePrice >= sellRangeMin && closePrice <= sellRangeMax) {
            console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango de venta $${sellRangeMin}-$${sellRangeMax}`);
            
            // Buscar venta programada pendiente
            const liquidityData = alert.liquidityData || {};
            const partialSales = liquidityData.partialSales || [];
            
            console.log(`🔍 ${alert.symbol}: Buscando ventas programadas en partialSales (total: ${partialSales.length})`);
            if (partialSales.length > 0) {
              console.log(`🔍 ${alert.symbol}: partialSales:`, partialSales.map((s: any) => ({
                percentage: s.percentage,
                executed: s.executed,
                priceRange: s.priceRange
              })));
            }
            
            // Buscar cualquier venta pendiente (no ejecutada)
            const pendingSale = partialSales.find((sale: any) => !sale.executed);
            
            if (pendingSale) {
              console.log(`✅ ${alert.symbol}: Encontrada venta programada: ${pendingSale.percentage}%`);
              
              // Ejecutar la venta programada (ya guarda participationPercentage internamente)
              const saleResult = await executeScheduledSale(alert, pendingSale, closePrice, adminUser);
              
              if (saleResult.shouldClose) {
                updateFields.status = 'CLOSED';
                updateFields.exitPrice = closePrice;
                updateFields.exitDate = new Date();
                updateFields.exitReason = 'AUTOMATIC';
                updateFields.participationPercentage = 0;
                updateFields.profit = saleResult.profitPercentage;
              } else {
                // ✅ IMPORTANTE: No sobrescribir participationPercentage aquí porque ya se guardó en executeScheduledSale
                // Solo actualizar si es diferente para evitar conflictos
                if (alert.participationPercentage !== saleResult.newParticipationPercentage) {
                  updateFields.participationPercentage = saleResult.newParticipationPercentage;
                }
              }
              
              updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // Enviar notificación de VENTA
              await sendSaleNotification(alert, closePrice, pendingSale.percentage, saleResult.profitPercentage);
              
            } else {
              // ✅ CORREGIDO: Si NO hay venta programada, solo convertir el rango a precio fijo
              // NO cerrar la alerta automáticamente - mantener la posición
              console.log(`⚠️ ${alert.symbol}: No hay venta programada pendiente - Solo convirtiendo rango a precio fijo`);
              
              updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // Enviar notificación de conversión (no de cierre)
              await sendConversionNotification(alert, closePrice, oldSellRange);
            }
          } else {
            // El precio NO está en el rango de venta - mantener la venta programada
            console.log(`⏳ ${alert.symbol}: Precio $${closePrice} está FUERA del rango de venta $${sellRangeMin}-$${sellRangeMax} - Manteniendo venta programada`);
          }
        }

        // Actualizar la alerta
        if (Object.keys(updateFields).length > 0 || Object.keys(unsetFields).length > 0) {
          await Alert.updateOne(
            { _id: alert._id },
            { 
              $set: updateFields,
              ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {})
            }
          );
        }

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
        
        if (hasSellRange && closePrice >= alert.sellRangeMin && closePrice <= alert.sellRangeMax) {
          conversionDetails.push({
            symbol: alert.symbol,
            type: 'sell',
            oldRange: oldSellRange,
            newPrice: closePrice
          });
          console.log(`✅ CRON: ${alert.symbol}: Rango de venta ${oldSellRange} procesado a precio $${closePrice}`);
        }

      } catch (alertError) {
        console.error(`❌ CRON: Error procesando alerta ${alert.symbol}:`, alertError);
      }
    }

    console.log(`🎉 CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`);

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
    return res.status(200).json({ 
      success: true,
      message: 'OK',
      processed: 0
    });
  }
}

/**
 * Ejecuta una venta programada
 */
async function executeScheduledSale(
  alert: any, 
  sale: any, 
  closePrice: number, 
  adminUser: any
): Promise<{ shouldClose: boolean; profitPercentage: number; newParticipationPercentage: number }> {
  try {
    const percentage = sale.percentage || 0;
    const isCompleteSale = sale.isCompleteSale || percentage >= 100;
    const entryPrice = alert.entryPrice || closePrice;
    
    // Calcular profit
    const profitPercentage = entryPrice > 0 
      ? ((closePrice - entryPrice) / entryPrice) * 100 
      : 0;
    
    // ✅ CORREGIDO: Usar originalParticipationPercentage si existe, sino participationPercentage actual
    // Si no hay ninguno, asumir 100%
    const baseParticipation = alert.originalParticipationPercentage ?? alert.participationPercentage ?? 100;
    const currentParticipation = alert.participationPercentage ?? baseParticipation;
    
    // Calcular nueva participación: restar el porcentaje vendido
    const newParticipationPercentage = isCompleteSale ? 0 : Math.max(0, currentParticipation - percentage);
    
    console.log(`📊 ${alert.symbol}: Cálculo de participación - Base: ${baseParticipation}%, Actual: ${currentParticipation}%, Vendido: ${percentage}%, Nueva: ${newParticipationPercentage}%`);
    
    // Marcar la venta como ejecutada
    sale.executed = true;
    sale.executedAt = new Date();
    sale.sellPrice = closePrice;
    
    // Actualizar liquidityData
    const liquidityData = alert.liquidityData || {};
    const partialSales = liquidityData.partialSales || [];
    
    // Actualizar el partialSale correspondiente
    const saleIndex = partialSales.findIndex((s: any) => !s.executed || s === sale);
    if (saleIndex >= 0) {
      partialSales[saleIndex] = sale;
    }
    
    // Guardar los cambios en liquidityData
    await Alert.updateOne(
      { _id: alert._id },
      { 
        $set: { 
          'liquidityData.partialSales': partialSales,
          participationPercentage: newParticipationPercentage
        } 
      }
    );
    
    console.log(`✅ ${alert.symbol}: Venta ejecutada - ${percentage}% vendido a $${closePrice} - Participación restante: ${newParticipationPercentage}%`);
    
    // Actualizar sistema de liquidez si hay admin
    if (adminUser) {
      try {
        const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        const LiquidityModule = await import('@/models/Liquidity');
        const Liquidity = LiquidityModule.default;
        
        const liquidity = await Liquidity.findOne({ 
          createdBy: adminUser._id, 
          pool: pool 
        });
        
        if (liquidity) {
          const distribution = liquidity.distributions.find((d: any) => 
            d.alertId && d.alertId.toString() === alert._id.toString()
          );
          
          if (distribution && distribution.shares > 0) {
            const sharesToSell = isCompleteSale 
              ? distribution.shares 
              : distribution.shares * (percentage / 100);
            
            const { returnedCash, remainingShares } = liquidity.sellShares(
              alert._id.toString(), 
              sharesToSell, 
              closePrice
            );
            
            if (remainingShares <= 0) {
              liquidity.removeDistribution(alert._id.toString());
            }
            
            await liquidity.save();
            console.log(`✅ ${alert.symbol}: Liquidez actualizada - +$${returnedCash.toFixed(2)} liberados`);
            
            // Registrar operación
            await registerSaleOperation(alert, sharesToSell, closePrice, pool, adminUser, percentage, isCompleteSale);
          }
        }
      } catch (liquidityError) {
        console.error(`⚠️ Error actualizando liquidez para ${alert.symbol}:`, liquidityError);
      }
    }
    
    const shouldClose = isCompleteSale || newParticipationPercentage <= 0;
    
    return {
      shouldClose,
      profitPercentage,
      newParticipationPercentage
    };
    
  } catch (error) {
    console.error(`❌ Error ejecutando venta programada para ${alert.symbol}:`, error);
    return { shouldClose: false, profitPercentage: 0, newParticipationPercentage: 100 };
  }
}

/**
 * Registra una operación de venta
 */
async function registerSaleOperation(
  alert: any,
  sharesToSell: number,
  closePrice: number,
  pool: string,
  adminUser: any,
  percentage: number,
  isCompleteSale: boolean
) {
  try {
    const OperationModule = await import('@/models/Operation');
    const Operation = OperationModule.default;
    
    const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
      .sort({ date: -1 })
      .select('balance');
    const currentBalance = currentBalanceDoc?.balance || 0;
    const liquidityReleased = sharesToSell * closePrice;
    const newBalance = currentBalance + liquidityReleased;
    
    const buyOperation = await Operation.findOne({ 
      alertId: alert._id, 
      operationType: 'COMPRA',
      system: pool
    }).sort({ date: -1 });
    
    const entryPrice = alert.entryPrice || closePrice;
    const realizedProfit = (closePrice - entryPrice) * sharesToSell;
    
    const operation = new Operation({
      ticker: alert.symbol.toUpperCase(),
      operationType: 'VENTA',
      quantity: -sharesToSell,
      price: closePrice,
      amount: liquidityReleased,
      date: new Date(),
      balance: newBalance,
      alertId: alert._id,
      alertSymbol: alert.symbol.toUpperCase(),
      system: pool,
      createdBy: adminUser._id,
      isPartialSale: !isCompleteSale,
      partialSalePercentage: percentage,
      portfolioPercentage: buyOperation?.portfolioPercentage,
      liquidityData: {
        entryPrice: entryPrice,
        realizedProfit: realizedProfit
      },
      executedBy: 'SYSTEM',
      executionMethod: 'AUTOMATIC',
      notes: `Venta ${isCompleteSale ? 'completa' : 'parcial'} (${percentage}%) ejecutada automáticamente - ${alert.symbol}`
    });
    
    await operation.save();
    console.log(`✅ ${alert.symbol}: Operación de venta registrada`);
  } catch (error) {
    console.error(`⚠️ Error registrando operación de venta para ${alert.symbol}:`, error);
  }
}

/**
 * Envía notificación de VENTA ejecutada
 */
async function sendSaleNotification(
  alert: any, 
  closePrice: number, 
  percentage: number, 
  profitPercentage: number
) {
  try {
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    const profitSign = profitPercentage >= 0 ? '+' : '';
    const message = percentage >= 100
      ? `✅ VENTA EJECUTADA: Se cerró completamente la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. Profit: ${profitSign}${profitPercentage.toFixed(2)}%`
      : `✅ VENTA PARCIAL EJECUTADA: Se vendió el ${percentage}% de la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. Profit: ${profitSign}${profitPercentage.toFixed(2)}%`;
    
    await createAlertNotification(alert, {
      message: message,
      price: closePrice,
      action: 'SELL', // ✅ Siempre SELL para ventas
      skipDuplicateCheck: true,
      title: `✅ Venta Ejecutada: ${alert.symbol}`,
      soldPercentage: percentage
    });
    
    console.log(`✅ ${alert.symbol}: Notificación de venta enviada`);
  } catch (error) {
    console.error(`⚠️ Error enviando notificación de venta para ${alert.symbol}:`, error);
  }
}

/**
 * Envía notificación de conversión de rango (sin cierre de posición)
 */
async function sendConversionNotification(
  alert: any, 
  closePrice: number, 
  oldRange: string
) {
  try {
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    const message = `🎯 Rango de venta convertido: ${alert.symbol} - El rango ${oldRange} se convirtió a precio fijo $${closePrice.toFixed(2)}. La posición sigue activa.`;
    
    await createAlertNotification(alert, {
      message: message,
      price: closePrice,
      action: 'SELL', // ✅ SELL porque es relacionado a venta
      skipDuplicateCheck: true,
      title: `🎯 Rango Convertido: ${alert.symbol}`
    });
    
    console.log(`✅ ${alert.symbol}: Notificación de conversión enviada`);
  } catch (error) {
    console.error(`⚠️ Error enviando notificación de conversión para ${alert.symbol}:`, error);
  }
}
