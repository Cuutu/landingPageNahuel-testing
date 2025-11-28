import LiquiditySnapshot from "@/models/LiquiditySnapshot";
import Liquidity from "@/models/Liquidity";

/**
 * Obtiene el inicio del día en Uruguay (UTC-3)
 */
function getStartOfDayUruguay(date: Date = new Date()): Date {
  const uruguayOffset = -3 * 60;
  const utcTime = date.getTime();
  const localTime = utcTime + uruguayOffset * 60 * 1000;
  const localDate = new Date(localTime);
  localDate.setHours(0, 0, 0, 0);
  const utcStartOfDay = new Date(localDate.getTime() - uruguayOffset * 60 * 1000);
  return utcStartOfDay;
}

/**
 * Resta días a una fecha
 */
function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Resta meses a una fecha
 */
function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

/**
 * Resta años a una fecha
 */
function subtractYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - years);
  return result;
}

/**
 * Guarda un snapshot de la liquidez actual para un pool específico
 * Si ya existe un snapshot para el día de hoy, no lo sobrescribe
 */
export async function saveDailyLiquiditySnapshot(pool: "TraderCall" | "SmartMoney"): Promise<boolean> {
  try {
    const liquidity = await Liquidity.findOne({ pool });
    if (!liquidity) {
      console.log(`No se encontró liquidez para el pool ${pool}`);
      return false;
    }

    const todayStart = getStartOfDayUruguay();

    const existingSnapshot = await LiquiditySnapshot.findOne({
      pool,
      date: todayStart
    });

    if (existingSnapshot) {
      console.log(`Snapshot ya existe para ${pool} en la fecha ${todayStart.toISOString()}`);
      return false;
    }

    const snapshot = new LiquiditySnapshot({
      date: todayStart,
      pool,
      totalLiquidity: liquidity.totalLiquidity,
      availableLiquidity: liquidity.availableLiquidity,
      distributedLiquidity: liquidity.distributedLiquidity,
      totalProfitLoss: liquidity.totalProfitLoss,
      totalProfitLossPercentage: liquidity.totalProfitLossPercentage
    });

    await snapshot.save();
    console.log(`Snapshot guardado exitosamente para ${pool} en ${todayStart.toISOString()}`);
    return true;
  } catch (error) {
    console.error(`Error al guardar snapshot para ${pool}:`, error);
    throw error;
  }
}

/**
 * Busca el snapshot más cercano hacia atrás desde una fecha objetivo
 */
async function findClosestSnapshot(pool: "TraderCall" | "SmartMoney", targetDate: Date): Promise<number | null> {
  const snapshot = await LiquiditySnapshot.findOne({
    pool,
    date: { $lte: targetDate }
  })
    .sort({ date: -1 })
    .limit(1);

  return snapshot ? snapshot.totalLiquidity : null;
}

/**
 * Calcula los rendimientos para diferentes períodos de tiempo
 */
export async function calculateReturns(pool: "TraderCall" | "SmartMoney") {
  try {
    const liquidity = await Liquidity.findOne({ pool });
    if (!liquidity) {
      return null;
    }

    const todayStart = getStartOfDayUruguay();
    const currentLiquidity = liquidity.totalLiquidity;

    const periods = [
      { key: "1d", date: subtractDays(todayStart, 1) },
      { key: "7d", date: subtractDays(todayStart, 7) },
      { key: "15d", date: subtractDays(todayStart, 15) },
      { key: "30d", date: subtractDays(todayStart, 30) },
      { key: "6m", date: subtractMonths(todayStart, 6) },
      { key: "1y", date: subtractYears(todayStart, 1) }
    ];

    const returns: Record<string, number | null> = {};

    for (const period of periods) {
      const pastLiquidity = await findClosestSnapshot(pool, period.date);
      
      if (pastLiquidity === null || pastLiquidity === 0) {
        returns[period.key] = null;
      } else {
        const returnValue = ((currentLiquidity - pastLiquidity) / pastLiquidity) * 100;
        returns[period.key] = parseFloat(returnValue.toFixed(2));
      }
    }

    return {
      todayLiquidity: currentLiquidity,
      returns
    };
  } catch (error) {
    console.error(`Error al calcular rendimientos para ${pool}:`, error);
    throw error;
  }
}
