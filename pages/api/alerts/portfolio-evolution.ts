/**
 * API para obtener la evolución del portfolio basada en P&L real de alertas
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import PortfolioMetrics from '@/models/PortfolioMetrics';
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';
import { respondWithMongoCache } from '@/lib/apiMongoCache';

interface SP500DataPoint {
  date: string;
  value: number;
  change: number;
}

// Función para obtener datos del S&P 500
async function getSP500Data(startDate: Date, endDate: Date): Promise<SP500DataPoint[]> {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}&interval=1d`);
    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      const sp500Data: SP500DataPoint[] = timestamps.map((timestamp: number, index: number) => {
        const date = new Date(timestamp * 1000);
        return {
          date: date.toISOString().split('T')[0],
          value: quotes.close[index] || 0,
          change: quotes.close[index] && quotes.close[0] ? 
            ((quotes.close[index] - quotes.close[0]) / quotes.close[0]) * 100 : 0
        };
      });
      
      return sp500Data;
    }
    return [];
  } catch (error) {
    console.error('Error obteniendo datos S&P 500:', error);
    return [];
  }
}

interface PortfolioEvolutionResponse {
  success?: boolean;
  data?: Array<{
    date: string;
    value: number;
    profit: number;
    alertsCount: number;
    sp500Value?: number;
    sp500Change?: number;
  }>;
  stats?: {
    totalProfit: number;
    totalAlerts: number;
    closedAlerts: number;
    winRate: number;
    sp500Return: number;
    baseValue: number;
  };
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PortfolioEvolutionResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  // ✅ Cache Mongo dinámico según período (muy pesado: Yahoo + múltiples queries)
  try {
    const { days = '30', tipo } = req.query;
    const daysNum = parseInt(days as string);
    
    // TTL más largo para períodos largos (menos cambios, más costoso calcular)
    let ttlSeconds = 60; // Default: 7 y 15 días
    let cacheControl = 's-maxage=60, stale-while-revalidate=120';
    
    if (daysNum >= 365) {
      // 1 año: 30 minutos
      ttlSeconds = 1800;
      cacheControl = 's-maxage=1800, stale-while-revalidate=3600';
    } else if (daysNum >= 180) {
      // 6 meses: 15 minutos
      ttlSeconds = 900;
      cacheControl = 's-maxage=900, stale-while-revalidate=1800';
    } else if (daysNum >= 30) {
      // 30 días: 5 minutos
      ttlSeconds = 300;
      cacheControl = 's-maxage=300, stale-while-revalidate=600';
    }
    
    await respondWithMongoCache(
      req,
      res,
      { ttlSeconds, scope: 'public', cacheControl },
      async () => {
        try {
          await dbConnect();

          // ✅ CAMBIO: No verificar autenticación - datos globales para todos los usuarios

          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - daysNum * 24 * 60 * 60 * 1000);

          const sp500Data = await getSP500Data(startDate, endDate);
          const sp500Map = new Map(sp500Data.map((item: SP500DataPoint) => [item.date, item]));

          const alertQuery: any = {
            $or: [
              { createdAt: { $gte: startDate, $lte: endDate } },
              { exitDate: { $gte: startDate, $lte: endDate } },
            ],
          };

          const poolType = tipo && (tipo === 'TraderCall' || tipo === 'SmartMoney') ? tipo : 'TraderCall';
          alertQuery.tipo = poolType;

          // ✅ OPTIMIZADO: Intentar obtener métricas pre-calculadas primero
          let metrics = await PortfolioMetrics.findOne({ pool: poolType });
          const metricsAge = metrics ? (Date.now() - new Date(metrics.lastUpdated).getTime()) / 1000 / 60 : Infinity;
          const shouldRecalculate = !metrics || metricsAge > 2;

          let currentPortfolioValue;
          let valorTotalCarteraActual: number;
          let initialLiquidity: number;
          let totalProfitLoss: number;

          if (shouldRecalculate || !metrics) {
            console.log(
              `⚠️ [PORTFOLIO] Métricas de ${poolType} son antiguas (${metricsAge.toFixed(1)} min) o no existen, calculando...`
            );
            currentPortfolioValue = await calculateCurrentPortfolioValue(poolType);
            valorTotalCarteraActual = currentPortfolioValue.valorTotalCartera;
            initialLiquidity = currentPortfolioValue.liquidezInicial;
            totalProfitLoss = currentPortfolioValue.totalProfitLoss;
          } else {
            console.log(`✅ [PORTFOLIO] Usando métricas pre-calculadas de ${poolType} (actualizadas hace ${metricsAge.toFixed(1)} min)`);
            valorTotalCarteraActual = metrics.valorTotalCartera;
            initialLiquidity = metrics.liquidezInicial;
            totalProfitLoss = metrics.totalProfitLoss;
          }

    console.log(`📊 [PORTFOLIO] Pool: ${poolType}, valorTotalCartera: $${valorTotalCarteraActual.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] Liquidez Inicial: $${initialLiquidity.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] Total Profit/Loss: $${totalProfitLoss.toFixed(2)}`);

    // ✅ CORREGIDO: Obtener TODAS las alertas del tipo específico (SIEMPRE filtrar por poolType)
    // Necesitamos todas para calcular el portfolio completo en tiempo real
    // ✅ IMPORTANTE: SIEMPRE filtrar por tipo para evitar mezclar TraderCall y SmartMoney
    const allAlertsQuery: any = {
      tipo: poolType // ✅ SIEMPRE filtrar por tipo para diferenciar servicios
    };
    let allAlerts = await Alert.find(allAlertsQuery).sort({ createdAt: 1 }).lean();
    
    // ✅ NOTA: Los precios de las alertas activas ya están actualizados por el cron job
    // No necesitamos actualizarlos aquí para evitar latencia. El P&L se calcula usando
    // el currentPrice que ya está en la base de datos (actualizado por /api/cron/update-stock-prices)
    console.log(`📊 [PORTFOLIO] Usando precios actuales de la base de datos para ${allAlerts.filter((a: any) => a.status === 'ACTIVE').length} alertas activas`);
    
    // ✅ CORREGIDO: Obtener distribuciones de liquidez para calcular P&L por alerta (solo para estadísticas)
    // Pero el valor total de la cartera viene de calculateCurrentPortfolioValue
    let liquidityDistributions: any[] = [];
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (adminUser) {
      const liquidityDocs = await Liquidity.find({ 
        createdBy: adminUser._id, 
        pool: poolType 
      }).lean();
      
      // Extraer todas las distribuciones activas
      liquidityDocs.forEach((doc: any) => {
        if (doc.distributions && Array.isArray(doc.distributions)) {
          liquidityDistributions.push(...doc.distributions);
        }
      });
    }
    
    // ✅ Crear mapa de liquidez por alertId para acceso rápido
    const liquidityByAlertId = new Map<string, any>();
    liquidityDistributions.forEach((dist: any) => {
      if (dist.alertId) {
        liquidityByAlertId.set(dist.alertId.toString(), dist);
      }
    });

    // ✅ Calcular P&L por alerta para estadísticas y evolución día a día
    // Para alertas ACTIVAS: usar currentPrice actual
    // Para alertas CERRADAS: usar profit guardado
    let totalRealizedPL = 0; // P&L realizado de alertas cerradas
    let totalUnrealizedPL = 0; // P&L no realizado de alertas activas
    let totalAllocatedAmount = 0; // Total de liquidez asignada (para calcular promedio ponderado)
    
    const alertsWithPL = allAlerts.map((alert: any) => {
      const alertId = alert._id.toString();
      const distribution = liquidityByAlertId.get(alertId);
      
      let alertPL = 0; // P&L en dólares
      let alertPLPercentage = 0; // P&L en porcentaje
      let allocatedAmount = 0; // Monto asignado a esta alerta
      
      if (alert.status === 'ACTIVE') {
        // ✅ ALERTA ACTIVA: Calcular P&L en tiempo real
        // Usar entryPrice de la distribución si existe (precio real de compra), sino usar el de la alerta
        const entryPrice = distribution?.entryPrice || alert.entryPriceRange?.min || alert.entryPrice || 0;
        const currentPrice = alert.currentPrice || entryPrice;
        
        if (entryPrice > 0 && currentPrice > 0) {
          // Calcular P&L porcentual
          alertPLPercentage = alert.action === 'BUY' 
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - currentPrice) / entryPrice) * 100;
          
          // Calcular P&L en dólares usando la distribución de liquidez
          if (distribution) {
            allocatedAmount = distribution.allocatedAmount || 0;
            
            // ✅ CORREGIDO: Calcular P&L siempre basado en allocatedAmount y cambio porcentual
            // No usar shares porque pueden ser 0 cuando el monto es pequeño
            // P&L = (cambio porcentual / 100) × monto asignado
            if (allocatedAmount > 0) {
              alertPL = (alertPLPercentage / 100) * allocatedAmount;
            } else {
              alertPL = 0;
            }
            
            // Sumar P&L realizado si hay ventas parciales
            if (distribution.realizedProfitLoss) {
              totalRealizedPL += distribution.realizedProfitLoss;
            }
            
            totalAllocatedAmount += allocatedAmount;
          } else {
            // Si no hay distribución, usar un monto estimado basado en profit porcentual
            allocatedAmount = 1000; // $1000 por defecto
            alertPL = (alertPLPercentage / 100) * allocatedAmount;
            totalAllocatedAmount += allocatedAmount;
          }
          
          totalUnrealizedPL += alertPL;
        }
      } else if (alert.status === 'CLOSED') {
        // ✅ ALERTA CERRADA: Usar profit guardado
        alertPLPercentage = alert.profit || 0;
        
        if (distribution) {
          allocatedAmount = distribution.allocatedAmount || 0;
          
          // Usar P&L realizado de la distribución (ya incluye todas las ventas)
          // Si la alerta está cerrada, todo el P&L debería estar realizado
          const realizedPL = distribution.realizedProfitLoss || 0;
          
          // Si no hay P&L realizado pero hay profit, calcular basado en shares vendidas
          if (realizedPL === 0 && distribution.soldShares > 0) {
            const entryPrice = distribution.entryPrice || alert.entryPriceRange?.min || alert.entryPrice || 0;
            const exitPrice = alert.exitPrice || alert.currentPrice || entryPrice;
            const soldShares = distribution.soldShares || 0;
            
            alertPL = alert.action === 'BUY'
              ? (exitPrice - entryPrice) * soldShares
              : (entryPrice - exitPrice) * soldShares;
          } else {
            alertPL = realizedPL;
          }
          
          totalRealizedPL += alertPL;
          totalAllocatedAmount += allocatedAmount;
        } else {
          // Si no hay distribución, estimar basado en profit porcentual
          allocatedAmount = 1000; // $1000 por defecto
          alertPL = (alertPLPercentage / 100) * allocatedAmount;
          totalRealizedPL += alertPL;
          totalAllocatedAmount += allocatedAmount;
        }
      }
      
      return {
        ...alert,
        calculatedPL: alertPL,
        calculatedPLPercentage: alertPLPercentage,
        allocatedAmount: allocatedAmount,
        distribution
      };
    });

    // ✅ CORREGIDO: Usar valorTotalCartera del portfolio calculator en lugar de calcular manualmente
    // Esto asegura consistencia con otros endpoints que usan el mismo método
    const currentTotalLiquidity = valorTotalCarteraActual;
    
    // ✅ NUEVO: Calcular porcentaje promedio ponderado del portfolio
    // Esto es más preciso que simplemente sumar porcentajes
    let weightedAveragePercentage = 0;
    if (totalAllocatedAmount > 0) {
      // Calcular promedio ponderado: suma de (porcentaje * monto) / suma de montos
      const weightedSum = alertsWithPL.reduce((sum, alert) => {
        if (alert.allocatedAmount > 0 && alert.calculatedPLPercentage !== undefined) {
          return sum + (alert.calculatedPLPercentage * alert.allocatedAmount);
        }
        return sum;
      }, 0);
      weightedAveragePercentage = weightedSum / totalAllocatedAmount;
    }
    
    // ✅ CORREGIDO: Calcular porcentaje basado en valorTotalCartera (método oficial)
    const portfolioReturnFromPL = initialLiquidity > 0 
      ? ((valorTotalCarteraActual - initialLiquidity) / initialLiquidity) * 100 
      : 0;
    
    console.log(`📊 [PORTFOLIO] Liquidez Inicial: $${initialLiquidity.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] Liquidez Asignada Total: $${totalAllocatedAmount.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] P&L Realizado: $${totalRealizedPL.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] P&L No Realizado: $${totalUnrealizedPL.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] P&L Total Calculado: $${(totalRealizedPL + totalUnrealizedPL).toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] valorTotalCartera (oficial): $${valorTotalCarteraActual.toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] Diferencia: $${Math.abs(valorTotalCarteraActual - (initialLiquidity + totalRealizedPL + totalUnrealizedPL)).toFixed(2)}`);
    console.log(`📊 [PORTFOLIO] Rendimiento (Promedio Ponderado): ${weightedAveragePercentage.toFixed(2)}%`);
    console.log(`📊 [PORTFOLIO] Rendimiento (Basado en valorTotalCartera): ${portfolioReturnFromPL.toFixed(2)}%`);
    
    // ✅ DEBUG: Mostrar P&L de cada alerta
    alertsWithPL.forEach((alert: any) => {
      if (alert.allocatedAmount > 0) {
        console.log(`  - ${alert.symbol}: ${alert.calculatedPLPercentage.toFixed(2)}% ($${alert.allocatedAmount.toFixed(2)} asignado, P&L: $${alert.calculatedPL.toFixed(2)})`);
      }
    });

    // Crear mapa de datos por día
    const dailyData = new Map<string, {
      date: string;
      value: number;
      profit: number;
      alertsCount: number;
      sp500Value?: number;
      sp500Change?: number;
    }>();

    // ✅ NUEVO: Encontrar la fecha más antigua de las alertas para establecer el valor inicial correcto
    let earliestAlertDate = startDate;
    if (allAlerts.length > 0) {
      const firstAlertDate = new Date(Math.min(...allAlerts.map((a: any) => new Date(a.createdAt).getTime())));
      if (firstAlertDate < startDate) {
        earliestAlertDate = firstAlertDate;
      }
    }
    
    // ✅ CORREGIDO: Inicializar solo los días dentro del período seleccionado
    // Usar startDate y endDate para asegurar que solo se incluyan días del período
    const periodStartDate = new Date(startDate);
    periodStartDate.setHours(0, 0, 0, 0);
    const periodEndDate = new Date(endDate);
    periodEndDate.setHours(23, 59, 59, 999);
    
    for (let d = new Date(periodStartDate); d <= periodEndDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const sp500Day = sp500Map.get(dateKey);
      dailyData.set(dateKey, {
        date: dateKey,
        value: initialLiquidity, // ✅ Usar liquidez inicial como base
        profit: 0,
        alertsCount: 0,
        sp500Value: sp500Day?.value || 0,
        sp500Change: sp500Day?.change || 0
      });
    }

    // ✅ CORREGIDO: Calcular evolución día a día usando snapshots históricos cuando estén disponibles
    // Para días pasados: usar snapshots guardados (más preciso)
    // Para el día actual: usar valorTotalCartera calculado en tiempo real
    const sortedDates = Array.from(dailyData.keys()).sort();
    
    for (const dateKey of sortedDates) {
      const dayData = dailyData.get(dateKey)!;
      const currentDate = new Date(dateKey);
      const isToday = dateKey === endDate.toISOString().split('T')[0];
      
      // ✅ CORREGIDO: Para el día actual, usar valorTotalCartera directamente
      if (isToday) {
        dayData.value = valorTotalCarteraActual;
        dayData.profit = valorTotalCarteraActual - initialLiquidity;
        // ✅ CORREGIDO: Contar solo alertas ejecutadas (no desestimadas) creadas en este día específico
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        dayData.alertsCount = allAlerts.filter((alert: any) => {
          const alertCreatedAt = new Date(alert.createdAt);
          // Solo contar alertas ejecutadas (no desestimadas) creadas en este día específico
          return alert.status !== 'DESESTIMADA' && 
                 alertCreatedAt >= dayStart && 
                 alertCreatedAt <= dayEnd;
        }).length;
      } else {
        // ✅ CORREGIDO: Para días pasados, intentar usar snapshot guardado
        const snapshotDate = new Date(dateKey);
        snapshotDate.setHours(16, 30, 0, 0); // Normalizar a las 16:30
        
        // Buscar snapshot en un rango de ±1 día
        const startDate = new Date(snapshotDate);
        startDate.setDate(startDate.getDate() - 1);
        const endSnapshotDate = new Date(snapshotDate);
        endSnapshotDate.setDate(endSnapshotDate.getDate() + 1);
        
        // ✅ CORREGIDO: Ordenar por snapshotDate ascendente para obtener el snapshot
        // más antiguo en el rango, que es más cercano al día que queremos calcular
        // Antes usaba -1 (más reciente) lo cual causaba inconsistencias en el cálculo
        const snapshot = await PortfolioSnapshot.findOne({
          pool: poolType,
          snapshotDate: {
            $gte: startDate,
            $lte: endSnapshotDate
          }
        }).sort({ snapshotDate: 1 }); // Obtener el más antiguo en el rango
        
        if (snapshot) {
          // ✅ Usar valorTotalCartera del snapshot (método oficial)
          dayData.value = snapshot.valorTotalCartera;
          dayData.profit = snapshot.valorTotalCartera - snapshot.liquidezInicial;
          
          // ✅ CORREGIDO: Contar solo alertas ejecutadas (no desestimadas) creadas en este día específico
          const dayStart = new Date(currentDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(currentDate);
          dayEnd.setHours(23, 59, 59, 999);
          dayData.alertsCount = allAlerts.filter((alert: any) => {
            const alertCreatedAt = new Date(alert.createdAt);
            // Solo contar alertas ejecutadas (no desestimadas) creadas en este día específico
            return alert.status !== 'DESESTIMADA' && 
                   alertCreatedAt >= dayStart && 
                   alertCreatedAt <= dayEnd;
          }).length;
        } else {
          // Fallback: calcular P&L acumulado hasta este día (método anterior)
          let dayRealizedPL = 0;
          let dayUnrealizedPL = 0;
          let dayAlertsCount = 0;
          
          // ✅ CORREGIDO: Contar solo alertas ejecutadas (no desestimadas) creadas en este día específico
          const dayStart = new Date(currentDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(currentDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          alertsWithPL.forEach((alert: any) => {
            const alertCreatedAt = new Date(alert.createdAt);
            const alertExitDate = alert.exitDate ? new Date(alert.exitDate) : null;
            
            // Solo contar alertas ejecutadas (no desestimadas) creadas en este día específico
            if (alert.status !== 'DESESTIMADA' && 
                alertCreatedAt >= dayStart && 
                alertCreatedAt <= dayEnd) {
              dayAlertsCount++;
              
              if (alert.status === 'ACTIVE') {
                dayUnrealizedPL += alert.calculatedPL || 0;
              } else if (alert.status === 'CLOSED' && alertExitDate) {
                if (alertExitDate <= currentDate) {
                  dayRealizedPL += alert.calculatedPL || 0;
                } else {
                  dayUnrealizedPL += alert.calculatedPL || 0;
                }
              }
            }
          });
          
          dayData.value = initialLiquidity + dayRealizedPL + dayUnrealizedPL;
          dayData.profit = dayRealizedPL + dayUnrealizedPL;
          dayData.alertsCount = dayAlertsCount;
        }
      }
    }
    
    // ✅ CORREGIDO: Para el último día, asegurar que use valorTotalCarteraActual
    const lastDateKey = sortedDates[sortedDates.length - 1];
    const lastDayData = dailyData.get(lastDateKey)!;
    lastDayData.value = valorTotalCarteraActual;
    lastDayData.profit = valorTotalCarteraActual - initialLiquidity;

    // Convertir a array y ordenar
    const evolutionData = Array.from(dailyData.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // ✅ NUEVO: Calcular estadísticas usando datos reales de alertas
    const totalAlerts = allAlerts.length;
    const closedAlerts = allAlerts.filter(alert => alert.status === 'CLOSED');
    const activeAlerts = allAlerts.filter(alert => alert.status === 'ACTIVE');
    
    // ✅ CORREGIDO: Win Rate incluye alertas cerradas Y alertas activas con ventas parciales ejecutadas
    // Un "trade ejecutado" es:
    // 1. Alerta cerrada completamente, O
    // 2. Alerta activa con al menos una venta parcial ejecutada
    
    // Función helper para verificar si una alerta tiene ventas parciales ejecutadas
    const hasExecutedPartialSales = (alert: any): boolean => {
      if (alert.liquidityData?.partialSales && Array.isArray(alert.liquidityData.partialSales)) {
        return alert.liquidityData.partialSales.some((sale: any) => 
          sale.executed === true && !sale.discarded
        );
      }
      return false;
    };
    
    // Función helper para calcular ganancia realizada de ventas parciales
    const getRealizedProfitFromPartialSales = (alert: any): number => {
      if (alert.liquidityData?.partialSales && Array.isArray(alert.liquidityData.partialSales)) {
        const executedSales = alert.liquidityData.partialSales.filter((sale: any) => 
          sale.executed === true && !sale.discarded
        );
        return executedSales.reduce((sum: number, sale: any) => {
          return sum + (sale.realizedProfit || 0);
        }, 0);
      }
      return 0;
    };
    
    // Contar trades ejecutados (denominador)
    const executedTrades = [
      ...closedAlerts, // Todas las alertas cerradas cuentan como trade ejecutado
      ...activeAlerts.filter(alert => hasExecutedPartialSales(alert)) // Alertas activas con ventas parciales ejecutadas
    ];
    
    // Contar trades ganadores (numerador)
    const winningTrades = [
      // Alertas cerradas con profit positivo
      ...closedAlerts.filter(alert => {
        const profitValue = alert.profit || 0;
        return profitValue > 0;
      }),
      // Alertas activas con ventas parciales ejecutadas y ganancia realizada positiva
      ...activeAlerts.filter(alert => {
        if (!hasExecutedPartialSales(alert)) return false;
        const realizedProfit = getRealizedProfitFromPartialSales(alert);
        return realizedProfit > 0;
      })
    ];
    
    // Calcular Win Rate
    const winRate = executedTrades.length > 0 ? 
      Math.min((winningTrades.length / executedTrades.length) * 100, 100) : 0;
    
    // Log para debugging
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log(`📊 [WIN RATE] Trades ejecutados: ${executedTrades.length} (${closedAlerts.length} cerradas + ${executedTrades.length - closedAlerts.length} con ventas parciales)`);
      console.log(`📊 [WIN RATE] Trades ganadores: ${winningTrades.length}`);
    }
    
    // ✅ OPTIMIZADO: Usar totalProfit de métricas pre-calculadas cuando esté disponible
    // Pero mantener cálculo de winRate complejo porque incluye ventas parciales
    const totalProfit = (metrics && metricsAge <= 2) 
      ? metrics.totalProfit 
      : valorTotalCarteraActual - initialLiquidity;
    
    // Calcular rendimientos relativos al S&P 500
    const sp500Return = sp500Data.length > 0 && sp500Data[0].value > 0 ? 
      ((sp500Data[sp500Data.length - 1].value - sp500Data[0].value) / sp500Data[0].value) * 100 : 0;
    
    // ✅ CORREGIDO: Calcular rendimiento del período seleccionado usando snapshots históricos
    // (igual que /api/portfolio/returns para mantener consistencia)
    let portfolioReturn = 0;
    
    try {
      // Obtener el snapshot histórico para el período seleccionado
      const now = new Date();
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - daysNum);
      targetDate.setHours(16, 30, 0, 0);
      
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 1);
      
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 1);
      
      const historicalSnapshot = await PortfolioSnapshot.findOne({
        pool: poolType,
        snapshotDate: { $gte: startDate, $lte: endDate },
      }).sort({ snapshotDate: 1 });
      
      if (historicalSnapshot) {
        // Calcular rendimiento comparando valor actual con valor histórico
        // Usar el mismo método que /api/portfolio/returns
        const currentValue = await calculateCurrentPortfolioValue(poolType);
        const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
        const historicalProfitLossPercent = historicalSnapshot.totalProfitLossPercentage || 0;
        portfolioReturn = currentProfitLossPercent - historicalProfitLossPercent;
      } else {
        // Fallback: usar el snapshot más antiguo disponible
        const oldestSnapshot = await PortfolioSnapshot.findOne({ pool: poolType }).sort({ snapshotDate: 1 });
        if (oldestSnapshot) {
          const currentValue = await calculateCurrentPortfolioValue(poolType);
          const currentProfitLossPercent = currentValue.totalProfitLossPercentage || 0;
          const historicalProfitLossPercent = oldestSnapshot.totalProfitLossPercentage || 0;
          portfolioReturn = currentProfitLossPercent - historicalProfitLossPercent;
        } else {
          // Si no hay snapshots, calcular desde liquidez inicial (fallback)
          portfolioReturn = initialLiquidity > 0 
            ? ((valorTotalCarteraActual - initialLiquidity) / initialLiquidity) * 100 
            : 0;
        }
      }
    } catch (error) {
      console.error('Error calculando rendimiento del período:', error);
      // Fallback: calcular desde liquidez inicial
      portfolioReturn = initialLiquidity > 0 
        ? ((valorTotalCarteraActual - initialLiquidity) / initialLiquidity) * 100 
        : 0;
    }
    
    if (isDev) {
      console.log(`📊 [PORTFOLIO] Rendimiento del Portfolio: ${portfolioReturn.toFixed(2)}%`);
      console.log(`📊 [PORTFOLIO] Total Alertas: ${totalAlerts} (${activeAlerts.length} activas, ${closedAlerts.length} cerradas)`);
      console.log(`📊 [PORTFOLIO] Win Rate: ${winRate.toFixed(1)}% (incluye ventas parciales)`);
    }
    
    const stats = {
      totalProfit: Number(totalProfit.toFixed(2)), // ✅ NUEVO: P&L total real (realizado + no realizado)
      totalAlerts,
      closedAlerts: executedTrades.length, // ✅ CORREGIDO: Incluye alertas cerradas + activas con ventas parciales ejecutadas
      winRate: Number(winRate.toFixed(1)),
      sp500Return: Number(sp500Return.toFixed(2)),
      baseValue: initialLiquidity // ✅ NUEVO: Usar liquidez inicial como base
    };

          return {
            success: true,
            data: evolutionData,
            stats,
            message: `Evolución del portfolio calculada para ${daysNum} días`,
          } as PortfolioEvolutionResponse;
        } catch (error) {
          console.error('Error al calcular evolución del portfolio:', error);
          return {
            error: 'Error interno del servidor',
            message: 'No se pudo calcular la evolución del portfolio',
          } as PortfolioEvolutionResponse;
        }
      }
    );
    return;
  } catch (error) {
    console.error('Error en cache Mongo (portfolio-evolution):', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}