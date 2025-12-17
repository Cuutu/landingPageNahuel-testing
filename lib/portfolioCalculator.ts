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

/**
 * ✅ NUEVO: Calcula el rendimiento acumulado considerando todas las ventas parciales previas + la venta actual
 * Este cálculo usa contribución ponderada: Σ(porcentaje_vendido × ganancia_porcentual) / 100
 * 
 * @param alert - La alerta con el historial de ventas parciales
 * @param currentSalePercentage - Porcentaje vendido en la venta actual
 * @param currentSalePrice - Precio de venta de la venta actual
 * @returns Porcentaje de rendimiento acumulado (ej: 43.75 = 43.75%)
 * 
 * @example
 * // Primera venta: 25% a $50 (entrada: $40) → rendimiento: +25%
 * // Segunda venta: 75% a $60 (entrada: $40) → rendimiento: +50%
 * // Rendimiento acumulado: (25 × 25 + 75 × 50) / 100 = 43.75%
 */
export function calculateAccumulatedProfitPercentage(
  alert: any,
  currentSalePercentage: number,
  currentSalePrice: number
): number {
  const entryPrice = alert.entryPriceRange?.min || alert.entryPrice || 0;
  
  if (entryPrice <= 0 || currentSalePrice <= 0) {
    return 0;
  }
  
  // Calcular rendimiento de la venta actual
  const currentSaleProfitPercentage = ((currentSalePrice - entryPrice) / entryPrice) * 100;
  
  // Inicializar suma ponderada con la venta actual
  let weightedProfitSum = currentSalePercentage * currentSaleProfitPercentage;
  
  // Procesar ventas parciales ejecutadas previas (sistema nuevo)
  // ✅ IMPORTANTE: Solo contar ventas ejecutadas ANTES de la venta actual
  // Si la venta actual ya está guardada en partialSales, la excluimos para evitar duplicados
  if (alert.liquidityData?.partialSales && Array.isArray(alert.liquidityData.partialSales)) {
    const executedSales = alert.liquidityData.partialSales.filter(
      (sale: any) => {
        // Solo incluir ventas ejecutadas y no descartadas
        if (!sale.executed || sale.discarded) return false;
        
        // ✅ EXCLUIR la venta actual si coincide (mismo porcentaje y precio aproximado)
        // Esto evita contar la venta dos veces si ya está guardada en el historial
        const isCurrentSale = Math.abs(sale.percentage - currentSalePercentage) < 0.01 &&
                              Math.abs(sale.sellPrice - currentSalePrice) < 0.01;
        return !isCurrentSale;
      }
    );
    
    executedSales.forEach((sale: any) => {
      const salePercentage = sale.percentage || 0;
      const saleSellPrice = sale.sellPrice || 0;
      
      if (saleSellPrice > 0 && entryPrice > 0) {
        // Calcular ganancia porcentual de esta venta específica
        const saleProfitPercentage = ((saleSellPrice - entryPrice) / entryPrice) * 100;
        
        // Acumular para contribución ponderada
        weightedProfitSum += salePercentage * saleProfitPercentage;
      }
    });
  }
  
  // Procesar ventas de ventasParciales (sistema legacy) - COMBINAR con las anteriores
  if (alert.ventasParciales && Array.isArray(alert.ventasParciales) && alert.ventasParciales.length > 0) {
    alert.ventasParciales.forEach((venta: any) => {
      const ventaPercentage = venta.porcentajeVendido || 0;
      const ventaProfitPercentage = venta.gananciaRealizada || 0;
      
      // Acumular para contribución ponderada
      weightedProfitSum += ventaPercentage * ventaProfitPercentage;
    });
  }
  
  // Calcular contribución ponderada dividiendo por 100 (inversión original)
  // Ejemplo: Si vendí 25% a +25% y 75% a +50% → (25 × 25 + 75 × 50) / 100 = 43.75%
  const accumulatedProfit = weightedProfitSum / 100;
  
  return accumulatedProfit;
}

