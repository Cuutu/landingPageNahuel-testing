import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import PortfolioMetrics from '@/models/PortfolioMetrics';
import { calculateCurrentPortfolioValue, calculateReturnPercentage } from '@/lib/portfolioCalculator';
import { respondWithMongoCache } from '@/lib/apiMongoCache';

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
    // ✅ TTL dinámico igual que portfolio-evolution para mantener consistencia
    const { pool, days } = req.query;
    const daysNum = days ? parseInt(days as string) : null;
    
    // Mismo TTL que portfolio-evolution según período
    let ttlSeconds = 60; // Default: 7 y 15 días
    let cacheControl = 's-maxage=60, stale-while-revalidate=120';
    
    if (daysNum !== null) {
      if (daysNum >= 365) {
        // 1 año: 30 minutos
        ttlSeconds = 1800;
        cacheControl = 's-maxage=1800, stale-while-revalidate=3600';
      } else if (daysNum >= 180) {
        // 6 meses: 15 minutos
        ttlSeconds = 900;
        cacheControl = 's-maxage=900, stale-while-revalidate=1800';
      } else if (daysNum >= 30) {
        // 30 días: 5 minutos
        ttlSeconds = 300;
        cacheControl = 's-maxage=300, stale-while-revalidate=600';
      }
    } else {
      // Si no se pasa days, usar TTL largo por defecto (incluye períodos largos)
      ttlSeconds = 1800;
      cacheControl = 's-maxage=1800, stale-while-revalidate=3600';
    }
    
    await respondWithMongoCache(
      req,
      res,
      { ttlSeconds, scope: 'public', cacheControl },
      async () => {
        await dbConnect();

        if (!pool || (pool !== 'TraderCall' && pool !== 'SmartMoney')) {
          return {
            success: false,
            error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)",
          } satisfies PortfolioReturnsResponse;
        }

        const poolType = pool as 'TraderCall' | 'SmartMoney';

        // ✅ OPTIMIZADO: Intentar obtener métricas pre-calculadas primero
        let metrics = await PortfolioMetrics.findOne({ pool: poolType });

        // Si las métricas son muy antiguas (> 2 minutos), recalcular como fallback
        const metricsAge = metrics ? (Date.now() - new Date(metrics.lastUpdated).getTime()) / 1000 / 60 : null;
        const shouldRecalculate = !metrics || (metricsAge !== null && metricsAge > 2);

        if (shouldRecalculate) {
          const ageMessage = metricsAge !== null ? `${metricsAge.toFixed(1)} min` : 'no existen';
          console.log(`⚠️ [Portfolio Returns] Métricas de ${poolType} son antiguas (${ageMessage}), calculando...`);

          const currentValue = await calculateCurrentPortfolioValue(poolType);
          const valorActualCartera = currentValue.valorTotalCartera;

          const now = new Date();
          const periods = { '1d': 1, '7d': 7, '15d': 15, '30d': 30, '180d': 180, '365d': 365 };

          const returns: Record<string, number | null> = {};
          const historicalValues: Record<string, number | null> = {};

          const [oldestSnapshot, newestSnapshot] = await Promise.all([
            PortfolioSnapshot.findOne({ pool: poolType }).sort({ snapshotDate: 1 }),
            PortfolioSnapshot.findOne({ pool: poolType }).sort({ snapshotDate: -1 }),
          ]);

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
                  snapshotDate: { $gte: startDate, $lte: endDate },
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

          return {
            success: true,
            data: {
              valorActualCartera,
              returns: returns as any,
              historicalValues: historicalValues as any,
            },
          } satisfies PortfolioReturnsResponse;
        }

        if (!metrics || metricsAge === null) {
          return { success: false, error: 'Error inesperado: métricas no disponibles' } satisfies PortfolioReturnsResponse;
        }

        console.log(`✅ [Portfolio Returns] Usando métricas pre-calculadas de ${poolType} (actualizadas hace ${metricsAge.toFixed(1)} min)`);

        return {
          success: true,
          data: {
            valorActualCartera: metrics.valorTotalCartera,
            returns: metrics.returns as any,
            historicalValues: metrics.historicalValues as any,
          },
        } satisfies PortfolioReturnsResponse;
      }
    );
    return;

  } catch (error) {
    console.error('Error calculando rendimientos de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

