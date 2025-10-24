import { useState, useEffect } from 'react';

export interface SP500Data {
  currentPrice: number;
  startPrice: number;
  change: number;
  changePercent: number;
  periodChange?: number;
  periodChangePercent?: number;
  volatility: number;
  period: string;
  marketStatus: string;
  lastUpdate: string;
  dailyData: Array<{
    date: string;
    price: number;
    change: number;
    changePercent: number;
  }>;
}

export interface ServicePerformanceData {
  totalReturnPercent: number;
  relativePerformanceVsSP500: number;
  activeAlerts: number;
  closedAlerts: number;
  winningAlerts: number;
  losingAlerts: number;
  winRate: number;
  averageGain: number;
  averageLoss: number;
  totalTrades: number;
  period: string;
}

export function useSP500Performance(period: string = '30d', serviceType: 'TraderCall' | 'SmartMoney' = 'TraderCall') {
  const [sp500Data, setSp500Data] = useState<SP500Data | null>(null);
  const [serviceData, setServiceData] = useState<ServicePerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSP500Data = async (selectedPeriod: string) => {
    try {
      const response = await fetch(`/api/market-data/spy500-performance?period=${selectedPeriod}`);
      if (!response.ok) {
        throw new Error('Error al obtener datos del SP500');
      }
      const data = await response.json();
      setSp500Data(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching SP500 data:', err);
    }
  };

  const calculateServicePerformance = async (selectedPeriod: string) => {
    try {
      // Obtener métricas reales del servicio desde la base de datos
      const response = await fetch(`/api/performance/service-performance?period=${selectedPeriod}&tipo=${serviceType}`);

      if (!response.ok) {
        throw new Error('Error al obtener métricas del servicio');
      }

      const serviceMetrics = await response.json();

      // Calcular rendimiento relativo vs S&P500 usando la fórmula correcta
      const sp500Return = sp500Data?.periodChangePercent ?? sp500Data?.changePercent ?? 0;
      let relativePerformanceVsSP500 = 0;
      
      if (sp500Return !== 0) {
        // Fórmula: ((Trader Call − S&P500) / S&P500) × 100
        relativePerformanceVsSP500 = ((serviceMetrics.totalReturnPercent - sp500Return) / sp500Return) * 100;
      }
      
      console.log('Debug SP500 Performance:', {
        serviceReturn: serviceMetrics.totalReturnPercent,
        sp500Return,
        relativePerformance: relativePerformanceVsSP500
      });

      const serviceData: ServicePerformanceData = {
        totalReturnPercent: serviceMetrics.totalReturnPercent,
        relativePerformanceVsSP500: parseFloat(relativePerformanceVsSP500.toFixed(2)),
        activeAlerts: serviceMetrics.activeAlerts,
        closedAlerts: serviceMetrics.closedAlerts,
        winningAlerts: serviceMetrics.winningAlerts,
        losingAlerts: serviceMetrics.losingAlerts,
        winRate: serviceMetrics.winRate,
        averageGain: serviceMetrics.averageGain,
        averageLoss: serviceMetrics.averageLoss,
        totalTrades: serviceMetrics.totalTrades,
        period: selectedPeriod
      };

      setServiceData(serviceData);
      setError(null);

    } catch (err) {
      console.error('Error calculating service performance:', err);
      setError(err instanceof Error ? err.message : 'Error al calcular rendimiento del servicio');

      // Fallback a datos simulados si hay error
      const fallbackData: ServicePerformanceData = {
        totalReturnPercent: 12.5,
        relativePerformanceVsSP500: 0, // Se calculará cuando se tengan datos del SP500
        activeAlerts: 8,
        closedAlerts: 25,
        winningAlerts: 16,
        losingAlerts: 9,
        winRate: 64.0,
        averageGain: 8.5,
        averageLoss: 5.2,
        totalTrades: 33,
        period: selectedPeriod
      };
      setServiceData(fallbackData);
    }
  };

  const refreshData = async (selectedPeriod: string) => {
    setLoading(true);
    await Promise.all([
      fetchSP500Data(selectedPeriod),
      calculateServicePerformance(selectedPeriod)
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshData(period);
  }, [period]);

  return {
    sp500Data,
    serviceData,
    loading,
    error,
    refreshData
  };
}

/**
 * Convierte el período a meses para cálculos
 */
function getMonthsFromPeriod(period: string): number {
  switch (period) {
    case '7d': return 1/4;
    case '15d': return 0.5;
    case '30d': return 1;
    case '6m': return 6;
    case '1y': return 12;
    default: return 1;
  }
}
