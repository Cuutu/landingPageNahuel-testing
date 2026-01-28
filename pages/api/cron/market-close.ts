import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { sendEmail } from '@/lib/emailService';
import { updateOperationPriceOnConfirmation } from './auto-convert-ranges';

/**
 * API para fijar precios finales al cierre del mercado (17:30)
 * Esta es una tarea programada que se ejecuta automáticamente
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ✅ NUEVO: Verificar método HTTP para cronjobs externos
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        message: 'Método no permitido. Use GET para cronjobs.',
        timestamp: new Date().toISOString()
      });
    }

    // ✅ NUEVO: Verificar que solo Vercel pueda ejecutar este cron job
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    // ✅ NUEVO: Permitir acceso manual para testing (solo en desarrollo)
    const isManualTest = req.query.test === 'true' && process.env.NODE_ENV === 'development';
    
    if (!isManualTest && token !== process.env.CRON_SECRET_TOKEN) {
      console.error('❌ Acceso no autorizado a cron job de cierre de mercado');
      return res.status(401).json({ 
        error: 'No autorizado',
        message: 'Este endpoint solo puede ser ejecutado por Vercel Cron o en modo test'
      });
    }

    console.log('✅ Cron job autorizado - Iniciando proceso de cierre de mercado...');
    
    const startTime = Date.now();
    
    await dbConnect();

    // ✅ NUEVO: Verificar si es día hábil (no feriado)
    const isBusinessDay = await checkBusinessDay();
    if (!isBusinessDay) {
      console.log('ℹ️ No es día hábil, proceso de cierre cancelado');
      return res.status(200).json({ 
        success: true, 
        message: 'No es día hábil',
        isBusinessDay: false
      });
    }

    // Obtener todas las alertas activas que no tengan precio final
    const activeAlerts = await Alert.find({ 
      status: 'ACTIVE',
      tipo: { $in: ['TraderCall', 'SmartMoney'] },
      finalPrice: { $exists: false }
    }).populate('createdBy', 'email name');

    // ✅ NUEVO: Filtrar alertas que ya deben cerrarse según su horario personalizado
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Convertir a minutos desde medianoche
    
    console.log(`🕐 Hora actual: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} (${currentTime} minutos)`);
    
    const alertsToClose = activeAlerts.filter(alert => {
      // Si no tiene horarioCierre, usar horario por defecto (17:30 = 1050 minutos)
      const closeTime = alert.horarioCierre || '17:30';
      const [hours, minutes] = closeTime.split(':').map(Number);
      const alertCloseTime = hours * 60 + minutes;
      
      // Verificar si ya es hora de cerrar esta alerta
      const shouldClose = currentTime >= alertCloseTime;
      
      console.log(`📊 ${alert.symbol}: Horario cierre ${closeTime} (${alertCloseTime} min) vs Actual ${currentTime} min = ${shouldClose ? 'SÍ' : 'NO'}`);
      
      if (shouldClose) {
        console.log(`⏰ ${alert.symbol}: Es hora de cerrar (${closeTime}) - Actual: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      } else {
        console.log(`⏳ ${alert.symbol}: Aún no es hora de cerrar (${closeTime}) - Actual: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      }
      
      return shouldClose;
    });

    // ✅ NUEVO: Si no hay alertas por horario, verificar si hay alertas con rango que necesiten conversión
    if (alertsToClose.length === 0) {
      const alertsWithRange = activeAlerts.filter(alert => 
        alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max
      );
      
      if (alertsWithRange.length > 0) {
        console.log(`🔄 Encontradas ${alertsWithRange.length} alertas con rango que necesitan conversión`);
        // Procesar alertas con rango independientemente del horario
        alertsToClose.push(...alertsWithRange);
      } else {
        console.log('ℹ️ No hay alertas que deban cerrarse en este momento');
        
        // ✅ NUEVO: Enviar mensaje de Telegram indicando que no hay operaciones
        try {
          const { sendMessageToChannel } = await import('@/lib/telegramBot');
          
          const noActivityMessage = `👋🏻 ¡Buenas a todos! ¿Cómo están? Hoy no tenemos activos para comprar ni para vender. Por lo que mantenemos la cartera tal cual como la tenemos hasta ahora.`;
          
          // Enviar a ambos canales (TraderCall y SmartMoney)
          await sendMessageToChannel('TraderCall', noActivityMessage);
          await sendMessageToChannel('SmartMoney', noActivityMessage);
          
          console.log('✅ Mensaje de sin actividad enviado a Telegram');
        } catch (telegramError: any) {
          console.error('❌ Error enviando mensaje de sin actividad a Telegram:', telegramError.message);
        }
        
        return res.status(200).json({ 
          success: true, 
          message: 'No hay alertas que deban cerrarse ahora - Mensaje de Telegram enviado',
          totalAlerts: activeAlerts.length,
          alertsToClose: 0,
          processedCount: 0,
          executionTime: Date.now() - startTime
        });
      }
    }

    console.log(`📊 Procesando ${alertsToClose.length} alertas para cierre de mercado (de ${activeAlerts.length} total)...`);

    let processedCount = 0;
    let errorCount = 0;
    let emailsSent = 0;
    const errors: string[] = [];

    // Procesar cada alerta que debe cerrarse
    for (const alert of alertsToClose) {
      try {
        // ✅ CRÍTICO: Siempre intentar obtener precio real del mercado primero
        let closePrice = await getMarketClosePrice(alert.symbol);
        
        // Si no se puede obtener precio real, usar el precio actual de la alerta
        if (!closePrice || closePrice <= 0) {
          closePrice = alert.currentPrice;
          console.log(`⚠️ ${alert.symbol}: Usando precio actual de la alerta como fallback: ${closePrice}`);
        }
        
        if (closePrice) {
          console.log(`💰 ${alert.symbol}: Precio actual ${alert.currentPrice} -> Precio de cierre ${closePrice}`);
          
          // ✅ NUEVO: Validar rango al cierre del mercado (solo para alertas de rango)
          if (alert.tipoAlerta === 'rango') {
            const { isBroken, reason } = alert.checkRangeBreak(closePrice);
            
            if (isBroken) {
              console.log(`❌ Alerta ${alert.symbol} (ID: ${alert._id}) ha roto el rango al cierre. Desestimando...`);
              
              alert.status = 'DESESTIMADA';
              alert.exitDate = new Date();
              alert.exitReason = 'RANGE_BREAK_AT_CLOSE';
              alert.desestimacionMotivo = reason;
              alert.profit = 0; // Desestimada, no hay profit/loss real de la operación
              
              // ✅ NUEVO: Liberar liquidez cuando se desestima la alerta 
              try {
                const Liquidity = (await import('@/models/Liquidity')).default;
                const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
                
                const liquidity = await Liquidity.findOne({ 
                  pool,
                  'distributions.alertId': alert._id.toString()
                });
                
                if (liquidity) {
                  const distribution = liquidity.distributions.find((d: any) => 
                    d.alertId && d.alertId.toString() === alert._id.toString()
                  );
                  
                  if (distribution && distribution.allocatedAmount > 0) {
                    console.log(`💰 ${alert.symbol}: Liberando liquidez por desestimación: $${distribution.allocatedAmount.toFixed(2)}`);
                    liquidity.removeDistribution(alert._id.toString());
                    await liquidity.save();
                    console.log(`✅ ${alert.symbol}: Liquidez liberada correctamente`);
                  }
                }
              } catch (liquidityError) {
                console.error(`⚠️ Error liberando liquidez para ${alert.symbol}:`, liquidityError);
              }
              
              // ✅ NUEVO: Crear operación CANCELLED para que aparezca en la tabla de operaciones
              try {
                const Operation = (await import('@/models/Operation')).default;
                const User = (await import('@/models/User')).default;
                
                const adminUser = await User.findOne({ role: 'admin' });
                if (adminUser) {
                  const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
                  
                  // Verificar si ya existe una operación para esta alerta
                  const existingOperation = await Operation.findOne({ 
                    alertId: alert._id,
                    operationType: 'COMPRA'
                  });
                  
                  if (existingOperation) {
                    await Operation.updateOne(
                      { _id: existingOperation._id },
                      {
                        $set: {
                          status: 'CANCELLED',
                          isPriceConfirmed: true,
                          notes: `❌ COMPRA DESESTIMADA AL CIERRE: ${reason} | Precio de cierre: $${closePrice.toFixed(2)}`
                        }
                      }
                    );
                    console.log(`✅ ${alert.symbol}: Operación existente marcada como CANCELLED al cierre`);
                  } else {
                    // Crear nueva operación CANCELLED
                    const entryRangeMin = alert.entryPriceRange?.min || alert.precioMinimo || 0;
                    const entryRangeMax = alert.entryPriceRange?.max || alert.precioMaximo || 0;
                    
                    const cancelledOperation = new Operation({
                      ticker: alert.symbol.toUpperCase(),
                      operationType: 'COMPRA',
                      quantity: 0,
                      price: closePrice,
                      amount: 0,
                      date: new Date(),
                      balance: 0,
                      alertId: alert._id,
                      alertSymbol: alert.symbol.toUpperCase(),
                      system: pool,
                      createdBy: adminUser._id,
                      portfolioPercentage: alert.participationPercentage || 0,
                      priceRange: entryRangeMin > 0 && entryRangeMax > 0 ? { min: entryRangeMin, max: entryRangeMax } : undefined,
                      isPriceConfirmed: true,
                      status: 'CANCELLED',
                      executedBy: 'CRON',
                      executionMethod: 'AUTOMATIC',
                      notes: `❌ COMPRA DESESTIMADA AL CIERRE: ${reason} | Precio de cierre: $${closePrice.toFixed(2)}`
                    });
                    
                    await cancelledOperation.save();
                    console.log(`✅ ${alert.symbol}: Nueva operación CANCELLED creada al cierre`);
                  }
                }
              } catch (operationError) {
                console.error(`⚠️ Error creando operación cancelada para ${alert.symbol}:`, operationError);
              }
              
              // Enviar notificación de alerta desestimada
              try {
                const { createAlertNotification } = await import('@/lib/notificationUtils');
                await createAlertNotification(alert, {
                  message: `🚫 Alerta desestimada al cierre: ${alert.symbol} - El precio de cierre ($${closePrice}) rompió el rango de entrada. Motivo: ${reason}`,
                  price: closePrice
                });
                console.log(`✅ Notificación de alerta desestimada enviada para ${alert.symbol}`);
              } catch (notificationError) {
                console.error(`⚠️ Error enviando notificación para ${alert.symbol}:`, notificationError);
              }
              
              console.log(`✅ Alerta ${alert.symbol} desestimada al cierre del mercado.`);
            } else {
              console.log(`✅ Alerta ${alert.symbol}: Precio de cierre dentro del rango válido.`);
            }
          }
          
          // ✅ NUEVO: Fijar precio final al cierre
          const isFromLastAvailable = !isBusinessDay; // Si no es hábil, usar último disponible
          alert.setFinalPrice(closePrice, isFromLastAvailable);

          // ✅ MODIFICADO: Si es una alerta de rango y NO fue desestimada, actualizar entryPrice al precio actual
          // para que se muestre correctamente en la interfaz como precio fijo
          const hasRange = alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max;
          const hasSellRange = alert.sellRangeMin && alert.sellRangeMax;
          
          // Solo convertir rangos a precios fijos si la alerta sigue activa (no fue desestimada)
          if (hasRange && alert.status === 'ACTIVE') {
            // ✅ CRÍTICO: Para rangos, usar el precio actual como nuevo precio de entrada
            const oldRange = `${alert.entryPriceRange.min}-${alert.entryPriceRange.max}`;
            alert.entryPrice = closePrice;
            // ✅ NUEVO: Limpiar el rango para que no se muestre más como rango
            alert.entryPriceRange = undefined;
            alert.precioMinimo = undefined;
            alert.precioMaximo = undefined;
            console.log(`🔄 ${alert.symbol}: Rango ${oldRange} convertido a precio fijo ${closePrice}`);
            
            // ✅ NUEVO: Actualizar la operación de COMPRA para cambiar el rango de precio por el precio de cierre
            try {
              await updateOperationPriceOnConfirmation(alert._id, closePrice);
              console.log(`✅ ${alert.symbol}: Operación de COMPRA actualizada con precio de cierre: $${closePrice}`);
            } catch (operationError) {
              console.error(`⚠️ Error actualizando operación de COMPRA para ${alert.symbol}:`, operationError);
              // No fallar el proceso si hay error actualizando la operación
            }
          } else if (!alert.entryPrice && alert.status === 'ACTIVE') {
            // Si no hay precio de entrada, usar el precio de cierre
            alert.entryPrice = closePrice;
            console.log(`🔄 ${alert.symbol}: Precio de entrada fijado en ${closePrice}`);
          }

          // ✅ NUEVO: Si tiene rango de venta, convertirlo a precio de venta fijo
          if (hasSellRange) {
            const oldSellRange = `${alert.sellRangeMin}-${alert.sellRangeMax}`;
            alert.sellPrice = closePrice; // Usar el último valor de la alerta
            // Limpiar el rango de venta
            alert.sellRangeMin = undefined;
            alert.sellRangeMax = undefined;
            console.log(`💰 ${alert.symbol}: Rango de venta ${oldSellRange} convertido a precio de venta fijo ${closePrice}`);
          }

          // ✅ NUEVO: Usar $unset para eliminar completamente los campos de rango de la base de datos
          // Solo si la alerta sigue activa (no fue desestimada)
          if (alert.status === 'ACTIVE') {
            const fieldsToUnset: any = {};
            
            if (hasRange) {
              fieldsToUnset.entryPriceRange = 1;
              fieldsToUnset.precioMinimo = 1;
              fieldsToUnset.precioMaximo = 1;
            }
            
            if (hasSellRange) {
              fieldsToUnset.sellRangeMin = 1;
              fieldsToUnset.sellRangeMax = 1;
            }
            
            if (Object.keys(fieldsToUnset).length > 0) {
              await Alert.updateOne(
                { _id: alert._id },
                { $unset: fieldsToUnset }
              );
              console.log(`🗑️ ${alert.symbol}: Campos de rango eliminados de la base de datos:`, Object.keys(fieldsToUnset));
            }
          }

          // ✅ NUEVO: Marcar email de cierre como enviado
          alert.emailsSent.marketClose = true;

          await alert.save();
          processedCount++;

          console.log(`✅ ${alert.symbol}: Precio final fijado en ${closePrice}`);
          
          // ✅ NUEVO: Enviar notificación a Telegram de cierre de mercado
          try {
            const { sendAlertToTelegram } = await import('@/lib/telegramBot');
            
            // Calcular profit si hay precio de entrada
            let profitPercentage: number | undefined = undefined;
            const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || alert.entryPriceRange?.max || 0;
            if (entryPrice > 0) {
              profitPercentage = ((closePrice - entryPrice) / entryPrice) * 100;
            }
            
            const message = `📊 Cierre de mercado: ${alert.symbol} cerró a $${closePrice.toFixed(2)}. ` +
              (profitPercentage !== undefined 
                ? `Resultado: ${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(2)}%` 
                : 'Precio final fijado.');
            
            await sendAlertToTelegram(alert, {
              message: message,
              price: closePrice,
              profitPercentage: profitPercentage,
              isExecutedSale: true // ✅ NUEVO: Indicar que es venta ejecutada (cierre de mercado)
            });
            console.log(`✅ Notificación de cierre enviada a Telegram para ${alert.symbol}`);
          } catch (telegramError: any) {
            console.error(`❌ Error enviando notificación a Telegram para ${alert.symbol}:`, telegramError.message);
            // No fallar el proceso si Telegram falla
          }
          
          // ✅ NUEVO: Enviar email de cierre al usuario
          try {
            await sendMarketCloseEmail(alert, closePrice);
            emailsSent++;
          } catch (emailError: any) {
            console.error(`❌ Error enviando email de cierre para ${alert.symbol}:`, emailError.message);
          }
        } else {
          console.warn(`⚠️ No se pudo obtener precio de cierre para ${alert.symbol}`);
        }
        
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Error procesando ${alert.symbol}: ${error.message}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Cierre de mercado completado en ${executionTime}ms`);
    console.log(`📊 Resumen: ${processedCount} procesadas, ${emailsSent} emails enviados, ${errorCount} errores`);

    // ✅ NUEVO: Log de métricas para monitoreo
    await logMarketCloseMetrics({
      totalAlerts: activeAlerts.length,
      processedCount,
      emailsSent,
      errorCount,
      executionTime,
      timestamp: new Date(),
      isBusinessDay
    });

    return res.status(200).json({
      success: true,
      message: 'Cierre de mercado procesado correctamente',
      summary: {
        totalAlerts: activeAlerts.length,
        processedCount,
        emailsSent,
        errorCount,
        executionTime,
        isBusinessDay
      },
      errors: errors.slice(0, 5) // Solo primeros 5 errores
    });

  } catch (error: any) {
    console.error('❌ Error en cierre de mercado:', error);
    
    // ✅ NUEVO: Log de error para monitoreo
    await logMarketCloseError({
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });

    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

/**
 * ✅ NUEVO: Verificar si es día hábil (no feriado)
 */
