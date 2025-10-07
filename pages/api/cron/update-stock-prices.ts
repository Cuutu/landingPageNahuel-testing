import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';

/**
 * API para actualizar precios de acciones cada 10 minutos
 * Esta es una tarea programada que se ejecuta automáticamente
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ✅ NUEVO: Verificar que solo Vercel pueda ejecutar este cron job
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (token !== process.env.CRON_SECRET_TOKEN) {
      console.error('❌ Acceso no autorizado a cron job de actualización de precios');
      return res.status(401).json({ 
        error: 'No autorizado',
        message: 'Este endpoint solo puede ser ejecutado por Vercel Cron'
      });
    }

    console.log('✅ Cron job autorizado - Iniciando actualización de precios de acciones...');
    
    const startTime = Date.now();
    
    await dbConnect();

    // Obtener todas las alertas activas
    const activeAlerts = await Alert.find({ 
      status: 'ACTIVE',
      tipo: { $in: ['TraderCall', 'SmartMoney'] }
    }).select('symbol currentPrice entryPriceRange');

    if (activeAlerts.length === 0) {
      console.log('ℹ️ No hay alertas activas para actualizar');
      return res.status(200).json({ 
        success: true, 
        message: 'No hay alertas activas',
        updatedCount: 0,
        executionTime: Date.now() - startTime
      });
    }

    console.log(`📊 Actualizando ${activeAlerts.length} alertas activas...`);

    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Procesar cada alerta en lotes para evitar sobrecarga
    const batchSize = 10;
    for (let i = 0; i < activeAlerts.length; i += batchSize) {
      const batch = activeAlerts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (alert) => {
        try {
          // ✅ Obtener precio actual desde API externa
          const newPrice = await fetchCurrentStockPrice(alert.symbol);
          
          if (newPrice && newPrice !== alert.currentPrice) {
            // Actualizar precio solo si cambió
            alert.currentPrice = newPrice;
            alert.calculateProfit(); // Recalcular profit automáticamente
            await alert.save();
            
            updatedCount++;
            console.log(`✅ ${alert.symbol}: ${alert.currentPrice} → ${newPrice}`);
          } else if (newPrice === null) {
            // Si no se puede obtener precio real, no actualizar
            errorCount++;
            const errorMsg = `No se pudo obtener precio real para ${alert.symbol} - manteniendo precio anterior`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Error actualizando ${alert.symbol}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }));

      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < activeAlerts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Actualización completada en ${executionTime}ms`);
    console.log(`📊 Resumen: ${updatedCount} actualizadas, ${errorCount} errores`);

    // ✅ NUEVO: Log de métricas para monitoreo
    await logPriceUpdateMetrics({
      totalAlerts: activeAlerts.length,
      updatedCount,
      errorCount,
      executionTime,
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Precios actualizados correctamente',
      summary: {
        totalAlerts: activeAlerts.length,
        updatedCount,
        errorCount,
        executionTime
      },
      errors: errors.slice(0, 5) // Solo primeros 5 errores
    });

  } catch (error: any) {
    console.error('❌ Error en actualización de precios:', error);
    
    // ✅ NUEVO: Log de error para monitoreo
    await logPriceUpdateError({
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
 * ✅ MEJORADO: Obtener precio actual de una acción usando la API interna que funciona
 */
async function fetchCurrentStockPrice(symbol: string): Promise<number | null> {
  try {
    // ✅ PRIORIDAD: Usar la API interna que ya funciona correctamente con Yahoo Finance
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stock-price?symbol=${symbol}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.price && !data.isSimulated) {
        console.log(`✅ Precio REAL obtenido para ${symbol}: $${data.price} (${data.marketStatus})`);
        return data.price;
      } else if (data.price && data.isSimulated) {
        console.log(`⚠️ Precio simulado para ${symbol}: $${data.price} (${data.marketStatus}) - API falló`);
        return data.price;
      }
    }
    
    console.log(`🔄 API interna falló para ${symbol}, intentando Yahoo Finance directamente`);
    
    // ✅ FALLBACK: Intentar Yahoo Finance directamente como último recurso
    const yahooResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (yahooResponse.ok) {
      const yahooData = await yahooResponse.json();
      
      if (yahooData.chart?.result?.[0]?.meta?.regularMarketPrice) {
        const price = yahooData.chart.result[0].meta.regularMarketPrice;
        console.log(`✅ Yahoo Finance directo - ${symbol}: $${price}`);
        return parseFloat(price.toFixed(2));
      }
    }
    
    console.error(`❌ CRÍTICO: Todas las APIs fallaron para ${symbol}`);
    console.error(`❌ No se pueden obtener precios reales del mercado`);
    return null; // Retornar null en lugar de precio simulado

  } catch (error: any) {
    console.error(`❌ Error crítico obteniendo precio para ${symbol}:`, error.message);
    console.error(`❌ Sistema requiere precios reales del mercado`);
    return null; // Retornar null en lugar de precio simulado
  }
}

/**
 * ✅ ELIMINADO: No más precios simulados - solo precios reales del mercado
 * Si no se pueden obtener precios reales, el sistema debe fallar claramente
 */
function generateSimulatedPrice(symbol: string): number {
  // ❌ NO MÁS PRECIOS SIMULADOS
  // El sistema debe usar solo precios reales del mercado
  console.error(`❌ CRÍTICO: No se pueden obtener precios reales para ${symbol}`);
  console.error(`❌ El sistema no debe usar precios inventados`);
  
  // Retornar null para indicar que no hay precio disponible
  throw new Error(`No se pueden obtener precios reales para ${symbol} - sistema requiere precios dinámicos del mercado`);
}

/**
 * ✅ NUEVO: Log de métricas de actualización para monitoreo
 */
async function logPriceUpdateMetrics(metrics: {
  totalAlerts: number;
  updatedCount: number;
  errorCount: number;
  executionTime: number;
  timestamp: Date;
}) {
  try {
    // Aquí podrías guardar en una colección de métricas o enviar a un servicio de logging
    console.log('📊 Métricas de actualización:', {
      ...metrics,
      successRate: ((metrics.updatedCount / metrics.totalAlerts) * 100).toFixed(2) + '%'
    });
  } catch (error) {
    console.error('❌ Error guardando métricas:', error);
  }
}

/**
 * ✅ NUEVO: Log de errores para monitoreo
 */
async function logPriceUpdateError(errorData: {
  error: string;
  stack?: string;
  timestamp: Date;
}) {
  try {
    // Aquí podrías guardar en una colección de errores o enviar a un servicio de logging
    console.error('📊 Error de actualización registrado:', errorData);
  } catch (error) {
    console.error('❌ Error guardando log de error:', error);
  }
} 