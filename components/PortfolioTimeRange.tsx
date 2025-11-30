import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, BarChart3, Target, Percent } from 'lucide-react';
import styles from './PortfolioTimeRange.module.css';

interface TimeRangeOption {
  value: string;
  label: string;
  days: number;
  description: string;
}

interface PortfolioData {
  date: string;
  value: number;
  profit: number;
  alertsCount: number;
  sp500Value?: number;
  sp500Change?: number;
}

interface PortfolioStats {
  totalProfit: number;
  totalAlerts: number;
  closedAlerts: number;
  winRate: number;
  sp500Return: number;
  baseValue: number;
}

interface PortfolioTimeRangeProps {
  selectedRange: string;
  onRangeChange: (range: string, days: number) => void;
  onPortfolioUpdate?: (stats: PortfolioStats) => void; // ✅ NUEVO: Callback para actualizar dashboard
  serviceType?: 'TraderCall' | 'SmartMoney'; // ✅ NUEVO: Tipo de servicio para filtrar datos
}

// ✅ NUEVO: Opciones de rango actualizadas según requerimientos
const timeRangeOptions: TimeRangeOption[] = [
  {
    value: '7d',
    label: '7 Días',
    days: 7,
    description: 'Evolución semanal'
  },
  {
    value: '15d',
    label: '15 Días',
    days: 15,
    description: 'Evolución quincenal'
  },
  {
    value: '30d',
    label: '30 Días',
    days: 30,
    description: 'Evolución mensual'
  },
  {
    value: '6m',
    label: '6 Meses',
    days: 180,
    description: 'Evolución semestral'
  },
  {
    value: '1a',
    label: '1 Año',
    days: 365,
    description: 'Evolución anual'
  }
];