async function checkBusinessDay(): Promise<boolean> {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Sábado (6) y Domingo (0) no son hábiles
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // ✅ NUEVO: Verificar feriados usando API o base de datos local
    const isHoliday = await checkHoliday(today);
    if (isHoliday) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error verificando día hábil:', error);
    // Por defecto, asumir que es hábil si hay error
    return true;
  }
}

/**
 * ✅ NUEVO: Verificar si es feriado
 */
async function checkHoliday(date: Date): Promise<boolean> {
  try {
    // ✅ NUEVO: Usar API de feriados o base de datos local
    const holidayApiKey = process.env.HOLIDAY_API_KEY;
    const holidayApiUrl = process.env.HOLIDAY_API_URL;
    
    if (holidayApiKey && holidayApiUrl) {
      const response = await fetch(`${holidayApiUrl}?date=${date.toISOString().split('T')[0]}&country=UY`);
      if (response.ok) {
        const data = await response.json();
        return data.isHoliday || false;
      }
    }
    
    // ✅ NUEVO: Fallback a feriados hardcodeados de Uruguay (ejemplo)
    const uruguayHolidays = [
      '01-01', // Año Nuevo
      '01-06', // Día de los Reyes
      '04-19', // Desembarco de los 33 Orientales
      '05-01', // Día del Trabajador
      '05-18', // Batalla de Las Piedras
      '06-19', // Natalicio de Artigas
      '07-18', // Jura de la Constitución
      '08-25', // Declaratoria de la Independencia
      '10-12', // Día de la Raza
      '11-02', // Día de los Difuntos
      '12-25'  // Navidad
    ];
    
    const dateString = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return uruguayHolidays.includes(dateString);
    
  } catch (error) {
    console.error('❌ Error verificando feriado:', error);
    return false;
  }
}

