import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import styles from './ActiveAlertsPieChart.module.css';

// ✅ NUEVO: Importación condicional de recharts para evitar errores si no está instalado
let PieChart: any, Pie: any, Cell: any, ResponsiveContainer: any, Tooltip: any, Legend: any;

try {
  const recharts = require('recharts');
  PieChart = recharts.PieChart;
  Pie = recharts.Pie;
  Cell = recharts.Cell;
  ResponsiveContainer = recharts.ResponsiveContainer;
  Tooltip = recharts.Tooltip;
  Legend = recharts.Legend;
} catch (error) {
  console.warn('Recharts no está instalado, el gráfico no se mostrará');
}

interface AlertData {
  id: string;
  symbol: string;
  profit: number;
  status: string;
  action: 'BUY' | 'SELL';
  tipo: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  entryPriceRange: {
    min: number;
    max: number;
  };
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
}

// ✅ NUEVO: Datos de liquidez por alerta
interface LiquidityByAlert {
  [symbol: string]: {
    alertId: string;
    allocatedAmount: number;
    shares: number;
    entryPrice: number;
    currentPrice: number;
    profitLoss: number;
    profitLossPercentage: number;
    realizedProfitLoss: number;
  };
}

interface ActiveAlertsPieChartProps {
  alerts: AlertData[];
  className?: string;
  // ✅ NUEVO: Liquidez (opcional)
  liquidityMap?: LiquidityByAlert;
  totalLiquidity?: number;
}

interface ChartSegment {
  name: string;
  value: number;
  symbol: string;
  profit: number;
  action: 'BUY' | 'SELL';
  tipo: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  color: string;
  darkColor: string;
  // ✅ NUEVO: Liquidez
  allocatedAmount?: number;
  shares?: number;
  realizedProfitLoss?: number;
}

