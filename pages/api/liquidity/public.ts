import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Liquidity from '../../../models/Liquidity';
import User from '@/models/User';

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

// Cache en memoria simple por proceso (TTL en ms)
const CACHE_TTL_MS = 60 * 1000; // 60s
const liquidityCache: Record<string, { expiresAt: number; payload: PublicLiquidityResponse['data'] }> = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicLiquidityResponse>
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
    const cached = liquidityCache[pool];
    if (cached && cached.expiresAt > Date.now()) {
      // Permitir caché público en Vercel/Edge
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ success: true, data: cached.payload });
    }

    await dbConnect();

    // Determinar owner por ADMIN_EMAIL para evitar buscar el usuario cada request de cliente
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return res.status(500).json({ success: false, error: 'ADMIN_EMAIL no configurado' });
    }

    const adminUser = await User.findOne({ email: adminEmail }).select('_id').lean();
    if (!adminUser || Array.isArray(adminUser)) {
      return res.status(404).json({ success: false, error: 'Admin no encontrado' });
    }

    // Consultar solo campos necesarios y en modo lean para menor overhead
    const liquidityDoc: any = await Liquidity.findOne({ createdBy: (adminUser as any)._id, pool })
      .select({ totalLiquidity: 1, distributions: 1 })
      .lean();

    const payload = !liquidityDoc
      ? { totalLiquidity: 0, distributions: [] as any[] }
      : {
          totalLiquidity: liquidityDoc.totalLiquidity || 0,
          distributions: (liquidityDoc.distributions || [])
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
            })),
        };

    // Guardar en cache
    liquidityCache[pool] = { expiresAt: Date.now() + CACHE_TTL_MS, payload };

    // Cache-Control para CDN (Vercel) y clientes
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error('Error en liquidity public:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
} 