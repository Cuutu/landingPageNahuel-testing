import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';
import { respondWithMongoCache } from '@/lib/apiMongoCache';

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
    await respondWithMongoCache(
      req,
      res,
      {
        ttlSeconds: 60,
        scope: 'public',
        cacheControl: 's-maxage=60, stale-while-revalidate=120',
      },
      async () => {
        await dbConnect();

        const { pool } = req.query;

        if (!pool || (pool !== 'TraderCall' && pool !== 'SmartMoney')) {
          return {
            success: false,
            error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)",
          } satisfies CurrentPortfolioValueResponse;
        }

        const poolType = pool as 'TraderCall' | 'SmartMoney';

        const portfolioValue = await calculateCurrentPortfolioValue(poolType);

        return {
          success: true,
          data: {
            valorActualCartera: portfolioValue.valorTotalCartera,
            liquidezInicial: portfolioValue.liquidezInicial,
            liquidezTotal: portfolioValue.liquidezTotal,
            liquidezDisponible: portfolioValue.liquidezDisponible,
            liquidezDistribuida: portfolioValue.liquidezDistribuida,
            totalProfitLoss: portfolioValue.totalProfitLoss,
            totalProfitLossPercentage: portfolioValue.totalProfitLossPercentage,
          },
        } satisfies CurrentPortfolioValueResponse;
      }
    );
    return;

  } catch (error) {
    console.error('Error calculando valor actual de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

