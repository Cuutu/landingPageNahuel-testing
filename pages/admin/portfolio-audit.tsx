import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Calculator,
  FileText,
  BarChart3,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/PortfolioAudit.module.css';
import toast from 'react-hot-toast';

interface AdminPortfolioAuditProps {
  user: any;
}

interface AlertDetail {
  alertId: string;
  symbol: string;
  ticker: string;
  status: string;
  tipo: string;
  entryPrice: number;
  currentPrice: number;
  finalPrice?: number;
  exitPrice?: number;
  profit?: number;
  profitPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
  currentPriceUpdatedAt?: Date;
  allocatedAmount?: number;
  shares?: number;
  entryPriceFromDistribution?: number;
  realizedProfitLoss?: number;
  soldShares?: number;
  participationPercentage?: number;
  calculatedPL?: number;
  calculatedPLPercentage?: number;
  priceSource: string;
}

interface DashboardBreakdown {
  metric: string;
  value: string;
  calculation: string;
  source: string;
  components?: Array<{
    label: string;
    value: string;
    source: string;
  }>;
}

export default function AdminPortfolioAuditPage({ user }: AdminPortfolioAuditProps) {
  const [selectedPool, setSelectedPool] = useState<'TraderCall' | 'SmartMoney'>('TraderCall');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchAuditData();
  }, [selectedPool]);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/portfolio-audit?pool=${selectedPool}`);
      if (!response.ok) throw new Error('Error al cargar datos de auditoría');
      const json = await response.json();
      setData(json);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const toggleMetric = (metric: string) => {
    const newExpanded = new Set(expandedMetrics);
    if (newExpanded.has(metric)) {
      newExpanded.delete(metric);
    } else {
      newExpanded.add(metric);
    }
    setExpandedMetrics(newExpanded);
  };

  const filteredAlerts = data?.alerts?.filter((alert: AlertDetail) => {
    const matchesSearch = 
      alert.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.alertId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || alert.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (date: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(d);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: 'Activa', className: styles.statusActive },
      CLOSED: { label: 'Cerrada', className: styles.statusClosed },
      PENDING: { label: 'Pendiente', className: styles.statusPending }
    };
    return badges[status] || { label: status, className: styles.statusUnknown };
  };

  return (
    <>
      <Head>
        <title>Auditoría de Portfolio - Admin - Lozano Nahuel</title>
        <meta name="description" content="Auditoría completa del portfolio con desglose de todos los cálculos" />
      </Head>
      
      <Navbar />
      
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIcon}>
                <BarChart3 size={30} />
              </div>
              <div>
                <h1 className={styles.title}>Auditoría de Portfolio</h1>
                <p className={styles.subtitle}>
                  Desglose completo de todos los números del dashboard con su origen y cálculos
                </p>
              </div>
            </div>
            
            <div className={styles.headerActions}>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value as 'TraderCall' | 'SmartMoney')}
                className={styles.poolSelector}
              >
                <option value="TraderCall">TraderCall</option>
                <option value="SmartMoney">SmartMoney</option>
              </select>
              
              <button
                onClick={fetchAuditData}
                className={styles.refreshButton}
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? styles.spinning : ''} />
                Actualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>
              <RefreshCw size={32} className={styles.spinning} />
              <p>Cargando datos de auditoría...</p>
            </div>
          ) : data ? (
            <>
              {/* Información de última actualización */}
              {data.metrics && (
                <div className={styles.infoBox}>
                  <Info size={18} />
                  <div>
                    <strong>Última actualización de métricas:</strong>{' '}
                    {formatDate(data.metrics.lastUpdated)} ({Math.round((Date.now() - new Date(data.metrics.lastUpdated).getTime()) / 1000 / 60)} min atrás)
                  </div>
                </div>
              )}

              {/* Desglose del Dashboard */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <Calculator size={24} />
                  Desglose de Métricas del Dashboard
                </h2>
                
                <div className={styles.metricsGrid}>
                  {data.dashboardBreakdown?.map((metric: DashboardBreakdown, index: number) => (
                    <motion.div
                      key={index}
                      className={styles.metricCard}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div
                        className={styles.metricHeader}
                        onClick={() => toggleMetric(metric.metric)}
                      >
                        <div className={styles.metricInfo}>
                          <h3 className={styles.metricName}>{metric.metric}</h3>
                          <div className={styles.metricValue}>{metric.value}</div>
                        </div>
                        <button className={styles.expandButton}>
                          {expandedMetrics.has(metric.metric) ? (
                            <ChevronUp size={20} />
                          ) : (
                            <ChevronDown size={20} />
                          )}
                        </button>
                      </div>
                      
                      {expandedMetrics.has(metric.metric) && (
                        <div className={styles.metricDetails}>
                          <div className={styles.detailRow}>
                            <strong>Fórmula:</strong>
                            <code className={styles.formula}>{metric.calculation}</code>
                          </div>
                          <div className={styles.detailRow}>
                            <strong>Origen:</strong>
                            <span className={styles.source}>{metric.source}</span>
                          </div>
                          
                          {metric.components && metric.components.length > 0 && (
                            <div className={styles.components}>
                              <strong>Componentes:</strong>
                              <ul>
                                {metric.components.map((comp, compIndex) => (
                                  <li key={compIndex}>
                                    <span className={styles.componentLabel}>{comp.label}:</span>
                                    <span className={styles.componentValue}>{comp.value}</span>
                                    <span className={styles.componentSource}>({comp.source})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Detalles de Alertas */}
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <FileText size={24} />
                  Detalles de Alertas ({filteredAlerts.length} de {data.alerts?.length || 0})
                </h2>
                
                {/* Filtros */}
                <div className={styles.filters}>
                  <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Buscar por ticker, símbolo o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>
                  
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className={styles.statusFilter}
                  >
                    <option value="all">Todas las alertas</option>
                    <option value="ACTIVE">Solo activas</option>
                    <option value="CLOSED">Solo cerradas</option>
                  </select>
                </div>

                {/* Tabla de Alertas */}
                <div className={styles.tableContainer}>
                  <table className={styles.alertsTable}>
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Estado</th>
                        <th>Precio Entrada</th>
                        <th>Precio Actual</th>
                        <th>Última Actualización</th>
                        <th>Cantidad</th>
                        <th>Monto Asignado</th>
                        <th>P&L</th>
                        <th>P&L %</th>
                        <th>Origen Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((alert: AlertDetail) => {
                        const statusBadge = getStatusBadge(alert.status);
                        return (
                          <tr key={alert.alertId}>
                            <td>
                              <strong>{alert.ticker || alert.symbol}</strong>
                              <div className={styles.alertId}>
                                {alert.alertId.substring(0, 8)}...
                              </div>
                            </td>
                            <td>
                              <span className={statusBadge.className}>
                                {statusBadge.label}
                              </span>
                            </td>
                            <td>
                              {formatCurrency(alert.entryPrice)}
                              {alert.entryPriceFromDistribution && (
                                <div className={styles.priceNote}>
                                  (dist: {formatCurrency(alert.entryPriceFromDistribution)})
                                </div>
                              )}
                            </td>
                            <td>
                              {formatCurrency(alert.currentPrice)}
                              {alert.finalPrice && alert.finalPrice !== alert.currentPrice && (
                                <div className={styles.priceNote}>
                                  final: {formatCurrency(alert.finalPrice)}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className={styles.dateCell}>
                                <Clock size={14} />
                                {formatDate(alert.currentPriceUpdatedAt || alert.updatedAt)}
                              </div>
                            </td>
                            <td>
                              {alert.shares ? alert.shares.toFixed(4) : 'N/A'}
                              {alert.soldShares && alert.soldShares > 0 && (
                                <div className={styles.priceNote}>
                                  vendidas: {alert.soldShares.toFixed(4)}
                                </div>
                              )}
                            </td>
                            <td>
                              {alert.allocatedAmount ? formatCurrency(alert.allocatedAmount) : 'N/A'}
                              {alert.participationPercentage && (
                                <div className={styles.priceNote}>
                                  {alert.participationPercentage}% participación
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={
                                (alert.calculatedPL || 0) >= 0 
                                  ? styles.positiveValue 
                                  : styles.negativeValue
                              }>
                                {formatCurrency(alert.calculatedPL || 0)}
                              </span>
                              {alert.realizedProfitLoss && alert.realizedProfitLoss > 0 && (
                                <div className={styles.priceNote}>
                                  realizado: {formatCurrency(alert.realizedProfitLoss)}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={
                                (alert.calculatedPLPercentage || 0) >= 0 
                                  ? styles.positiveValue 
                                  : styles.negativeValue
                              }>
                                {((alert.calculatedPLPercentage || 0) >= 0 ? '+' : '')}
                                {(alert.calculatedPLPercentage || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td>
                              <span className={
                                alert.priceSource === 'database' 
                                  ? styles.sourceDatabase 
                                  : styles.sourceCalculated
                              }>
                                <Database size={14} />
                                {alert.priceSource === 'database' ? 'BD' : 'Calculado'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Información de Liquidez */}
              {data.liquidity && (
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>
                    <DollarSign size={24} />
                    Detalles de Liquidez
                  </h2>
                  
                  <div className={styles.liquidityGrid}>
                    <div className={styles.liquidityCard}>
                      <div className={styles.liquidityLabel}>Liquidez Inicial</div>
                      <div className={styles.liquidityValue}>
                        {formatCurrency(data.liquidity.initialLiquidity)}
                      </div>
                    </div>
                    <div className={styles.liquidityCard}>
                      <div className={styles.liquidityLabel}>Liquidez Total</div>
                      <div className={styles.liquidityValue}>
                        {formatCurrency(data.liquidity.totalLiquidity)}
                      </div>
                    </div>
                    <div className={styles.liquidityCard}>
                      <div className={styles.liquidityLabel}>Liquidez Distribuida</div>
                      <div className={styles.liquidityValue}>
                        {formatCurrency(data.liquidity.distributedLiquidity)}
                      </div>
                    </div>
                    <div className={styles.liquidityCard}>
                      <div className={styles.liquidityLabel}>Liquidez Disponible</div>
                      <div className={styles.liquidityValue}>
                        {formatCurrency(data.liquidity.availableLiquidity)}
                      </div>
                    </div>
                    <div className={styles.liquidityCard}>
                      <div className={styles.liquidityLabel}>Total Profit/Loss</div>
                      <div className={`${styles.liquidityValue} ${
                        data.liquidity.totalProfitLoss >= 0 
                          ? styles.positiveValue 
                          : styles.negativeValue
                      }`}>
                        {formatCurrency(data.liquidity.totalProfitLoss)}
                      </div>
                    </div>
                    <div className={styles.liquidityCard}>
                      <div className={styles.liquidityLabel}>Profit/Loss %</div>
                      <div className={`${styles.liquidityValue} ${
                        data.liquidity.totalProfitLossPercentage >= 0 
                          ? styles.positiveValue 
                          : styles.negativeValue
                      }`}>
                        {((data.liquidity.totalProfitLossPercentage >= 0 ? '+' : ''))}
                        {data.liquidity.totalProfitLossPercentage.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {data.liquidity.distributions && data.liquidity.distributions.length > 0 && (
                    <div className={styles.distributionsTable}>
                      <h3>Distribuciones de Liquidez</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Ticker</th>
                            <th>Monto Asignado</th>
                            <th>Cantidad</th>
                            <th>Precio Entrada</th>
                            <th>P&L Realizado</th>
                            <th>Cantidad Vendida</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.liquidity.distributions.map((dist: any, index: number) => (
                            <tr key={index}>
                              <td>{dist.symbol || dist.alertId?.substring(0, 8)}</td>
                              <td>{formatCurrency(dist.allocatedAmount)}</td>
                              <td>{dist.shares.toFixed(4)}</td>
                              <td>{formatCurrency(dist.entryPrice)}</td>
                              <td className={
                                dist.realizedProfitLoss >= 0 
                                  ? styles.positiveValue 
                                  : styles.negativeValue
                              }>
                                {formatCurrency(dist.realizedProfitLoss)}
                              </td>
                              <td>{dist.soldShares.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <div className={styles.error}>
              <AlertCircle size={32} />
              <p>No se pudieron cargar los datos de auditoría</p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </>
  );
}

export const getServerSideProps = async (context: any) => {
  const result = await verifyAdminAccess(context);
  
  // Si hay redirección, retornar redirect
  if (result.redirectTo) {
    return {
      redirect: {
        destination: result.redirectTo,
        permanent: false
      }
    };
  }
  
  // Retornar props anidadas correctamente
  return {
    props: {
      isAdmin: result.isAdmin,
      user: result.user || null,
      session: result.session || null
    }
  };
};

