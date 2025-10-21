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

interface OperationsTableProps {
  system: 'TraderCall' | 'SmartMoney';
  className?: string;
}

const OperationsTable: React.FC<OperationsTableProps> = ({ system, className = '' }) => {
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
  const [sortBy, setSortBy] = useState<'date' | 'ticker' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchOperations(system);
  }, [system, fetchOperations]);

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
        case 'amount':
          comparison = a.amount - b.amount;
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
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Cargando operaciones...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 mb-2">Error al cargar operaciones</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => fetchOperations(system)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header con estadísticas */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Operaciones - {system}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshOperations}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Balance Actual</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(currentBalance)}
            </p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Total Operaciones</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Activos Únicos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.length}</p>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ticker..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'ALL' | 'COMPRA' | 'VENTA')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Todas</option>
              <option value="COMPRA">Compras</option>
              <option value="VENTA">Ventas</option>
            </select>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as 'date' | 'ticker' | 'amount');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date-desc">Fecha (Reciente)</option>
              <option value="date-asc">Fecha (Antiguo)</option>
              <option value="ticker-asc">Ticker (A-Z)</option>
              <option value="ticker-desc">Ticker (Z-A)</option>
              <option value="amount-desc">Monto (Mayor)</option>
              <option value="amount-asc">Monto (Menor)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de operaciones */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOperations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
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
                  <tr key={operation._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getOperationBgColor(operation.operationType)}`}>
                        {getOperationIcon(operation.operationType)}
                        <span className={getOperationColor(operation.operationType)}>
                          {operation.operationType}
                        </span>
                      </div>
                      {operation.isPartialSale && (
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-100 text-orange-800">
                            Parcial ({operation.partialSalePercentage}%)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {operation.ticker}
                      </div>
                      <div className="text-sm text-gray-500">
                        {operation.alertSymbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${operation.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {operation.quantity > 0 ? '+' : ''}{operation.quantity.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(operation.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${operation.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {operation.amount > 0 ? '+' : ''}{formatCurrency(operation.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(operation.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(operation.balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen por ticker */}
      {summary.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen por Activo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.map((item) => (
              <div key={item._id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{item._id}</h4>
                  <span className="text-sm text-gray-500">
                    {item.totalOperations} ops
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cantidad:</span>
                    <span className="font-medium">{item.totalQuantity.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto Total:</span>
                    <span className="font-medium">{formatCurrency(item.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Precio Promedio:</span>
                    <span className="font-medium">{formatCurrency(item.avgPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Última Operación:</span>
                    <span className="font-medium">{formatDate(item.lastOperation)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsTable;
