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

    for (const [periodKey, days] of Object.entries(periods)) {
      try {
        // Calcular fecha objetivo (días atrás)
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
          const valorHistorico = snapshot.valorTotalCartera;
          const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
          
          returns[periodKey] = Number(returnPercentage.toFixed(2));
          historicalValues[periodKey] = valorHistorico;
        } else {
          // Si no hay snapshot, buscar el más antiguo disponible
          const oldestSnapshot = await PortfolioSnapshot.findOne({
            pool: poolType
          }).sort({ snapshotDate: 1 });

          if (oldestSnapshot && oldestSnapshot.snapshotDate <= targetDate) {
            // Si el snapshot más antiguo es anterior a la fecha objetivo, usarlo
            const valorHistorico = oldestSnapshot.valorTotalCartera;
            const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
            
            returns[periodKey] = Number(returnPercentage.toFixed(2));
            historicalValues[periodKey] = valorHistorico;
          } else {
            // No hay datos históricos suficientes
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

  } catch (error) {
    console.error('Error calculando rendimientos de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