const ActiveAlertsPieChart: React.FC<ActiveAlertsPieChartProps> = ({ 
  alerts, 
  className = '',
  liquidityMap,
  totalLiquidity
}) => {
  const [chartData, setChartData] = useState<ChartSegment[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertData | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // ✅ NUEVO: Paleta de colores dinámicos para cada alerta
  const colorPalette = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    '#14B8A6', '#F43F5E', '#A855F7', '#EAB308', '#22C55E'
  ];

  useEffect(() => {
    if (alerts && alerts.length > 0) {
      const activeAlerts = alerts.filter(alert => alert.status === 'ACTIVE');
      if (activeAlerts.length === 0) {
        setChartData([]);
        return;
      }
      const chartSegments = activeAlerts.map((alert, index) => {
        const profitValue = Math.abs(alert.profit || 0);
        const liquidity = liquidityMap?.[alert.symbol];
        return {
          name: alert.symbol,
          value: profitValue > 0 ? profitValue : 1,
          symbol: alert.symbol,
          profit: alert.profit || 0,
          action: alert.action,
          tipo: alert.tipo,
          color: colorPalette[index % colorPalette.length],
          darkColor: colorPalette[index % colorPalette.length] + '80',
          allocatedAmount: liquidity?.allocatedAmount,
          shares: liquidity?.shares,
          realizedProfitLoss: liquidity?.realizedProfitLoss,
        };
      });
      setChartData(chartSegments);
    } else {
      setChartData([]);
    }
  }, [alerts, liquidityMap]);

  // ✅ Formateadores
  const formatCurrency = (n?: number) => {
    if (n === undefined || n === null) return '-';
    return `$${Number(n).toFixed(2)}`;
  };
  const formatShares = (n?: number) => (n !== undefined ? `${n}` : '-');
  const formatPercentage = (value: number) => {
    if (value === undefined || value === null) return '0%';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Number(value).toFixed(1)}%`;
  };
  const getProfitColor = (value: number) => (value >= 0 ? '#10B981' : '#EF4444');

  // ✅ NUEVO: Tooltip con liquidez
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartSegment;
      return (
        <div className={styles.tooltip}>
          <div className={styles.tooltipTitle}>{data.symbol}</div>
          <div className={styles.tooltipContent}>
            <p>Profit: <span style={{ color: getProfitColor(data.profit) }}>{formatPercentage(data.profit)}</span></p>
            {data.allocatedAmount !== undefined && (
              <>
                <p>Liquidez asignada: {formatCurrency(data.allocatedAmount)}</p>
                <p>Shares: {formatShares(data.shares)}</p>
                <p>P&L realizado: {formatCurrency(data.realizedProfitLoss)}</p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className={styles.legend}>
        {payload?.map((entry: any, index: number) => {
          const data = entry?.payload as ChartSegment;
          return (
            <div key={index} className={styles.legendItem}>
              <span className={styles.legendColor} style={{ backgroundColor: data.color }} />
              <span className={styles.legendText}>{data.symbol}</span>
              <span className={styles.legendProfit} style={{ color: getProfitColor(data.profit) }}>
                {formatPercentage(data.profit)}
              </span>
              {data.allocatedAmount !== undefined && (
                <span className={styles.legendExtra}>
                  {formatCurrency(data.allocatedAmount)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ✅ NUEVO: Verificar si recharts está disponible
  if (!PieChart || !Pie || !Cell || !ResponsiveContainer) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <PieChart size={20} />
            Gráfico de Alertas Activas
          </h3>
          <p className={styles.subtitle}>
            Solo alertas con estado ACTIVO
          </p>
        </div>
        <div className={styles.emptyState}>
          <Info size={48} />
          <h4 className={styles.emptyTitle}>Recharts no está instalado</h4>
          <p className={styles.emptyText}>
            Para mostrar el gráfico, instala la dependencia: npm install recharts
          </p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <PieChart size={20} />
            Gráfico de Alertas Activas
          </h3>
          <p className={styles.subtitle}>
            Solo alertas con estado ACTIVO
          </p>
        </div>
        <div className={styles.emptyState}>
          <Info size={48} />
          <h4 className={styles.emptyTitle}>No hay alertas activas</h4>
          <p className={styles.emptyText}>
            Actualmente no hay alertas activas para mostrar en el gráfico.
          </p>
          <p className={styles.emptySubtext}>
            Las alertas aparecerán aquí cuando se creen y mantengan estado ACTIVO.
          </p>
        </div>
      </div>
    );
  }

  // Estadísticas simples + Liquidez total
  const totalProfit = chartData.reduce((sum, item) => sum + (item.profit || 0), 0);
  const portfolioStats = {
    totalAlerts: chartData.length,
    totalProfit,
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <PieChart size={20} />
          Gráfico de Alertas Activas
        </h3>
        <p className={styles.subtitle}>
          Solo alertas con estado ACTIVO - {chartData.length} alertas
        </p>
      </div>

      {portfolioStats && (
        <div className={styles.portfolioStats}>
          <div className={styles.statRow}>
            <div className={styles.statItem}>
              <DollarSign size={16} />
              <span className={styles.statLabel}>Total Alertas:</span>
              <span className={styles.statValue}>{portfolioStats.totalAlerts}</span>
            </div>
            <div className={styles.statItem}>
              <TrendingUp size={16} />
              <span className={styles.statLabel}>Profit Total:</span>
              <span 
                className={styles.statValue}
                style={{ color: getProfitColor(portfolioStats.totalProfit) }}
              >
                {formatPercentage(portfolioStats.totalProfit)}
              </span>
            </div>
          </div>
          {typeof totalLiquidity === 'number' && (
            <div className={styles.statRow}>
              <div className={styles.statItem}>
                <DollarSign size={16} />
                <span className={styles.statLabel}>Liquidez Total:</span>
                <span className={styles.statValue}>{formatCurrency(totalLiquidity)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: { name: string; percent: number }) => 
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={(data: ChartSegment) => setHoveredSegment(data.symbol)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={entry.darkColor}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.additionalInfo}>
        <div className={styles.infoItem}>
          <AlertTriangle size={14} />
          <span>
            <strong>Nota:</strong> Solo se muestran alertas con estado ACTIVO.
          </span>
        </div>
        <div className={styles.infoItem}>
          <Info size={14} />
          <span>
            El tamaño de cada segmento representa el profit relativo de la alerta. Si hay liquidez asignada, el tooltip muestra el monto y P&L.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActiveAlertsPieChart; 