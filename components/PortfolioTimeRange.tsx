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
  portfolioReturn: number;
  sp500Return: number;
  relativeReturn: number;
  outperformance: number;
  baseValue: number;
}

interface PortfolioTimeRangeProps {
  selectedRange: string;
  onRangeChange: (range: string, days: number) => void;
  onPortfolioUpdate?: (stats: PortfolioStats) => void; // ✅ NUEVO: Callback para actualizar dashboard
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
  onPortfolioUpdate
}) => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData[]>([]);
  const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null);
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
      // ✅ CAMBIO: Usar API global sin autenticación
      const response = await fetch(`/api/alerts/portfolio-evolution?days=${days}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No incluir credentials para datos globales
      });
      const result = await response.json();
      
      if (result.success) {
        setPortfolioData(result.data || []);
        
        // ✅ NUEVO: Calcular estadísticas mejoradas
        const stats = calculateEnhancedStats(result.data || [], result.stats || null);
        setPortfolioStats(stats);
        
        // ✅ NUEVO: Notificar al dashboard sobre la actualización
        if (onPortfolioUpdate) {
          onPortfolioUpdate(stats);
        }
      } else {
        setError(result.error || 'Error al cargar datos del portfolio');
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

  // Calcular estadísticas usando datos del API actualizado
  const calculateEnhancedStats = (data: PortfolioData[], baseStats: any): PortfolioStats => {
    if (!baseStats) {
      return {
        totalProfit: 0,
        totalAlerts: 0,
        closedAlerts: 0,
        winRate: 0,
        portfolioReturn: 0,
        sp500Return: 0,
        relativeReturn: 0,
        outperformance: 0,
        baseValue: 10000
      };
    }
    
    // Usar estadísticas del API que ya incluyen comparación con S&P 500
    return {
      totalProfit: baseStats.totalProfit || 0,
      totalAlerts: baseStats.totalAlerts || 0,
      closedAlerts: baseStats.closedAlerts || 0,
      winRate: baseStats.winRate || 0,
      portfolioReturn: baseStats.portfolioReturn || 0,
      sp500Return: baseStats.sp500Return || 0,
      relativeReturn: baseStats.relativeReturn || 0,
      outperformance: baseStats.outperformance || 0,
      baseValue: baseStats.baseValue || 10000
    };
  };

  const calculatePerformance = () => {
    if (portfolioData.length === 0) return { change: 0, percentage: 0, currentValue: 10000 };
    
    const firstValue = portfolioData[0]?.value || 10000;
    const lastValue = portfolioData[portfolioData.length - 1]?.value || 10000;
    
    const change = lastValue - firstValue;
    const percentage = firstValue ? (change / firstValue) * 100 : 0;
    
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
                <p><strong>P&L Total:</strong> Ganancia/pérdida absoluta en dólares</p>
                <p><strong>Rendimiento Portfolio:</strong> % de ganancia/pérdida sobre capital inicial (${portfolioStats.baseValue.toLocaleString()})</p>
                <p><strong>Rendimiento S&P 500:</strong> % de cambio del índice en el mismo período</p>
                <p><strong>Rendimiento Relativo:</strong> Cuánto mejor/peor fue el portfolio vs S&P 500</p>
                <p><strong>Outperformance:</strong> Diferencia absoluta entre portfolio y S&P 500</p>
              </div>
              <div className={styles.globalStatsGrid}>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>P&L Total (USD):</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.totalProfit >= 0 ? styles.positive : styles.negative}`}>
                    ${portfolioStats.totalProfit.toFixed(2)}
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Rendimiento Portfolio:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.portfolioReturn >= 0 ? styles.positive : styles.negative}`}>
                    {portfolioStats.portfolioReturn.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Rendimiento S&P 500:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.sp500Return >= 0 ? styles.positive : styles.negative}`}>
                    {portfolioStats.sp500Return.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Rendimiento Relativo:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.relativeReturn >= 0 ? styles.positive : styles.negative}`}>
                    {portfolioStats.relativeReturn >= 0 ? '+' : ''}{portfolioStats.relativeReturn.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Outperformance:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.outperformance >= 0 ? styles.positive : styles.negative}`}>
                    {portfolioStats.outperformance >= 0 ? '+' : ''}{portfolioStats.outperformance.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Win Rate (Alertas Cerradas):</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.winRate >= 50 ? styles.positive : styles.negative}`}>
                    {portfolioStats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Alertas Cerradas:</span>
                  <span className={styles.globalStatValue}>
                    {portfolioStats.closedAlerts} / {portfolioStats.totalAlerts}
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