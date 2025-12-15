import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import PortfolioMetrics from '@/models/PortfolioMetrics';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';
import User from '@/models/User';
import { calculateCurrentPortfolioValue, calculateReturnPercentage } from '@/lib/portfolioCalculator';

interface CalculateMetricsResponse {
  success: boolean;
  message: string;
  processed?: {
    TraderCall?: boolean;
    SmartMoney?: boolean;
  };
}

/**
 * Calcula y guarda métricas del portfolio cada minuto
 * Este CRON ejecuta todos los cálculos pesados y guarda los resultados
 * para que las APIs solo lean y devuelvan valores pre-calculados
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CalculateMetricsResponse>
) {
  // Permitir GET para cronjobs externos
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
    console.log('🌐 CRON PÚBLICO DETECTADO (calculate-portfolio-metrics):', {
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.url
    });
  }

  try {
    await dbConnect();
    console.log('🔄 CRON: Iniciando cálculo de métricas del portfolio...');

    const pools: ('TraderCall' | 'SmartMoney')[] = ['TraderCall', 'SmartMoney'];
    const processed: { TraderCall?: boolean; SmartMoney?: boolean } = {};

    for (const pool of pools) {
      try {
        console.log(`\n📊 Procesando métricas para ${pool}...`);
        
        // 1. Calcular valor actual de la cartera
        const currentValue = await calculateCurrentPortfolioValue(pool);
        console.log(`✅ Valor actual calculado: $${currentValue.valorTotalCartera.toFixed(2)}`);

        // 2. Calcular estadísticas de alertas
        const allAlerts = await Alert.find({ tipo: pool }).lean();
        const activeAlerts = allAlerts.filter((a: any) => a.status === 'ACTIVE');
        const closedAlerts = allAlerts.filter((a: any) => a.status === 'CLOSED');
        
        // Calcular winRate de alertas cerradas
        let winRate = 0;
        if (closedAlerts.length > 0) {
          const winningAlerts = closedAlerts.filter((a: any) => (a.profit || 0) > 0);
          winRate = (winningAlerts.length / closedAlerts.length) * 100;
        }

        // Calcular totalProfit (suma de profit de alertas cerradas)
        const totalProfit = closedAlerts.reduce((sum, alert: any) => {
          return sum + (alert.profit || 0);
        }, 0);

        console.log(`✅ Estadísticas de alertas: ${allAlerts.length} total, ${activeAlerts.length} activas, ${closedAlerts.length} cerradas, WinRate: ${winRate.toFixed(2)}%`);

        // 3. Calcular rendimientos por períodos usando snapshots históricos
        const now = new Date();
        const periods = {
          '1d': 1,
          '7d': 7,
          '15d': 15,
          '30d': 30,
          '180d': 180,
          '365d': 365
        };

        const returns: Record<string, number | null> = {};
        const historicalValues: Record<string, number | null> = {};

        // Obtener snapshots más antiguo y más reciente
        const [oldestSnapshot, newestSnapshot] = await Promise.all([
          PortfolioSnapshot.findOne({ pool }).sort({ snapshotDate: 1 }),
          PortfolioSnapshot.findOne({ pool }).sort({ snapshotDate: -1 })
        ]);

        const oldestSnapshotDate = oldestSnapshot ? new Date(oldestSnapshot.snapshotDate) : null;
        const daysSinceOldest = oldestSnapshotDate 
          ? Math.floor((now.getTime() - oldestSnapshotDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        for (const [periodKey, days] of Object.entries(periods)) {
          try {
            if (days > daysSinceOldest && oldestSnapshot) {
              // Período excede días disponibles, usar snapshot más antiguo
              const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
              const historicalProfitLossPercent = oldestSnapshot.totalProfitLossPercentage || 0;
              const returnPercentage = currentProfitLossPercent - historicalProfitLossPercent;
              
              returns[periodKey] = Number(returnPercentage.toFixed(2));
              historicalValues[periodKey] = oldestSnapshot.valorTotalCartera;
            } else {
              // Buscar snapshot para el período específico
              const targetDate = new Date(now);
              targetDate.setDate(targetDate.getDate() - days);
              targetDate.setHours(16, 30, 0, 0);

              const startDate = new Date(targetDate);
              startDate.setDate(startDate.getDate() - 1);
              
              const endDate = new Date(targetDate);
              endDate.setDate(endDate.getDate() + 1);

              const snapshot = await PortfolioSnapshot.findOne({
                pool,
                snapshotDate: {
                  $gte: startDate,
                  $lte: endDate
                }
              }).sort({ snapshotDate: 1 });

              if (snapshot) {
                const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
                const historicalProfitLossPercent = snapshot.totalProfitLossPercentage || 0;
                const returnPercentage = currentProfitLossPercent - historicalProfitLossPercent;
                
                returns[periodKey] = Number(returnPercentage.toFixed(2));
                historicalValues[periodKey] = snapshot.valorTotalCartera;
              } else if (days === 1 && newestSnapshot) {
                // Caso especial: 1 día sin snapshot (fin de semana)
                const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
                const historicalProfitLossPercent = newestSnapshot.totalProfitLossPercentage || 0;
                const returnPercentage = currentProfitLossPercent - historicalProfitLossPercent;
                
                returns[periodKey] = Number(returnPercentage.toFixed(2));
                historicalValues[periodKey] = newestSnapshot.valorTotalCartera;
              } else if (oldestSnapshot) {
                // Fallback: usar snapshot más antiguo
                const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
                const historicalProfitLossPercent = oldestSnapshot.totalProfitLossPercentage || 0;
                const returnPercentage = currentProfitLossPercent - historicalProfitLossPercent;
                
                returns[periodKey] = Number(returnPercentage.toFixed(2));
                historicalValues[periodKey] = oldestSnapshot.valorTotalCartera;
              } else {
                returns[periodKey] = null;
                historicalValues[periodKey] = null;
              }
            }
          } catch (error) {
            console.error(`❌ Error calculando rendimiento para ${periodKey}:`, error);
            returns[periodKey] = null;
            historicalValues[periodKey] = null;
          }
        }

        console.log(`✅ Rendimientos calculados:`, returns);

        // 4. Guardar o actualizar métricas en la base de datos
        const metricsData = {
          pool,
          valorTotalCartera: currentValue.valorTotalCartera,
          liquidezInicial: currentValue.liquidezInicial,
          liquidezTotal: currentValue.liquidezTotal,
          liquidezDisponible: currentValue.liquidezDisponible,
          liquidezDistribuida: currentValue.liquidezDistribuida,
          totalProfitLoss: currentValue.totalProfitLoss,
          totalProfitLossPercentage: currentValue.totalProfitLossPercentage,
          totalAlerts: allAlerts.length,
          activeAlerts: activeAlerts.length,
          closedAlerts: closedAlerts.length,
          winRate: Number(winRate.toFixed(2)),
          totalProfit: Number(totalProfit.toFixed(2)),
          returns: returns as any,
          historicalValues: historicalValues as any,
          lastUpdated: new Date()
        };

        // Usar upsert para crear o actualizar
        await PortfolioMetrics.findOneAndUpdate(
          { pool },
          metricsData,
          { upsert: true, new: true }
        );

        console.log(`✅ Métricas de ${pool} guardadas exitosamente`);
        processed[pool] = true;

      } catch (poolError) {
        console.error(`❌ Error procesando métricas para ${pool}:`, poolError);
        processed[pool] = false;
      }
    }

    const responseMessage = isCronJobOrg 
      ? 'OK'
      : `OK - Métricas calculadas para ${Object.values(processed).filter(Boolean).length} pools`;

    return res.status(200).json({
      success: true,
      message: responseMessage,
      processed
    });

  } catch (error) {
    console.error('❌ CRON: Error calculando métricas del portfolio:', error);
    return res.status(200).json({
      success: true,
      message: 'OK',
      processed: {}
    });
  }
}

