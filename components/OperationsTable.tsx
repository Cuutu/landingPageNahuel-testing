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
  Clock,
  Plus,
  X
} from 'lucide-react';
import styles from '@/styles/OperationsTable.module.css';

interface OperationsTableProps {
  system: 'TraderCall' | 'SmartMoney';
  className?: string;
  refreshTrigger?: number; // Cuando cambia, refresca las operaciones
  userRole?: string; // Rol del usuario para mostrar botones de admin
}

const OperationsTable: React.FC<OperationsTableProps> = ({ system, className = '', refreshTrigger = 0, userRole = '' }) => {
  const { 
    operations, 
    summary, 
    currentBalance, 
    total, 
    loading, 
    error, 
    fetchOperations, 
    refreshOperations,
    createOperation
  } = useOperations();

  // Estado para el modal de crear operación manual
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingOperation, setCreatingOperation] = useState(false);
  const [quantityType, setQuantityType] = useState<'shares' | 'percentage'>('shares');
  const [formData, setFormData] = useState({
    ticker: '',
    operationType: 'COMPRA' as 'COMPRA' | 'VENTA',
    quantity: '',
    price: '',
    date: new Date().toISOString().split('T')[0],
    portfolioPercentage: '',
    notes: '',
    alertId: '' // Opcional para operaciones antiguas
  });

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

  // Función para manejar la creación de operación manual
  const handleCreateManualOperation = async () => {
    if (!formData.ticker || !formData.quantity || !formData.price || !formData.date) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setCreatingOperation(true);
    try {
      const operationData: any = {
        ticker: formData.ticker.toUpperCase(),
        operationType: formData.operationType,
        price: parseFloat(formData.price),
        system: system,
        date: formData.date,
        notes: formData.notes || `Operación manual registrada - ${formData.operationType}`,
        isManual: true // Marcar como operación manual
      };

      // Manejar cantidad según el tipo seleccionado
      if (quantityType === 'percentage') {
        // Si es porcentaje, guardar en portfolioPercentage
        operationData.portfolioPercentage = parseFloat(formData.quantity);
        // La cantidad puede ser 0 o un valor estimado basado en el porcentaje
        operationData.quantity = 0; // O calcular basado en el balance actual si está disponible
      } else {
        // Si es acciones, guardar en quantity
        operationData.quantity = parseFloat(formData.quantity);
        // Si también hay portfolioPercentage, agregarlo
        if (formData.portfolioPercentage) {
          operationData.portfolioPercentage = parseFloat(formData.portfolioPercentage);
        }
      }

      // Si hay alertId, agregarlo; si no, crear operación sin alerta
      if (formData.alertId) {
        operationData.alertId = formData.alertId;
      }

      const result = await createOperation(operationData);
      
      if (result) {
        alert('✅ Operación creada exitosamente');
        setShowCreateModal(false);
        setQuantityType('shares');
        setFormData({
          ticker: '',
          operationType: 'COMPRA',
          quantity: '',
          price: '',
          date: new Date().toISOString().split('T')[0],
          portfolioPercentage: '',
          notes: '',
          alertId: ''
        });
        await fetchOperations(system);
      } else {
        alert('❌ Error al crear la operación');
      }
    } catch (error) {
      console.error('Error creating manual operation:', error);
      alert('❌ Error al crear la operación: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setCreatingOperation(false);
    }
  };

  // ✅ NUEVO: Función para determinar el estado de la operación
  const getOperationStatus = (operation: any): 'Ejecutada' | 'Rechazada' | 'A confirmar' => {
    if (!operation.alert) {
      // Si no hay información de la alerta, retornar "A confirmar" por defecto
      return 'A confirmar';
    }

    const alert = operation.alert;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // 1. "Ejecutada": Todas las alertas que aparecen en Seguimiento
    // Según la lógica de seguimiento:
    
    // A. Alertas cerradas o detenidas
    if (alert.status === 'CLOSED' || alert.status === 'STOPPED') {
      return 'Ejecutada';
    }

    // B. Alertas activas que están en seguimiento:
    //    - No son del día actual, O
    //    - Son del día actual pero tienen finalPriceSetAt (confirmadas a las 18:30)
    if (alert.status === 'ACTIVE') {
      const alertDate = alert.date ? new Date(alert.date) : (alert.createdAt ? new Date(alert.createdAt) : null);
      if (alertDate) {
        const isCreatedToday = alertDate >= startOfDay && alertDate <= endOfDay;
        // Si no es del día actual, está en seguimiento -> Ejecutada
        if (!isCreatedToday) {
          return 'Ejecutada';
        }
        // Si es del día actual pero tiene finalPriceSetAt, está en seguimiento -> Ejecutada
        if (isCreatedToday && alert.finalPriceSetAt) {
          return 'Ejecutada';
        }
      } else {
        // Si no tiene fecha pero tiene finalPriceSetAt, está en seguimiento -> Ejecutada
        if (alert.finalPriceSetAt) {
          return 'Ejecutada';
        }
      }
    }

    // C. Alertas descartadas del día actual (aparecen en seguimiento)
    if (alert.status === 'DESCARTADA' && alert.descartadaAt) {
      const descartadaAt = new Date(alert.descartadaAt);
      const isDescartadaToday = descartadaAt >= startOfDay && descartadaAt <= endOfDay;
      if (isDescartadaToday) {
        return 'Ejecutada';
      }
    }

    // 2. "Rechazada": Alertas descartadas que NO son del día actual
    // Las descartadas del día actual aparecen en seguimiento, así que son "Ejecutada"
    if (alert.status === 'DESCARTADA' && alert.descartadaAt) {
      const descartadaAt = new Date(alert.descartadaAt);
      const isDescartadaToday = descartadaAt >= startOfDay && descartadaAt <= endOfDay;
      if (!isDescartadaToday) {
        return 'Rechazada';
      }
    }

    // 3. "A confirmar": Alertas vigentes (status === 'ACTIVE' && availableForPurchase === true)
    // Estas son las alertas que aparecen en "Alertas vigentes"
    // NOTA: Solo llegamos aquí si NO se cumplió la condición de "Ejecutada" anterior
    // (es decir, son del día actual y NO tienen finalPriceSetAt)
    if (alert.status === 'ACTIVE' && alert.availableForPurchase === true) {
      return 'A confirmar';
    }

    // Por defecto, si no cumple ninguna condición, es "A confirmar"
    return 'A confirmar';
  };

  // ✅ NUEVO: Función para obtener el color del estado
  const getStatusColor = (status: 'Ejecutada' | 'Rechazada' | 'A confirmar') => {
    switch (status) {
      case 'Ejecutada':
        return { color: '#10B981', bgColor: '#D1FAE5' }; // Verde
      case 'Rechazada':
        return { color: '#EF4444', bgColor: '#FEE2E2' }; // Rojo
      case 'A confirmar':
        return { color: '#F59E0B', bgColor: '#FEF3C7' }; // Amarillo/Naranja
      default:
        return { color: '#6B7280', bgColor: '#F3F4F6' }; // Gris
    }
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

      {/* Botón para crear operación manual (solo admin) */}
      {userRole === 'admin' && (
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            <Plus size={16} />
            Agregar Operación Manual
          </button>
        </div>
      )}

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
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filteredOperations.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.noData}>
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
              filteredOperations.map((operation) => {
                const status = getOperationStatus(operation);
                const statusColors = getStatusColor(status);
                
                return (
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
                      {operation.operationType === 'COMPRA' && operation.portfolioPercentage != null ? (
                        <span style={{ color: '#10B981', fontWeight: '500' }}>
                          {typeof operation.portfolioPercentage === 'number' 
                            ? operation.portfolioPercentage.toFixed(2) 
                            : operation.portfolioPercentage}%
                        </span>
                      ) : operation.operationType === 'VENTA' && operation.portfolioPercentage != null ? (
                        <span style={{ color: '#EF4444', fontWeight: '500' }}>
                          {typeof operation.portfolioPercentage === 'number' 
                            ? operation.portfolioPercentage.toFixed(2) 
                            : operation.portfolioPercentage}%
                        </span>
                      ) : operation.operationType === 'VENTA' && operation.partialSalePercentage != null ? (
                        <span style={{ color: '#EF4444', fontWeight: '500' }}>
                          {operation.partialSalePercentage}%
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: statusColors.color,
                          backgroundColor: statusColors.bgColor,
                          border: `1px solid ${statusColors.color}20`
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td>
                      {formatDate(operation.date)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para crear operación manual */}
      {showCreateModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e5e7eb'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '2px solid #f3f4f6'
            }}>
              <h3 style={{ 
                fontSize: '1.75rem', 
                fontWeight: '700', 
                margin: 0,
                color: '#1f2937',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Plus size={24} style={{ color: '#3b82f6' }} />
                Agregar Operación Manual
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s',
                  color: '#6b7280'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Ticker / Símbolo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Tipo de Operación <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={formData.operationType}
                  onChange={(e) => setFormData({ ...formData, operationType: e.target.value as 'COMPRA' | 'VENTA' })}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <option value="COMPRA">Compra</option>
                  <option value="VENTA">Venta</option>
                </select>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Tipo de Cantidad <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <button
                    type="button"
                    onClick={() => setQuantityType('shares')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      border: `2px solid ${quantityType === 'shares' ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      backgroundColor: quantityType === 'shares' ? '#eff6ff' : 'white',
                      color: quantityType === 'shares' ? '#3b82f6' : '#6b7280',
                      fontWeight: quantityType === 'shares' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '0.95rem'
                    }}
                  >
                    Acciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantityType('percentage')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      border: `2px solid ${quantityType === 'percentage' ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      backgroundColor: quantityType === 'percentage' ? '#eff6ff' : 'white',
                      color: quantityType === 'percentage' ? '#3b82f6' : '#6b7280',
                      fontWeight: quantityType === 'percentage' ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: '0.95rem'
                    }}
                  >
                    Porcentaje (%)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.95rem'
                  }}>
                    {quantityType === 'shares' ? 'Cantidad (Acciones)' : 'Cantidad (%)'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder={quantityType === 'shares' ? "100" : "10"}
                    min="0"
                    step={quantityType === 'shares' ? "1" : "0.01"}
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.95rem'
                  }}>
                    Precio <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="150.00"
                    min="0"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Fecha <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>

              {quantityType === 'shares' && (
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '0.95rem'
                  }}>
                    % de Cartera (opcional)
                  </label>
                  <input
                    type="number"
                    value={formData.portfolioPercentage}
                    onChange={(e) => setFormData({ ...formData, portfolioPercentage: e.target.value })}
                    placeholder="10"
                    min="0"
                    max="100"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  ID de Alerta (opcional)
                </label>
                <input
                  type="text"
                  value={formData.alertId}
                  onChange={(e) => setFormData({ ...formData, alertId: e.target.value })}
                  placeholder="Dejar vacío si no hay alerta asociada"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#374151',
                  fontSize: '0.95rem'
                }}>
                  Notas (opcional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Operación manual registrada..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    resize: 'vertical',
                    transition: 'border-color 0.2s',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                marginTop: '0.5rem',
                paddingTop: '1.5rem',
                borderTop: '2px solid #f3f4f6'
              }}>
                <button
                  onClick={handleCreateManualOperation}
                  disabled={creatingOperation}
                  style={{
                    flex: 1,
                    padding: '0.875rem 1.5rem',
                    backgroundColor: creatingOperation ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: creatingOperation ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: creatingOperation ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!creatingOperation) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!creatingOperation) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                >
                  {creatingOperation ? (
                    <>
                      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Creando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Crear Operación
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingOperation}
                  style={{
                    padding: '0.875rem 1.5rem',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: creatingOperation ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!creatingOperation) {
                      e.currentTarget.style.backgroundColor = '#e5e7eb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!creatingOperation) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsTable;
