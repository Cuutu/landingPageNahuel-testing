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
    const poolType = tipo && (tipo === 'TraderCall' || tipo === 'SmartMoney') ? tipo : 'TraderCall';
    if (tipo && (tipo === 'TraderCall' || tipo === 'SmartMoney')) {
      alertQuery.tipo = tipo;
    }

    // ✅ NUEVO: Obtener liquidez inicial y total del sistema
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });
    
    let initialLiquidity = 10000; // Valor por defecto
    let totalLiquidity = 10000; // Valor por defecto
    
    if (adminUser) {
      const liquidityDocs = await Liquidity.find({ 
        createdBy: adminUser._id, 
        pool: poolType 
      }).lean();
      
      if (liquidityDocs.length > 0) {
        // Obtener liquidez inicial global (del documento más reciente)
        const docsWithInitialLiquidity = liquidityDocs.filter((doc: any) => 
          doc.initialLiquidity !== undefined && doc.initialLiquidity !== null && doc.initialLiquidity > 0
        );
        
        if (docsWithInitialLiquidity.length > 0) {
          const sortedByUpdate = [...docsWithInitialLiquidity].sort((a: any, b: any) => 
            new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
          );
          initialLiquidity = sortedByUpdate[0].initialLiquidity;
        } else {
          // Fallback: calcular desde el primer documento
          const firstDoc = liquidityDocs[0];
          initialLiquidity = firstDoc.totalLiquidity - (firstDoc.totalProfitLoss || 0);
        }
        
        // Calcular liquidez total actual (suma de todos los documentos)
        let totalProfitLoss = 0;
        liquidityDocs.forEach((doc: any) => {
          const unrealized = (doc.distributions || []).reduce((sum: number, dist: any) => sum + (dist.profitLoss || 0), 0);
          const realized = (doc.distributions || []).reduce((sum: number, dist: any) => sum + (dist.realizedProfitLoss || 0), 0);
          totalProfitLoss += (unrealized + realized);
        });
        
        totalLiquidity = initialLiquidity + totalProfitLoss;
      }
    }

    console.log(`📊 [PORTFOLIO] Liquidez Inicial: $${initialLiquidity}, Liquidez Total: $${totalLiquidity}`);

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

    // ✅ NUEVO: Calcular rendimiento basado en liquidez
    // Fórmula: ((Liquidez Total - Liquidez Inicial) / Liquidez Inicial) × 100
    const performancePercentage = initialLiquidity > 0 
      ? ((totalLiquidity - initialLiquidity) / initialLiquidity) * 100 
      : 0;
    
    console.log(`📊 [PORTFOLIO] Rendimiento calculado: ${performancePercentage.toFixed(2)}%`);

    // Inicializar todos los días en el rango
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const sp500Day = sp500Map.get(dateKey);
      dailyData.set(dateKey, {
        date: dateKey,
        value: initialLiquidity, // ✅ NUEVO: Usar liquidez inicial como base
        profit: 0,
        alertsCount: 0,
        sp500Value: sp500Day?.value || 0,
        sp500Change: sp500Day?.change || 0
      });
    }

    // ✅ NUEVO: Calcular evolución basada en liquidez real
    // El valor del portfolio evoluciona desde initialLiquidity hasta totalLiquidity
    // Distribuir el cambio proporcionalmente a lo largo del período
    const liquidityChange = totalLiquidity - initialLiquidity;
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyChange = totalDays > 0 ? liquidityChange / totalDays : 0;
    
    let currentLiquidity = initialLiquidity;

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

    // ✅ NUEVO: Procesar datos día por día basado en liquidez real
    const sortedDates = Array.from(dailyData.keys()).sort();
    
    for (const dateKey of sortedDates) {
      const dayAlerts = alertsByDay.get(dateKey) || [];
      const dayData = dailyData.get(dateKey)!;
      
      // ✅ NUEVO: Calcular valor del portfolio basado en liquidez
      // El valor evoluciona proporcionalmente desde initialLiquidity hasta totalLiquidity
      // Para el último día, usar totalLiquidity exacto
      if (dateKey === sortedDates[sortedDates.length - 1]) {
        dayData.value = totalLiquidity;
      } else {
        currentLiquidity += dailyChange;
        dayData.value = Math.max(initialLiquidity, Math.min(totalLiquidity, currentLiquidity));
      }
      
      // Calcular profit acumulado como diferencia desde liquidez inicial
      dayData.profit = dayData.value - initialLiquidity;
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
      totalProfit: Number((totalLiquidity - initialLiquidity).toFixed(2)), // ✅ NUEVO: Ganancia real en dólares
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