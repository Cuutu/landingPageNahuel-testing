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
      // Aquí calcularemos el rendimiento del servicio basado en las alertas
      // Por ahora usamos datos simulados basados en las métricas existentes

      // Obtener métricas del servicio (esto debería venir de tu API de métricas)
      const mockServiceData: ServicePerformanceData = {
        totalReturn: 0,
        totalReturnPercent: 0,
        activeAlerts: 0,
        closedAlerts: 0,
        winningAlerts: 0,
        losingAlerts: 0,
        winRate: 0,
        averageGain: 0,
        averageLoss: 0,
        period: selectedPeriod
      };

      // Calcular rendimientos basados en el período
      const baseReturn = 12.5; // Rendimiento base mensual
      const months = getMonthsFromPeriod(selectedPeriod);

      mockServiceData.totalReturnPercent = baseReturn * months + (Math.random() - 0.5) * 5;
      mockServiceData.totalReturn = 10000 * (mockServiceData.totalReturnPercent / 100);

      // Métricas adicionales simuladas
      mockServiceData.activeAlerts = Math.floor(Math.random() * 15) + 5;
      mockServiceData.closedAlerts = Math.floor(Math.random() * 50) + 20;
      mockServiceData.winningAlerts = Math.floor(mockServiceData.closedAlerts * 0.65);
      mockServiceData.losingAlerts = mockServiceData.closedAlerts - mockServiceData.winningAlerts;
      mockServiceData.winRate = (mockServiceData.winningAlerts / mockServiceData.closedAlerts) * 100;
      mockServiceData.averageGain = 8.5 + Math.random() * 4;
      mockServiceData.averageLoss = -5.2 + Math.random() * 2;

      setServiceData(mockServiceData);

    } catch (err) {
      console.error('Error calculating service performance:', err);
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
