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
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';

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

  try {
    // Conectar a la base de datos
    await dbConnect();

    // ✅ CAMBIO: No verificar autenticación - datos globales para todos los usuarios

    // Extraer parámetros de query
    const { days = '30', tipo } = req.query;
    const daysNum = parseInt(days as string);

    // Calcular fecha de inicio
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysNum * 24 * 60 * 60 * 1000);

    // Obtener datos del S&P 500
    const sp500Data = await getSP500Data(startDate, endDate);
    const sp500Map = new Map(sp500Data.map((item: SP500DataPoint) => [item.date, item]));

    // Construir query de alertas con filtro opcional por tipo
    const alertQuery: any = {
      $or: [
        { createdAt: { $gte: startDate, $lte: endDate } },
        { exitDate: { $gte: startDate, $lte: endDate } }
      ]
    };

    // ✅ CORREGIDO: Filtrar por tipo - SIEMPRE debe tener un valor para diferenciar entre servicios
    // Si no se proporciona tipo, usar 'TraderCall' por defecto
    const poolType = tipo && (tipo === 'TraderCall' || tipo === 'SmartMoney') ? tipo : 'TraderCall';
    
    // ✅ CORREGIDO: SIEMPRE filtrar alertas por tipo para evitar mezclar servicios
    alertQuery.tipo = poolType;

    // ✅ CORREGIDO: Usar calculateCurrentPortfolioValue para obtener valorTotalCartera actual
    // Esto mantiene consistencia con /api/portfolio/returns y otros endpoints
    const currentPortfolioValue = await calculateCurrentPortfolioValue(poolType);
    const valorTotalCarteraActual = currentPortfolioValue.valorTotalCartera;
    const initialLiquidity = currentPortfolioValue.liquidezInicial;
    const totalProfitLoss = currentPortfolioValue.totalProfitLoss;

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
    
    // Inicializar todos los días en el rango
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
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
        // Contar alertas activas y cerradas
        dayData.alertsCount = allAlerts.filter((alert: any) => {
          const alertCreatedAt = new Date(alert.createdAt);
          return alertCreatedAt <= currentDate;
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
        
        const snapshot = await PortfolioSnapshot.findOne({
          pool: poolType,
          snapshotDate: {
            $gte: startDate,
            $lte: endSnapshotDate
          }
        }).sort({ snapshotDate: -1 }); // Obtener el más cercano
        
        if (snapshot) {
          // ✅ Usar valorTotalCartera del snapshot (método oficial)
          dayData.value = snapshot.valorTotalCartera;
          dayData.profit = snapshot.valorTotalCartera - snapshot.liquidezInicial;
          
          // Contar alertas que existían en ese día
          dayData.alertsCount = allAlerts.filter((alert: any) => {
            const alertCreatedAt = new Date(alert.createdAt);
            return alertCreatedAt <= currentDate;
          }).length;
        } else {
          // Fallback: calcular P&L acumulado hasta este día (método anterior)
          let dayRealizedPL = 0;
          let dayUnrealizedPL = 0;
          let dayAlertsCount = 0;
          
          alertsWithPL.forEach((alert: any) => {
            const alertCreatedAt = new Date(alert.createdAt);
            const alertExitDate = alert.exitDate ? new Date(alert.exitDate) : null;
            
            if (alertCreatedAt <= currentDate) {
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
    const winningAlerts = closedAlerts.filter(alert => {
      const profitValue = alert.profit || 0;
      return profitValue > 0;
    });
    
    // Winrate basado solo en alertas cerradas, máximo 100%
    const winRate = closedAlerts.length > 0 ? 
      Math.min((winningAlerts.length / closedAlerts.length) * 100, 100) : 0;
    
    // ✅ CORREGIDO: Calcular profit total usando valorTotalCartera (método oficial)
    const totalProfit = valorTotalCarteraActual - initialLiquidity;
    
    // Calcular rendimientos relativos al S&P 500
    const sp500Return = sp500Data.length > 0 && sp500Data[0].value > 0 ? 
      ((sp500Data[sp500Data.length - 1].value - sp500Data[0].value) / sp500Data[0].value) * 100 : 0;
    
    // ✅ CORREGIDO: Calcular rendimiento del PERÍODO específico (no desde el inicio)
    // Para el período solicitado, comparar el valor del primer día con el último día
    let portfolioReturn = 0;
    let periodStartValue = initialLiquidity; // Valor por defecto
    
    if (evolutionData.length > 0) {
      // Obtener el valor del primer día del período (hace X días)
      const firstDayData = evolutionData[0];
      const lastDayData = evolutionData[evolutionData.length - 1];
      
      periodStartValue = firstDayData.value || initialLiquidity;
      const periodEndValue = lastDayData.value || valorTotalCarteraActual;
      
      // Calcular rendimiento del período: (valor final - valor inicial) / valor inicial * 100
      if (periodStartValue > 0) {
        portfolioReturn = ((periodEndValue - periodStartValue) / periodStartValue) * 100;
      }
      
      console.log(`📊 [PORTFOLIO] Rendimiento del período (${daysNum} días):`, {
        periodStartValue: periodStartValue.toFixed(2),
        periodEndValue: periodEndValue.toFixed(2),
        portfolioReturn: portfolioReturn.toFixed(2) + '%',
        firstDay: firstDayData.date,
        lastDay: lastDayData.date
      });
    } else {
      // Si no hay datos de evolución, calcular desde el inicio (fallback)
      portfolioReturn = initialLiquidity > 0 
        ? ((valorTotalCarteraActual - initialLiquidity) / initialLiquidity) * 100 
        : 0;
      console.log(`⚠️ [PORTFOLIO] No hay datos de evolución, usando cálculo desde inicio.`);
    }
    
    console.log(`📊 [PORTFOLIO] Rendimiento del Portfolio: ${portfolioReturn.toFixed(2)}%`);
    console.log(`📊 [PORTFOLIO] Total Alertas: ${totalAlerts} (${activeAlerts.length} activas, ${closedAlerts.length} cerradas)`);
    console.log(`📊 [PORTFOLIO] Win Rate: ${winRate.toFixed(1)}%`);
    
    const stats = {
      totalProfit: Number(totalProfit.toFixed(2)), // ✅ NUEVO: P&L total real (realizado + no realizado)
      totalAlerts,
      closedAlerts: closedAlerts.length,
      winRate: Number(winRate.toFixed(1)),
      sp500Return: Number(sp500Return.toFixed(2)),
      baseValue: initialLiquidity // ✅ NUEVO: Usar liquidez inicial como base
    };

    return res.status(200).json({
      success: true,
      data: evolutionData,
      stats,
      message: `Evolución del portfolio calculada para ${daysNum} días`
    });

  } catch (error) {
    console.error('Error al calcular evolución del portfolio:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudo calcular la evolución del portfolio'
    });
  }
} 