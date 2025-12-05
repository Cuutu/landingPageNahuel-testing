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

        // ✅ CRÍTICO: Usar el precio de cierre de la alerta (precio del momento de ejecución del cronjob)
        // Este precio se usará para registrar las operaciones de venta
        const closePrice = alert.currentPrice;
        
        if (!closePrice || closePrice <= 0) {
          console.warn(`⚠️ ${alert.symbol}: Precio de cierre inválido (${closePrice}), saltando...`);
          continue;
        }
        
        console.log(`💰 ${alert.symbol}: Precio de cierre para operaciones: $${closePrice}`);

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
            const motivo = closePrice < entryRangeMin 
              ? `Precio $${closePrice} < mínimo $${entryRangeMin}`
              : `Precio $${closePrice} > máximo $${entryRangeMax}`;
            
            console.log(`❌ ${alert.symbol}: ${motivo} - DESCARTANDO COMPRA`);
            
            // ✅ DEVOLVER LIQUIDEZ si fue asignada
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
                  
                  if (distribution && distribution.allocatedAmount > 0) {
                    console.log(`💰 ${alert.symbol}: Devolviendo liquidez asignada: $${distribution.allocatedAmount.toFixed(2)}`);
                    liquidity.removeDistribution(alert._id.toString());
                    await liquidity.save();
                    console.log(`✅ ${alert.symbol}: Liquidez devuelta al pool`);
                  }
                }
              } catch (liquidityError) {
                console.error(`⚠️ Error devolviendo liquidez para ${alert.symbol}:`, liquidityError);
              }
            }
            
          await Alert.updateOne(
            { _id: alert._id },
            { 
              $set: { 
                status: 'DESCARTADA',
                descartadaAt: new Date(),
                  descartadaMotivo: motivo,
                descartadaPrecio: closePrice
              }
            }
          );

          conversionDetails.push({
            symbol: alert.symbol,
            type: 'discarded',
            oldRange: oldEntryRange,
            newPrice: closePrice,
              reason: motivo
            });
          
            // Enviar notificación de compra descartada
            await sendDiscardedBuyNotification(alert, closePrice, entryRangeMin, entryRangeMax, motivo);
            
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
          
          // ✅ NUEVO: Enviar notificación de compra confirmada
          await sendEntryConfirmedNotification(alert, closePrice, entryRangeMin, entryRangeMax);
          
          // ✅ NUEVO: Actualizar el precio de la operación de COMPRA existente con el precio final confirmado
          await updateOperationPriceOnConfirmation(alert._id, closePrice);
        }
        
        // Procesar rango de venta si existe
        if (hasSellRange) {
          const sellRangeMin = alert.sellRangeMin;
          const sellRangeMax = alert.sellRangeMax;
          
          // ✅ Verificar si el precio está DENTRO del rango de venta
          const precioEnRango = closePrice >= sellRangeMin && closePrice <= sellRangeMax;
          
          if (precioEnRango) {
            console.log(`✅ ${alert.symbol}: Precio $${closePrice} está DENTRO del rango $${sellRangeMin}-$${sellRangeMax} → EJECUTANDO VENTA`);
            
            // Buscar venta programada pendiente
          const liquidityData = alert.liquidityData || {};
          const partialSales = liquidityData.partialSales || [];
            
            console.log(`🔍 ${alert.symbol}: Buscando ventas programadas (total: ${partialSales.length})`);
            
            // Buscar cualquier venta pendiente (no ejecutada)
            const pendingSale = partialSales.find((sale: any) => !sale.executed);
          
          if (pendingSale) {
              console.log(`✅ ${alert.symbol}: Ejecutando venta programada: ${pendingSale.percentage}%`);
              
              // Ejecutar la venta programada
              const saleResult = await executeScheduledSale(alert, pendingSale, closePrice, adminUser);
              
              if (saleResult.shouldClose) {
                updateFields.status = 'CLOSED';
                updateFields.exitPrice = closePrice;
                updateFields.exitDate = new Date();
                updateFields.exitReason = 'AUTOMATIC';
                updateFields.participationPercentage = 0;
                updateFields.profit = saleResult.profitPercentage;
                console.log(`🔒 ${alert.symbol}: Posición CERRADA - Profit: ${saleResult.profitPercentage.toFixed(2)}%`);
              } else {
                if (alert.participationPercentage !== saleResult.newParticipationPercentage) {
                  updateFields.participationPercentage = saleResult.newParticipationPercentage;
                  }
                console.log(`📊 ${alert.symbol}: Venta parcial - Participación restante: ${saleResult.newParticipationPercentage}%`);
              }
              
              updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // Enviar notificación de VENTA
              await sendSaleNotification(alert, closePrice, pendingSale.percentage, saleResult.profitPercentage);
              
          } else {
              // ✅ Si NO hay venta programada pero el precio está en rango, 
              // ejecutar venta del porcentaje restante (participationPercentage actual)
              const remainingPercentage = alert.participationPercentage || 100;
              console.log(`✅ ${alert.symbol}: Precio en rango sin venta programada - Ejecutando venta del ${remainingPercentage}% restante`);
              
              // Crear venta sintética para ejecutar
              const syntheticSale = {
                percentage: remainingPercentage,
                isCompleteSale: true, // Siempre es venta completa de lo que queda
                scheduledAt: new Date(),
                priceRange: { min: sellRangeMin, max: sellRangeMax }
              };
              
              // Ejecutar la venta
              const saleResult = await executeScheduledSale(alert, syntheticSale, closePrice, adminUser);
              
              if (saleResult.shouldClose) {
                    updateFields.status = 'CLOSED';
                    updateFields.exitPrice = closePrice;
                    updateFields.exitDate = new Date();
                    updateFields.exitReason = 'AUTOMATIC';
                    updateFields.participationPercentage = 0;
                updateFields.profit = saleResult.profitPercentage;
                console.log(`🔒 ${alert.symbol}: Posición CERRADA - Profit: ${saleResult.profitPercentage.toFixed(2)}%`);
              }
              
                    updateFields.sellPrice = closePrice;
              unsetFields.sellRangeMin = 1;
              unsetFields.sellRangeMax = 1;
              
              // Enviar notificación de VENTA ejecutada (no solo conversión)
              await sendSaleNotification(alert, closePrice, remainingPercentage, saleResult.profitPercentage);
                  }
                } else {
            // ❌ Precio FUERA del rango → DESCARTAR la venta programada (no ejecutar)
            const motivo = closePrice < sellRangeMin 
              ? `Precio $${closePrice} < mínimo $${sellRangeMin}`
              : `Precio $${closePrice} > máximo $${sellRangeMax}`;
            
            console.log(`❌ ${alert.symbol}: ${motivo} → DESCARTANDO venta programada`);
            
            // Limpiar la venta programada (marcar como descartada)
            const liquidityData = alert.liquidityData || {};
            const partialSales = liquidityData.partialSales || [];
                    
            // Marcar todas las ventas pendientes como descartadas
            const updatedPartialSales = partialSales.map((sale: any) => {
              if (!sale.executed) {
                return {
                  ...sale,
                  executed: false,
                  discarded: true,
                  discardedAt: new Date(),
                  discardReason: motivo
                };
              }
              return sale;
            });
            
            // Actualizar la alerta: limpiar rangos pero mantener la posición activa
            await Alert.updateOne(
              { _id: alert._id },
              { 
                $set: { 
                  'liquidityData.partialSales': updatedPartialSales 
                },
                $unset: { 
                  sellRangeMin: 1, 
                  sellRangeMax: 1 
                }
              }
            );
            
            console.log(`🗑️ ${alert.symbol}: Venta descartada - Posición sigue ACTIVA sin venta programada`);
            
            // Enviar notificación de venta descartada
            await sendDiscardedSaleNotification(alert, closePrice, sellRangeMin, sellRangeMax, motivo);
            
            conversionDetails.push({
              symbol: alert.symbol,
              type: 'discarded_sale',
              oldRange: oldSellRange,
              newPrice: closePrice,
              reason: motivo
            });
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
          console.log(`✅ CRON: ${alert.symbol}: Venta ejecutada a $${closePrice}`);
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
    const alertEntryPrice = alert.entryPrice || alert.entryPriceRange?.min || closePrice;
    
    // Calcular profit
    const profitPercentage = alertEntryPrice > 0 
      ? ((closePrice - alertEntryPrice) / alertEntryPrice) * 100 
      : 0;
    
    // ✅ CORREGIDO: Usar originalParticipationPercentage si existe, sino participationPercentage actual
    // Si no hay ninguno, asumir 100%
    const baseParticipation = alert.originalParticipationPercentage ?? alert.participationPercentage ?? 100;
    const currentParticipation = alert.participationPercentage ?? baseParticipation;
    
    // Calcular nueva participación: restar el porcentaje vendido
    const newParticipationPercentage = isCompleteSale ? 0 : Math.max(0, currentParticipation - percentage);
    
    console.log(`📊 ${alert.symbol}: Cálculo de participación - Base: ${baseParticipation}%, Actual: ${currentParticipation}%, Vendido: ${percentage}%, Nueva: ${newParticipationPercentage}%`);
    
    // ✅ CORREGIDO: Calcular realizedProfit basado en el P&L real de la venta
    // realizedProfit = (precioVenta - precioEntrada) * accionesVendidas
    const saleEntryPrice = alert.entryPrice || alert.entryPriceRange?.min || closePrice;
    const sharesToSell = sale.sharesToSell || 0;
    const costBasis = sharesToSell * saleEntryPrice; // Costo original de las acciones vendidas
    const proceeds = sharesToSell * closePrice; // Efectivo recibido
    const realizedProfit = proceeds - costBasis; // P&L real en dólares
    
    // Marcar la venta como ejecutada
    sale.executed = true;
    sale.executedAt = new Date();
    sale.sellPrice = closePrice;
    sale.realizedProfit = realizedProfit; // ✅ CORREGIDO: Guardar el P&L real calculado
    
    // Actualizar liquidityData
    const liquidityData = alert.liquidityData || {};
    const partialSales = liquidityData.partialSales || [];
    
    // Actualizar el partialSale correspondiente
    const saleIndex = partialSales.findIndex((s: any) => !s.executed || s === sale);
    if (saleIndex >= 0) {
      partialSales[saleIndex] = sale;
    }
    
    // ✅ NUEVO: Recargar la alerta para poder llamar a calculateTotalProfit
    const updatedAlert = await Alert.findById(alert._id);
    if (updatedAlert) {
      updatedAlert.liquidityData = {
        ...liquidityData,
        partialSales: partialSales
      };
      updatedAlert.participationPercentage = newParticipationPercentage;
      
      // ✅ NUEVO: Calcular ganancia realizada acumulada
      updatedAlert.calculateTotalProfit();
      
      await updatedAlert.save();
    } else {
      // Fallback: usar updateOne si no se puede recargar
      await Alert.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            'liquidityData.partialSales': partialSales,
            participationPercentage: newParticipationPercentage
          } 
        }
      );
    }
    
    console.log(`✅ ${alert.symbol}: Venta ejecutada - ${percentage}% vendido a $${closePrice} - Participación restante: ${newParticipationPercentage}%`);
    
    // Actualizar sistema de liquidez si hay admin
    if (adminUser) {
      try {
        const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        const LiquidityModule = await import('@/models/Liquidity');
        const Liquidity = LiquidityModule.default;
        const OperationModule = await import('@/models/Operation');
        const Operation = OperationModule.default;
        
        // ✅ CORREGIDO: Buscar liquidez que contenga la distribución del alertId
        // Esto asegura que encontremos el documento correcto sin importar quién lo creó
        let liquidity = await Liquidity.findOne({ 
          pool,
          'distributions.alertId': alert._id.toString()
        });
        
        let liquidityReleased = 0;
        let sharesToSellFinal = 0;
        
        if (liquidity) {
          const distribution = liquidity.distributions.find((d: any) => 
            d.alertId && d.alertId.toString() === alert._id.toString()
          );
          
          if (distribution && distribution.shares > 0) {
            // ✅ Caso 1: Tiene distribución de liquidez
            sharesToSellFinal = isCompleteSale 
              ? distribution.shares 
              : distribution.shares * (percentage / 100);
            
            const { returnedCash, remainingShares } = liquidity.sellShares(
              alert._id.toString(), 
              sharesToSellFinal, 
              closePrice
            );
            
            liquidityReleased = returnedCash;
            
            if (remainingShares <= 0) {
              liquidity.removeDistribution(alert._id.toString());
            }
            
            await liquidity.save();
            console.log(`✅ ${alert.symbol}: Liquidez actualizada (distribución) - +$${returnedCash.toFixed(2)} liberados`);
          } else {
            // ✅ Caso 2: No tiene distribución, buscar en operación de compra
            console.log(`⚠️ ${alert.symbol}: No tiene distribución de liquidez, buscando operación de compra...`);
            
            const buyOperation = await Operation.findOne({
              alertId: alert._id,
              operationType: 'COMPRA',
              system: pool
            }).sort({ date: -1 });
            
            if (buyOperation && buyOperation.portfolioPercentage > 0) {
              // ✅ CORREGIDO: Calcular liquidez liberada basándose en participationPercentage y precio actual
              // Primero calcular acciones a vender basándose en la posición actual
              const currentParticipation = alert.participationPercentage ?? 100;
              
              // Calcular el valor actual de la posición basado en participationPercentage
              // Si participationPercentage es 50%, significa que tenemos el 50% de la posición original
              const baseLiquidity = liquidity.initialLiquidity || liquidity.totalLiquidity || 1000;
              const totalAllocated = baseLiquidity * (buyOperation.portfolioPercentage / 100);
              
              // Calcular acciones totales actuales basándose en participationPercentage y precio actual
              const currentShares = (totalAllocated * (currentParticipation / 100)) / (alert.entryPrice || closePrice);
              
              // Calcular acciones a vender
              sharesToSellFinal = isCompleteSale 
                ? currentShares 
                : currentShares * (percentage / 100);
              
              // ✅ CORREGIDO: Calcular liquidez liberada basándose en participationPercentage y precio actual
              // La liquidez liberada = (participationPercentage / 100) * currentPrice * sharesToSell
              liquidityReleased = (currentParticipation / 100) * closePrice * sharesToSellFinal;
              
              // ✅ CORREGIDO: Calcular ganancia realizada
              const proceeds = sharesToSellFinal * closePrice;
              const costBasis = sharesToSellFinal * (alert.entryPrice || closePrice);
              const realizedProfit = proceeds - costBasis;
              
              // ✅ CORREGIDO: Actualizar totalLiquidity con el efectivo total recibido (proceeds)
              // Cuando vendemos, recibimos proceeds en efectivo que debe agregarse a totalLiquidity
              // El costBasis que estaba en distributedLiquidity se libera reduciendo distributedLiquidity
              // La ganancia (realizedProfit) es dinero nuevo que también debe estar en totalLiquidity
              // Por lo tanto, sumamos proceeds completo (costBasis + realizedProfit) a totalLiquidity
              liquidity.totalLiquidity = (liquidity.totalLiquidity || baseLiquidity) + proceeds;
              
              // ✅ CORREGIDO: Reducir distributedLiquidity en el monto liberado
              // Esto aumenta availableLiquidity automáticamente
              liquidity.distributedLiquidity = Math.max(0, (liquidity.distributedLiquidity || 0) - liquidityReleased);
              
              // ✅ CORREGIDO: Recalcular availableLiquidity
              liquidity.availableLiquidity = liquidity.totalLiquidity - liquidity.distributedLiquidity;
              
              await liquidity.save();
              
              console.log(`✅ ${alert.symbol}: Liquidez actualizada (desde operación)`);
              console.log(`   - Liquidez liberada: $${liquidityReleased.toFixed(2)}`);
              console.log(`   - Ganancia realizada: $${realizedProfit.toFixed(2)}`);
              console.log(`   - totalLiquidity: $${liquidity.totalLiquidity.toFixed(2)}`);
              console.log(`   - distributedLiquidity: $${liquidity.distributedLiquidity.toFixed(2)}`);
              console.log(`   - availableLiquidity: $${liquidity.availableLiquidity.toFixed(2)}`);
              console.log(`📊 portfolioPercentage: ${buyOperation.portfolioPercentage}%, base: $${baseLiquidity}`);
            } else {
              console.log(`⚠️ ${alert.symbol}: No se encontró operación de compra con portfolioPercentage`);
            }
          }
        }
        
        // Registrar operación de venta si se liberó liquidez
        if (liquidityReleased > 0) {
          await registerSaleOperation(alert, sharesToSellFinal, closePrice, pool, adminUser, percentage, isCompleteSale, liquidityReleased);
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
  isCompleteSale: boolean,
  liquidityReleased?: number // ✅ NUEVO: Liquidez real liberada del sistema
) {
      try {
        const OperationModule = await import('@/models/Operation');
        const Operation = OperationModule.default;
        
        const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
          .sort({ date: -1 })
          .select('balance');
        const currentBalance = currentBalanceDoc?.balance || 0;
        
    // ✅ CORREGIDO: Usar liquidez real si está disponible, sino calcular valor de mercado
    const actualLiquidityReleased = liquidityReleased ?? (sharesToSell * closePrice);
    const newBalance = currentBalance + actualLiquidityReleased;
        
        const buyOperation = await Operation.findOne({ 
          alertId: alert._id, 
          operationType: 'COMPRA',
          system: pool
        }).sort({ date: -1 });
        
    const entryPrice = alert.entryPrice || closePrice;
    const marketValue = sharesToSell * closePrice;
    // ✅ CORREGIDO: Ganancia = valor de mercado - liquidez asignada original
    const realizedProfit = marketValue - actualLiquidityReleased;
        
        // ✅ CRÍTICO: Usar el precio de cierre del cronjob para registrar la operación
        // Este precio es el precio del momento de cierre de la alerta cuando se ejecuta el cronjob
        const operation = new Operation({
          ticker: alert.symbol.toUpperCase(),
          operationType: 'VENTA',
      quantity: -sharesToSell,
          price: closePrice, // ✅ Precio de cierre del cronjob (precio del momento de ejecución)
      amount: actualLiquidityReleased,
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
      notes: `Venta ${isCompleteSale ? 'completa' : 'parcial'} (${percentage}%) ejecutada automáticamente a precio de cierre $${closePrice} - ${alert.symbol}`
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
  profitPercentage: number,
  isPositionClosed?: boolean // ✅ NUEVO: Indica si la posición se cerró completamente
) {
  try {
    const { createAlertNotification } = await import('@/lib/notificationUtils');

    const profitSign = profitPercentage >= 0 ? '+' : '';
    
    // ✅ CORREGIDO: Si la posición se cerró completamente (participación = 0%), 
    // mostrar mensaje de cierre completo, aunque el % vendido no sea 100%
    const positionClosed = isPositionClosed || percentage >= 100;
    
    const message = positionClosed
      ? `✅ VENTA EJECUTADA: Se cerró completamente la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. Profit: ${profitSign}${profitPercentage.toFixed(2)}%`
      : `✅ VENTA PARCIAL EJECUTADA: Se vendió el ${percentage}% de la posición en ${alert.symbol} a $${closePrice.toFixed(2)}. Profit: ${profitSign}${profitPercentage.toFixed(2)}%`;
    
    // ✅ CORREGIDO: El % vendido en el email debe reflejar que se cerró todo si es cierre completo
    const displayPercentage = positionClosed ? 100 : percentage;
        
    await createAlertNotification(alert, {
      message: message,
          price: closePrice,
      action: 'SELL', // ✅ Siempre SELL para ventas
      skipDuplicateCheck: true,
      title: `✅ Venta Ejecutada: ${alert.symbol}`,
      soldPercentage: displayPercentage,
      profitPercentage: profitPercentage // ✅ NUEVO: Pasar el P&L porcentual
        });
        
    console.log(`✅ ${alert.symbol}: Notificación de venta enviada (${positionClosed ? 'cierre completo' : 'venta parcial'} - ${displayPercentage}%)`);
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
      action: 'SELL',
      skipDuplicateCheck: true,
      title: `🎯 Rango Convertido: ${alert.symbol}`
    });
    
    console.log(`✅ ${alert.symbol}: Notificación de conversión enviada`);
  } catch (error) {
    console.error(`⚠️ Error enviando notificación de conversión para ${alert.symbol}:`, error);
  }
}

/**
 * Envía notificación de venta DESCARTADA (precio fuera del rango)
 */
async function sendDiscardedSaleNotification(
  alert: any, 
  closePrice: number, 
  rangeMin: number,
  rangeMax: number,
  motivo: string
) {
  try {
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    const message = `❌ Venta descartada: ${alert.symbol} - El precio de cierre ($${closePrice.toFixed(2)}) está fuera del rango programado ($${rangeMin}-$${rangeMax}). La posición sigue ACTIVA sin venta programada.`;
    
    await createAlertNotification(alert, {
      message: message,
      price: closePrice,
      action: 'SELL',
      skipDuplicateCheck: true,
      title: `❌ Venta Descartada: ${alert.symbol}`
    });
    
    console.log(`✅ ${alert.symbol}: Notificación de venta descartada enviada`);
  } catch (error) {
    console.error(`⚠️ Error enviando notificación de venta descartada para ${alert.symbol}:`, error);
  }
}

/**
 * Envía notificación de compra DESCARTADA (precio fuera del rango de entrada)
 */
async function sendDiscardedBuyNotification(
  alert: any, 
  closePrice: number, 
  rangeMin: number,
  rangeMax: number,
  motivo: string
) {
  try {
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    const message = `❌ Compra descartada: ${alert.symbol} - El precio de cierre ($${closePrice.toFixed(2)}) está fuera del rango de entrada ($${rangeMin}-$${rangeMax}). La alerta ha sido cancelada.`;
    
    await createAlertNotification(alert, {
      message: message,
      price: closePrice,
      action: 'BUY',
      skipDuplicateCheck: true,
      title: `❌ Compra Descartada: ${alert.symbol}`
    });
    
    console.log(`✅ ${alert.symbol}: Notificación de compra descartada enviada`);
  } catch (error) {
    console.error(`⚠️ Error enviando notificación de compra descartada para ${alert.symbol}:`, error);
  }
}

/**
 * Envía notificación de compra CONFIRMADA (precio dentro del rango de entrada)
 */
async function sendEntryConfirmedNotification(
  alert: any, 
  closePrice: number, 
  rangeMin: number,
  rangeMax: number
) {
  try {
    const { createAlertNotification } = await import('@/lib/notificationUtils');
    
    const message = `✅ Compra confirmada: ${alert.symbol} - El precio de cierre ($${closePrice.toFixed(2)}) está dentro del rango de entrada ($${rangeMin}-$${rangeMax}). La posición está ahora activa con precio de entrada $${closePrice.toFixed(2)}.`;
    
    await createAlertNotification(alert, {
      message: message,
      price: closePrice,
      action: 'BUY',
      skipDuplicateCheck: true,
      title: `✅ Compra Confirmada: ${alert.symbol}`
    });
    
    console.log(`✅ ${alert.symbol}: Notificación de compra confirmada enviada`);
  } catch (error) {
    console.error(`⚠️ Error enviando notificación de compra confirmada para ${alert.symbol}:`, error);
  }
}

/**
 * Actualiza el precio de la operación de COMPRA cuando se confirma la alerta
 * Esto asegura que el precio en OPERACIONES coincida con el del email de confirmación
 */
async function updateOperationPriceOnConfirmation(alertId: any, finalPrice: number) {
  try {
    const Operation = (await import('@/models/Operation')).default;
    const Liquidity = (await import('@/models/Liquidity')).default;
    
    // Buscar la operación de COMPRA asociada a esta alerta
    const operation = await Operation.findOne({
      alertId: alertId,
      operationType: 'COMPRA'
    });
    
    if (!operation) {
      console.log(`⚠️ No se encontró operación de COMPRA para alerta ${alertId}`);
      return;
    }
    
    const oldPrice = operation.price;
    
    // Actualizar el precio y recalcular el monto
    operation.price = finalPrice;
    operation.amount = operation.quantity * finalPrice;
    
    // Actualizar también el precio de entrada en liquidityData si existe
    if (operation.liquidityData) {
      operation.liquidityData.entryPrice = finalPrice;
      // Recalcular allocatedAmount basado en shares y nuevo precio
      if (operation.liquidityData.shares) {
        operation.liquidityData.allocatedAmount = operation.liquidityData.shares * finalPrice;
      }
    }
    
    // Agregar nota de actualización
    const existingNotes = operation.notes || '';
    operation.notes = `${existingNotes} | Precio actualizado de $${oldPrice.toFixed(2)} a $${finalPrice.toFixed(2)} al confirmar compra`;
    
    await operation.save();
    
    console.log(`✅ Operación actualizada: ${operation.ticker} - Precio: $${oldPrice.toFixed(2)} → $${finalPrice.toFixed(2)}`);
    
    // ✅ NUEVO: También actualizar la distribución de liquidez para mantener consistencia
    try {
      const alertIdString = alertId.toString();
      
      // Buscar todas las liquidez que tengan esta distribución
      const liquidities = await Liquidity.find({
        'distributions.alertId': alertIdString
      });
      
      for (const liquidity of liquidities) {
        const distribution = liquidity.distributions.find(
          (dist: any) => dist.alertId?.toString() === alertIdString
        );
        
        if (distribution) {
          const oldEntryPrice = distribution.entryPrice;
          
          // Actualizar el precio de entrada
          distribution.entryPrice = finalPrice;
          distribution.currentPrice = finalPrice;
          
          // Recalcular allocatedAmount manteniendo el mismo número de shares
          if (distribution.shares) {
            distribution.allocatedAmount = distribution.shares * finalPrice;
          }
          
          distribution.updatedAt = new Date();
          
          // Recalcular totales de liquidez
          liquidity.recalculateDistributions();
          await liquidity.save();
          
          console.log(`✅ Distribución de liquidez actualizada: alertId=${alertIdString} - Precio: $${oldEntryPrice.toFixed(2)} → $${finalPrice.toFixed(2)}`);
        }
      }
    } catch (liquidityError) {
      console.error(`⚠️ Error actualizando distribución de liquidez:`, liquidityError);
      // No fallar la operación principal por un error en liquidez
    }
    
  } catch (error) {
    console.error(`⚠️ Error actualizando precio de operación para alerta ${alertId}:`, error);
  }
}
