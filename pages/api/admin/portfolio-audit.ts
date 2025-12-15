import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';
import PortfolioMetrics from '@/models/PortfolioMetrics';
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';

interface AlertDetail {
  alertId: string;
  symbol: string;
  ticker: string;
  status: string;
  tipo: string;
  entryPrice: number;
  currentPrice: number;
  finalPrice?: number;
  exitPrice?: number;
  profit?: number;
  profitPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
  currentPriceUpdatedAt?: Date;
  // Datos de liquidez
  allocatedAmount?: number;
  shares?: number;
  entryPriceFromDistribution?: number;
  realizedProfitLoss?: number;
  soldShares?: number;
  participationPercentage?: number;
  // Cálculos
  calculatedPL?: number;
  calculatedPLPercentage?: number;
  priceSource: string; // 'database' | 'calculated'
}

interface LiquidityDetail {
  pool: string;
  initialLiquidity: number;
  totalLiquidity: number;
  distributedLiquidity: number;
  availableLiquidity: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  lastUpdated: Date;
  distributions: Array<{
    alertId: string;
    symbol: string;
    allocatedAmount: number;
    shares: number;
    entryPrice: number;
    realizedProfitLoss: number;
    soldShares: number;
  }>;
}

interface DashboardBreakdown {
  metric: string;
  value: number | string;
  calculation: string;
  source: string;
  components?: Array<{
    label: string;
    value: number | string;
    source: string;
  }>;
}

interface PortfolioAuditResponse {
  success: boolean;
  pool: 'TraderCall' | 'SmartMoney';
  timestamp: Date;
  dashboardBreakdown: DashboardBreakdown[];
  alerts: AlertDetail[];
  liquidity: LiquidityDetail;
  metrics?: {
    valorTotalCartera: number;
    liquidezInicial: number;
    totalProfitLoss: number;
    totalProfitLossPercentage: number;
    totalAlerts: number;
    activeAlerts: number;
    closedAlerts: number;
    winRate: number;
    lastUpdated: Date;
  };
  error?: string;
}

