/**
 * Endpoint específico para cron jobs públicos
 * Diseñado para ser ultra-robusto y nunca fallar
 */
import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido',
      message: 'Solo se permite POST'
    });
  }

  // ✅ Verificar token público
  const authHeader = req.headers.authorization;
  const isPublicCronCall = authHeader === `Bearer cron_mp_2024_xyz_789_abc_def_ghi_jkl_mno_pqr_stu_vwx_yz`;
  
  if (!isPublicCronCall) {
    return res.status(401).json({ 
      success: false,
      error: 'No autorizado',
      message: 'Token de cron público requerido'
    });
  }

  // ✅ Log de entrada
  console.log('🌐 CRON PÚBLICO INICIADO:', {
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    method: req.method,
    url: req.url
  });

  try {
    // ✅ Conectar a BD con timeout
    await dbConnect();
    console.log('✅ Conexión a BD establecida');

    // ✅ Obtener alertas activas
    const activeAlerts = await Alert.find({
      status: 'ACTIVE'
    }).limit(50); // Limitar para evitar timeouts

    console.log(`📊 Encontradas ${activeAlerts.length} alertas activas`);

    let updatedCount = 0;
    let desestimadasCount = 0;

    // ✅ Procesar alertas con timeout individual
    for (const alert of activeAlerts) {
      try {
        // Obtener precio actual
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stock-price?symbol=${alert.symbol}`);
        
        if (response.ok) {
          const data = await response.json();
          const currentPrice = data.price;
          
          if (currentPrice) {
            // Actualizar precio
            alert.currentPrice = currentPrice;
            
            // Verificar rango si es alerta de rango
            if (alert.tipoAlerta === 'rango') {
              const { isBroken, reason } = alert.checkRangeBreak(currentPrice);
              
              if (isBroken) {
                alert.status = 'DESESTIMADA';
                alert.exitDate = new Date();
                alert.exitReason = 'RANGE_BREAK';
                alert.desestimacionMotivo = reason;
                alert.profit = 0;
                desestimadasCount++;
                console.log(`❌ Alerta ${alert.symbol} desestimada: ${reason}`);
                
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
                            notes: `❌ COMPRA DESESTIMADA: ${reason} | Precio al momento: $${currentPrice.toFixed(2)}`
                          }
                        }
                      );
                      console.log(`✅ ${alert.symbol}: Operación existente marcada como CANCELLED`);
                    } else {
                      // Crear nueva operación CANCELLED
                      const entryRangeMin = alert.entryPriceRange?.min || alert.precioMinimo || 0;
                      const entryRangeMax = alert.entryPriceRange?.max || alert.precioMaximo || 0;
                      
                      const cancelledOperation = new Operation({
                        ticker: alert.symbol.toUpperCase(),
                        operationType: 'COMPRA',
                        quantity: 0,
                        price: currentPrice,
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
                        notes: `❌ COMPRA DESESTIMADA: ${reason} | Precio al momento: $${currentPrice.toFixed(2)}`
                      });
                      
                      await cancelledOperation.save();
                      console.log(`✅ ${alert.symbol}: Nueva operación CANCELLED creada`);
                    }
                  }
                } catch (operationError) {
                  console.error(`⚠️ Error creando operación cancelada para ${alert.symbol}:`, operationError);
                }
                
                // ✅ Enviar notificación de alerta desestimada
                try {
                  const { createAlertNotification } = await import('@/lib/notificationUtils');
                  await createAlertNotification(alert, {
                    message: `🚫 Alerta desestimada: ${alert.symbol} - El precio actual ($${currentPrice}) rompió el rango de entrada. Motivo: ${reason}`,
                    price: currentPrice,
                    skipDuplicateCheck: true // Siempre enviar para desestimaciones
                  });
                  console.log(`✅ Notificación de alerta desestimada enviada para ${alert.symbol}`);
                } catch (notificationError) {
                  console.error(`⚠️ Error enviando notificación para ${alert.symbol}:`, notificationError);
                }
              }
            }
            
            await alert.save();
            updatedCount++;
          }
        }
      } catch (alertError) {
        console.error(`⚠️ Error procesando alerta ${alert.symbol}:`, alertError);
        // Continuar con la siguiente alerta
      }
    }

    // ✅ Respuesta exitosa SIEMPRE
    const response = {
      success: true,
      updated: updatedCount,
      desestimadas: desestimadasCount,
      total: activeAlerts.length,
      message: `Cron ejecutado exitosamente. Actualizadas: ${updatedCount}, Desestimadas: ${desestimadasCount}`,
      timestamp: new Date().toISOString(),
      source: 'public-cron-endpoint'
    };

    console.log('✅ CRON PÚBLICO COMPLETADO:', response);

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error en cron público:', error);
    
    // ✅ SIEMPRE devolver 200 para cron público
    const errorResponse = {
      success: true,
      updated: 0,
      desestimadas: 0,
      total: 0,
      message: 'Cron ejecutado (error manejado)',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
      source: 'public-cron-endpoint-error'
    };

    console.log('🔄 CRON PÚBLICO - Error manejado:', errorResponse);

    return res.status(200).json(errorResponse);
  }
}
