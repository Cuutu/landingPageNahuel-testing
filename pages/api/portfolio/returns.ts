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

    // Calcular cuántos días han pasado desde el snapshot más antiguo hasta ahora
    const oldestSnapshotDate = oldestSnapshot ? new Date(oldestSnapshot.snapshotDate) : null;
    const daysSinceOldest = oldestSnapshotDate 
      ? Math.floor((now.getTime() - oldestSnapshotDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calcular cuántos días de datos históricos tenemos (entre el más antiguo y el más reciente)
    let availableDays = 0;
    if (oldestSnapshot && newestSnapshot) {
      const oldestDate = new Date(oldestSnapshot.snapshotDate);
      const newestDate = new Date(newestSnapshot.snapshotDate);
      availableDays = Math.floor((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    console.log(`📊 [Portfolio Returns] Datos históricos para ${poolType}:`, {
      oldestDate: oldestSnapshotDate,
      newestDate: newestSnapshot ? new Date(newestSnapshot.snapshotDate) : null,
      availableDays,
      daysSinceOldest,
      oldestValorTotalCartera: oldestSnapshot?.valorTotalCartera
    });

    for (const [periodKey, days] of Object.entries(periods)) {
      try {
        // ✅ CORREGIDO: Si el período solicitado es mayor a los días desde el snapshot más antiguo, usar el snapshot más antiguo
        // Esto asegura que siempre usemos el máximo período disponible cuando se solicita un período más largo
        if (days > daysSinceOldest && oldestSnapshot) {
          // El período solicitado excede los días disponibles desde el snapshot más antiguo
          // Usar el snapshot más antiguo disponible para mostrar el máximo período posible
          const valorHistorico = oldestSnapshot.valorTotalCartera;
          const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico); 
          
          returns[periodKey] = Number(returnPercentage.toFixed(2));
          historicalValues[periodKey] = valorHistorico;
          
          console.log(`⚠️ [Portfolio Returns] ${periodKey}: Período solicitado (${days}d) > días desde snapshot más antiguo (${daysSinceOldest}d). Usando snapshot más antiguo disponible`);
        } else {
          // ✅ CORREGIDO: Buscar snapshot más cercano a la fecha objetivo (no el más reciente en el rango)
          const targetDate = new Date(now);
          targetDate.setDate(targetDate.getDate() - days);
          targetDate.setHours(16, 30, 0, 0); // Normalizar a las 16:30

          // Buscar snapshots en un rango de ±2 días para encontrar el más cercano
          const startDate = new Date(targetDate);
          startDate.setDate(startDate.getDate() - 2);
          
          const endDate = new Date(targetDate);
          endDate.setDate(endDate.getDate() + 2);

          // Obtener todos los snapshots en el rango y encontrar el más cercano
          const snapshotsInRange = await PortfolioSnapshot.find({
            pool: poolType,
            snapshotDate: {
              $gte: startDate,
              $lte: endDate
            }
          }).sort({ snapshotDate: 1 }).lean();

          let snapshot: any = null;
          let minDaysDifference = Infinity;

          // Encontrar el snapshot más cercano a la fecha objetivo
          for (const snap of snapshotsInRange) {
            const snapDate = new Date(snap.snapshotDate);
            const daysDifference = Math.abs((targetDate.getTime() - snapDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDifference < minDaysDifference) {
              minDaysDifference = daysDifference;
              snapshot = snap;
            }
          }

          // ✅ CORREGIDO: Solo usar el snapshot si está dentro de 2 días de diferencia
          // Si la diferencia es mayor, es mejor calcular desde portfolio-evolution
          if (snapshot && minDaysDifference <= 2) {
            const valorHistorico = snapshot.valorTotalCartera;
            const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
            
            returns[periodKey] = Number(returnPercentage.toFixed(2));
            historicalValues[periodKey] = valorHistorico;
            
            const snapshotDate = new Date(snapshot.snapshotDate);
            const actualDaysDifference = Math.floor((now.getTime() - snapshotDate.getTime()) / (1000 * 60 * 60 * 24));
            
            console.log(`✅ [Portfolio Returns] ${periodKey}: Usando snapshot del ${snapshotDate.toISOString().split('T')[0]} (${actualDaysDifference} días atrás, diferencia: ${minDaysDifference.toFixed(1)} días)`);
          } else if (days === 1 && newestSnapshot) {
            // ✅ CASO ESPECIAL: Para 1 día, si no hay snapshot de ayer (fin de semana), usar el último snapshot disponible
            // Esto maneja el caso cuando el mercado está cerrado (fines de semana)
            const newestDate = new Date(newestSnapshot.snapshotDate);
            const daysSinceNewest = Math.floor((now.getTime() - newestDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Solo usar si tiene menos de 3 días de diferencia (para manejar fines de semana)
            if (daysSinceNewest <= 3) {
              const valorHistorico = newestSnapshot.valorTotalCartera;
              const returnPercentage = calculateReturnPercentage(valorActualCartera, valorHistorico);
              
              returns[periodKey] = Number(returnPercentage.toFixed(2));
              historicalValues[periodKey] = valorHistorico;
              
              console.log(`⚠️ [Portfolio Returns] ${periodKey}: No se encontró snapshot de ayer (probablemente fin de semana). Usando último snapshot disponible del ${newestDate.toISOString().split('T')[0]} (${daysSinceNewest} días atrás)`);
            } else {
              // Si el snapshot más reciente es muy antiguo, no usar (devolver null)
              returns[periodKey] = null;
              historicalValues[periodKey] = null;
              console.log(`⚠️ [Portfolio Returns] ${periodKey}: El snapshot más reciente es muy antiguo (${daysSinceNewest} días). No se puede calcular rendimiento confiable.`);
            }
          } else {
            // ✅ CORREGIDO: Si no hay snapshot cercano, devolver null
            // Los componentes frontend usarán el cálculo desde portfolio-evolution directamente
            // Esto evita usar fetch dentro del endpoint y mantiene la lógica separada
            returns[periodKey] = null;
            historicalValues[periodKey] = null;
            
            console.log(`⚠️ [Portfolio Returns] ${periodKey}: No se encontró snapshot cercano (dentro de 2 días). Los componentes usarán cálculo desde portfolio-evolution`);
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

