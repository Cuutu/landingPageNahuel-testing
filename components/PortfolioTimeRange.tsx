import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, BarChart3, Target, Percent, Save } from 'lucide-react';
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
}

interface PortfolioStats {
  totalProfit: number;
  totalAlerts: number;
  winRate: number;
  avgProfit: number;
  totalInvested: number; // ✅ NUEVO: Cantidad total invertida
  profitPercentage: number; // ✅ NUEVO: Porcentaje de ganancia
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
      const response = await fetch(`/api/alerts/portfolio-evolution?days=${days}`);
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

  // ✅ NUEVO: Calcular estadísticas mejoradas incluyendo inversión y porcentaje de ganancia
  const calculateEnhancedStats = (data: PortfolioData[], baseStats: any): PortfolioStats => {
    if (data.length === 0) {
      return {
        totalProfit: 0,
        totalAlerts: 0,
        winRate: 0,
        avgProfit: 0,
        totalInvested: 0,
        profitPercentage: 0
      };
    }
    
    // ✅ NUEVO: Calcular cantidad total invertida (simulado por ahora)
    const totalInvested = data.reduce((sum, item) => sum + (item.value * 0.1), 0); // 10% del valor como inversión
    
    // ✅ NUEVO: Calcular profit total y porcentaje
    const totalProfit = data.reduce((sum, item) => sum + item.profit, 0);
    const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    
    // Calcular estadísticas base
    const totalAlerts = data.reduce((sum, item) => sum + item.alertsCount, 0);
    const positiveAlerts = data.filter(item => item.profit > 0).length;
    const winRate = totalAlerts > 0 ? (positiveAlerts / totalAlerts) * 100 : 0;
    const avgProfit = totalAlerts > 0 ? totalProfit / totalAlerts : 0;
    
    return {
      totalProfit,
      totalAlerts,
      winRate,
      avgProfit,
      totalInvested,
      profitPercentage
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
            {userPreference === option.value && (
              <Save size={12} className={styles.savedIndicator} />
            )}
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
              <div className={styles.globalStatsGrid}>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>P&L Total:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.totalProfit >= 0 ? styles.positive : styles.negative}`}>
                    {formatPercentage(portfolioStats.totalProfit)}
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Total Alertas:</span>
                  <span className={styles.globalStatValue}>
                    {portfolioStats.totalAlerts}
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Win Rate:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.winRate >= 50 ? styles.positive : styles.negative}`}>
                    {portfolioStats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Profit Promedio:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.avgProfit >= 0 ? styles.positive : styles.negative}`}>
                    {formatPercentage(portfolioStats.avgProfit)}
                  </span>
                </div>
                {/* ✅ NUEVO: Cantidad invertida y porcentaje de ganancia */}
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>Total Invertido:</span>
                  <span className={styles.globalStatValue}>
                    ${portfolioStats.totalInvested.toLocaleString()}
                  </span>
                </div>
                <div className={styles.globalStatItem}>
                  <span className={styles.globalStatLabel}>% de Ganancia:</span>
                  <span className={`${styles.globalStatValue} ${portfolioStats.profitPercentage >= 0 ? styles.positive : styles.negative}`}>
                    {formatPercentage(portfolioStats.profitPercentage)}
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