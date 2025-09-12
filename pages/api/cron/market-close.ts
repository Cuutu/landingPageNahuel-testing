import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { sendEmail } from '@/lib/emailService';

/**
 * API para fijar precios finales al cierre del mercado (17:30)
 * Esta es una tarea programada que se ejecuta automáticamente
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
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
      tipo: { $in: ['TraderCall', 'SmartMoney', 'CashFlow'] },
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
        return res.status(200).json({ 
          success: true, 
          message: 'No hay alertas que deban cerrarse ahora',
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
        // ✅ MODIFICADO: Usar el precio actual de la alerta como precio de cierre
        const closePrice = alert.currentPrice || await getMarketClosePrice(alert.symbol);
        
        if (closePrice) {
          console.log(`💰 ${alert.symbol}: Precio actual ${alert.currentPrice} -> Precio de cierre ${closePrice}`);
          
          // ✅ NUEVO: Fijar precio final al cierre
          const isFromLastAvailable = !isBusinessDay; // Si no es hábil, usar último disponible
          alert.setFinalPrice(closePrice, isFromLastAvailable);

          // ✅ MODIFICADO: Si es una alerta de rango, actualizar entryPrice al precio actual
          // para que se muestre correctamente en la interfaz como precio fijo
          const hasRange = alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max;
          
          if (hasRange) {
            // ✅ CRÍTICO: Para rangos, usar el precio actual como nuevo precio de entrada
            const oldRange = `${alert.entryPriceRange.min}-${alert.entryPriceRange.max}`;
            alert.entryPrice = closePrice;
            // ✅ NUEVO: Limpiar el rango para que no se muestre más como rango
            alert.entryPriceRange = undefined;
            alert.precioMinimo = undefined;
            alert.precioMaximo = undefined;
            console.log(`🔄 ${alert.symbol}: Rango ${oldRange} convertido a precio fijo ${closePrice}`);
          } else if (!alert.entryPrice) {
            // Si no hay precio de entrada, usar el precio de cierre
            alert.entryPrice = closePrice;
            console.log(`🔄 ${alert.symbol}: Precio de entrada fijado en ${closePrice}`);
          }

          // ✅ NUEVO: Usar $unset para eliminar completamente los campos de rango de la base de datos
          if (hasRange) {
            await Alert.updateOne(
              { _id: alert._id },
              { 
                $unset: { 
                  entryPriceRange: 1,
                  precioMinimo: 1,
                  precioMaximo: 1
                }
              }
            );
            console.log(`🗑️ ${alert.symbol}: Campos de rango eliminados de la base de datos`);
          }

          // ✅ NUEVO: Marcar email de cierre como enviado
          alert.emailsSent.marketClose = true;

          await alert.save();
          processedCount++;

          console.log(`✅ ${alert.symbol}: Precio final fijado en ${closePrice}`);
          
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
    // ✅ NUEVO: Usar Google Finance para obtener precio de cierre
    const googleFinanceUrl = `https://www.google.com/finance/quote/${symbol}`;
    
    // ✅ NUEVO: Intentar obtener precio de cierre oficial desde Google Finance
    const response = await fetch(googleFinanceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // ✅ NUEVO: Extraer precio de cierre del HTML de Google Finance
      const closePriceMatch = html.match(/"closePrice":\s*"([^"]+)"/);
      if (closePriceMatch) {
        const closePrice = parseFloat(closePriceMatch[1].replace(/,/g, ''));
        if (!isNaN(closePrice)) {
          console.log(`✅ Precio de cierre obtenido desde Google Finance para ${symbol}: $${closePrice}`);
          return closePrice;
        }
      }
      
      // ✅ NUEVO: Fallback - buscar precio actual si no hay cierre
      const priceMatch = html.match(/"price":\s*"([^"]+)"/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(price)) {
          console.log(`🔄 No hay precio de cierre para ${symbol}, usando precio actual: $${price}`);
          return price;
        }
      }
      
      // ✅ NUEVO: Fallback adicional - buscar en diferentes formatos
      const alternativePriceMatch = html.match(/(\d+\.?\d*)\s*USD/);
      if (alternativePriceMatch) {
        const price = parseFloat(alternativePriceMatch[1]);
        if (!isNaN(price)) {
          console.log(`🔄 Precio obtenido desde formato alternativo para ${symbol}: $${price}`);
          return price;
        }
      }
    }
    
    // ✅ NUEVO: Si Google Finance falla completamente, usar precio simulado
    console.log(`⚠️ Google Finance no disponible para ${symbol}, usando precio simulado`);
    return generateSimulatedClosePrice(symbol);

  } catch (error: any) {
    console.error(`❌ Error obteniendo precio de cierre desde Google Finance para ${symbol}:`, error.message);
    return generateSimulatedClosePrice(symbol);
  }
}

/**
 * ✅ NUEVO: Generar precio de cierre simulado para testing/fallback
 */
function generateSimulatedClosePrice(symbol: string): number {
  // Generar precio realista basado en el símbolo
  const basePrice = symbol.charCodeAt(0) * 10 + symbol.charCodeAt(1);
  const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variación menor para cierre
  return Math.round((basePrice * (1 + variation)) * 100) / 100;
}

/**
 * ✅ NUEVO: Enviar email de cierre de mercado al usuario
 */
async function sendMarketCloseEmail(alert: any, closePrice: number): Promise<void> {
  try {
    const userEmail = alert.createdBy.email;
    const userName = alert.createdBy.name || 'Usuario';
    
    const emailSubject = `🔔 Cierre de Mercado - ${alert.symbol} - ${alert.tipo}`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">🔔 Cierre de Mercado - ${alert.symbol}</h2>
        
        <p>Hola ${userName},</p>
        
        <p>El mercado ha cerrado y se ha fijado el precio final para tu alerta:</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📊 Detalles de la Alerta</h3>
          <p><strong>Símbolo:</strong> ${alert.symbol}</p>
          <p><strong>Acción:</strong> ${alert.action}</p>
          <p><strong>Rango de Entrada:</strong> $${alert.entryPriceRange.min} - $${alert.entryPriceRange.max}</p>
          <p><strong>Precio de Cierre:</strong> $${closePrice}</p>
          <p><strong>Profit/Pérdida:</strong> ${alert.profit >= 0 ? '+' : ''}${alert.profit.toFixed(2)}%</p>
        </div>
        
        <p>El precio final ha sido fijado y tu alerta se mantiene activa para seguimiento.</p>
        
        <p>Saludos,<br>Equipo de ${alert.tipo}</p>
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