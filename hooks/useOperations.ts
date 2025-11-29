import { useState, useEffect, useCallback } from 'react';

interface Operation {
  _id: string;
  ticker: string;
  operationType: 'COMPRA' | 'VENTA';
  quantity: number;
  price: number;
  amount: number;
  date: string;
  balance: number;
  alertId: string;
  alertSymbol: string;
  system: 'TraderCall' | 'SmartMoney';
  isPartialSale?: boolean;
  partialSalePercentage?: number;
  originalQuantity?: number;
  portfolioPercentage?: number; // ✅ NUEVO: Porcentaje de la cartera para compras
  liquidityData?: {
    allocatedAmount: number;
    shares: number;
    entryPrice: number;
    realizedProfit?: number;
  };
  executedBy?: string;
  executionMethod?: 'MANUAL' | 'AUTOMATIC' | 'ADMIN';
  notes?: string;
  createdAt: string;
  // ✅ NUEVO: Información de la alerta para determinar el estado
  alert?: {
    status: 'ACTIVE' | 'CLOSED' | 'STOPPED' | 'DESESTIMADA' | 'DESCARTADA';
    availableForPurchase?: boolean;
    finalPriceSetAt?: string | Date;
    descartadaAt?: string | Date;
    date?: string | Date;
    createdAt?: string | Date;
  } | null;
}

interface OperationsSummary {
  _id: string; // ticker
  totalOperations: number;
  totalQuantity: number;
  totalAmount: number;
  avgPrice: number;
  lastOperation: string;
  firstOperation: string;
}

interface UseOperationsReturn {
  operations: Operation[];
  summary: OperationsSummary[];
  currentBalance: number;
  total: number;
  loading: boolean;
  error: string | null;
  fetchOperations: (system: 'TraderCall' | 'SmartMoney', limit?: number, skip?: number) => Promise<void>;
  createOperation: (operationData: CreateOperationData) => Promise<Operation | null>;
  refreshOperations: () => Promise<void>;
}

interface CreateOperationData {
  alertId?: string; // ✅ NUEVO: Opcional para operaciones manuales
  ticker?: string; // ✅ NUEVO: Ticker para operaciones sin alerta
  operationType: 'COMPRA' | 'VENTA';
  quantity: number;
  price: number;
  system: 'TraderCall' | 'SmartMoney';
  date?: string; // ✅ NUEVO: Fecha opcional
  isPartialSale?: boolean;
  partialSalePercentage?: number;
  originalQuantity?: number;
  portfolioPercentage?: number; // ✅ NUEVO: Porcentaje de la cartera para compras
  liquidityData?: {
    allocatedAmount: number;
    shares: number;
    entryPrice: number;
    realizedProfit?: number;
  };
  notes?: string;
  isManual?: boolean; // ✅ NUEVO: Flag para operaciones manuales
}

export const useOperations = (): UseOperationsReturn => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [summary, setSummary] = useState<OperationsSummary[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOperations = useCallback(async (
    system: 'TraderCall' | 'SmartMoney',
    limit: number = 50,
    skip: number = 0
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/operations/list?system=${system}&limit=${limit}&skip=${skip}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener operaciones');
      }

      if (data.success) {
        setOperations(data.operations || []);
        setSummary(data.summary || []);
        setCurrentBalance(data.currentBalance || 0);
        setTotal(data.total || 0);
      } else {
        throw new Error(data.error || 'Error al obtener operaciones');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching operations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createOperation = useCallback(async (operationData: CreateOperationData): Promise<Operation | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/operations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(operationData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear operación');
      }

      if (data.success && data.operation) {
        // Agregar la nueva operación al inicio de la lista
        setOperations(prev => [data.operation, ...prev]);
        setTotal(prev => prev + 1);
        
        // Actualizar el balance
        setCurrentBalance(data.operation.balance);
        
        return data.operation;
      } else {
        throw new Error(data.error || 'Error al crear operación');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error creating operation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOperations = useCallback(async () => {
    if (operations.length > 0) {
      // Determinar el sistema basándose en la primera operación
      const system = operations[0].system;
      await fetchOperations(system);
    }
  }, [operations, fetchOperations]);

  return {
    operations,
    summary,
    currentBalance,
    total,
    loading,
    error,
    fetchOperations,
    createOperation,
    refreshOperations
  };
};
