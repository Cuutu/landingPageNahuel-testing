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
    { value: '7d', label: '7D' },
    { value: '15d', label: '15D' },
    { value: '30d', label: '30D' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1A' }
  ];

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
  };

  const handleRefresh = () => {
    refreshData(selectedPeriod);
  };

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getPerformanceIcon = (value: number) => {
    return value >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  };

  return (
    <div
      className={`sp500-comparison ${className}`}
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        padding: '2rem',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        marginTop: '2rem'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            📈
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                lineHeight: 1.2
              }}
            >
              Rendimiento Comparado
            </h3>
            <p
              style={{
                margin: '0.25rem 0 0 0',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.875rem',
                fontWeight: 400,
                lineHeight: 1.4
              }}
            >
              Compara tu inversión con el índice S&P 500
            </p>
          </div>
        </div>
        
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <button
            onClick={handleRefresh}
            title="Actualizar datos"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#FFFFFF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem'
        }}
      >
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => handlePeriodChange(period.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              background: selectedPeriod === period.value ? 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' : 'var(--bg-secondary)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: selectedPeriod === period.value ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (selectedPeriod !== period.value) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#FFFFFF';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPeriod !== period.value) {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }
            }}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Comparison Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}
      >
        {/* SP500 Card */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <BarChart3 size={16} />
            </div>
            <div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.7)'
                }}
              >
                Índice de referencia
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#FFFFFF'
                }}
              >
                S&P 500
              </p>
            </div>
          </div>
          
          <div>
            <p
              style={{
                margin: '0 0 0.25rem 0',
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            >
              Índice
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#FFFFFF'
              }}
            >
              {sp500Data?.currentPrice?.toFixed(2) || '0.00'}
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginTop: '0.5rem'
              }}
            >
              {getPerformanceIcon(sp500Data?.changePercent ?? 0)}
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: (sp500Data?.changePercent ?? 0) >= 0 ? '#10B981' : '#EF4444'
                }}
              >
                {(sp500Data?.changePercent ?? 0) >= 0 ? '+' : ''}{(sp500Data?.changePercent ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Service Card */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <TrendingUp size={16} />
            </div>
            <div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.7)'
                }}
              >
                Mi Servicio
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#FFFFFF'
                }}
              >
                Actualizado
              </p>
            </div>
          </div>
          
          <div>
            <p
              style={{
                margin: '0 0 0.25rem 0',
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            >
              Rendimiento
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: (serviceData?.totalReturnPercent ?? 0) >= 0 ? '#10B981' : '#EF4444'
              }}
            >
              {(serviceData?.totalReturnPercent ?? 0) >= 0 ? '+' : ''}{(serviceData?.totalReturnPercent ?? 0).toFixed(2)}%
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                marginTop: '0.5rem'
              }}
            >
              {getPerformanceIcon(serviceData?.totalReturnPercent ?? 0)}
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: (serviceData?.totalReturnPercent ?? 0) >= 0 ? '#10B981' : '#EF4444'
                }}
              >
                Retorno total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h4
          style={{
            margin: '0 0 1rem 0',
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#FFFFFF'
          }}
        >
          📊 Análisis Comparativo
        </h4>
        
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '1rem'
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div
              style={{
                fontSize: '0.625rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                marginBottom: '0.25rem'
              }}
            >
              Alertas Activas
            </div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#8B5CF6'
              }}
            >
              {serviceData?.activeAlerts ?? 0}
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div
              style={{
                fontSize: '0.625rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                marginBottom: '0.25rem'
              }}
            >
              Win Rate
            </div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#10B981'
              }}
            >
              {(serviceData?.winRate ?? 0).toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div
              style={{
                fontSize: '0.625rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                marginBottom: '0.25rem'
              }}
            >
              Diferencial
            </div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: ((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)) >= 0 ? '#10B981' : '#EF4444'
              }}
            >
              {((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)) >= 0 ? '+' : ''}
              {((serviceData?.totalReturnPercent ?? 0) - (sp500Data?.changePercent ?? 0)).toFixed(2)}%
            </div>
          </div>

          <div
            style={{
              textAlign: 'center',
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <div
              style={{
                fontSize: '0.625rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 500,
                marginBottom: '0.25rem'
              }}
            >
              Pérdida Promedio
            </div>
            <div
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#EF4444'
              }}
            >
              {(serviceData?.averageLoss ?? 0).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SP500Comparison;