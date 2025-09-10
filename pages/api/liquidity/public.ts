import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
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
      realizedProfitLoss: number;
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
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    // Encontrar liquidez del admin (opcionalmente, podrías parametrizar si fueran multi-admin)
    const liquidity = await Liquidity.findOne({});
    if (!liquidity) {
      return res.status(200).json({ success: true, data: { totalLiquidity: 0, distributions: [] } });
    }

    const distributions = (liquidity.distributions || []).filter((d: any) => d.isActive).map((d: any) => ({
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

    return res.status(200).json({
      success: true,
      data: {
        totalLiquidity: liquidity.totalLiquidity || 0,
        distributions,
      }
    });
  } catch (error) {
    console.error('Error en liquidity public:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
} 