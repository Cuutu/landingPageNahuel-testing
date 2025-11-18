import React, { useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, AlertCircle, Loader2, Activity } from 'lucide-react';
import { useSP500Performance, SP500Data, ServicePerformanceData } from '@/hooks/useSP500Performance';
import styles from './SP500Comparison.module.css';

interface SP500ComparisonProps {
  className?: string;
  serviceType?: 'TraderCall' | 'SmartMoney';
}

// Constantes para mejor mantenibilidad
const PERIODS = [
  { value: '7d', label: '7D' },
  { value: '15d', label: '15D' },
  { value: '30d', label: '30D' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1A' }
] as const;

const PERFORMANCE_COLORS = {
  positive: '#10B981',
  negative: '#EF4444'
} as const;

const SP500Comparison: React.FC<SP500ComparisonProps> = ({ className = '', serviceType = 'TraderCall' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const { sp500Data, serviceData, loading, error, refreshData } = useSP500Performance(selectedPeriod, serviceType);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleRefresh = () => {
    refreshData(selectedPeriod);
  };

  const handleRetry = () => {
    refreshData(selectedPeriod);
  };

  const getPerformanceIcon = (value: number) => {
    return value >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  };

  const getPerformanceClass = (value: number) => {
    return value >= 0 ? styles.positive : styles.negative;
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Usar el rendimiento relativo calculado en el hook
  const relativePerformance = serviceData?.relativePerformanceVsSP500 ?? 0;

  // Estados de loading y error
  if (loading && !sp500Data && !serviceData) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.loadingContainer}>
          <Loader2 size={24} className="animate-spin" />
          <span style={{ marginLeft: '0.5rem' }}>Cargando datos de rendimiento...</span>
        </div>
      </div>
    );
  }

  // Mostrar error solo si no hay datos previos
  if (error && !sp500Data && !serviceData) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.errorContainer}>
          <AlertCircle size={32} />
          <div className={styles.errorMessage}>
            {error}
          </div>
          <button 
            onClick={handleRetry}
            className={styles.retryButton}
            aria-label="Reintentar carga de datos"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} role="region" aria-label="Comparación de rendimiento S&P 500">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconContainer} aria-hidden="true">
            📈
          </div>
          <div>
            <h3 className={styles.title}>
              Rendimiento Comparado
            </h3>
            <p className={styles.subtitle}>
              Compara tu inversión con el índice S&P 500
            </p>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <button
            onClick={handleRefresh}
            title="Actualizar datos"
            className={styles.refreshButton}
            aria-label="Actualizar datos de rendimiento"
            disabled={loading}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className={styles.periodSelector} role="tablist" aria-label="Seleccionar período de tiempo">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            onClick={() => handlePeriodChange(period.value)}
            className={`${styles.periodButton} ${selectedPeriod === period.value ? styles.active : ''}`}
            role="tab"
            aria-selected={selectedPeriod === period.value}
            aria-label={`Período ${period.label}`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Cards Grid - SP500 y Nuestro Servicio */}
      <div className={styles.cardsGridContainer}>
        {/* SP500 Card */}
        <div className={`${styles.card} ${styles.sp500Card}`} role="article" aria-label="Rendimiento del índice S&P 500">
          <div className={styles.trendIndicator} aria-hidden="true"></div>
          
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} aria-hidden="true">
              <BarChart3 size={16} />
            </div>
            <div>
              <h4 className={styles.cardTitle}>
                Índice de referencia
              </h4>
              <p className={styles.cardSubtitle}>
                S&P 500
              </p>
            </div>
          </div>
          
          <div>
            <div className={styles.performanceContainer}>
              <span className={styles.performanceLabel}>Rendimiento en el período seleccionado</span>
              {loading && !sp500Data ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span style={{ color: '#9CA3AF' }}>Cargando...</span>
                </div>
              ) : sp500Data ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {getPerformanceIcon(sp500Data.periodChangePercent ?? sp500Data.changePercent ?? 0)}
                  <span
                    className={`${styles.performanceValue} ${getPerformanceClass(sp500Data.periodChangePercent ?? sp500Data.changePercent ?? 0)}`}
                  >
                    {formatPercentage(sp500Data.periodChangePercent ?? sp500Data.changePercent ?? 0)}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <AlertCircle size={16} style={{ color: '#EF4444' }} />
                  <span style={{ color: '#EF4444' }}>No hay datos disponibles</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nuestro Servicio Card */}
        <div className={`${styles.card} ${styles.serviceCard}`} role="article" aria-label="Rendimiento de nuestro servicio">
          <div className={styles.trendIndicator} aria-hidden="true"></div>
          
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} aria-hidden="true">
              <Activity size={16} />
            </div>
            <div>
              <h4 className={styles.cardTitle}>
                Nuestro servicio
              </h4>
              <p className={styles.cardSubtitle}>
                {serviceType === 'SmartMoney' ? 'Smart Money' : 'Trader Call'}
              </p>
            </div>
          </div>
          
          <div>
            <div className={styles.performanceContainer}>
              <span className={styles.performanceLabel}>Rendimiento en el período seleccionado</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                {getPerformanceIcon(serviceData?.totalReturnPercent ?? 0)}
                <span
                  className={`${styles.performanceValue} ${getPerformanceClass(serviceData?.totalReturnPercent ?? 0)}`}
                >
                  {formatPercentage(serviceData?.totalReturnPercent ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SP500Comparison;