/**
 * ✅ NUEVO: Obtener precio de cierre del mercado desde Google Finance
 */
async function getMarketClosePrice(symbol: string): Promise<number | null> {
  try {
    // ✅ NUEVO: Usar la API interna de Google Finance del proyecto
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/market-data/google-finance?symbol=${symbol}`);
    
    if (response.ok) {
      const data = await response.json();
      if (data.price && data.price > 0) {
        console.log(`✅ Precio obtenido desde API interna para ${symbol}: $${data.price}`);
        return data.price;
      }
    }
    
    // ✅ FALLBACK: Usar Google Finance directo
    const googleFinanceUrl = `https://www.google.com/finance/quote/${symbol}`;
    const response2 = await fetch(googleFinanceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response2.ok) {
      const html = await response2.text();
      
      // Buscar precio actual
      const priceMatch = html.match(/"price":\s*"([^"]+)"/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          console.log(`✅ Precio obtenido desde Google Finance para ${symbol}: $${price}`);
          return price;
        }
      }
    }
    
    console.log(`⚠️ No se pudo obtener precio real para ${symbol}`);
    return null;

  } catch (error: any) {
    console.error(`❌ Error obteniendo precio para ${symbol}:`, error.message);
    return null;
  }
}


/**
 * ✅ NUEVO: Enviar email de cierre de mercado al usuario
 */
