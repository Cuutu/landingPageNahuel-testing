import React, { useState, useEffect } from 'react';
import { useOperations } from '@/hooks/useOperations';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Filter,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import styles from '@/styles/OperationsTable.module.css';

interface OperationsTableProps {
  system: 'TraderCall' | 'SmartMoney';
  className?: string;
  refreshTrigger?: number; // Cuando cambia, refresca las operaciones
}

const OperationsTable: React.FC<OperationsTableProps> = ({ system, className = '', refreshTrigger = 0 }) => {
  const { 
    operations, 
    summary, 
    currentBalance, 
    total, 
    loading, 
    error, 
    fetchOperations, 
    refreshOperations 
  } = useOperations();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'COMPRA' | 'VENTA'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'ticker'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchOperations(system);
  }, [system, fetchOperations]);

  // Refrescar cuando cambia el refreshTrigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchOperations(system);
    }
  }, [refreshTrigger, system, fetchOperations]);

  const filteredOperations = operations
    .filter(op => {
      const matchesSearch = (op.ticker && typeof op.ticker === 'string' && op.ticker.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (op.alertSymbol && typeof op.alertSymbol === 'string' && op.alertSymbol.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = filterType === 'ALL' || op.operationType === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'ticker':
          comparison = a.ticker.localeCompare(b.ticker);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getOperationIcon = (type: 'COMPRA' | 'VENTA') => {
    return type === 'COMPRA' ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getOperationColor = (type: 'COMPRA' | 'VENTA') => {
    return type === 'COMPRA' ? 'text-green-600' : 'text-red-600';
  };

  const getOperationBgColor = (type: 'COMPRA' | 'VENTA') => {
    return type === 'COMPRA' ? 'bg-green-50' : 'bg-red-50';
  };

  if (loading && operations.length === 0) {
    return (
      <div className={`${styles.operationsContainer} ${className}`}>
        <div className={styles.loading}>
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Cargando operaciones...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.operationsContainer} ${className}`}>
        <div className={styles.error}>
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>Error al cargar operaciones</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchOperations(system)}
            className={styles.paginationButton}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.operationsContainer} ${className}`}>
      {/* Header con estadísticas */}
      <div>
        <h2 className={styles.title}>
          Operaciones - {system}
        </h2>
        <p className={styles.description}>
          Gestiona y monitorea todas tus operaciones de trading
        </p>

        <div className={styles.summaryCards}>
          <div className={styles.card}>
            <CheckCircle className="w-8 h-8" />
            <h3>Total Operaciones</h3>
            <p>{total}</p>
          </div>
          
          <div className={styles.card}>
            <TrendingUp className="w-8 h-8" />
            <h3>Activos Únicos</h3>
            <p>{summary.length}</p>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <Search className="w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por ticker..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        
        <div className={styles.filterGroup}>
          <Filter className="w-4 h-4" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'ALL' | 'COMPRA' | 'VENTA')}
            className={styles.filterSelect}
          >
            <option value="ALL">Todas</option>
            <option value="COMPRA">Compras</option>
            <option value="VENTA">Ventas</option>
          </select>
        </div>
        
        <div className={styles.filterGroup}>
          <Calendar className="w-4 h-4" />
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as 'date' | 'ticker');
              setSortOrder(order as 'asc' | 'desc');
            }}
            className={styles.filterSelect}
          >
            <option value="date-desc">Fecha (Reciente)</option>
            <option value="date-asc">Fecha (Antiguo)</option>
            <option value="ticker-asc">Ticker (A-Z)</option>
            <option value="ticker-desc">Ticker (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Tabla de operaciones */}
      <div className={styles.tableWrapper}>
        <table className={styles.operationsTable}>
          <thead>
            <tr>
              <th>Operación</th>
              <th>Ticker</th>
              <th>Precio</th>
              <th>% Cartera</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperations.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.noData}>
                  <Clock className="w-8 h-8 mx-auto mb-2" />
                  <p>No hay operaciones para mostrar</p>
                  {searchTerm && (
                    <p className="text-sm mt-1">
                      Intenta con otro término de búsqueda
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              filteredOperations.map((operation) => (
                <tr key={operation._id} className={operation.operationType === 'COMPRA' ? styles.buyRow : styles.sellRow}>
                  <td>
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        {getOperationIcon(operation.operationType)}
                        <span className={operation.operationType === 'COMPRA' ? styles.positive : styles.negative}>
                          {operation.operationType}
                        </span>
                      </div>
                      {operation.isPartialSale && (
                        <div className="mt-1 flex items-center">
                          <span className={styles.partialSaleTag}>
                            Parcial ({operation.partialSalePercentage}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div>
                      <div className="font-medium">
                        {operation.ticker}
                      </div>
                      {operation.alertSymbol && operation.alertSymbol !== operation.ticker && (
                        <div className="text-sm opacity-75">
                          {operation.alertSymbol}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {formatCurrency(operation.price)}
                  </td>
                  <td>
                    {operation.operationType === 'COMPRA' && operation.portfolioPercentage ? (
                      <span style={{ color: '#10B981', fontWeight: '500' }}>
                        {operation.portfolioPercentage.toFixed(2)}%
                      </span>
                    ) : operation.operationType === 'VENTA' && operation.partialSalePercentage ? (
                      <span style={{ color: '#EF4444', fontWeight: '500' }}>
                        {operation.partialSalePercentage}%
                      </span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td>
                    {formatDate(operation.date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default OperationsTable;
