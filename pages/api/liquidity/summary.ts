import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Liquidity from '../../../models/Liquidity';

interface LiquiditySummaryResponse {
  success: boolean;
  data?: {
    liquidezInicial: number;      // Valor base asignado por nosotros
    liquidezTotal: number;        // INICIAL + Ganancias/Pérdidas
    liquidezDisponible: number;   // Lo que NO está asignado a alertas
    liquidezDistribuida: number;  // Lo que SÍ está asignado a alertas
    ganancia: number;             // Resultado neto (puede ser positivo o negativo)
    gananciaPorcentaje: number;   // Porcentaje de ganancia sobre la inicial
    distributions: Array<{
      alertId: string;
      symbol: string;
      allocatedAmount: number;
      shares: number;
      entryPrice: number;
      currentPrice: number;
      profitLoss: number;
      profitLossPercentage: number;
      realizedProfitLoss?: number;
      isActive: boolean;
    }>;
  };
  error?: string;
}

// Cache en memoria simple por proceso (TTL en ms)
const CACHE_TTL_MS = 30 * 1000; // 30s
const summaryCache: Record<string, { expiresAt: number; payload: LiquiditySummaryResponse['data'] }> = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LiquiditySummaryResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }

  try {
    // Validar parámetro pool
    const pool = (req.query.pool as string) as ('TraderCall' | 'SmartMoney');
    if (!pool || !['TraderCall', 'SmartMoney'].includes(pool)) {
      return res.status(400).json({ success: false, error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)" });
    }

    // Responder desde cache si está válido
    const cached = summaryCache[pool];
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ success: true, data: cached.payload });
    }

    await dbConnect();

    // Obtener TODAS las liquidez del pool
    const liquidityDocs: any[] = await Liquidity.find({ pool })
      .select({ 
        totalLiquidity: 1, 
        availableLiquidity: 1, 
        distributedLiquidity: 1,
        totalProfitLoss: 1,
        totalProfitLossPercentage: 1,
        distributions: 1 
      })
      .lean();

    console.log(`📊 [LIQUIDITY SUMMARY] Documentos encontrados para ${pool}:`, liquidityDocs.length);

    // Combinar todas las distribuciones y calcular totales
    const allDistributions: any[] = [];
    let liquidezInicialSum = 0;
    let liquidezTotalSum = 0;
    let liquidezDisponibleSum = 0;
    let liquidezDistribuidaSum = 0;
    let gananciaTotalSum = 0;

    liquidityDocs.forEach((doc) => {
      // La liquidez inicial es la liquidez total menos las ganancias/pérdidas
      const liquidezInicial = doc.totalLiquidity - (doc.totalProfitLoss || 0);
      liquidezInicialSum += liquidezInicial;
      
      liquidezTotalSum += doc.totalLiquidity || 0;
      liquidezDisponibleSum += doc.availableLiquidity || 0;
      liquidezDistribuidaSum += doc.distributedLiquidity || 0;
      gananciaTotalSum += doc.totalProfitLoss || 0;

      const activeDistributions = (doc.distributions || [])
        .filter((d: any) => d.isActive)
        .map((d: any) => ({
          alertId: d.alertId,
          symbol: d.symbol,
          allocatedAmount: d.allocatedAmount,
          shares: d.shares,
          entryPrice: d.entryPrice,
          currentPrice: d.currentPrice,
          profitLoss: d.profitLoss || 0,
          profitLossPercentage: d.profitLossPercentage || 0,
          realizedProfitLoss: d.realizedProfitLoss || 0,
          isActive: d.isActive,
        }));
      allDistributions.push(...activeDistributions);
    });

    // Consolidar distribuciones por símbolo (sumar si hay duplicados)
    const distributionMap = new Map<string, any>();
    allDistributions.forEach((dist) => {
      if (distributionMap.has(dist.symbol)) {
        const existing = distributionMap.get(dist.symbol);
        // Sumar cantidades y shares
        existing.allocatedAmount += dist.allocatedAmount;
        existing.shares += dist.shares;
        // Recalcular promedios ponderados para precios
        const totalShares = existing.shares;
        existing.entryPrice = ((existing.entryPrice * (totalShares - dist.shares)) + (dist.entryPrice * dist.shares)) / totalShares;
        existing.currentPrice = ((existing.currentPrice * (totalShares - dist.shares)) + (dist.currentPrice * dist.shares)) / totalShares;
        existing.profitLoss += dist.profitLoss;
        existing.realizedProfitLoss += (dist.realizedProfitLoss || 0);
        distributionMap.set(dist.symbol, existing);
      } else {
        distributionMap.set(dist.symbol, { ...dist });
      }
    });

    const consolidatedDistributions = Array.from(distributionMap.values());

    // Calcular porcentaje de ganancia
    const gananciaPorcentaje = liquidezInicialSum > 0 
      ? (gananciaTotalSum / liquidezInicialSum) * 100 
      : 0;

    console.log(`📊 [LIQUIDITY SUMMARY] Resumen calculado para ${pool}:`, {
      liquidezInicial: liquidezInicialSum,
      liquidezTotal: liquidezTotalSum,
      liquidezDisponible: liquidezDisponibleSum,
      liquidezDistribuida: liquidezDistribuidaSum,
      ganancia: gananciaTotalSum,
      gananciaPorcentaje,
      distributionsCount: consolidatedDistributions.length
    });

    const payload = {
      liquidezInicial: liquidezInicialSum,
      liquidezTotal: liquidezTotalSum,
      liquidezDisponible: liquidezDisponibleSum,
      liquidezDistribuida: liquidezDistribuidaSum,
      ganancia: gananciaTotalSum,
      gananciaPorcentaje,
      distributions: consolidatedDistributions
    };

    // Guardar en cache
    summaryCache[pool] = { expiresAt: Date.now() + CACHE_TTL_MS, payload };

    // Cache-Control para CDN (Vercel) y clientes
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error('Error en liquidity summary:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
