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
    porcentajeRestante: number;   // ✅ NUEVO: % restante = (Distribuida * 100) / Inicial
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
    individualDistributions?: Array<{  // ✅ NUEVO: Distribuciones individuales por alertId
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
        initialLiquidity: 1,  // ✅ NUEVO: Incluir liquidez inicial
        totalLiquidity: 1, 
        availableLiquidity: 1, 
        distributedLiquidity: 1,
        totalProfitLoss: 1,
        totalProfitLossPercentage: 1,
        distributions: 1,
        updatedAt: 1,  // ✅ NUEVO: Para ordenar por fecha de actualización
        createdAt: 1   // ✅ NUEVO: Fallback si no hay updatedAt
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

    // ✅ NUEVO: La liquidez inicial es UN SOLO valor global por pool, no se suma
    // Usar el valor del documento más reciente que tenga initialLiquidity definido
    let liquidezInicialGlobal = 0;
    const docsWithInitialLiquidity = liquidityDocs.filter(doc => 
      doc.initialLiquidity !== undefined && doc.initialLiquidity !== null && doc.initialLiquidity > 0
    );
    
    if (docsWithInitialLiquidity.length > 0) {
      // Usar el valor más reciente (por updatedAt) o el primer documento encontrado
      const sortedByUpdate = [...docsWithInitialLiquidity].sort((a, b) => 
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
      liquidezInicialGlobal = sortedByUpdate[0].initialLiquidity;
    } else {
      // Fallback: calcular desde el primer documento si no hay initialLiquidity definido
      if (liquidityDocs.length > 0) {
        const firstDoc = liquidityDocs[0];
        liquidezInicialGlobal = firstDoc.totalLiquidity - (firstDoc.totalProfitLoss || 0);
      }
    }
    
    // ✅ CORREGIDO: Sumar solo las distribuciones y ganancias de TODOS los documentos
    // Todos los cálculos se basan en la liquidez inicial GLOBAL
    liquidityDocs.forEach((doc) => {
      // Sumar solo la liquidez distribuida (de todas las distribuciones activas)
      liquidezDistribuidaSum += doc.distributedLiquidity || 0;
      
      // ✅ CORREGIDO: Calcular ganancias directamente desde TODAS las distribuciones (activas e inactivas)
      // Esto asegura que las ganancias realizadas de distribuciones vendidas completamente se incluyan
      const allDocDistributions = doc.distributions || [];
      allDocDistributions.forEach((d: any) => {
        // Sumar ganancias no realizadas (solo de distribuciones activas)
        if (d.isActive) {
          gananciaTotalSum += d.profitLoss || 0;
        }
        // Sumar ganancias realizadas (de todas las distribuciones, activas e inactivas)
        gananciaTotalSum += d.realizedProfitLoss || 0;
      });

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

    // ✅ CORREGIDO: Calcular todo en base a la liquidez inicial GLOBAL
    // Liquidez Total = Inicial + Ganancias/Pérdidas
    liquidezTotalSum = liquidezInicialGlobal + gananciaTotalSum;
    
    // Liquidez Disponible = Total - Distribuida
    liquidezDisponibleSum = liquidezTotalSum - liquidezDistribuidaSum;

    // ✅ CORREGIDO: Calcular porcentaje de ganancia sobre la liquidez inicial GLOBAL
    // El signo debe ser correcto: positivo para ganancias, negativo para pérdidas
    const gananciaPorcentaje = liquidezInicialGlobal > 0 
      ? (gananciaTotalSum / liquidezInicialGlobal) * 100 
      : 0;

    // ✅ NUEVO: Calcular % restante = (Liquidez distribuida * 100) / Liquidez inicial
    const porcentajeRestante = liquidezInicialGlobal > 0 
      ? (liquidezDistribuidaSum * 100) / liquidezInicialGlobal 
      : 0;

    // ✅ DEBUG: Log detallado de distribuciones para verificar ganancias realizadas
    const allDistributionsDebug = liquidityDocs.flatMap((doc) => doc.distributions || []);
    const realizedProfitsDebug = allDistributionsDebug
      .filter((d: any) => (d.realizedProfitLoss || 0) !== 0)
      .map((d: any) => ({
        symbol: d.symbol,
        alertId: d.alertId,
        isActive: d.isActive,
        realizedProfitLoss: d.realizedProfitLoss || 0,
        profitLoss: d.profitLoss || 0
      }));
    
    console.log(`📊 [LIQUIDITY SUMMARY] Resumen calculado para ${pool}:`, {
      liquidezInicial: liquidezInicialGlobal,  // ✅ Valor único global, no suma
      liquidezTotal: liquidezTotalSum,
      liquidezDisponible: liquidezDisponibleSum,
      liquidezDistribuida: liquidezDistribuidaSum,
      ganancia: gananciaTotalSum,
      gananciaPorcentaje,
      porcentajeRestante,
      distributionsCount: consolidatedDistributions.length,
      realizedProfitsCount: realizedProfitsDebug.length,
      realizedProfitsDetails: realizedProfitsDebug
    });

    const payload = {
      liquidezInicial: liquidezInicialGlobal,  // ✅ Valor único global
      liquidezTotal: liquidezTotalSum,
      liquidezDisponible: liquidezDisponibleSum,
      liquidezDistribuida: liquidezDistribuidaSum,
      ganancia: gananciaTotalSum,
      gananciaPorcentaje,
      porcentajeRestante,  // ✅ NUEVO: % restante
      distributions: consolidatedDistributions,  // Distribuciones consolidadas por símbolo
      individualDistributions: allDistributions  // ✅ NUEVO: Distribuciones individuales por alertId
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
