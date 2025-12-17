import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Liquidity from '../../../models/Liquidity';
import { respondWithMongoCache } from '@/lib/apiMongoCache';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LiquiditySummaryResponse>
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
          return { success: false, error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)" } as LiquiditySummaryResponse;
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

    // ✅ CORREGIDO: Encontrar el documento PRINCIPAL (el que tiene distributions)
    // Priorizar el documento que tiene distributions activas
    const docsWithDistributions = liquidityDocs.filter(doc => 
      doc.distributions && doc.distributions.length > 0
    );
    
    // Usar el documento principal (con distributions) o el primero disponible
    const mainDoc = docsWithDistributions.length > 0 
      ? docsWithDistributions.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        )[0]
      : liquidityDocs[0];

    // Combinar todas las distribuciones y calcular totales
    const allDistributions: any[] = [];
    let liquidezInicialGlobal = 0;
    let liquidezTotalSum = 0;
    let liquidezDisponibleSum = 0;
    let liquidezDistribuidaSum = 0;
    let gananciaTotalSum = 0;

    if (mainDoc) {
      // ✅ CORREGIDO: Usar fórmula correcta de liquidez
      // Disponible = Inicial - Distribuida + Ganancias Realizadas
      liquidezInicialGlobal = mainDoc.initialLiquidity || 0;
      
      const allDocDistributions = mainDoc.distributions || [];
      
      // 1. Calcular liquidez distribuida (allocatedAmount de distribuciones activas con shares > 0)
      // Esto representa el dinero que actualmente está invertido en alertas activas
      let montosDistribuidos = 0;
      allDocDistributions.forEach((d: any) => {
        if (d.isActive && d.shares > 0) {
          montosDistribuidos += d.allocatedAmount || 0;
        }
      });
      
      // 2. Calcular ganancias REALIZADAS (solo de ventas completadas)
      // Esto es el efectivo que volvió a la cuenta por ventas parciales o totales
      let gananciasRealizadas = 0;
      allDocDistributions.forEach((d: any) => {
        gananciasRealizadas += d.realizedProfitLoss || 0;
      });
      
      // 3. Calcular ganancias NO realizadas (paper gains/losses de posiciones activas)
      let gananciasNoRealizadas = 0;
      allDocDistributions.forEach((d: any) => {
        if (d.isActive && d.shares > 0) {
          gananciasNoRealizadas += d.profitLoss || 0;
        }
      });
      
      // 4. Ganancia total = realizadas + no realizadas
      gananciaTotalSum = gananciasRealizadas + gananciasNoRealizadas;

      // ✅ CORREGIDO: Fórmulas correctas
      // Liquidez distribuida = montos actualmente invertidos
      liquidezDistribuidaSum = montosDistribuidos;
      
      // Liquidez total = inicial + ganancias totales (realizadas + no realizadas)
      liquidezTotalSum = liquidezInicialGlobal + gananciaTotalSum;
      
      // ✅ FÓRMULA CORRECTA: Disponible = Inicial - Distribuida + Ganancias Realizadas
      // Solo las ganancias REALIZADAS vuelven al disponible, no las ganancias en papel
      liquidezDisponibleSum = liquidezInicialGlobal - montosDistribuidos + gananciasRealizadas;

      const activeDistributions = allDocDistributions
        .filter((d: any) => d.isActive)
        .map((d: any) => ({
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
      
      console.log(`📊 [LIQUIDITY SUMMARY] Usando documento principal:`, mainDoc._id);
      console.log(`📊 [LIQUIDITY SUMMARY] Fórmula Disponible: $${liquidezInicialGlobal} (inicial) - $${montosDistribuidos} (distribuida) + $${gananciasRealizadas} (realizadas) = $${liquidezDisponibleSum}`);
      console.log(`📊 [LIQUIDITY SUMMARY] Ganancias: Realizadas=$${gananciasRealizadas}, NoRealizadas=$${gananciasNoRealizadas}, Total=$${gananciaTotalSum}`);
    }

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

    // ✅ INFO: Ahora los cálculos son:
    // - liquidezTotal = initialLiquidity + ganancias
    // - liquidezDisponible = liquidezTotal - liquidezDistribuida
    // Esto permite que las ganancias estén disponibles para crear nuevas alertas

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

        return { success: true, data: payload } as LiquiditySummaryResponse;
      }
    );
    return;
  } catch (error) {
    console.error('Error en liquidity summary:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