/**
 * API para auditoría completa del portfolio
 * Muestra de dónde sale cada número del dashboard
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PortfolioAuditResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      pool: 'TraderCall',
      timestamp: new Date(),
      dashboardBreakdown: [],
      alerts: [],
      liquidity: {} as LiquidityDetail,
      error: 'Método no permitido'
    });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.email) {
      return res.status(401).json({
        success: false,
        pool: 'TraderCall',
        timestamp: new Date(),
        dashboardBreakdown: [],
        alerts: [],
        liquidity: {} as LiquidityDetail,
        error: 'No autorizado'
      });
    }

    await dbConnect();

    // Verificar permisos de admin
    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        pool: 'TraderCall',
        timestamp: new Date(),
        dashboardBreakdown: [],
        alerts: [],
        liquidity: {} as LiquidityDetail,
        error: 'Permisos insuficientes'
      });
    }

    // Obtener pool de query (default: TraderCall)
    const { pool = 'TraderCall' } = req.query;
    const poolType = (pool === 'SmartMoney' ? 'SmartMoney' : 'TraderCall') as 'TraderCall' | 'SmartMoney';

    console.log(`🔍 [AUDIT] Iniciando auditoría para ${poolType}...`);

    // 1. Obtener métricas pre-calculadas
    const metrics = await PortfolioMetrics.findOne({ pool: poolType });
    
    // 2. Calcular valores actuales
    const currentValue = await calculateCurrentPortfolioValue(poolType);

    // 3. Obtener todas las alertas del pool
    const allAlerts = await Alert.find({ tipo: poolType }).sort({ createdAt: 1 }).lean();
    const activeAlerts = allAlerts.filter((a: any) => a.status === 'ACTIVE');
    const closedAlerts = allAlerts.filter((a: any) => a.status === 'CLOSED');

    // 4. Obtener distribuciones de liquidez
    const adminUser = await User.findOne({ role: 'admin' });
    let liquidityDocs: any[] = [];
    let liquidityDistributions: any[] = [];
    let totalLiquidity = 0;

    if (adminUser) {
      liquidityDocs = await Liquidity.find({ 
        createdBy: adminUser._id, 
        pool: poolType 
      }).lean();
      
      liquidityDocs.forEach((doc: any) => {
        if (doc.distributions && Array.isArray(doc.distributions)) {
          liquidityDistributions.push(...doc.distributions);
        }
        // ✅ NUEVO: Obtener liquidez total para calcular allocatedAmount desde participationPercentage
        if (doc.totalLiquidity && doc.totalLiquidity > totalLiquidity) {
          totalLiquidity = doc.totalLiquidity;
        }
      });
    }

    // Crear mapa de liquidez por alertId
    const liquidityByAlertId = new Map<string, any>();
    liquidityDistributions.forEach((dist: any) => {
      if (dist.alertId) {
        liquidityByAlertId.set(dist.alertId.toString(), dist);
      }
    });

    // 5. Calcular detalles de cada alerta
    const alertsDetails: AlertDetail[] = allAlerts.map((alert: any) => {
      const alertId = alert._id.toString();
      const distribution = liquidityByAlertId.get(alertId);
      
      const entryPrice = distribution?.entryPrice || alert.entryPriceRange?.min || alert.entryPrice || 0;
      const currentPrice = alert.currentPrice || entryPrice;
      
      // ✅ CORREGIDO: Obtener allocatedAmount de la distribución, o calcularlo desde participationPercentage
      let allocatedAmount = distribution?.allocatedAmount || 0;
      
      // Si no hay allocatedAmount en la distribución pero hay participationPercentage y liquidez total, calcularlo
      if (allocatedAmount === 0 && totalLiquidity > 0) {
        const participationPercentage = distribution?.percentage || alert.participationPercentage || alert.originalParticipationPercentage || 0;
        if (participationPercentage > 0) {
          allocatedAmount = (totalLiquidity * participationPercentage) / 100;
        }
      }
      
      // ✅ CORREGIDO: Obtener shares de múltiples fuentes
      // 1. Primero intentar desde la distribución (fuente principal)
      // 2. Luego desde alert.liquidityData (si existe)
      // 3. Luego calcular desde allocatedAmount y entryPrice
      // 4. Para alertas cerradas, usar soldShares si shares es 0 (indica que se vendieron todas)
      let shares = distribution?.shares || 0;
      
      // Si no hay shares en la distribución, buscar en liquidityData
      if (shares === 0 && alert.liquidityData?.shares) {
        shares = alert.liquidityData.shares;
      }
      
      // Si aún no hay shares, intentar con originalShares
      if (shares === 0 && alert.liquidityData?.originalShares) {
        shares = alert.liquidityData.originalShares;
      }
      
      // Si aún no hay shares pero hay allocatedAmount y entryPrice, calcular
      if (shares === 0 && allocatedAmount > 0 && entryPrice > 0) {
        shares = allocatedAmount / entryPrice;
      }
      
      // Para alertas cerradas, si shares es 0 pero hay soldShares, usar soldShares como referencia
      // (indica que se vendieron todas las acciones)
      if (alert.status === 'CLOSED' && shares === 0 && distribution?.soldShares && distribution.soldShares > 0) {
        shares = distribution.soldShares;
      }
      
      // Calcular P&L
      let calculatedPL = 0;
      let calculatedPLPercentage = 0;
      
      if (alert.status === 'ACTIVE' && entryPrice > 0 && currentPrice > 0) {
        calculatedPLPercentage = alert.action === 'BUY' 
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currentPrice) / entryPrice) * 100;
        
        if (allocatedAmount > 0) {
          calculatedPL = (calculatedPLPercentage / 100) * allocatedAmount;
        }
      } else if (alert.status === 'CLOSED') {
        calculatedPLPercentage = alert.profit || 0;
        if (distribution?.realizedProfitLoss) {
          calculatedPL = distribution.realizedProfitLoss;
        } else if (allocatedAmount > 0) {
          calculatedPL = (calculatedPLPercentage / 100) * allocatedAmount;
        }
      }

      return {
        alertId,
        symbol: alert.symbol || '',
        ticker: alert.symbol || '',
        status: alert.status,
        tipo: alert.tipo || poolType,
        entryPrice,
        currentPrice,
        finalPrice: alert.finalPrice,
        exitPrice: alert.exitPrice,
        profit: alert.profit,
        profitPercentage: alert.profit,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
        currentPriceUpdatedAt: alert.currentPriceUpdatedAt || alert.updatedAt,
        allocatedAmount,
        shares,
        entryPriceFromDistribution: distribution?.entryPrice,
        realizedProfitLoss: distribution?.realizedProfitLoss || 0,
        soldShares: distribution?.soldShares || 0,
        participationPercentage: distribution?.percentage || alert.participationPercentage || alert.originalParticipationPercentage || 0,
        calculatedPL,
        calculatedPLPercentage,
        priceSource: alert.currentPrice ? 'database' : 'calculated'
      };
    });

    // 6. Calcular winRate
    let winRate = 0;
    if (closedAlerts.length > 0) {
      const winningAlerts = closedAlerts.filter((a: any) => (a.profit || 0) > 0);
      winRate = (winningAlerts.length / closedAlerts.length) * 100;
    }

    // 7. Crear desglose del dashboard
    const dashboardBreakdown: DashboardBreakdown[] = [
      {
        metric: 'Valor Total de la Cartera',
        value: `$${currentValue.valorTotalCartera.toFixed(2)}`,
        calculation: 'liquidezInicial + totalProfitLoss',
        source: 'calculateCurrentPortfolioValue()',
        components: [
          {
            label: 'Liquidez Inicial',
            value: `$${currentValue.liquidezInicial.toFixed(2)}`,
            source: 'Liquidity.initialLiquidity (más reciente)'
          },
          {
            label: 'Total Profit/Loss',
            value: `$${currentValue.totalProfitLoss.toFixed(2)}`,
            source: 'Suma de Liquidity.totalProfitLoss de todos los docs'
          }
        ]
      },
      {
        metric: 'Liquidez Total',
        value: `$${currentValue.liquidezTotal.toFixed(2)}`,
        calculation: 'liquidezInicial + totalProfitLoss',
        source: 'calculateCurrentPortfolioValue()',
        components: [
          {
            label: 'Liquidez Inicial',
            value: `$${currentValue.liquidezInicial.toFixed(2)}`,
            source: 'Liquidity.initialLiquidity'
          },
          {
            label: 'Ganancias/Pérdidas',
            value: `$${currentValue.totalProfitLoss.toFixed(2)}`,
            source: 'Suma de Liquidity.totalProfitLoss'
          }
        ]
      },
      {
        metric: 'Liquidez Distribuida',
        value: `$${currentValue.liquidezDistribuida.toFixed(2)}`,
        calculation: 'Suma de Liquidity.distributedLiquidity',
        source: 'Suma de todos los documentos de Liquidity del pool',
        components: liquidityDistributions.map((dist: any) => ({
          label: `${dist.symbol || 'N/A'} (${dist.alertId?.toString().substring(0, 8)}...)`,
          value: `$${(dist.allocatedAmount || 0).toFixed(2)}`,
          source: `Liquidity.distributions[].allocatedAmount`
        }))
      },
      {
        metric: 'Liquidez Disponible',
        value: `$${currentValue.liquidezDisponible.toFixed(2)}`,
        calculation: 'liquidezTotal - liquidezDistribuida',
        source: 'calculateCurrentPortfolioValue()',
        components: [
          {
            label: 'Liquidez Total',
            value: `$${currentValue.liquidezTotal.toFixed(2)}`,
            source: 'liquidezInicial + totalProfitLoss'
          },
          {
            label: 'Liquidez Distribuida',
            value: `$${currentValue.liquidezDistribuida.toFixed(2)}`,
            source: 'Suma de distribuciones'
          }
        ]
      },
      {
        metric: 'Total Profit/Loss %',
        value: `${currentValue.totalProfitLossPercentage.toFixed(2)}%`,
        calculation: '(totalProfitLoss / liquidezInicial) * 100',
        source: 'calculateCurrentPortfolioValue()',
        components: [
          {
            label: 'Total Profit/Loss',
            value: `$${currentValue.totalProfitLoss.toFixed(2)}`,
            source: 'Suma de Liquidity.totalProfitLoss'
          },
          {
            label: 'Liquidez Inicial',
            value: `$${currentValue.liquidezInicial.toFixed(2)}`,
            source: 'Liquidity.initialLiquidity'
          }
        ]
      },
      {
        metric: 'Total Alertas',
        value: allAlerts.length.toString(),
        calculation: 'Count de Alert.find({ tipo: poolType })',
        source: 'Alert collection',
        components: [
          {
            label: 'Alertas Activas',
            value: activeAlerts.length.toString(),
            source: 'Alert.status === "ACTIVE"'
          },
          {
            label: 'Alertas Cerradas',
            value: closedAlerts.length.toString(),
            source: 'Alert.status === "CLOSED"'
          }
        ]
      },
      {
        metric: 'Win Rate',
        value: `${winRate.toFixed(2)}%`,
        calculation: '(alertas ganadoras / alertas cerradas) * 100',
        source: 'Cálculo basado en Alert.profit > 0',
        components: [
          {
            label: 'Alertas Ganadoras',
            value: closedAlerts.filter((a: any) => (a.profit || 0) > 0).length.toString(),
            source: 'Alert.profit > 0'
          },
          {
            label: 'Total Alertas Cerradas',
            value: closedAlerts.length.toString(),
            source: 'Alert.status === "CLOSED"'
          }
        ]
      }
    ];

    // 8. Detalles de liquidez
    const liquidityDetail: LiquidityDetail = {
      pool: poolType,
      initialLiquidity: currentValue.liquidezInicial,
      totalLiquidity: currentValue.liquidezTotal,
      distributedLiquidity: currentValue.liquidezDistribuida,
      availableLiquidity: currentValue.liquidezDisponible,
      totalProfitLoss: currentValue.totalProfitLoss,
      totalProfitLossPercentage: currentValue.totalProfitLossPercentage,
      lastUpdated: metrics?.lastUpdated || new Date(),
      distributions: liquidityDistributions.map((dist: any) => ({
        alertId: dist.alertId?.toString() || '',
        symbol: dist.symbol || '',
        allocatedAmount: dist.allocatedAmount || 0,
        shares: dist.shares || 0,
        entryPrice: dist.entryPrice || 0,
        realizedProfitLoss: dist.realizedProfitLoss || 0,
        soldShares: dist.soldShares || 0
      }))
    };

    return res.status(200).json({
      success: true,
      pool: poolType,
      timestamp: new Date(),
      dashboardBreakdown,
      alerts: alertsDetails,
      liquidity: liquidityDetail,
      metrics: metrics ? {
        valorTotalCartera: metrics.valorTotalCartera,
        liquidezInicial: metrics.liquidezInicial,
        totalProfitLoss: metrics.totalProfitLoss,
        totalProfitLossPercentage: metrics.totalProfitLossPercentage,
        totalAlerts: metrics.totalAlerts,
        activeAlerts: metrics.activeAlerts,
        closedAlerts: metrics.closedAlerts,
        winRate: metrics.winRate,
        lastUpdated: metrics.lastUpdated
      } : undefined
    });

  } catch (error) {
    console.error('❌ [AUDIT] Error en auditoría del portfolio:', error);
    return res.status(500).json({
      success: false,
      pool: 'TraderCall',
      timestamp: new Date(),
      dashboardBreakdown: [],
      alerts: [],
      liquidity: {} as LiquidityDetail,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

