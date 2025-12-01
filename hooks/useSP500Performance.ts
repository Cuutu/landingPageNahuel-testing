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
      console.log(`📊 [SP500] Calculando rendimiento para serviceType: ${serviceType}, período: ${selectedPeriod}`);
      // ✅ NUEVO: Usar el nuevo endpoint de rendimientos basado en valorTotalCartera y valorActualCartera
      const response = await fetch(`/api/portfolio/returns?pool=${serviceType}`);

      if (!response.ok) {
        throw new Error('Error al obtener métricas del servicio');
      }

      const returnsData = await response.json();

      if (!returnsData.success || !returnsData.data) {
        throw new Error('No hay datos disponibles para el período seleccionado');
      }

      // Obtener datos del portfolio-evolution PRIMERO (igual que PortfolioTimeRange)
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
      console.log(`📊 [SP500] Obteniendo portfolio-evolution para tipo: ${serviceType}, días: ${days}`);
      const portfolioResponse = await fetch(`/api/alerts/portfolio-evolution?days=${days}&tipo=${serviceType}`);
      
      let activeAlerts = 0;
      let closedAlerts = 0;
      let winRate = 0;
      let totalTrades = 0;
      let portfolioReturn = null; // ✅ Rendimiento calculado desde portfolio-evolution (igual que PortfolioTimeRange)

      if (portfolioResponse.ok) {
        const portfolioData = await portfolioResponse.json();
        if (portfolioData.success && portfolioData.stats) {
          activeAlerts = portfolioData.stats.totalAlerts || 0;
          closedAlerts = portfolioData.stats.closedAlerts || 0;
          winRate = portfolioData.stats.winRate || 0;
          totalTrades = portfolioData.stats.totalAlerts || 0;
          
          // ✅ CORREGIDO: Calcular portfolioReturn desde los datos de evolución (EXACTAMENTE igual que PortfolioTimeRange)
          if (portfolioData.data && portfolioData.data.length > 0) {
            const firstValue = portfolioData.data[0]?.value || 10000;
            const lastValue = portfolioData.data[portfolioData.data.length - 1]?.value || 10000;
            const change = lastValue - firstValue;
            portfolioReturn = firstValue ? (change / firstValue) * 100 : 0;
            
            console.log(`📊 [SP500] Calculado portfolioReturn desde evolución (igual que PortfolioTimeRange):`, {
              firstValue,
              lastValue,
              change,
              portfolioReturn,
              dataLength: portfolioData.data.length
            });
          } else {
            // Si no hay datos de evolución, usar 0
            portfolioReturn = 0;
          }
        }
      }
      
      // ✅ CORREGIDO: Usar EXACTAMENTE la misma lógica que PortfolioTimeRange.calculatePerformance()
      // PortfolioTimeRange usa serviceReturn si está disponible, sino calcula desde portfolioData
      // Para asegurar que muestre el MISMO valor, usamos portfolioReturn cuando esté disponible
      const returnsKey = periodToReturnsKey(selectedPeriod);
      const rawReturnValue = returnsData.data.returns[returnsKey];
      
      // ✅ IMPORTANTE: Priorizar el cálculo desde portfolioData (igual que PortfolioTimeRange cuando serviceReturn es null)
      // Esto asegura que el rendimiento sea EXACTAMENTE el mismo que en "Evolución del Portafolio Real"
      let totalReturnPercent: number;
      
      // Si tenemos el cálculo desde portfolioData, usarlo (es la misma fuente que PortfolioTimeRange)
      if (portfolioReturn !== null && portfolioReturn !== undefined) {
        totalReturnPercent = portfolioReturn;
        console.log(`📊 [SP500] Usando cálculo desde portfolio-evolution: ${totalReturnPercent}% (igual que Evolución del Portafolio Real)`);
      } else if (rawReturnValue !== null && rawReturnValue !== undefined) {
        // Fallback: usar /api/portfolio/returns solo si no hay datos de portfolioData
        totalReturnPercent = rawReturnValue;
        console.log(`📊 [SP500] Usando rendimiento desde /api/portfolio/returns (fallback): ${totalReturnPercent}%`);
      } else {
        totalReturnPercent = 0;
        console.warn(`⚠️ [SP500] No hay datos disponibles para período ${selectedPeriod}`);
      }
      
      console.log(`📊 [SP500] Rendimiento final del servicio para período ${selectedPeriod}:`, {
        selectedPeriod,
        returnsKey,
        rawReturnValue,
        portfolioReturn,
        finalValue: totalReturnPercent,
        source: rawReturnValue !== null && rawReturnValue !== undefined ? 'portfolio/returns' : 'portfolio-evolution (igual que Evolución del Portafolio Real)'
      });

      const serviceData: ServicePerformanceData = {
        totalReturnPercent: typeof totalReturnPercent === 'number' ? parseFloat(totalReturnPercent.toFixed(2)) : 0,
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
      
      console.log(`✅ [SP500] ServiceData creado:`, {
        totalReturnPercent: serviceData.totalReturnPercent,
        period: serviceData.period,
        serviceType
      });

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
    console.log(`🔄 [SP500] refreshData iniciado para período: ${selectedPeriod}, serviceType: ${serviceType}`);
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSP500Data(selectedPeriod),
        calculateServicePerformance(selectedPeriod)
      ]);
      console.log(`✅ [SP500] refreshData completado para período: ${selectedPeriod}, serviceType: ${serviceType}`);
    } catch (err) {
      console.error('❌ [SP500] Error en refreshData:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(`🔄 [SP500] useEffect: Cambio de período a ${period}, serviceType: ${serviceType}`);
    // ✅ CORREGIDO: Limpiar datos anteriores cuando cambia el período para forzar recarga
    setServiceData(null);
    setSp500Data(null);
    setLoading(true);
    refreshData(period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, serviceType]);

  // Recalcular rendimiento relativo cuando sp500Data o serviceData cambien
  useEffect(() => {
    if (sp500Data && serviceData) {
      const sp500Return = sp500Data.periodChangePercent ?? sp500Data.changePercent ?? 0;
      const serviceReturn = serviceData.totalReturnPercent ?? 0;
      const totalAlerts = serviceData.totalTrades || 0;
      
      // ✅ CORREGIDO: Si no hay alertas, el rendimiento relativo debe ser -100%
      // Sin operaciones, se considera pérdida total comparado con el mercado
      let relativePerformanceVsSP500 = -100;
      
      if (totalAlerts > 0) {
        // ✅ CORREGIDO: Calcular diferencia simple en puntos porcentuales
        // Fórmula: Rendimiento del Servicio - Rendimiento del S&P 500
        // Esto muestra cuántos puntos porcentuales más (o menos) rindió el servicio vs el S&P 500
        relativePerformanceVsSP500 = serviceReturn - sp500Return;
      } else {
        console.log(`📊 [SP500] No hay alertas (${totalAlerts}), estableciendo rendimiento relativo en -100%`);
      }
      
      console.log(`📊 [SP500] Calculando rendimiento relativo vs S&P 500:`, {
        serviceReturn,
        sp500Return,
        relativePerformance: relativePerformanceVsSP500,
        period: serviceData.period,
        totalAlerts
      });
      
      setServiceData(prev => prev ? {
        ...prev,
        relativePerformanceVsSP500: parseFloat(relativePerformanceVsSP500.toFixed(2))
      } : null);
    }
  }, [sp500Data, serviceData]);

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
