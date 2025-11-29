import React, { useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, AlertCircle, Loader2, Activity } from 'lucide-react';
import { useSP500Performance, SP500Data, ServicePerformanceData } from '@/hooks/useSP500Performance';
import styles from './SP500Comparison.module.css';

interface SP500ComparisonProps {
  className?: string;
  serviceType?: 'TraderCall' | 'SmartMoney';
}

// Constantes para mejor mantenibilidad - Alineados con PortfolioTimeRange
const PERIODS = [
  { value: '1d', label: '1 día' },
  { value: '7d', label: '7 días' },
  { value: '15d', label: '15 días' },
  { value: '30d', label: '30 días' },
  { value: '6m', label: '6 meses' },
  { value: '1y', label: '1 año' }
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
                  {(() => {
                    const percentValue = sp500Data.periodChangePercent ?? sp500Data.changePercent ?? 0;
                    console.log('📊 [SP500Comparison] Mostrando porcentaje:', {
                      periodChangePercent: sp500Data.periodChangePercent,
                      changePercent: sp500Data.changePercent,
                      finalValue: percentValue,
                      dataProvider: sp500Data.dataProvider
                    });
                    return (
                      <>
                        {getPerformanceIcon(percentValue)}
                        <span
                          className={`${styles.performanceValue} ${getPerformanceClass(percentValue)}`}
                        >
                          {formatPercentage(percentValue)}
                        </span>
                      </>
                    );
                  })()}
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
              {loading && !serviceData ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span style={{ color: '#9CA3AF' }}>Cargando...</span>
                </div>
              ) : serviceData ? (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {(() => {
                      // ✅ CORREGIDO: Verificar que el período del serviceData coincida con el período seleccionado
                      // Si no coincide, mostrar loading o el valor actual mientras se actualiza
                      const percentValue = typeof serviceData.totalReturnPercent === 'number' 
                        ? serviceData.totalReturnPercent 
                        : 0;
                      
                      // Verificar si el período del serviceData coincide con el seleccionado
                      const isPeriodMatching = serviceData.period === selectedPeriod;
                      
                      console.log('📊 [SP500Comparison] Mostrando rendimiento del servicio:', {
                        serviceType,
                        totalReturnPercent: serviceData.totalReturnPercent,
                        serviceDataPeriod: serviceData.period,
                        selectedPeriod,
                        isPeriodMatching,
                        finalValue: percentValue,
                        isNumber: typeof serviceData.totalReturnPercent === 'number'
                      });
                      
                      // Si el período no coincide, mostrar loading mientras se actualiza
                      if (!isPeriodMatching && loading) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Loader2 size={16} className="animate-spin" />
                            <span style={{ color: '#9CA3AF' }}>Actualizando...</span>
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {getPerformanceIcon(percentValue)}
                          <span
                            className={`${styles.performanceValue} ${getPerformanceClass(percentValue)}`}
                          >
                            {formatPercentage(percentValue)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  {/* Nota informativa si el período solicitado es mayor que los datos disponibles */}
                  {(() => {
                    const periodDays: { [key: string]: number } = {
                      '1d': 1,
                      '7d': 7,
                      '15d': 15,
                      '30d': 30,
                      '6m': 180,
                      '1y': 365
                    };
                    const requestedDays = periodDays[selectedPeriod] || 30;
                    // Si el período solicitado es mayor a 7 días y el valor es 0 o muy bajo, 
                    // probablemente estamos usando el snapshot más antiguo disponible
                    // Nota: Esto es una aproximación, podríamos mejorar agregando metadata al response
                    if (requestedDays > 7 && serviceData.totalReturnPercent !== null && Math.abs(serviceData.totalReturnPercent) < 0.01) {
                      return (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          fontSize: '0.75rem', 
                          color: '#9CA3AF',
                          fontStyle: 'italic'
                        }}>
                          * Cálculo basado en datos disponibles
                        </div>
                      );
                    }
                    return null;
                  })()}
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
      </div>

    </div>
  );
};

export default SP500Comparison;