const PortfolioTimeRange: React.FC<PortfolioTimeRangeProps> = ({
  selectedRange,
  onRangeChange,
  onPortfolioUpdate,
  serviceType = 'TraderCall' // ✅ NUEVO: Valor por defecto para compatibilidad
}) => {
  // ✅ NUEVO: Nombre del servicio para mostrar en textos
  const serviceName = serviceType === 'SmartMoney' ? 'Smart Money' : 'Trader Call';
  const [portfolioData, setPortfolioData] = useState<PortfolioData[]>([]);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
  const [serviceReturn, setServiceReturn] = useState<number | null>(null); // ✅ NUEVO: Almacenar rendimiento del servicio por período
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPreference, setUserPreference] = useState<string>(selectedRange);
  
  // ✅ NUEVO: Cargar preferencia del usuario al montar el componente
  useEffect(() => {
    loadUserPreference();
  }, []);

  // ✅ NUEVO: Cargar preferencia guardada del usuario
  const loadUserPreference = async () => {
    try {
      // Intentar cargar desde localStorage
      const savedRange = localStorage.getItem('portfolioTimeRange');
      if (savedRange && timeRangeOptions.find(opt => opt.value === savedRange)) {
        setUserPreference(savedRange);
        // Aplicar el rango guardado automáticamente
        const option = timeRangeOptions.find(opt => opt.value === savedRange);
        if (option) {
          onRangeChange(savedRange, option.days);
        }
      }
    } catch (error) {
      console.warn('No se pudo cargar preferencia del usuario:', error);
    }
  };

  // ✅ NUEVO: Guardar preferencia del usuario
  const saveUserPreference = async (range: string) => {
    try {
      // Guardar en localStorage
      localStorage.setItem('portfolioTimeRange', range);
      
      // ✅ NUEVO: Guardar en backend si el usuario está autenticado
      const response = await fetch('/api/profile/update-portfolio-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ portfolioTimeRange: range })
      });
      
      if (response.ok) {
        console.log('✅ Preferencia de portfolio guardada en backend');
      }
    } catch (error) {
      console.warn('No se pudo guardar preferencia en backend:', error);
      // Continuar con localStorage como fallback
    }
  };

  const fetchPortfolioData = async (days: number) => {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ CAMBIO: Usar API global sin autenticación, incluyendo tipo de servicio
      const [evolutionResponse, returnsResponse] = await Promise.all([
        fetch(`/api/alerts/portfolio-evolution?days=${days}&tipo=${serviceType}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
        fetch(`/api/portfolio/returns?pool=${serviceType}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      ]);
      
      const evolutionResult = await evolutionResponse.json();
      const returnsResult = await returnsResponse.json();
      
      if (evolutionResult.success) {
        setPortfolioData(evolutionResult.data || []);
        
        // ✅ CORREGIDO: Usar el rendimiento del servicio desde /api/portfolio/returns para consistencia
        // Convertir días a clave de período
        let periodKey = '30d';
        if (days === 1) periodKey = '1d';
        else if (days === 7) periodKey = '7d';
        else if (days === 15) periodKey = '15d';
        else if (days === 30) periodKey = '30d';
        else if (days === 180) periodKey = '180d';
        else if (days === 365) periodKey = '365d';
        
        const serviceReturnValue = returnsResult.success && returnsResult.data?.returns?.[periodKey] 
          ? returnsResult.data.returns[periodKey] 
          : null;
        
        // ✅ NUEVO: Guardar el rendimiento del servicio en el estado para que varíe según el período
        setServiceReturn(serviceReturnValue);
        
        // ✅ NUEVO: Calcular estadísticas mejoradas usando el rendimiento correcto
        const stats = calculateEnhancedStats(
          evolutionResult.data || [], 
          evolutionResult.stats || null,
          serviceReturnValue
        );
        setPortfolioStats(stats);
        
        // ✅ NUEVO: Notificar al dashboard sobre la actualización
        if (onPortfolioUpdate) {
          onPortfolioUpdate(stats);
        }
      } else {
        setError(evolutionResult.error || 'Error al cargar datos del portfolio');
      }
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      setError('Error de conexión al cargar datos del portfolio');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const selectedOption = timeRangeOptions.find(opt => opt.value === selectedRange);
    if (selectedOption) {
      fetchPortfolioData(selectedOption.days);
    }
  }, [selectedRange]);

  // ✅ NUEVO: Actualización automática cada 30 segundos para datos en tiempo real
  useEffect(() => {
    const selectedOption = timeRangeOptions.find(opt => opt.value === selectedRange);
    if (!selectedOption) return;

    // Actualizar inmediatamente al montar
    fetchPortfolioData(selectedOption.days);

    // Configurar intervalo de actualización cada 30 segundos
    const intervalId = setInterval(() => {
      fetchPortfolioData(selectedOption.days);
    }, 30000); // 30 segundos

    // Limpiar intervalo al desmontar o cambiar rango
    return () => {
      clearInterval(intervalId);
    };
  }, [selectedRange]);

  // Calcular estadísticas usando datos del API actualizado
  const calculateEnhancedStats = (data: PortfolioData[], baseStats: any, serviceReturnFromAPI: number | null = null): PortfolioStats => {
    if (!baseStats) {
      return {
        totalProfit: 0,
        totalAlerts: 0,
        closedAlerts: 0,
        winRate: 0,
        sp500Return: 0,
        baseValue: 10000
      };
    }
    
    // ✅ CORREGIDO: Usar el rendimiento del servicio desde /api/portfolio/returns si está disponible
    // Esto asegura consistencia con el componente SP500Comparison
    let portfolioReturn = 0;
    
    if (serviceReturnFromAPI !== null && serviceReturnFromAPI !== undefined) {
      // Usar el rendimiento del API de returns (mismo que usa SP500Comparison)
      portfolioReturn = serviceReturnFromAPI;
      console.log('📊 [PortfolioTimeRange] Usando rendimiento del servicio desde /api/portfolio/returns:', portfolioReturn);
    } else {
      // Fallback: calcular desde los datos de evolución
      const portfolioDataForCalc = data.length > 0 ? data : [];
      const firstValue = portfolioDataForCalc[0]?.value || 10000;
      const lastValue = portfolioDataForCalc[portfolioDataForCalc.length - 1]?.value || 10000;
      portfolioReturn = firstValue ? ((lastValue - firstValue) / firstValue) * 100 : 0;
      console.log('📊 [PortfolioTimeRange] Calculando rendimiento desde datos de evolución:', {
        portfolioReturn,
        firstValue,
        lastValue,
        dataLength: data.length
      });
    }
    
    const sp500Return = baseStats.sp500Return || 0; // Rendimiento del S&P 500 para el período seleccionado
    
    // ✅ CORREGIDO: Calcular diferencia simple en puntos porcentuales
    // Fórmula: Rendimiento del Portfolio - Rendimiento del S&P 500
    // Esto muestra cuántos puntos porcentuales más (o menos) rindió el portfolio vs el S&P 500
    const relativePerformanceVsSP500 = portfolioReturn - sp500Return;
    
    console.log('📊 [PortfolioTimeRange] Calculando rendimiento relativo vs S&P 500:', {
      portfolioReturn,
      sp500Return,
      relativePerformance: relativePerformanceVsSP500,
      serviceReturnFromAPI,
      usingAPIData: serviceReturnFromAPI !== null
    });
    
    return {
      totalProfit: baseStats.totalProfit || 0,
      totalAlerts: baseStats.totalAlerts || 0,
      closedAlerts: baseStats.closedAlerts || 0,
      winRate: baseStats.winRate || 0,
      sp500Return: relativePerformanceVsSP500, // Ahora es el rendimiento relativo
      baseValue: baseStats.baseValue || 10000
    };
  };

  const calculatePerformance = () => {
    // ✅ CORREGIDO: Usar el rendimiento del servicio desde el API si está disponible
    // Esto asegura que el rendimiento varíe según el período seleccionado
    if (serviceReturn !== null && serviceReturn !== undefined) {
      // Calcular el cambio y valor actual basado en el rendimiento porcentual
      const baseValue = portfolioStats?.baseValue || 10000;
      const percentage = serviceReturn;
      const change = (baseValue * percentage) / 100;
      const currentValue = baseValue + change;
      
      console.log('📊 [PortfolioTimeRange] Usando rendimiento del servicio desde API:', {
        serviceReturn,
        baseValue,
        change,
        percentage,
        currentValue,
        selectedRange
      });
      
      return { change, percentage, currentValue };
    }
    
    // Fallback: calcular desde los datos de evolución si no hay rendimiento del API
    if (portfolioData.length === 0) return { change: 0, percentage: 0, currentValue: 10000 };
    
    const firstValue = portfolioData[0]?.value || 10000;
    const lastValue = portfolioData[portfolioData.length - 1]?.value || 10000;
    
    const change = lastValue - firstValue;
    const percentage = firstValue ? (change / firstValue) * 100 : 0;
    
    console.log('📊 [PortfolioTimeRange] Calculando rendimiento desde datos de evolución (fallback):', {
      firstValue,
      lastValue,
      change,
      percentage,
      dataLength: portfolioData.length,
      selectedRange
    });
    
    return { change, percentage, currentValue: lastValue };
  };

  const performance = calculatePerformance();
  const isPositive = performance.percentage >= 0;


  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // ✅ NUEVO: Manejar cambio de rango con persistencia
  const handleRangeChange = async (range: string, days: number) => {
    setUserPreference(range);
    onRangeChange(range, days);
    
    // ✅ NUEVO: Guardar preferencia del usuario
    await saveUserPreference(range);
  };

  return (
    <div className={styles.portfolioTimeRange}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h3 className={styles.title}>
            <BarChart3 size={20} />
            Evolución del Portafolio Real
          </h3>
          <p className={styles.subtitle}>
            Basado en P&L de todas las alertas creadas
          </p>
        </div>
        
        <div className={styles.performanceIndicator}>
          <span className={styles.performanceLabel}>Rendimiento:</span>
          <span 
            className={`${styles.performanceValue} ${isPositive ? styles.positive : styles.negative}`}
          >
            {formatPercentage(performance.percentage)}
          </span>
        </div>
      </div>

      {/* ✅ NUEVO: Selector de rango mejorado */}
      <div className={styles.rangeSelector}>
        {timeRangeOptions.map((option) => (
          <button
            key={option.value}
            className={`${styles.rangeButton} ${userPreference === option.value ? styles.active : ''}`}
            onClick={() => handleRangeChange(option.value, option.days)}
            disabled={loading}
          >
            <span className={styles.rangeLabel}>{option.label}</span>
            <span className={styles.rangeDescription}>{option.description}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className={styles.loadingIndicator}>
          <div className={styles.loadingSpinner}></div>
          <span>Cargando datos reales del portfolio...</span>
        </div>
      )}

      {error && (
        <div className={styles.errorIndicator}>
          <span className={styles.errorText}>{error}</span>
          <button 
            className={styles.retryButton}
            onClick={() => {
              const selectedOption = timeRangeOptions.find(opt => opt.value === selectedRange);
              if (selectedOption) fetchPortfolioData(selectedOption.days);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && portfolioData.length > 0 && (
        <>

          {/* ✅ NUEVO: Estadísticas del portfolio con inversión y ganancia */}
          {portfolioStats && (
            <div className={styles.summaryStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Período:</span>
                <span className={styles.statValue}>
                  {timeRangeOptions.find(opt => opt.value === selectedRange)?.label}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Días con alertas:</span>
                <span className={styles.statValue}>
                  {portfolioData.filter(d => d.alertsCount > 0).length}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total alertas:</span>
                <span className={styles.statValue}>
                  {portfolioData.reduce((sum, d) => sum + d.alertsCount, 0)}
                </span>
              </div>
            </div>
          )}

          {/* ✅ NUEVO: Estadísticas generales mejoradas */}
          {portfolioStats && (
              <div className={styles.globalStats}>
              <h4 className={styles.globalStatsTitle}>
                <Target size={16} />
                Estadísticas Generales
              </h4>
              <div className={styles.explanationBox}>
                <p><strong>Rendimiento vs S&P 500:</strong> Diferencia en puntos porcentuales entre el rendimiento del portfolio y el índice S&P 500. Fórmula: Rendimiento del Portfolio - Rendimiento del S&P 500</p>
                <p><strong>Win Rate:</strong> Proporción de operaciones ganadoras sobre el total de operaciones ejecutadas. Fórmula: (Cantidad de trades ganadores / Cantidad total de trades) × 100</p>
                <p><strong>Total de Alertas:</strong> Número absoluto de alertas de compra efectivamente ejecutadas por el servicio {serviceName} en el rango de fechas seleccionado</p>
              </div>
              <div className={styles.globalStatsGrid}>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Rendimiento vs S&P 500:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.sp500Return >= 0 ? styles.positive : styles.negative}`}>
                    {portfolioStats.sp500Return >= 0 ? '+' : ''}{portfolioStats.sp500Return.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Win Rate (Alertas Cerradas):</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.winRate >= 50 ? styles.positive : styles.negative}`}>
                    {portfolioStats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Total de Alertas:</span>
                  <span className={styles.globalStatValue}>
                    {portfolioStats.closedAlerts}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.updateInfo}>
            <Percent size={14} />
            <span>Último update: {new Date().toLocaleDateString('es-ES', { 
              day: '2-digit', 
              month: 'short', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}</span>
          </div>
        </>
      )}

      {!loading && !error && portfolioData.length === 0 && (
        <div className={styles.noDataIndicator}>
          <BarChart3 size={48} />
          <span className={styles.noDataText}>
            No hay datos de alertas en el período seleccionado
          </span>
          <span className={styles.noDataSubtext}>
            Los datos del portfolio se calcularán automáticamente cuando se creen alertas
          </span>
        </div>
      )}
    </div>
  );
};

export default PortfolioTimeRange; 