import dbConnect from '@/lib/mongodb';
import Liquidity from '@/models/Liquidity';
import Alert from '@/models/Alert';

export interface PortfolioValue {
  valorTotalCartera: number;
  liquidezInicial: number;
  liquidezTotal: number;
  liquidezDisponible: number;
  liquidezDistribuida: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
}

/**
 * Calcula el valor actual de la cartera para un pool específico
 * Este valor se actualiza en tiempo real a medida que las alertas fluctúan
 */
export async function calculateCurrentPortfolioValue(pool: 'TraderCall' | 'SmartMoney'): Promise<PortfolioValue> {
  await dbConnect();

  // Obtener todos los documentos de liquidez del pool (no solo del admin, sino de todo el pool)
  const liquidityDocs: any[] = await Liquidity.find({ pool }).lean();

  // Calcular liquidez inicial global
  let liquidezInicialGlobal = 0;
  const docsWithInitialLiquidity = liquidityDocs.filter((doc: any) => 
    doc.initialLiquidity !== undefined && doc.initialLiquidity !== null && doc.initialLiquidity > 0
  );

  if (docsWithInitialLiquidity.length > 0) {
    const sortedByUpdate = [...docsWithInitialLiquidity].sort((a: any, b: any) => 
      new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
    liquidezInicialGlobal = sortedByUpdate[0].initialLiquidity;
  } else if (liquidityDocs.length > 0) {
    const firstDoc = liquidityDocs[0];
    liquidezInicialGlobal = firstDoc.totalLiquidity - (firstDoc.totalProfitLoss || 0);
  }

  // Si no hay liquidez configurada, loguear un warning pero continuar con 0
  if (liquidezInicialGlobal === 0 && liquidityDocs.length === 0) {
    console.warn(`⚠️ [PORTFOLIO] No hay documentos de liquidez configurados para el pool ${pool}. El valor de la cartera será 0.`);
  }

  // Calcular totales de todas las distribuciones
  let liquidezDistribuidaSum = 0;
  let gananciaTotalSum = 0;

  liquidityDocs.forEach((doc: any) => {
    liquidezDistribuidaSum += doc.distributedLiquidity || 0;
    gananciaTotalSum += doc.totalProfitLoss || 0;
  });

  // Calcular liquidez total y disponible
  const liquidezTotal = liquidezInicialGlobal + gananciaTotalSum;
  const liquidezDisponible = liquidezTotal - liquidezDistribuidaSum;

  // El valor total de la cartera es: liquidez inicial + ganancias/pérdidas
  // Esto es equivalente a: liquidezTotal
  const valorTotalCartera = liquidezTotal;

  // Calcular porcentaje de ganancia
  const totalProfitLossPercentage = liquidezInicialGlobal > 0 
    ? (gananciaTotalSum / liquidezInicialGlobal) * 100 
    : 0;

  return {
    valorTotalCartera,
    liquidezInicial: liquidezInicialGlobal,
    liquidezTotal,
    liquidezDisponible,
    liquidezDistribuida: liquidezDistribuidaSum,
    totalProfitLoss: gananciaTotalSum,
    totalProfitLossPercentage
  };
}

/**
 * Calcula el rendimiento de la cartera comparando con un valor histórico
 * @param valorActual Valor actual de la cartera
 * @param valorHistorico Valor histórico de la cartera
 * @returns Porcentaje de rendimiento (ej: 10 = 10%)
 */
export function calculateReturnPercentage(valorActual: number, valorHistorico: number): number {
  if (valorHistorico === 0) {
    return 0;
  }
  return ((valorActual / valorHistorico) - 1) * 100;
}

