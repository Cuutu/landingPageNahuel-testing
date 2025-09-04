import { NextApiRequest, NextApiResponse } from 'next';

/**
 * API endpoint para obtener rendimiento histórico del S&P 500 por períodos
 * GET /api/market-data/spy500-performance?period=7d|15d|30d|6m|1y
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { period = '30d' } = req.query;

    console.log(`📊 Obteniendo rendimiento del S&P 500 para período: ${period}`);

    // Calcular fechas según el período solicitado
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
        return res.status(400).json({ error: 'Período no válido. Use: 7d, 15d, 30d, 6m, 1y' });
    }

    // Generar datos históricos simulados realistas
    const performanceData = generateHistoricalPerformance(startDate, endDate, period as string);

    // Cache headers para optimizar
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutos

    return res.status(200).json({
      period: period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      ...performanceData,
      dataProvider: 'Simulado',
      refreshRate: '30 minutos'
    });

  } catch (error) {
    console.error('❌ Error al obtener rendimiento del S&P 500:', error);

    return res.status(500).json({
      error: 'Error al obtener rendimiento del S&P 500',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * Genera datos históricos de rendimiento simulados pero realistas
 */
function generateHistoricalPerformance(startDate: Date, endDate: Date, period: string) {
  const now = new Date();
  const currentPrice = 4850 + (Math.random() - 0.5) * 100; // Precio actual del S&P 500 (más realista)

  // Precios históricos basados en rendimiento típico del S&P 500
  const historicalPrices: { [key: string]: number } = {
    '7d': currentPrice * (1 - 0.005), // Pequeña caída típica semanal
    '15d': currentPrice * (1 + 0.008), // Pequeña subida quincenal
    '30d': currentPrice * (1 + 0.015), // Subida mensual típica
    '6m': currentPrice * (1 + 0.045), // Subida semestral típica
    '1y': currentPrice * (1 + 0.085)  // Subida anual típica
  };

  const startPrice = historicalPrices[period] || currentPrice * 0.95;
  const change = currentPrice - startPrice;
  const changePercent = (change / startPrice) * 100;

  // Generar volatilidad diaria para el período
  const dailyVolatility = generateDailyVolatility(startDate, endDate, startPrice, currentPrice);

  return {
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    startPrice: parseFloat(startPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    volatility: parseFloat((Math.abs(changePercent) * 0.3).toFixed(2)), // Volatilidad aproximada
    dailyData: dailyVolatility,
    marketStatus: getMarketStatus(),
    lastUpdate: now.toISOString()
  };
}

/**
 * Genera datos diarios de volatilidad para el período
 */
function generateDailyVolatility(startDate: Date, endDate: Date, startPrice: number, endPrice: number) {
  const dailyData = [];
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Generar datos diarios (máximo 30 días para no sobrecargar)
  const maxDays = Math.min(totalDays, 30);
  const stepDays = Math.max(1, Math.floor(totalDays / maxDays));

  let currentPrice = startPrice;
  const totalChange = endPrice - startPrice;
  const dailyChange = totalChange / maxDays;

  for (let i = 0; i < maxDays; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + (i * stepDays));

    // Agregar variación aleatoria para simular volatilidad
    const randomVariation = (Math.random() - 0.5) * 0.02; // ±2%
    currentPrice = currentPrice + dailyChange + (currentPrice * randomVariation);

    dailyData.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat((dailyChange + (currentPrice * randomVariation)).toFixed(2)),
      changePercent: parseFloat(((dailyChange + (currentPrice * randomVariation)) / currentPrice * 100).toFixed(2))
    });
  }

  return dailyData;
}

/**
 * Determina el estado actual del mercado
 */
function getMarketStatus(): string {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Fines de semana
  if (currentDay === 0 || currentDay === 6) {
    return 'Cerrado - Fin de semana';
  }

  // Horario de mercado: 9:30 AM - 4:00 PM EST
  if (currentHour >= 9 && currentHour < 16) {
    return 'Abierto';
  } else if (currentHour >= 16 && currentHour < 20) {
    return 'After Hours';
  } else if (currentHour >= 4 && currentHour < 9) {
    return 'Pre-Market';
  } else {
    return 'Cerrado';
  }
}
