import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';

/**
 * Obtiene el inicio del día en Uruguay (UTC-3)
 */
function getStartOfDayUruguay(date: Date = new Date()): Date {
  const uruguayOffset = -3 * 60; // UTC-3 en minutos
  const utcTime = date.getTime();
  const localTime = utcTime + uruguayOffset * 60 * 1000;
  const localDate = new Date(localTime);
  localDate.setHours(0, 0, 0, 0);
  const utcStartOfDay = new Date(localDate.getTime() - uruguayOffset * 60 * 1000);
  return utcStartOfDay;
}

/**
 * API para guardar el valor de la cartera diariamente a las 16:30
 * Este endpoint se ejecuta automáticamente mediante cron job externo (cron-job.org)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitir GET para cronjobs externos (cron-job.org) y POST para otros usos
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido. Use GET o POST.' 
    });
  }

  try {
    // ✅ NUEVO: Detectar cron jobs externos por User-Agent
    const authHeader = req.headers.authorization;
    const userAgent = req.headers['user-agent'] || '';
    const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN;
    
    // Permitir acceso manual para testing (solo en desarrollo)
    const isManualTest = req.query.test === 'true' && process.env.NODE_ENV === 'development';
    
    // Permitir cron jobs externos sin token, o con token correcto
    if (!isManualTest && cronSecret && authHeader !== `Bearer ${cronSecret}` && !isCronJobOrg) {
      console.error('❌ Acceso no autorizado a cron job de snapshot de cartera');
      return res.status(401).json({ 
        success: false,
        error: 'No autorizado',
        message: 'Este endpoint requiere autenticación o debe ser ejecutado desde cron-job.org'
      });
    }
    
    if (isCronJobOrg) {
      console.log('🌐 CRON PÚBLICO DETECTADO (save-portfolio-snapshot):', {
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        method: req.method,
        url: req.url
      });
    }

    console.log('✅ Cron job autorizado - Iniciando guardado de snapshot de cartera...');
    
    const startTime = Date.now();
    await dbConnect();

    // Crear fecha normalizada al inicio del día en Uruguay
    const todayStart = getStartOfDayUruguay();
    const snapshotDate = new Date(todayStart);
    snapshotDate.setHours(16, 30, 0, 0); // 16:30:00 hora de Uruguay

    const pools: ('TraderCall' | 'SmartMoney')[] = ['TraderCall', 'SmartMoney'];
    const results = [];

    for (const pool of pools) {
      try {
        console.log(`📊 Calculando valor de cartera para ${pool}...`);
        
        // ✅ NUEVO: Actualizar precios de alertas activas antes de calcular el valor
        console.log(`🔄 Actualizando precios de alertas activas para ${pool}...`);
        await updatePricesForPool(pool);
        
        // Calcular valor actual de la cartera
        const portfolioValue = await calculateCurrentPortfolioValue(pool);
        
        // Log detallado del cálculo
        console.log(`📊 [${pool}] Valores calculados:`, {
          valorTotalCartera: portfolioValue.valorTotalCartera,
          liquidezInicial: portfolioValue.liquidezInicial,
          liquidezTotal: portfolioValue.liquidezTotal,
          liquidezDistribuida: portfolioValue.liquidezDistribuida,
          totalProfitLoss: portfolioValue.totalProfitLoss
        });

        // Verificar si ya existe un snapshot para esta fecha y pool
        // Buscar exactamente por la fecha normalizada (inicio del día en Uruguay)
        const existingSnapshot = await PortfolioSnapshot.findOne({
          pool,
          snapshotDate: {
            $gte: todayStart,
            $lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) // Menos de 24 horas después
          }
        });

        if (existingSnapshot) {
          // Actualizar snapshot existente
          existingSnapshot.valorTotalCartera = portfolioValue.valorTotalCartera;
          existingSnapshot.liquidezInicial = portfolioValue.liquidezInicial;
          existingSnapshot.liquidezTotal = portfolioValue.liquidezTotal;
          existingSnapshot.liquidezDisponible = portfolioValue.liquidezDisponible;
          existingSnapshot.liquidezDistribuida = portfolioValue.liquidezDistribuida;
          existingSnapshot.totalProfitLoss = portfolioValue.totalProfitLoss;
          existingSnapshot.totalProfitLossPercentage = portfolioValue.totalProfitLossPercentage;
          await existingSnapshot.save();
          
          console.log(`✅ Snapshot actualizado para ${pool}: $${portfolioValue.valorTotalCartera.toFixed(2)}`);
          results.push({
            pool,
            action: 'updated',
            valorTotalCartera: portfolioValue.valorTotalCartera
          });
        } else {
          // Crear nuevo snapshot
          const snapshot = new PortfolioSnapshot({
            pool,
            valorTotalCartera: portfolioValue.valorTotalCartera,
            liquidezInicial: portfolioValue.liquidezInicial,
            liquidezTotal: portfolioValue.liquidezTotal,
            liquidezDisponible: portfolioValue.liquidezDisponible,
            liquidezDistribuida: portfolioValue.liquidezDistribuida,
            totalProfitLoss: portfolioValue.totalProfitLoss,
            totalProfitLossPercentage: portfolioValue.totalProfitLossPercentage,
            snapshotDate
          });
          
          await snapshot.save();
          
          console.log(`✅ Snapshot creado para ${pool}: $${portfolioValue.valorTotalCartera.toFixed(2)}`);
          results.push({
            pool,
            action: 'created',
            valorTotalCartera: portfolioValue.valorTotalCartera
          });
        }
      } catch (error) {
        console.error(`❌ Error procesando ${pool}:`, error);
        results.push({
          pool,
          action: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'Snapshots de cartera guardados correctamente',
      results,
      executionTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en cron job de snapshot de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * Actualiza los precios de las alertas activas de un pool y sus distribuciones de liquidez
 */
