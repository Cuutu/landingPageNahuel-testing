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
    <motion.div
      className={`sp500-comparison ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div
        className="comparison-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="header-content">
          <motion.div
            className="title-section"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <motion.div
              className="title-icon"
              animate={{
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3
              }}
            >
              📈
            </motion.div>
            <div className="title-text">
              <h3>Rendimiento Comparado</h3>
              <p>Compara tu inversión con el índice SP500</p>
            </div>
          </motion.div>
          <motion.div
            className="header-actions"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <motion.button
              className="refresh-button"
              onClick={handleRefresh}
              title="Actualizar datos"
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <RefreshCw size={16} />
            </motion.button>
          </motion.div>
        </div>

        <motion.div
          className="period-selector"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {periods.map((period, index) => (
            <motion.button
              key={period.value}
              className={`period-button ${selectedPeriod === period.value ? 'active' : ''}`}
              onClick={() => handlePeriodChange(period.value)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: 0.8 + index * 0.1,
                type: "spring",
                stiffness: 300
              }}
              whileHover={{
                scale: 1.05,
                transition: { type: "spring", stiffness: 400 }
              }}
              whileTap={{ scale: 0.95 }}
            >
              {period.short}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        className="comparison-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
      >
        {/* SP500 Performance */}
        <motion.div
          className="performance-card sp500-card"
          initial={{ opacity: 0, x: -50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2, type: "spring", stiffness: 300 }}
          whileHover={{
            scale: 1.02,
            transition: { type: "spring", stiffness: 400 }
          }}
        >
          <div className="card-gradient-bg"></div>
          <div className="card-content-wrapper">
            <div className="card-header">
              <motion.div
                className="card-icon"
                animate={{
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 5
                }}
              >
                <BarChart3 size={24} />
              </motion.div>
              <div className="card-info">
                <h4>SP500</h4>
                <span className="card-subtitle">Índice de referencia</span>
              </div>
            </div>
            <div className="card-content">
              <div className="price-section">
                <motion.div
                  className="current-price"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.5 }}
                >
                  ${(sp500Data?.currentPrice ?? 0).toFixed(2)}
                </motion.div>
                <div className="market-status">
                  <div className="status-dot"></div>
                  <span>Mercado abierto</span>
                </div>
              </div>
              <motion.div
                className={`performance-change ${getPerformanceColor(sp500Data?.changePercent ?? 0)}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.7 }}
              >
                {getPerformanceIcon(sp500Data?.changePercent ?? 0)}
                <span className="change-value">
                  {(sp500Data?.changePercent ?? 0) >= 0 ? '+' : ''}{(sp500Data?.changePercent ?? 0).toFixed(2)}%
                </span>
                <span className="change-amount">
                  ({(sp500Data?.change ?? 0) >= 0 ? '+' : ''}${(sp500Data?.change ?? 0).toFixed(2)})
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* VS Indicator */}
        <motion.div
          className="vs-indicator"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.4, type: "spring", stiffness: 300 }}
        >
          <motion.div
            className="vs-circle"
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 2, -2, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              repeatDelay: 2
            }}
          >
            <span>VS</span>
          </motion.div>
          <div className="vs-line"></div>
        </motion.div>

        {/* Service Performance */}
        <motion.div
          className="performance-card service-card"
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2, type: "spring", stiffness: 300 }}
          whileHover={{
            scale: 1.02,
            transition: { type: "spring", stiffness: 400 }
          }}
        >
          <div className="card-gradient-bg"></div>
          <div className="card-content-wrapper">
            <div className="card-header">
              <motion.div
                className="card-icon"
                animate={{
                  rotate: [0, -5, 5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 5
                }}
              >
                <TrendingUp size={24} />
              </motion.div>
              <div className="card-info">
                <h4>Mi Servicio</h4>
                <span className="card-subtitle">Tu inversión</span>
              </div>
            </div>
            <div className="card-content">
              <div className="price-section">
                <motion.div
                  className="current-price"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.5 }}
                >
                  ${(serviceData?.totalReturn ?? 0).toFixed(2)}
                </motion.div>
                <div className="market-status">
                  <div className="status-dot active"></div>
                  <span>Actualizado</span>
                </div>
              </div>
              <motion.div
                className={`performance-change ${getPerformanceColor(serviceData?.totalReturnPercent ?? 0)}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.7 }}
              >
                {getPerformanceIcon(serviceData?.totalReturnPercent ?? 0)}
                <span className="change-value">
                  {(serviceData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}{(serviceData?.totalReturnPercent ?? 0).toFixed(2)}%
                </span>
                <span className="change-amount">
                  (Retorno total)
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Comparison Summary */}
        <motion.div
          className="comparison-summary"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.8 }}
        >
          <motion.div
            className="summary-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2 }}
          >
            <motion.h4
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 2.2 }}
            >
              📊 Análisis Comparativo
            </motion.h4>
            <p>Período: {periods.find(p => p.value === selectedPeriod)?.label}</p>
          </motion.div>

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
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default SP500Comparison;
