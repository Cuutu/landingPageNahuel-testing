import { useState, useEffect } from 'react';

export interface SP500Data {
  currentPrice: number;
  startPrice: number;
  change: number;
  changePercent: number;
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
  totalReturn: number;
  totalReturnPercent: number;
  activeAlerts: number;
  closedAlerts: number;
  winningAlerts: number;
  losingAlerts: number;
  winRate: number;
  averageGain: number;
  averageLoss: number;
  period: string;
}

export function useSP500Performance(period: string = '30d') {
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
      const response = await fetch(`/api/performance/service-performance?period=${selectedPeriod}&tipo=TraderCall`);

      if (!response.ok) {
        throw new Error('Error al obtener métricas del servicio');
      }

      const serviceMetrics = await response.json();

      const serviceData: ServicePerformanceData = {
        totalReturn: serviceMetrics.totalReturn,
        totalReturnPercent: serviceMetrics.totalReturnPercent,
        activeAlerts: serviceMetrics.activeAlerts,
        closedAlerts: serviceMetrics.closedAlerts,
        winningAlerts: serviceMetrics.winningAlerts,
        losingAlerts: serviceMetrics.losingAlerts,
        winRate: serviceMetrics.winRate,
        averageGain: serviceMetrics.averageGain,
        averageLoss: serviceMetrics.averageLoss,
        period: selectedPeriod
      };

      setServiceData(serviceData);
      setError(null);

    } catch (err) {
      console.error('Error calculating service performance:', err);
      setError(err instanceof Error ? err.message : 'Error al calcular rendimiento del servicio');

      // Fallback a datos simulados si hay error
      const fallbackData: ServicePerformanceData = {
        totalReturn: 1250,
        totalReturnPercent: 12.5,
        activeAlerts: 8,
        closedAlerts: 25,
        winningAlerts: 16,
        losingAlerts: 9,
        winRate: 64.0,
        averageGain: 8.5,
        averageLoss: 5.2,
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
