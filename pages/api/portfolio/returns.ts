import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import PortfolioMetrics from '@/models/PortfolioMetrics';
import { calculateCurrentPortfolioValue, calculateReturnPercentage } from '@/lib/portfolioCalculator';

interface PortfolioReturnsResponse {
  success: boolean;
  data?: {
    valorActualCartera: number;
    returns: {
      '1d': number | null;  // Rendimiento a 1 día
      '7d': number | null;  // Rendimiento a 7 días
      '15d': number | null; // Rendimiento a 15 días
      '30d': number | null; // Rendimiento a 30 días
      '180d': number | null; // Rendimiento a 180 días
      '365d': number | null; // Rendimiento a 365 días
    };
    historicalValues: {
      '1d': number | null;
      '7d': number | null;
      '15d': number | null;
      '30d': number | null;
      '180d': number | null;
      '365d': number | null;
    };
  };
  error?: string;
  message?: string;
}

/**
 * API para obtener el rendimiento de la cartera por períodos
 * Compara el valor actual con valores históricos guardados
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PortfolioReturnsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();

    const { pool } = req.query;
    
    if (!pool || (pool !== 'TraderCall' && pool !== 'SmartMoney')) {
      return res.status(400).json({
        success: false,
        error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)"
      });
    }

    const poolType = pool as 'TraderCall' | 'SmartMoney';

    // ✅ OPTIMIZADO: Intentar obtener métricas pre-calculadas primero
    let metrics = await PortfolioMetrics.findOne({ pool: poolType });
    
    // Si las métricas son muy antiguas (> 2 minutos), recalcular como fallback
    const metricsAge = metrics ? (Date.now() - new Date(metrics.lastUpdated).getTime()) / 1000 / 60 : Infinity;
    const shouldRecalculate = !metrics || metricsAge > 2;

    if (shouldRecalculate) {
      console.log(`⚠️ [Portfolio Returns] Métricas de ${poolType} son antiguas (${metricsAge.toFixed(1)} min) o no existen, calculando...`);
      
      // Calcular valor actual de la cartera (fallback)
      const currentValue = await calculateCurrentPortfolioValue(poolType);
      const valorActualCartera = currentValue.valorTotalCartera;

      // Obtener snapshots históricos para diferentes períodos
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

      // ✅ ESCALABLE: Obtener el snapshot más antiguo y más reciente para calcular días disponibles
      const [oldestSnapshot, newestSnapshot] = await Promise.all([
        PortfolioSnapshot.findOne({
          pool: poolType
        }).sort({ snapshotDate: 1 }),
        PortfolioSnapshot.findOne({
          pool: poolType
        }).sort({ snapshotDate: -1 })
      ]);

      // Calcular cuántos días han pasado desde el snapshot más antiguo hasta ahora
      const oldestSnapshotDate = oldestSnapshot ? new Date(oldestSnapshot.snapshotDate) : null;
      const daysSinceOldest = oldestSnapshotDate 
        ? Math.floor((now.getTime() - oldestSnapshotDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      for (const [periodKey, days] of Object.entries(periods)) {
        try {
          if (days > daysSinceOldest && oldestSnapshot) {
            const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
            const historicalProfitLossPercent = oldestSnapshot.totalProfitLossPercentage || 0;
            const returnPercentage = currentProfitLossPercent - historicalProfitLossPercent;
            
            returns[periodKey] = Number(returnPercentage.toFixed(2));
            historicalValues[periodKey] = oldestSnapshot.valorTotalCartera;
          } else {
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() - days);
            targetDate.setHours(16, 30, 0, 0);

            const startDate = new Date(targetDate);
            startDate.setDate(startDate.getDate() - 1);
            
            const endDate = new Date(targetDate);
            endDate.setDate(endDate.getDate() + 1);

            const snapshot = await PortfolioSnapshot.findOne({
              pool: poolType,
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
              const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
              const historicalProfitLossPercent = newestSnapshot.totalProfitLossPercentage || 0;
              const returnPercentage = currentProfitLossPercent - historicalProfitLossPercent;
              
              returns[periodKey] = Number(returnPercentage.toFixed(2));
              historicalValues[periodKey] = newestSnapshot.valorTotalCartera;
            } else if (oldestSnapshot) {
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
          console.error(`Error calculando rendimiento para ${periodKey}:`, error);
          returns[periodKey] = null;
          historicalValues[periodKey] = null;
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          valorActualCartera,
          returns: returns as {
            '1d': number | null;
            '7d': number | null;
            '15d': number | null;
            '30d': number | null;
            '180d': number | null;
            '365d': number | null;
          },
          historicalValues: historicalValues as {
            '1d': number | null;
            '7d': number | null;
            '15d': number | null;
            '30d': number | null;
            '180d': number | null;
            '365d': number | null;
          }
        }
      });
    }

    // ✅ OPTIMIZADO: Usar métricas pre-calculadas (mucho más rápido)
    console.log(`✅ [Portfolio Returns] Usando métricas pre-calculadas de ${poolType} (actualizadas hace ${metricsAge.toFixed(1)} min)`);
    
    return res.status(200).json({
      success: true,
      data: {
        valorActualCartera: metrics.valorTotalCartera,
        returns: metrics.returns as {
          '1d': number | null;
          '7d': number | null;
          '15d': number | null;
          '30d': number | null;
          '180d': number | null;
          '365d': number | null;
        },
        historicalValues: metrics.historicalValues as {
          '1d': number | null;
          '7d': number | null;
          '15d': number | null;
          '30d': number | null;
          '180d': number | null;
          '365d': number | null;
        }
      }
    });

  } catch (error) {
    console.error('Error calculando rendimientos de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

