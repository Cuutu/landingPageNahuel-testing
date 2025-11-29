import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
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

    // Calcular valor actual de la cartera (tiempo real)
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

    // Calcular cuántos días de datos históricos tenemos realmente
    let availableDays = 0;
    if (oldestSnapshot && newestSnapshot) {
      const oldestDate = new Date(oldestSnapshot.snapshotDate);
      const newestDate = new Date(newestSnapshot.snapshotDate);
      availableDays = Math.floor((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    const oldestSnapshotDate = oldestSnapshot ? new Date(oldestSnapshot.snapshotDate) : null;
    const daysSinceOldest = oldestSnapshotDate 
      ? Math.floor((now.getTime() - oldestSnapshotDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    console.log(`📊 [Portfolio Returns] Datos históricos para ${poolType}:`, {
      oldestDate: oldestSnapshotDate,
      newestDate: newestSnapshot ? new Date(newestSnapshot.snapshotDate) : null,
      availableDays,
      daysSinceOldest,
      oldestValorTotalCartera: oldestSnapshot?.valorTotalCartera
    });

    for (const [periodKey, days] of Object.entries(periods)) {
      try {
        // ✅ ESCALABLE: Si el período solicitado es mayor a los días disponibles, usar el snapshot más antiguo
        if (days > availableDays && oldestSnapshot) {
          // No hay suficientes datos históricos para este período, usar el más antiguo disponible
          const valorHistorico = oldestSnapshot.valorTotalCartera;
          const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
          
          returns[periodKey] = Number(returnPercentage.toFixed(2));
          historicalValues[periodKey] = valorHistorico;
          
          console.log(`⚠️ [Portfolio Returns] ${periodKey}: Período solicitado (${days}d) > días disponibles (${availableDays}d). Usando snapshot más antiguo (${daysSinceOldest} días atrás)`);
        } else {
          // ✅ Hay suficientes datos históricos, buscar snapshot exacto para el período
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - days);
          targetDate.setHours(16, 30, 0, 0); // Normalizar a las 16:30

          // Buscar el snapshot más cercano a la fecha objetivo
          // Buscar en un rango de ±1 día para encontrar el snapshot más cercano
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
          }).sort({ snapshotDate: -1 }); // Obtener el más reciente en el rango

          if (snapshot) {
            // ✅ Caso ideal: encontramos un snapshot para el período exacto
            const valorHistorico = snapshot.valorTotalCartera;
            const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
            
            returns[periodKey] = Number(returnPercentage.toFixed(2));
            historicalValues[periodKey] = valorHistorico;
            
            console.log(`✅ [Portfolio Returns] ${periodKey}: Usando snapshot exacto del ${snapshot.snapshotDate.toISOString().split('T')[0]}`);
          } else if (days === 1 && newestSnapshot) {
            // ✅ CASO ESPECIAL: Para 1 día, si no hay snapshot de ayer (fin de semana), usar el último snapshot disponible
            // Esto maneja el caso cuando el mercado está cerrado (fines de semana)
            const valorHistorico = newestSnapshot.valorTotalCartera;
            const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
            
            returns[periodKey] = Number(returnPercentage.toFixed(2));
            historicalValues[periodKey] = valorHistorico;
            
            const newestDate = new Date(newestSnapshot.snapshotDate);
            const daysSinceNewest = Math.floor((now.getTime() - newestDate.getTime()) / (1000 * 60 * 60 * 24));
            
            console.log(`⚠️ [Portfolio Returns] ${periodKey}: No se encontró snapshot de ayer (probablemente fin de semana). Usando último snapshot disponible del ${newestDate.toISOString().split('T')[0]} (${daysSinceNewest} días atrás)`);
          } else if (oldestSnapshot) {
            // Fallback: no encontramos snapshot exacto pero hay datos históricos, usar el más antiguo
            const valorHistorico = oldestSnapshot.valorTotalCartera;
            const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
            
            returns[periodKey] = Number(returnPercentage.toFixed(2));
            historicalValues[periodKey] = valorHistorico;
            
            console.log(`⚠️ [Portfolio Returns] ${periodKey}: No se encontró snapshot exacto para ${days} días. Usando snapshot más antiguo (${daysSinceOldest} días atrás)`);
          } else {
            // ❌ No hay ningún snapshot disponible
            returns[periodKey] = null;
            historicalValues[periodKey] = null;
            
            console.log(`❌ [Portfolio Returns] ${periodKey}: No hay snapshots disponibles`);
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

  } catch (error) {
    console.error('Error calculando rendimientos de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

