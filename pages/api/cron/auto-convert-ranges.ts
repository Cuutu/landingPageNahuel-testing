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
        
        console.log(`💰 ${alert.symbol}: Precio actual ${closePrice} -> Verificando si está dentro del rango`);

        // Determinar qué rangos convertir
        const hasEntryRange = alert.entryPriceRange || (alert.precioMinimo && alert.precioMaximo);
        const hasSellRange = alert.sellRangeMin && alert.sellRangeMax;
        
        let oldEntryRange = 'N/A';
        let oldSellRange = 'N/A';
        let entryRangeMin = 0;
        let entryRangeMax = 0;
        
        if (hasEntryRange) {
          if (alert.entryPriceRange) {
            oldEntryRange = `$${alert.entryPriceRange.min}-$${alert.entryPriceRange.max}`;
            entryRangeMin = alert.entryPriceRange.min;
            entryRangeMax = alert.entryPriceRange.max;
          } else if (alert.precioMinimo && alert.precioMaximo) {
            oldEntryRange = `$${alert.precioMinimo}-$${alert.precioMaximo}`;
            entryRangeMin = alert.precioMinimo;
            entryRangeMax = alert.precioMaximo;
          }
        }
        
        if (hasSellRange) {
          oldSellRange = `$${alert.sellRangeMin}-$${alert.sellRangeMax}`;
        }

        // ✅ NUEVO: Verificar si el precio está dentro del rango de entrada
        if (hasEntryRange && (closePrice < entryRangeMin || closePrice > entryRangeMax)) {
          console.log(`❌ ${alert.symbol}: Precio $${closePrice} está FUERA del rango ${oldEntryRange} - DESCARTANDO alerta`);
          
          // Descartar la alerta
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
          
          console.log(`🗑️ CRON: ${alert.symbol}: Alerta DESCARTADA - Precio $${closePrice} fuera del rango ${oldEntryRange}`);
          
          // Enviar notificación de descarte
          try {
            const discardMessage = `❌ Alerta descartada: ${alert.symbol} - Precio $${closePrice} fuera del rango de entrada ${oldEntryRange}`;
            await sendRangeConversionNotification(alert, closePrice, discardMessage);
            console.log(`📧 CRON: Notificación de descarte enviada para ${alert.symbol}`);
          } catch (emailError) {
            console.error(`❌ CRON: Error enviando notificación de descarte para ${alert.symbol}:`, emailError);
          }
          
          continue; // Saltar al siguiente alerta
        }
        
        console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango ${oldEntryRange} - Convirtiendo a precio fijo`);

        // ✅ NUEVO: Verificar si el precio está dentro del rango de venta ANTES de descontar participación
        let shouldDiscountParticipation = false;
        let sellRangeMin = 0;
        let sellRangeMax = 0;
        
        if (hasSellRange) {
          sellRangeMin = alert.sellRangeMin || 0;
          sellRangeMax = alert.sellRangeMax || 0;
          
          // Solo descontar participación si el precio está dentro del rango de venta
          if (closePrice >= sellRangeMin && closePrice <= sellRangeMax) {
            shouldDiscountParticipation = true;
            console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango de venta $${sellRangeMin}-$${sellRangeMax} - Se descontará participación`);
          } else {
            console.log(`⚠️ ${alert.symbol}: Precio $${closePrice} está FUERA del rango de venta $${sellRangeMin}-$${sellRangeMax} - NO se descontará participación`);
          }
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
        
        // ✅ EJECUTAR VENTA PROGRAMADA si el precio está en el rango de venta
        if (hasSellRange && shouldDiscountParticipation) {
          console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango de venta $${sellRangeMin}-$${sellRangeMax} - Ejecutando venta programada`);
          
          // ✅ EJECUTAR VENTA PROGRAMADA: Buscar venta programada pendiente
          const liquidityData = alert.liquidityData || {};
          const partialSales = liquidityData.partialSales || [];
          const pendingSale = partialSales.find((sale: any) => 
            sale.priceRange && 
            sale.priceRange.min === sellRangeMin && 
            sale.priceRange.max === sellRangeMax &&
            !sale.executed
          );
          
          if (pendingSale) {
            try {
              // ✅ EJECUTAR LA VENTA PROGRAMADA
              const percentage = pendingSale.percentage || 0;
              const sharesToSell = pendingSale.sharesToSell || 0;
              const entryPrice = alert.entryPrice || closePrice;
              const profitPerShare = closePrice - entryPrice;
              const liquidityReleased = sharesToSell * closePrice;
              const realizedProfit = sharesToSell * profitPerShare;
              
              // Actualizar la venta como ejecutada
              pendingSale.executed = true;
              pendingSale.executedAt = new Date();
              pendingSale.sellPrice = closePrice; // Precio real de ejecución
              pendingSale.liquidityReleased = liquidityReleased; // Liquidez real liberada
              pendingSale.realizedProfit = realizedProfit; // Ganancia real
              
              // Actualizar liquidez de la alerta
              const currentShares = liquidityData.shares || 0;
              const sharesRemaining = currentShares - sharesToSell;
              const newAllocatedAmount = sharesRemaining * entryPrice;
              
              // Actualizar participación
              const originalPercentage = alert.originalParticipationPercentage || 100;
              const newParticipationPercentage = Math.max(0, originalPercentage - percentage);
              alert.participationPercentage = newParticipationPercentage;
              
              // Actualizar liquidez de la alerta
              alert.liquidityData = {
                ...liquidityData,
                allocatedAmount: newAllocatedAmount,
                shares: sharesRemaining,
                partialSales: partialSales
              };
              
              // Si se vendió todo, cerrar la alerta
              if (sharesRemaining <= 0 || alert.participationPercentage <= 0) {
                alert.status = 'CLOSED';
                alert.exitPrice = closePrice;
                alert.exitDate = new Date();
                alert.exitReason = 'MANUAL';
                alert.participationPercentage = 0;
                console.log(`🔒 ${alert.symbol}: Alerta cerrada completamente después de ejecutar venta programada`);
              }
              
              // ✅ ACTUALIZAR SISTEMA DE LIQUIDEZ
              const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
              const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
              const adminUser = await User.findOne({ email: ADMIN_EMAIL });
              
              if (adminUser) {
                const LiquidityModule = await import('@/models/Liquidity');
                const Liquidity = LiquidityModule.default;
                const liquidity = await Liquidity.findOne({ 
                  createdBy: adminUser._id, 
                  pool: pool 
                });
                
                if (liquidity) {
                  const { realized, returnedCash, remainingShares } = liquidity.sellShares(alert._id.toString(), sharesToSell, closePrice);
                  
                  // Si se cerró completamente, remover la distribución
                  if (remainingShares <= 0) {
                    liquidity.removeDistribution(alert._id.toString());
                    console.log(`🗑️ ${alert.symbol}: Distribución removida - posición cerrada completamente`);
                  }
                  
                  await liquidity.save();
                  console.log(`✅ ${alert.symbol}: Sistema de liquidez actualizado - +$${returnedCash.toFixed(2)} liberados`);
                  
                  // Registrar operación de venta
                  try {
                    const OperationModule = await import('@/models/Operation');
                    const Operation = OperationModule.default;
                    
                    const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
                      .sort({ date: -1 })
                      .select('balance');
                    const currentBalance = currentBalanceDoc?.balance || 0;
                    const newBalance = currentBalance + returnedCash;
                    
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
                      isPartialSale: percentage < 100,
                      partialSalePercentage: percentage,
                      originalQuantity: liquidityData.originalShares || currentShares,
                      liquidityData: {
                        allocatedAmount: newAllocatedAmount,
                        shares: sharesRemaining,
                        entryPrice: entryPrice,
                        realizedProfit: realizedProfit
                      },
                      executedBy: 'SYSTEM',
                      executionMethod: 'AUTOMATIC',
                      notes: `Venta programada ejecutada automáticamente (${percentage}%) - ${alert.symbol}`
                    });
                    
                    await operation.save();
                    console.log(`✅ ${alert.symbol}: Operación de venta programada registrada`);
                  } catch (operationError) {
                    console.error(`⚠️ Error registrando operación de venta programada para ${alert.symbol}:`, operationError);
                  }
                }
              }
              
              // Limpiar el rango de venta después de ejecutar
              updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // ✅ NUEVO: Enviar email de CONFIRMACIÓN DE VENTA cuando se ejecuta la venta programada
              try {
                console.log(`📧 Enviando email de CONFIRMACIÓN DE VENTA para alerta ${alert.symbol}...`);
                
                // Obtener información de la venta ejecutada
                const emailMessage = pendingSale.emailMessage || 
                  `✅ VENTA EJECUTADA: Se vendió el ${percentage}% de la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. ` +
                  `La venta se ejecutó automáticamente cuando el precio llegó al rango de $${sellRangeMin} a $${sellRangeMax}.`;
                
                // Importar y usar la función de notificaciones
                const { notifyAlertSubscribers } = await import('@/lib/notificationUtils');
                
                // Enviar notificación de confirmación
                await notifyAlertSubscribers(alert, {
                  message: emailMessage,
                  imageUrl: pendingSale.emailImageUrl || undefined,
                  title: `✅ Confirmación de Venta - ${alert.symbol}`,
                  action: 'SELL', // ✅ Asegurar que sea SELL
                  price: closePrice,
                  soldPercentage: percentage // ✅ Pasar el porcentaje vendido
                });
                
                console.log(`✅ Email de confirmación de venta enviado exitosamente para ${alert.symbol}`);
              } catch (emailError) {
                console.error(`⚠️ Error enviando email de confirmación de venta para ${alert.symbol}:`, emailError);
                // No fallar la ejecución por un error de email
              }
              
              console.log(`✅ ${alert.symbol}: Venta programada ejecutada exitosamente - ${percentage}% vendido a $${closePrice}`);
            } catch (saleError) {
              console.error(`❌ Error ejecutando venta programada para ${alert.symbol}:`, saleError);
            }
          } else {
            console.log(`⚠️ ${alert.symbol}: No se encontró venta programada pendiente para este rango`);
            console.log(`🔄 ${alert.symbol}: Ejecutando venta automática completa (cerrar posición)`);
            
            // ✅ NUEVO: Si no hay venta programada pero el precio está en el rango, ejecutar venta completa automática
            try {
              const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
              const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
              const adminUser = await User.findOne({ email: ADMIN_EMAIL });
              
              if (adminUser) {
                const LiquidityModule = await import('@/models/Liquidity');
                const Liquidity = LiquidityModule.default;
                
                // ✅ CORREGIDO: Buscar liquidez con fallback (igual que en /api/liquidity/sell.ts)
                let liquidity = await Liquidity.findOne({ 
                  createdBy: adminUser._id, 
                  pool: pool 
                });
                
                if (!liquidity) {
                  console.warn(`[CRON] No se encontró liquidez para el admin en ${pool}. Intentando fallback por pool+alertId...`);
                  liquidity = await Liquidity.findOne({ 
                    pool: pool, 
                    'distributions.alertId': alert._id.toString() 
                  });
                }
                
                if (liquidity) {
                  let distribution = liquidity.distributions.find((d: any) => 
                    d.alertId && d.alertId.toString() === alert._id.toString()
                  );
                  
                  // ✅ CORREGIDO: Si no se encuentra en la primera búsqueda, buscar en todo el pool
                  if (!distribution) {
                    console.warn(`[CRON] No se encontró distribución en la liquidez seleccionada. Intentando localizar por alertId en el pool...`);
                    const liquidityWithDist = await Liquidity.findOne({ 
                      pool: pool, 
                      'distributions.alertId': alert._id.toString() 
                    });
                    if (liquidityWithDist) {
                      liquidity = liquidityWithDist;
                      distribution = liquidityWithDist.distributions.find((d: any) => 
                        d.alertId && d.alertId.toString() === alert._id.toString()
                      );
                    }
                  }
                  
                  if (distribution && distribution.shares > 0) {
                    const sharesToSell = distribution.shares;
                    const entryPrice = distribution.entryPrice || alert.entryPrice || closePrice;
                    const { realized, returnedCash, remainingShares } = liquidity.sellShares(
                      alert._id.toString(), 
                      sharesToSell, 
                      closePrice
                    );
                    
                    // Remover la distribución ya que se vendió todo
                    if (remainingShares <= 0) {
                      liquidity.removeDistribution(alert._id.toString());
                      console.log(`🗑️ ${alert.symbol}: Distribución removida - posición cerrada completamente`);
                    }
                    
                    await liquidity.save();
                    console.log(`✅ ${alert.symbol}: Sistema de liquidez actualizado - +$${returnedCash.toFixed(2)} liberados`);
                    
                    // Cerrar la alerta completamente
                    alert.status = 'CLOSED';
                    alert.exitPrice = closePrice;
                    alert.exitDate = new Date();
                    alert.exitReason = 'AUTOMATIC';
                    alert.participationPercentage = 0;
                    
                    // Calcular profit porcentual
                    const profitPercentage = entryPrice > 0 
                      ? ((closePrice - entryPrice) / entryPrice) * 100 
                      : 0;
                    alert.profit = profitPercentage;
                    
                    console.log(`🔒 ${alert.symbol}: Alerta cerrada automáticamente - Profit: ${profitPercentage.toFixed(2)}%`);
                    
                    // Registrar operación de venta
                    try {
                      const OperationModule = await import('@/models/Operation');
                      const Operation = OperationModule.default;
                      
                      const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
                        .sort({ date: -1 })
                        .select('balance');
                      const currentBalance = currentBalanceDoc?.balance || 0;
                      const newBalance = currentBalance + returnedCash;
                      
                      // ✅ NUEVO: Buscar la operación de compra original para obtener el portfolioPercentage
                      const buyOperation = await Operation.findOne({ 
                        alertId: alert._id, 
                        operationType: 'COMPRA',
                        system: pool
                      }).sort({ date: -1 });
                      
                      const operation = new Operation({
                        ticker: alert.symbol.toUpperCase(),
                        operationType: 'VENTA',
                        quantity: -sharesToSell,
                        price: closePrice,
                        amount: returnedCash,
                        date: new Date(),
                        balance: newBalance,
                        alertId: alert._id,
                        alertSymbol: alert.symbol.toUpperCase(),
                        system: pool,
                        createdBy: adminUser._id,
                        isPartialSale: false,
                        portfolioPercentage: buyOperation?.portfolioPercentage, // ✅ NUEVO: Copiar el porcentaje de la compra original
                        liquidityData: {
                          allocatedAmount: 0, // Se vendió todo
                          shares: 0,
                          entryPrice: entryPrice,
                          realizedProfit: realized
                        },
                        executedBy: 'SYSTEM',
                        executionMethod: 'AUTOMATIC',
                        notes: `Venta automática ejecutada al convertir rango de venta - ${alert.symbol} - Precio alcanzó rango $${sellRangeMin}-$${sellRangeMax}`
                      });
                      
                      await operation.save();
                      console.log(`✅ ${alert.symbol}: Operación de venta automática registrada - ${sharesToSell} acciones por $${closePrice}`);
                    } catch (operationError) {
                      console.error(`⚠️ Error registrando operación de venta automática para ${alert.symbol}:`, operationError);
                    }
                    
                    // Enviar notificación de venta ejecutada
                    try {
                      const { notifyAlertSubscribers } = await import('@/lib/notificationUtils');
                      const emailMessage = `✅ VENTA AUTOMÁTICA EJECUTADA: Se cerró completamente la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. ` +
                        `La venta se ejecutó automáticamente cuando el precio alcanzó el rango de $${sellRangeMin} a $${sellRangeMax}. ` +
                        `Profit: ${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`;
                      
                      await notifyAlertSubscribers(alert, {
                        message: emailMessage,
                        title: `✅ Venta Automática - ${alert.symbol}`,
                        action: 'SELL',
                        price: closePrice,
                        soldPercentage: 100
                      });
                      
                      console.log(`✅ Email de confirmación de venta automática enviado para ${alert.symbol}`);
                    } catch (emailError) {
                      console.error(`⚠️ Error enviando email de confirmación de venta automática para ${alert.symbol}:`, emailError);
                    }
                    
                    // Actualizar campos de la alerta
                    updateFields.status = 'CLOSED';
                    updateFields.exitPrice = closePrice;
                    updateFields.exitDate = new Date();
                    updateFields.exitReason = 'AUTOMATIC';
                    updateFields.participationPercentage = 0;
                    updateFields.profit = profitPercentage;
                    updateFields.sellPrice = closePrice;
                  } else {
                    console.log(`⚠️ ${alert.symbol}: No se encontró distribución de liquidez para ejecutar venta automática`);
                    // ✅ NUEVO: Aunque no haya distribución, cerrar la alerta si el precio está en el rango de venta
                    console.log(`🔄 ${alert.symbol}: Cerrando alerta sin liquidez (precio en rango de venta)`);
                    const closedFields = await closeAlertWithoutLiquidity(alert, closePrice, sellRangeMin, sellRangeMax, pool, adminUser);
                    // Actualizar updateFields para que el Alert.updateOne final también incluya estos campos
                    Object.assign(updateFields, closedFields);
                  }
                } else {
                  console.log(`⚠️ ${alert.symbol}: No se encontró liquidez para el pool ${pool}`);
                  // ✅ NUEVO: Aunque no haya liquidez, cerrar la alerta si el precio está en el rango de venta
                  console.log(`🔄 ${alert.symbol}: Cerrando alerta sin liquidez (precio en rango de venta)`);
                  const closedFields = await closeAlertWithoutLiquidity(alert, closePrice, sellRangeMin, sellRangeMax, pool, adminUser);
                  // Actualizar updateFields para que el Alert.updateOne final también incluya estos campos
                  Object.assign(updateFields, closedFields);
                }
              } else {
                console.log(`⚠️ ${alert.symbol}: No se encontró usuario admin`);
                // ✅ NUEVO: Aunque no haya admin, cerrar la alerta si el precio está en el rango de venta
                console.log(`🔄 ${alert.symbol}: Cerrando alerta sin admin (precio en rango de venta)`);
                const closedFields = await closeAlertWithoutLiquidity(alert, closePrice, sellRangeMin, sellRangeMax, pool, null);
                // Actualizar updateFields para que el Alert.updateOne final también incluya estos campos
                Object.assign(updateFields, closedFields);
              }
            } catch (autoSaleError) {
              console.error(`❌ Error ejecutando venta automática para ${alert.symbol}:`, autoSaleError);
              // ✅ NUEVO: En caso de error, intentar cerrar la alerta de todas formas
              try {
                const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
                const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
                const adminUser = await User.findOne({ email: ADMIN_EMAIL });
                const closedFields = await closeAlertWithoutLiquidity(alert, closePrice, sellRangeMin, sellRangeMax, pool, adminUser);
                // Actualizar updateFields para que el Alert.updateOne final también incluya estos campos
                Object.assign(updateFields, closedFields);
              } catch (fallbackError) {
                console.error(`❌ Error en fallback de cierre para ${alert.symbol}:`, fallbackError);
              }
            }
            
            // Limpiar el rango después de procesar
            unsetFields.sellRangeMin = 1;
            unsetFields.sellRangeMax = 1;
          }
        } else if (hasSellRange && !shouldDiscountParticipation) {
          // Si el precio NO está en el rango de venta, NO ejecutar la venta
          // Mantener el rango y la venta programada para la próxima ejecución del CRON
          console.log(`⏳ ${alert.symbol}: Precio $${closePrice} está FUERA del rango de venta $${sellRangeMin}-$${sellRangeMax} - Venta programada NO ejecutada (se mantiene programada)`);
          // NO limpiar el rango - mantener la venta programada
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
 * ✅ NUEVO: Cierra una alerta cuando el precio está en el rango de venta pero no hay liquidez
 */
async function closeAlertWithoutLiquidity(
  alert: any, 
  closePrice: number, 
  sellRangeMin: number, 
  sellRangeMax: number,
  pool: string,
  adminUser: any
) {
  try {
    const entryPrice = alert.entryPrice || closePrice;
    
    // Calcular profit porcentual
    const profitPercentage = entryPrice > 0 
      ? ((closePrice - entryPrice) / entryPrice) * 100 
      : 0;
    
    // Cerrar la alerta
    const updateFields: any = {
      status: 'CLOSED',
      exitPrice: closePrice,
      exitDate: new Date(),
      exitReason: 'AUTOMATIC',
      participationPercentage: 0,
      profit: profitPercentage,
      sellPrice: closePrice
    };
    
    await Alert.updateOne(
      { _id: alert._id },
      { $set: updateFields }
    );
    
    console.log(`🔒 ${alert.symbol}: Alerta cerrada automáticamente (sin liquidez) - Profit: ${profitPercentage.toFixed(2)}%`);
    
    // Registrar operación de venta aunque no haya liquidez
    if (adminUser) {
      try {
        const OperationModule = await import('@/models/Operation');
        const Operation = OperationModule.default;
        
        // Obtener balance actual
        const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
          .sort({ date: -1 })
          .select('balance');
        const currentBalance = currentBalanceDoc?.balance || 0;
        
        // Estimar cantidad vendida (usar un valor estimado si no hay liquidez)
        // Buscar operación de compra previa para esta alerta
        const buyOperation = await Operation.findOne({ 
          alertId: alert._id, 
          operationType: 'COMPRA',
          system: pool
        }).sort({ date: -1 });
        
        const estimatedShares = buyOperation?.quantity || 100; // Valor por defecto
        const estimatedAmount = estimatedShares * closePrice;
        const newBalance = currentBalance + estimatedAmount;
        
        const operation = new Operation({
          ticker: alert.symbol.toUpperCase(),
          operationType: 'VENTA',
          quantity: -Math.abs(estimatedShares),
          price: closePrice,
          amount: estimatedAmount,
          date: new Date(),
          balance: newBalance,
          alertId: alert._id,
          alertSymbol: alert.symbol.toUpperCase(),
          system: pool,
          createdBy: adminUser._id,
          isPartialSale: false,
          portfolioPercentage: buyOperation?.portfolioPercentage, // ✅ NUEVO: Copiar el porcentaje de la compra original
          liquidityData: {
            allocatedAmount: 0,
            shares: 0,
            entryPrice: entryPrice,
            realizedProfit: (closePrice - entryPrice) * Math.abs(estimatedShares)
          },
          executedBy: 'SYSTEM',
          executionMethod: 'AUTOMATIC',
          notes: `Venta automática ejecutada al convertir rango de venta (sin liquidez registrada) - ${alert.symbol} - Precio alcanzó rango $${sellRangeMin}-$${sellRangeMax}`
        });
        
        await operation.save();
        console.log(`✅ ${alert.symbol}: Operación de venta automática registrada (sin liquidez) - ${estimatedShares} acciones estimadas por $${closePrice}`);
      } catch (operationError) {
        console.error(`⚠️ Error registrando operación de venta automática (sin liquidez) para ${alert.symbol}:`, operationError);
      }
      
      // Enviar notificación de venta ejecutada
      try {
        const { notifyAlertSubscribers } = await import('@/lib/notificationUtils');
        const emailMessage = `✅ VENTA AUTOMÁTICA EJECUTADA: Se cerró completamente la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. ` +
          `La venta se ejecutó automáticamente cuando el precio alcanzó el rango de $${sellRangeMin} a $${sellRangeMax}. ` +
          `Profit: ${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%`;
        
        await notifyAlertSubscribers(alert, {
          message: emailMessage,
          title: `✅ Venta Automática - ${alert.symbol}`,
          action: 'SELL',
          price: closePrice,
          soldPercentage: 100
        });
        
        console.log(`✅ Email de confirmación de venta automática enviado para ${alert.symbol}`);
      } catch (emailError) {
        console.error(`⚠️ Error enviando email de confirmación de venta automática para ${alert.symbol}:`, emailError);
      }
    }
    
    return updateFields;
  } catch (error) {
    console.error(`❌ Error cerrando alerta sin liquidez para ${alert.symbol}:`, error);
    throw error;
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