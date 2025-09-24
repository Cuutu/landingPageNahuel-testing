import React, { useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, AlertCircle, Loader2 } from 'lucide-react';
import { useSP500Performance, SP500Data, ServicePerformanceData } from '@/hooks/useSP500Performance';
import styles from './SP500Comparison.module.css';

interface SP500ComparisonProps {
  className?: string;
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

const SP500Comparison: React.FC<SP500ComparisonProps> = ({ className = '' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const { sp500Data, serviceData, loading, error, refreshData } = useSP500Performance(selectedPeriod);

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

  // Estados de loading y error
  if (loading) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.loadingContainer}>
          <Loader2 size={24} className="animate-spin" />
          <span style={{ marginLeft: '0.5rem' }}>Cargando datos de rendimiento...</span>
        </div>
      </div>
    );
  }

  if (error) {
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

      {/* Comparison Cards */} 
      <div className={styles.cardsGrid}>
        {/* SP500 Card */}
        <div className={styles.card} role="article" aria-label="Rendimiento del índice S&P 500">
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
              {getPerformanceIcon(sp500Data?.changePercent ?? 0)}
              <span
                className={`${styles.performanceValue} ${getPerformanceClass(sp500Data?.periodChangePercent ?? sp500Data?.changePercent ?? 0)}`}
              >
                {formatPercentage(sp500Data?.periodChangePercent ?? sp500Data?.changePercent ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Service Card */}
        <div className={styles.card} role="article" aria-label="Rendimiento del servicio de trading">
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon} aria-hidden="true">
              <TrendingUp size={16} />
            </div>
            <div>
              <h4 className={styles.cardTitle}>
                Mi Servicio
              </h4>
              <p className={styles.cardSubtitle}>
                Actualizado
              </p>
            </div>
          </div>
          
          <div>
            <p className={styles.performanceLabel}>
              Rendimiento
            </p>
            <p className={`${styles.performanceValue} ${getPerformanceClass(serviceData?.totalReturnPercent ?? 0)}`}>
              {formatPercentage(serviceData?.totalReturnPercent ?? 0)}
            </p>
            <div className={`${styles.performanceSubtext} ${getPerformanceClass(serviceData?.totalReturnPercent ?? 0)}`}>
              {getPerformanceIcon(serviceData?.totalReturnPercent ?? 0)}
              <span>Retorno total</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SP500Comparison;