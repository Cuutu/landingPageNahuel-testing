import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

interface ServiceMetrics {
  totalReturnPercent: number;
  activeAlerts: number;
  closedAlerts: number;
  winningAlerts: number;
  losingAlerts: number;
  winRate: number;
  averageGain: number;
  averageLoss: number;
  period: string;
  totalTrades: number;
  bestTrade: number;
  worstTrade: number;
}

/**
 * API endpoint para obtener métricas de rendimiento del servicio basado en alertas reales
 * GET /api/performance/service-performance?period=7d|15d|30d|6m|1y&tipo=TraderCall
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { period = '30d', tipo = 'TraderCall' } = req.query;

    console.log(`📊 Calculando rendimiento del servicio para período: ${period}, tipo: ${tipo}`);

    await dbConnect();

    // Calcular fecha de inicio según el período
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '15d':
        startDate.setDate(endDate.getDate() - 15);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        return res.status(400).json({
          error: 'Período no válido. Use: 7d, 15d, 30d, 6m, 1y'
        });
    }

    // Consultar alertas del período y tipo especificado
    const alerts = await Alert.find({
      tipo: tipo,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).select('profit status exitPrice exitDate exitReason createdAt');

    // Calcular métricas
    const metrics = calculateServiceMetrics(alerts, period as string);

    // Cache headers para optimizar
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutos

    return res.status(200).json({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...metrics,
      dataProvider: 'Base de Datos Real',
      refreshRate: '30 minutos',
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error al calcular rendimiento del servicio:', error);

    return res.status(500).json({
      error: 'Error al calcular rendimiento del servicio',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * Calcula métricas de rendimiento basadas en las alertas
 */
function calculateServiceMetrics(alerts: any[], period: string): ServiceMetrics {
  const closedAlerts = alerts.filter(alert => alert.status === 'CLOSED');
  const activeAlerts = alerts.filter(alert => alert.status === 'ACTIVE').length;

  // Alertas ganadoras y perdedoras (basado en profit > 0)
  const winningAlerts = closedAlerts.filter(alert => alert.profit > 0);
  const losingAlerts = closedAlerts.filter(alert => alert.profit <= 0);

  // Calcular rendimiento porcentual promedio
  const totalReturnPercent = closedAlerts.length > 0
    ? closedAlerts.reduce((sum, alert) => sum + (alert.profit || 0), 0) / closedAlerts.length
    : 0;

  // Calcular métricas adicionales
  const winRate = closedAlerts.length > 0
    ? (winningAlerts.length / closedAlerts.length) * 100
    : 0;

  const averageGain = winningAlerts.length > 0
    ? winningAlerts.reduce((sum, alert) => sum + (alert.profit || 0), 0) / winningAlerts.length
    : 0;

  const averageLoss = losingAlerts.length > 0
    ? Math.abs(losingAlerts.reduce((sum, alert) => sum + (alert.profit || 0), 0) / losingAlerts.length)
    : 0;

  // Mejor y peor trade
  const profits = closedAlerts.map(alert => alert.profit || 0);
  const bestTrade = profits.length > 0 ? Math.max(...profits) : 0;
  const worstTrade = profits.length > 0 ? Math.min(...profits) : 0;

  return {
    totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
    activeAlerts,
    closedAlerts: closedAlerts.length,
    winningAlerts: winningAlerts.length,
    losingAlerts: losingAlerts.length,
    winRate: parseFloat(winRate.toFixed(1)),
    averageGain: parseFloat(averageGain.toFixed(2)),
    averageLoss: parseFloat(averageLoss.toFixed(2)),
    period,
    totalTrades: alerts.length,
    bestTrade: parseFloat(bestTrade.toFixed(2)),
    worstTrade: parseFloat(worstTrade.toFixed(2))
  };
}
