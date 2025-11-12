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

  // Convertir período a días (igual que PortfolioTimeRange)
  const periodToDays = (period: string): number => {
    switch (period) {
      case '7d': return 7;
      case '15d': return 15;
      case '30d': return 30;
      case '6m': return 180;
      case '1y': return 365;
      default: return 30;
    }
  };

  const calculateServicePerformance = async (selectedPeriod: string) => {
    try {
      // Usar el mismo endpoint que PortfolioTimeRange
      const days = periodToDays(selectedPeriod);
      const response = await fetch(`/api/alerts/portfolio-evolution?days=${days}&tipo=${serviceType}`);

      if (!response.ok) {
        throw new Error('Error al obtener métricas del servicio');
      }

      const portfolioData = await response.json();

      if (!portfolioData.success || !portfolioData.data || portfolioData.data.length === 0) {
        throw new Error('No hay datos disponibles para el período seleccionado');
      }

      // Calcular rendimiento de la misma manera que PortfolioTimeRange
      const firstValue = portfolioData.data[0]?.value || 10000;
      const lastValue = portfolioData.data[portfolioData.data.length - 1]?.value || 10000;
      const change = lastValue - firstValue;
      const totalReturnPercent = firstValue ? (change / firstValue) * 100 : 0;

      const serviceData: ServicePerformanceData = {
        totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
        relativePerformanceVsSP500: 0, // Se calculará después cuando sp500Data esté disponible
        activeAlerts: portfolioData.stats?.totalAlerts || 0,
        closedAlerts: portfolioData.stats?.closedAlerts || 0,
        winningAlerts: 0, // No disponible en portfolio-evolution
        losingAlerts: 0, // No disponible en portfolio-evolution
        winRate: portfolioData.stats?.winRate || 0,
        averageGain: 0, // No disponible en portfolio-evolution
        averageLoss: 0, // No disponible en portfolio-evolution
        totalTrades: portfolioData.stats?.totalAlerts || 0,
        period: selectedPeriod
      };

      setServiceData(serviceData);
      setError(null);

    } catch (err) {
      console.error('Error calculating service performance:', err);
      setError(err instanceof Error ? err.message : 'Error al calcular rendimiento del servicio');

      // Fallback a datos simulados si hay error
      const fallbackData: ServicePerformanceData = {
        totalReturnPercent: 0,
        relativePerformanceVsSP500: 0,
        activeAlerts: 0,
        closedAlerts: 0,
        winningAlerts: 0,
        losingAlerts: 0,
        winRate: 0,
        averageGain: 0,
        averageLoss: 0,
        totalTrades: 0,
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

  // Recalcular rendimiento relativo cuando sp500Data cambie
  useEffect(() => {
    if (sp500Data && serviceData) {
      const sp500Return = sp500Data.periodChangePercent ?? sp500Data.changePercent ?? 0;
      let relativePerformanceVsSP500 = 0;
      
      if (sp500Return !== 0) {
        relativePerformanceVsSP500 = ((serviceData.totalReturnPercent - sp500Return) / sp500Return) * 100;
      }
      
      setServiceData(prev => prev ? {
        ...prev,
        relativePerformanceVsSP500: parseFloat(relativePerformanceVsSP500.toFixed(2))
      } : null);
    }
  }, [sp500Data]);

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
