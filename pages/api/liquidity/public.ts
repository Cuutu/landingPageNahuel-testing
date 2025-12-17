import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Liquidity from '../../../models/Liquidity';
import User from '@/models/User';
import { respondWithMongoCache } from '@/lib/apiMongoCache';

interface PublicLiquidityResponse {
  success: boolean;
  data?: {
    totalLiquidity: number;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicLiquidityResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }

  try {
    await respondWithMongoCache(
      req,
      res,
      { ttlSeconds: 60, scope: 'public', cacheControl: 's-maxage=60, stale-while-revalidate=120' },
      async () => {
        // Validar parámetro pool
        const pool = (req.query.pool as string) as 'TraderCall' | 'SmartMoney';
        if (!pool || !['TraderCall', 'SmartMoney'].includes(pool)) {
          return { success: false, error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)" } as PublicLiquidityResponse;
        }

        await dbConnect();

    // ✅ CAMBIO: Obtener TODAS las liquidez del pool, sin importar quién las creó
    const liquidityDocs: any[] = await Liquidity.find({ pool })
      .select({ totalLiquidity: 1, distributions: 1 })
      .lean();

    console.log(`📊 [PUBLIC LIQUIDITY] Documentos de liquidez encontrados para ${pool}:`, liquidityDocs.length);

    // Combinar todas las distribuciones de todos los admins
    const allDistributions: any[] = [];
    let totalLiquiditySum = 0;

    liquidityDocs.forEach((doc) => {
      totalLiquiditySum += doc.totalLiquidity || 0;
      const activeDistributions = (doc.distributions || [])
        .filter((d: any) => d.isActive)
        .map((d: any) => ({
          // ✅ CORREGIDO: Convertir alertId a string para asegurar consistencia con el frontend
          alertId: d.alertId ? d.alertId.toString() : d.alertId,
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

    console.log(`📊 [PUBLIC LIQUIDITY] Distribuciones consolidadas:`, {
      totalLiquidity: totalLiquiditySum,
      distributionsCount: consolidatedDistributions.length,
      symbols: consolidatedDistributions.map(d => d.symbol)
    });

    const payload = {
      totalLiquidity: totalLiquiditySum,
      distributions: consolidatedDistributions
    };

        return { success: true, data: payload } as PublicLiquidityResponse;
      }
    );
    return;
  } catch (error) {
    console.error('Error en liquidity public:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
} 