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
  dataProvider?: string; // ✅ NUEVO: Fuente de los datos (Yahoo Finance, Alpha Vantage, etc.)
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

export function useSP500Performance(period: string = '1m', serviceType: 'TraderCall' | 'SmartMoney' = 'TraderCall') {
  const [sp500Data, setSp500Data] = useState<SP500Data | null>(null);
  const [serviceData, setServiceData] = useState<ServicePerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSP500Data = async (selectedPeriod: string) => {
    try {
      console.log(`📊 [SP500] Obteniendo datos para período: ${selectedPeriod}`);
      const response = await fetch(`/api/market-data/spy500-performance?period=${selectedPeriod}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error HTTP ${response.status}: Error al obtener datos del SP500`);
      }
      
      const data = await response.json();
      console.log(`✅ [SP500] Datos recibidos:`, {
        periodChangePercent: data.periodChangePercent,
        changePercent: data.changePercent,
        currentPrice: data.currentPrice,
        dataProvider: data.dataProvider
      });
      
      // Verificar que los datos tienen al menos un campo de porcentaje
      if (data.periodChangePercent === undefined && data.changePercent === undefined) {
        console.warn('⚠️ [SP500] Datos recibidos sin porcentaje de cambio');
      }
      
      setSp500Data(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error('❌ [SP500] Error fetching SP500 data:', err);
      setError(errorMessage);
      // No establecer sp500Data a null, mantener el último valor si existe
    }
  };

  // Convertir período a clave del endpoint de returns
  const periodToReturnsKey = (period: string): string => {
    switch (period) {
      case '1d': return '1d';
      case '7d': return '7d';
      case '15d': return '15d';
      case '30d': return '30d';
      case '6m': return '180d';
      case '1y': return '365d';
      default: return '30d';
    }
  };

  const calculateServicePerformance = async (selectedPeriod: string) => {
    try {
      // ✅ NUEVO: Usar el nuevo endpoint de rendimientos basado en valorTotalCartera y valorActualCartera
      const response = await fetch(`/api/portfolio/returns?pool=${serviceType}`);

      if (!response.ok) {
        throw new Error('Error al obtener métricas del servicio');
      }

      const returnsData = await response.json();

      if (!returnsData.success || !returnsData.data) {
        throw new Error('No hay datos disponibles para el período seleccionado');
      }

      // Obtener el rendimiento para el período seleccionado
      const returnsKey = periodToReturnsKey(selectedPeriod);
      const totalReturnPercent = returnsData.data.returns[returnsKey] ?? 0;

      // Obtener datos adicionales del portfolio-evolution para estadísticas
      const periodToDays = (period: string): number => {
        switch (period) {
          case '1d': return 1;
          case '7d': return 7;
          case '15d': return 15;
          case '30d': return 30;
          case '6m': return 180;
          case '1y': return 365; 
          default: return 30;
        }
      };

      const days = periodToDays(selectedPeriod);
      const portfolioResponse = await fetch(`/api/alerts/portfolio-evolution?days=${days}&tipo=${serviceType}`);
      
      let activeAlerts = 0;
      let closedAlerts = 0;
      let winRate = 0;
      let totalTrades = 0;

      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        if (portfolioData.success && portfolioData.stats) {
          activeAlerts = portfolioData.stats.totalAlerts || 0;
          closedAlerts = portfolioData.stats.closedAlerts || 0;
          winRate = portfolioData.stats.winRate || 0;
          totalTrades = portfolioData.stats.totalAlerts || 0;
        }
      }

      const serviceData: ServicePerformanceData = {
        totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2)),
        relativePerformanceVsSP500: 0, // Se calculará después cuando sp500Data esté disponible
        activeAlerts,
        closedAlerts,
        winningAlerts: 0, // No disponible en portfolio-evolution
        losingAlerts: 0, // No disponible en portfolio-evolution
        winRate,
        averageGain: 0, // No disponible en portfolio-evolution
        averageLoss: 0, // No disponible en portfolio-evolution
        totalTrades,
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
    console.log(`🔄 [SP500] refreshData iniciado para período: ${selectedPeriod}`);
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSP500Data(selectedPeriod),
        calculateServicePerformance(selectedPeriod)
      ]);
      console.log(`✅ [SP500] refreshData completado para período: ${selectedPeriod}`);
    } catch (err) {
      console.error('❌ [SP500] Error en refreshData:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(`🔄 [SP500] useEffect: Cambio de período a ${period}`);
    refreshData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    case '1d': return 1/30;
    case '7d': return 7/30;
    case '15d': return 15/30;
    case '30d': return 1;
    case '6m': return 6;
    case '1y': return 12;
    default: return 1;
  }
}
