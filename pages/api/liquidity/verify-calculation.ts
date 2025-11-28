import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Liquidity from "@/models/Liquidity";

interface DistributionDetail {
  symbol: string;
  alertId: string;
  allocatedAmount: number;
  entryPrice: number;
  currentPrice: number;
  shares: number;
  profitLoss: number;
  profitLossPercentage: number;
  realizedProfitLoss: number;
  isActive: boolean;
}

interface VerificationResult {
  pool: string;
  documents: Array<{
    documentId: string;
    initialLiquidity: number;
    totalLiquidity: number;
    availableLiquidity: number;
    distributedLiquidity: number;
    totalProfitLoss: number;
    distributions: DistributionDetail[];
  }>;
  totals: {
    liquidezInicial: number;
    liquidezTotal: number;
    liquidezDisponible: number;
    liquidezDistribuida: number;
    gananciaTotal: number;
    gananciaPorcentaje: number;
  };
  manualVerification: {
    formulaLiquidezTotal: string;
    formulaLiquidezDisponible: string;
    calculatedLiquidezTotal: number;
    calculatedLiquidezDisponible: number;
    matches: boolean;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VerificationResult | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    await dbConnect();

    const { pool } = req.query;

    if (!pool || (pool !== "TraderCall" && pool !== "SmartMoney")) {
      return res.status(400).json({ 
        error: "Pool inválido. Debe ser 'TraderCall' o 'SmartMoney'" 
      });
    }

    // Obtener todos los documentos de liquidez del pool
    const liquidityDocs = await Liquidity.find({ pool }).lean();

    if (liquidityDocs.length === 0) {
      return res.status(404).json({ 
        error: `No se encontraron documentos de liquidez para el pool ${pool}` 
      });
    }

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

    // Procesar cada documento
    const documents = liquidityDocs.map((doc: any) => ({
      documentId: doc._id.toString(),
      initialLiquidity: doc.initialLiquidity || 0,
      totalLiquidity: doc.totalLiquidity || 0,
      availableLiquidity: doc.availableLiquidity || 0,
      distributedLiquidity: doc.distributedLiquidity || 0,
      totalProfitLoss: doc.totalProfitLoss || 0,
      distributions: (doc.distributions || []).map((dist: any) => ({
        symbol: dist.symbol,
        alertId: dist.alertId,
        allocatedAmount: dist.allocatedAmount || 0,
        entryPrice: dist.entryPrice || 0,
        currentPrice: dist.currentPrice || 0,
        shares: dist.shares || 0,
        profitLoss: dist.profitLoss || 0,
        profitLossPercentage: dist.profitLossPercentage || 0,
        realizedProfitLoss: dist.realizedProfitLoss || 0,
        isActive: dist.isActive !== false
      }))
    }));

    // Calcular totales
    let liquidezDistribuidaSum = 0;
    let gananciaTotalSum = 0;

    liquidityDocs.forEach((doc: any) => {
      liquidezDistribuidaSum += doc.distributedLiquidity || 0;
      gananciaTotalSum += doc.totalProfitLoss || 0;
    });

    const liquidezTotal = liquidezInicialGlobal + gananciaTotalSum;
    const liquidezDisponible = liquidezTotal - liquidezDistribuidaSum;
    const gananciaPorcentaje = liquidezInicialGlobal > 0 
      ? (gananciaTotalSum / liquidezInicialGlobal) * 100 
      : 0;

    // Verificación manual
    const calculatedLiquidezTotal = liquidezInicialGlobal + gananciaTotalSum;
    const calculatedLiquidezDisponible = calculatedLiquidezTotal - liquidezDistribuidaSum;
    const matches = 
      Math.abs(calculatedLiquidezTotal - liquidezTotal) < 0.01 &&
      Math.abs(calculatedLiquidezDisponible - liquidezDisponible) < 0.01;

    const result: VerificationResult = {
      pool: pool as string,
      documents,
      totals: {
        liquidezInicial: liquidezInicialGlobal,
        liquidezTotal,
        liquidezDisponible,
        liquidezDistribuida: liquidezDistribuidaSum,
        gananciaTotal: gananciaTotalSum,
        gananciaPorcentaje
      },
      manualVerification: {
        formulaLiquidezTotal: `${liquidezInicialGlobal} + ${gananciaTotalSum}`,
        formulaLiquidezDisponible: `${liquidezTotal} - ${liquidezDistribuidaSum}`,
        calculatedLiquidezTotal,
        calculatedLiquidezDisponible,
        matches
      }
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error al verificar cálculo de liquidez:", error);
    return res.status(500).json({ 
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
}
