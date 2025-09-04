import React, { useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';
import { useSP500Performance, SP500Data, ServicePerformanceData } from '@/hooks/useSP500Performance';

interface SP500ComparisonProps {
  className?: string;
}

const SP500Comparison: React.FC<SP500ComparisonProps> = ({ className = '' }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const { sp500Data, serviceData, loading, error, refreshData } = useSP500Performance(selectedPeriod);

  const periods = [
    { value: '7d', label: '7 Días', short: '7D' },
    { value: '15d', label: '15 Días', short: '15D' },
    { value: '30d', label: '30 Días', short: '30D' },
    { value: '6m', label: '6 Meses', short: '6M' },
    { value: '1y', label: '1 Año', short: '1A' }
  ];

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleRefresh = () => {
    refreshData(selectedPeriod);
  };

  if (loading) {
    return (
      <div className={`sp500-comparison ${className}`}>
        <div className="comparison-header">
          <h3>📊 Comparación con SP500</h3>
          <div className="period-selector">
            {periods.map(period => (
              <button
                key={period.value}
                className={`period-button ${selectedPeriod === period.value ? 'active' : ''}`}
                disabled
              >
                {period.short}
              </button>
            ))}
          </div>
        </div>
        <div className="loading-state">
          <RefreshCw className="spinning" size={20} />
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`sp500-comparison ${className}`}>
        <div className="comparison-header">
          <h3>📊 Comparación con SP500</h3>
          <button className="refresh-button" onClick={handleRefresh}>
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="error-state">
          <p>❌ Error al cargar datos del SP500</p>
          <button className="retry-button" onClick={handleRefresh}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? 'positive' : 'negative';
  };

  const getPerformanceIcon = (value: number) => {
    return value >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  };

  return (
    <div className={`sp500-comparison ${className}`}>
      <div className="comparison-header">
        <div className="header-content">
          <div className="title-section">
            <div className="title-icon">
              📈
            </div>
            <div className="title-text">
              <h3>Rendimiento Comparado</h3>
              <p>Compara tu inversión con el índice SP500</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="refresh-button" onClick={handleRefresh} title="Actualizar datos">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="period-selector">
          {periods.map(period => (
            <button
              key={period.value}
              className={`period-button ${selectedPeriod === period.value ? 'active' : ''}`}
              onClick={() => handlePeriodChange(period.value)}
            >
              {period.short}
            </button>
          ))}
        </div>
      </div>

      <div className="comparison-content">
        {/* SP500 Performance */}
        <div className="performance-card sp500-card">
          <div className="card-gradient-bg"></div>
          <div className="card-content-wrapper">
            <div className="card-header">
              <div className="card-icon">
                <BarChart3 size={24} />
              </div>
              <div className="card-info">
                <h4>SP500</h4>
                <span className="card-subtitle">Índice de referencia</span>
              </div>
            </div>
            <div className="card-content">
              <div className="price-section">
                <div className="current-price">
                  ${(sp500Data?.currentPrice ?? 0).toFixed(2)}
                </div>
                <div className="market-status">
                  <div className="status-dot"></div>
                  <span>Mercado abierto</span>
                </div>
              </div>
              <div className={`performance-change ${getPerformanceColor(sp500Data?.changePercent ?? 0)}`}>
                {getPerformanceIcon(sp500Data?.changePercent ?? 0)}
                <span className="change-value">
                  {(sp500Data?.changePercent ?? 0) >= 0 ? '+' : ''}{(sp500Data?.changePercent ?? 0).toFixed(2)}%
                </span>
                <span className="change-amount">
                  ({(sp500Data?.change ?? 0) >= 0 ? '+' : ''}${(sp500Data?.change ?? 0).toFixed(2)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* VS Indicator */}
        <div className="vs-indicator">
          <div className="vs-circle">
            <span>VS</span>
          </div>
          <div className="vs-line"></div>
        </div>

        {/* Service Performance */}
        <div className="performance-card service-card">
          <div className="card-gradient-bg"></div>
          <div className="card-content-wrapper">
            <div className="card-header">
              <div className="card-icon">
                <TrendingUp size={24} />
              </div>
              <div className="card-info">
                <h4>Mi Servicio</h4>
                <span className="card-subtitle">Tu inversión</span>
              </div>
            </div>
            <div className="card-content">
              <div className="price-section">
                <div className="current-price">
                  ${(serviceData?.totalReturn ?? 0).toFixed(2)}
                </div>
                <div className="market-status">
                  <div className="status-dot active"></div>
                  <span>Actualizado</span>
                </div>
              </div>
              <div className={`performance-change ${getPerformanceColor(serviceData?.totalReturnPercent ?? 0)}`}>
                {getPerformanceIcon(serviceData?.totalReturnPercent ?? 0)}
                <span className="change-value">
                  {(serviceData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}{(serviceData?.totalReturnPercent ?? 0).toFixed(2)}%
                </span>
                <span className="change-amount">
                  (Retorno total)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Summary */}
        <div className="comparison-summary">
          <div className="summary-header">
            <h4>📊 Análisis Comparativo</h4>
            <p>Período: {periods.find(p => p.value === selectedPeriod)?.label}</p>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-icon sp500-icon">
                <BarChart3 size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">SP500</span>
                <span className={`summary-value ${getPerformanceColor(sp500Data?.changePercent ?? 0)}`}>
                  {(sp500Data?.changePercent ?? 0) >= 0 ? '+' : ''}{(sp500Data?.changePercent ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-icon service-icon">
                <TrendingUp size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Mi Servicio</span>
                <span className={`summary-value ${getPerformanceColor(serviceData?.totalReturnPercent ?? 0)}`}>
                  {(serviceData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}{(serviceData?.totalReturnPercent ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="summary-card difference-card">
              <div className="summary-icon difference-icon">
                {getPerformanceIcon((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0))}
              </div>
              <div className="summary-content">
                <span className="summary-label">Diferencial</span>
                <span className={`summary-value ${getPerformanceColor((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0))}`}>
                  {((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)) >= 0 ? '+' : ''}
                  {((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Service Metrics */}
          {serviceData && (
            <div className="service-metrics">
              <div className="metric-grid">
                <div className="metric-item">
                  <span className="metric-label">Alertas Activas</span>
                  <span className="metric-value">{serviceData?.activeAlerts ?? 0}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Win Rate</span>
                  <span className="metric-value">{(serviceData?.winRate ?? 0).toFixed(1)}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Ganancia Promedio</span>
                  <span className="metric-value">+{(serviceData?.averageGain ?? 0).toFixed(1)}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Pérdida Promedio</span>
                  <span className="metric-value">{(serviceData?.averageLoss ?? 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SP500Comparison;
