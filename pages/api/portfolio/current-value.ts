import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';

interface CurrentPortfolioValueResponse {
  success: boolean;
  data?: {
    valorActualCartera: number;
    liquidezInicial: number;
    liquidezTotal: number;
    liquidezDisponible: number;
    liquidezDistribuida: number;
    totalProfitLoss: number;
    totalProfitLossPercentage: number;
  };
  error?: string;
  message?: string;
}

/**
 * API para obtener el valor actual de la cartera en tiempo real
 * Este valor se actualiza constantemente a medida que las alertas fluctúan
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CurrentPortfolioValueResponse>
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
    const portfolioValue = await calculateCurrentPortfolioValue(poolType);

    return res.status(200).json({
      success: true,
      data: {
        valorActualCartera: portfolioValue.valorTotalCartera,
        liquidezInicial: portfolioValue.liquidezInicial,
        liquidezTotal: portfolioValue.liquidezTotal,
        liquidezDisponible: portfolioValue.liquidezDisponible,
        liquidezDistribuida: portfolioValue.liquidezDistribuida,
        totalProfitLoss: portfolioValue.totalProfitLoss,
        totalProfitLossPercentage: portfolioValue.totalProfitLossPercentage
      }
    });

  } catch (error) {
    console.error('Error calculando valor actual de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