async function sendMarketCloseEmail(alert: any, closePrice: number): Promise<void> {
  try {
    const userEmail = alert.createdBy.email;
    const userName = alert.createdBy.name || 'Usuario';
    
    const emailSubject = `🔔 Cierre de Mercado - ${alert.symbol} - ${alert.tipo}`;
    
    // Determinar si la alerta fue activada
    const hasRange = alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max;
    const wasActivated = hasRange ? 
      (closePrice >= alert.entryPriceRange.min && closePrice <= alert.entryPriceRange.max) : 
      true;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 20px; border-radius: 8px 8px 0 0; color: white;">
          <h2 style="margin: 0; display: flex; align-items: center;">
            <span style="margin-right: 10px;">📈</span>
            Cierre de Mercado
          </h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Alerta ${alert.symbol}</p>
        </div>
        
        <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 18px; font-weight: bold; color: #374151;">Hola ${userName}!</p>
          
          <p style="color: #6b7280;">El mercado ha cerrado y aquí tienes el resultado de tu alerta:</p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="margin-top: 0; color: #374151; display: flex; align-items: center;">
              <span style="margin-right: 8px;">📊</span>
              Detalles de la Alerta
            </h3>
            <p style="margin: 8px 0;"><strong>Símbolo:</strong> ${alert.symbol}</p>
            <p style="margin: 8px 0;"><strong>Acción:</strong> ${alert.action}</p>
            ${hasRange ? `<p style="margin: 8px 0;"><strong>Rango:</strong> $${alert.entryPriceRange.min} - $${alert.entryPriceRange.max}</p>` : ''}
            <p style="margin: 8px 0;"><strong>Precio Final:</strong> <span style="color: #dc2626; font-weight: bold;">$${closePrice.toFixed(2)}</span></p>
            <p style="margin: 8px 0;"><strong>Estado:</strong> 
              <span style="color: ${wasActivated ? '#10b981' : '#dc2626'}; font-weight: bold;">
                ${wasActivated ? '✅ ACTIVADA' : '❌ NO ACTIVADA'}
              </span>
            </p>
          </div>
          
          ${!wasActivated ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626; display: flex; align-items: center;">
                <span style="margin-right: 8px;">📉</span>
                Alerta No Activada
              </h4>
              <p style="margin: 0; color: #7f1d1d;">
                El precio final ($${closePrice.toFixed(2)}) está fuera de tu rango objetivo. 
                Sigue monitoreando el mercado.
              </p>
            </div>
          ` : `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0; color: #10b981; display: flex; align-items: center;">
                <span style="margin-right: 8px;">📈</span>
                Alerta Activada
              </h4>
              <p style="margin: 0; color: #14532d;">
                ¡Excelente! El precio final ($${closePrice.toFixed(2)}) está dentro de tu rango objetivo.
              </p>
            </div>
          `}
          
          <p style="color: #6b7280; font-size: 14px;">
            Saludos,<br>
            <strong>Equipo de ${alert.tipo}</strong>
          </p>
        </div>
      </div>
    `;
    
    await sendEmail({
      to: userEmail,
      subject: emailSubject,
      html: emailHtml
    });
    
    console.log(`✅ Email de cierre enviado a ${userEmail} para ${alert.symbol}`);
    
  } catch (error: any) {
    console.error(`❌ Error enviando email de cierre para ${alert.symbol}:`, error);
    throw error;
  }
}

/**
 * ✅ NUEVO: Log de métricas de cierre para monitoreo
 */
async function logMarketCloseMetrics(metrics: {
  totalAlerts: number;
  processedCount: number;
  emailsSent: number;
  errorCount: number;
  executionTime: number;
  timestamp: Date;
  isBusinessDay: boolean;
}) {
  try {
    console.log('📊 Métricas de cierre de mercado:', {
      ...metrics,
      successRate: ((metrics.processedCount / metrics.totalAlerts) * 100).toFixed(2) + '%',
      emailSuccessRate: ((metrics.emailsSent / metrics.processedCount) * 100).toFixed(2) + '%'
    });
  } catch (error) {
    console.error('❌ Error guardando métricas de cierre:', error);
  }
}

/**
 * ✅ NUEVO: Log de errores de cierre para monitoreo
 */
async function logMarketCloseError(errorData: {
  error: string;
  stack?: string;
  timestamp: Date;
}) {
  try {
    console.error('📊 Error de cierre de mercado registrado:', errorData);
  } catch (error) {
    console.error('❌ Error guardando log de error de cierre:', error);
  }
} 