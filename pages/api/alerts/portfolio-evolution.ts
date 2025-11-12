/**
 * API para obtener la evolución del portfolio basada en P&L real de alertas
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

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
    return res.status(405).json({ error: 'Método no permitido' });
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

    // Filtrar por tipo si se proporciona
    if (tipo && (tipo === 'TraderCall' || tipo === 'SmartMoney')) {
      alertQuery.tipo = tipo;
    }

    // Obtener todas las alertas en el rango de fechas
    const alerts = await Alert.find(alertQuery).sort({ createdAt: 1 }).lean();

    // Crear mapa de datos por día
    const dailyData = new Map<string, {
      date: string;
      value: number;
      profit: number;
      alertsCount: number;
      sp500Value?: number;
      sp500Change?: number;
    }>();

    // Inicializar todos los días en el rango
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const sp500Day = sp500Map.get(dateKey);
      dailyData.set(dateKey, {
        date: dateKey,
        value: 10000, // Portfolio inicial base
        profit: 0,
        alertsCount: 0,
        sp500Value: sp500Day?.value || 0,
        sp500Change: sp500Day?.change || 0
      });
    }

    // Calcular evolución acumulativa
    let cumulativeProfit = 0;
    let baseValue = 10000;

    // Procesar alertas por día
    const alertsByDay = new Map<string, any[]>();
    
    alerts.forEach(alert => {
      const alertDate = new Date(alert.createdAt);
      const dateKey = alertDate.toISOString().split('T')[0];
      
      if (!alertsByDay.has(dateKey)) {
        alertsByDay.set(dateKey, []);
      }
      alertsByDay.get(dateKey)!.push(alert);
    });

    // Procesar datos día por día
    const sortedDates = Array.from(dailyData.keys()).sort();
    
    for (const dateKey of sortedDates) {
      const dayAlerts = alertsByDay.get(dateKey) || [];
      const dayData = dailyData.get(dateKey)!;
      
      // Calcular profit del día
      const dayProfit = dayAlerts.reduce((sum, alert) => {
        return sum + (Number(alert.profit) || 0);
      }, 0);
      
      // Acumular profit
      cumulativeProfit += dayProfit;
      
      // Calcular valor del portfolio (base + profit acumulado)
      const portfolioValue = baseValue + (baseValue * (cumulativeProfit / 100));
      
      dayData.value = portfolioValue;
      dayData.profit = cumulativeProfit;
      dayData.alertsCount = dayAlerts.length;
    }

    // Convertir a array y ordenar
    const evolutionData = Array.from(dailyData.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calcular estadísticas generales (filtrar por tipo si se proporciona)
    const statsQuery: any = {};
    if (tipo && (tipo === 'TraderCall' || tipo === 'SmartMoney')) {
      statsQuery.tipo = tipo;
    }
    const allAlerts = await Alert.find(statsQuery).lean();
    const totalAlerts = allAlerts.length;
    const closedAlerts = allAlerts.filter(alert => alert.status === 'CLOSED');
    const winningAlerts = closedAlerts.filter(alert => (alert.profit || 0) > 0);
    
    // Winrate basado solo en alertas cerradas, máximo 100%
    const winRate = closedAlerts.length > 0 ? 
      Math.min((winningAlerts.length / closedAlerts.length) * 100, 100) : 0;
    
    const totalProfit = allAlerts.reduce((sum, alert) => sum + (alert.profit || 0), 0);
    
    // Calcular rendimientos relativos al S&P 500
    const sp500Return = sp500Data.length > 0 && sp500Data[0].value > 0 ? 
      ((sp500Data[sp500Data.length - 1].value - sp500Data[0].value) / sp500Data[0].value) * 100 : 0;
    
    const stats = {
      totalProfit: Number(totalProfit.toFixed(2)),
      totalAlerts,
      closedAlerts: closedAlerts.length,
      winRate: Number(winRate.toFixed(1)),
      sp500Return: Number(sp500Return.toFixed(2)),
      baseValue: baseValue
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