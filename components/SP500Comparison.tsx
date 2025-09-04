import React, { useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
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
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        marginTop: '2rem'
      }}
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
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1.05, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 4
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
              }}
            >
              📈
            </motion.div>
            <div className="title-text">
              <motion.h3
                style={{
                  margin: 0,
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2
                }}
              >
                Rendimiento Comparado
              </motion.h3>
              <motion.p
                style={{
                  margin: '0.5rem 0 0 0',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1rem',
                  fontWeight: 400,
                  lineHeight: 1.5
                }}
              >
                Compara tu inversión con el índice SP500
              </motion.p>
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
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2, type: "spring", stiffness: 300 }}
          whileHover={{
            scale: 1.02,
            transition: { type: "spring", stiffness: 400 }
          }}
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease'
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
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.4, type: "spring", stiffness: 300 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            position: 'relative',
            zIndex: 10
          }}
        >
          <motion.div
            className="vs-circle"
            animate={{
              scale: [1, 1.05, 1],
              rotate: [0, 1, -1, 0]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              repeatDelay: 3
            }}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
              border: '2px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <span style={{
              color: 'white',
              fontWeight: 700,
              fontSize: '0.875rem',
              letterSpacing: '0.1em'
            }}>VS</span>
          </motion.div>
          <div style={{
            width: '2px',
            height: '40px',
            background: 'linear-gradient(to bottom, #8B5CF6 0%, #A855F7 100%)',
            borderRadius: '1px',
            opacity: 0.6
          }}></div>
        </motion.div>

        {/* Service Performance */}
        <motion.div
          className="performance-card service-card"
          initial={{ opacity: 0, x: 30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2, type: "spring", stiffness: 300 }}
          whileHover={{
            scale: 1.02,
            transition: { type: "spring", stiffness: 400 }
          }}
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease'
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
          style={{
            gridColumn: '1 / -1',
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '2rem',
            marginTop: '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
          }}
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
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#FFFFFF'
              }}
            >
              📊 Análisis Comparativo
            </motion.h4>
            <p style={{
              margin: 0,
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.875rem',
              fontWeight: 400
            }}>Período: {periods.find(p => p.value === selectedPeriod)?.label}</p>
          </motion.div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem'
          }}>
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <BarChart3 size={16} />
              </div>
              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', fontWeight: 500 }}>SP500</div>
                <div style={{ 
                  color: (sp500Data?.changePercent ?? 0) >= 0 ? '#10B981' : '#EF4444',
                  fontSize: '1rem',
                  fontWeight: 600
                }}>
                  {(sp500Data?.changePercent ?? 0) >= 0 ? '+' : ''}{(sp500Data?.changePercent ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                <TrendingUp size={16} />
              </div>
              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', fontWeight: 500 }}>Mi Servicio</div>
                <div style={{ 
                  color: (serviceData?.totalReturnPercent ?? 0) >= 0 ? '#10B981' : '#EF4444',
                  fontSize: '1rem',
                  fontWeight: 600
                }}>
                  {(serviceData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}{(serviceData?.totalReturnPercent ?? 0).toFixed(2)}%
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                {getPerformanceIcon((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0))}
              </div>
              <div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem', fontWeight: 500 }}>Diferencial</div>
                <div style={{ 
                  color: ((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)) >= 0 ? '#10B981' : '#EF4444',
                  fontSize: '1rem',
                  fontWeight: 600
                }}>
                  {((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)) >= 0 ? '+' : ''}
                  {((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Service Metrics */}
          {serviceData && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.75rem'
              }}>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.625rem', fontWeight: 500, marginBottom: '0.25rem' }}>Alertas Activas</div>
                  <div style={{ color: '#8B5CF6', fontSize: '1.125rem', fontWeight: 600 }}>{serviceData?.activeAlerts ?? 0}</div>
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.625rem', fontWeight: 500, marginBottom: '0.25rem' }}>Win Rate</div>
                  <div style={{ color: '#10B981', fontSize: '1.125rem', fontWeight: 600 }}>{(serviceData?.winRate ?? 0).toFixed(1)}%</div>
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.625rem', fontWeight: 500, marginBottom: '0.25rem' }}>Ganancia Promedio</div>
                  <div style={{ color: '#10B981', fontSize: '1.125rem', fontWeight: 600 }}>+{(serviceData?.averageGain ?? 0).toFixed(1)}%</div>
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.625rem', fontWeight: 500, marginBottom: '0.25rem' }}>Pérdida Promedio</div>
                  <div style={{ color: '#EF4444', fontSize: '1.125rem', fontWeight: 600 }}>{(serviceData?.averageLoss ?? 0).toFixed(1)}%</div>
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