async function updatePricesForPool(pool: 'TraderCall' | 'SmartMoney'): Promise<void> {
  try {
    // Obtener alertas activas del pool
    const activeAlerts = await Alert.find({
      status: 'ACTIVE',
      tipo: pool
    });

    if (activeAlerts.length === 0) {
      console.log(`ℹ️ No hay alertas activas para ${pool}`);
      return;
    }

    console.log(`🔄 Actualizando ${activeAlerts.length} alertas activas para ${pool}...`);

    // Procesar en lotes para evitar sobrecarga
    const batchSize = 5;
    for (let i = 0; i < activeAlerts.length; i += batchSize) {
      const batch = activeAlerts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (alert) => {
        try {
          // Obtener precio actual
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stock-price?symbol=${alert.symbol}`, {
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (response.ok) {
            const data = await response.json();
            const newPrice = data.price;

            if (newPrice && !data.isSimulated) {
              // Actualizar precio en la alerta
              alert.currentPrice = newPrice;
              alert.calculateProfit();
              await alert.save();

              // Actualizar distribuciones de liquidez
              const liquidityDocs = await Liquidity.find({
                pool,
                'distributions.alertId': alert._id.toString()
              });

              for (const liquidityDoc of liquidityDocs) {
                const distribution = liquidityDoc.distributions.find(
                  (d: any) => d.alertId.toString() === alert._id.toString()
                );

                if (distribution && distribution.isActive) {
                  liquidityDoc.updateDistribution(alert._id.toString(), newPrice);
                  await liquidityDoc.save();
                }
              }
            }
          }
        } catch (error) {
          console.error(`⚠️ Error actualizando precio para ${alert.symbol}:`, error);
          // Continuar con la siguiente alerta
        }
      }));
    }

    console.log(`✅ Precios actualizados para ${pool}`);
  } catch (error) {
    console.error(`❌ Error actualizando precios para ${pool}:`, error);
    // No lanzar error para que el snapshot se guarde de todas formas
  }
}

