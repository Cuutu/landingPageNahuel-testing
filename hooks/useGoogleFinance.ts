import { useState, useEffect, useCallback } from 'react';

interface StockPrice {
  symbol: string;
  price: number;
  success: boolean;
  error?: string;
}

interface UseGoogleFinanceReturn {
  // Precio individual
  price: number | null;
  loading: boolean;
  error: string | null;
  fetchPrice: (symbol: string) => Promise<void>;
  
  // Precios múltiples
  prices: StockPrice[];
  loadingMultiple: boolean;
  errorMultiple: string | null;
  fetchMultiplePrices: (symbols: string[]) => Promise<void>;
  
  // Utilidades
  clearError: () => void;
  clearPrices: () => void;
}

/**
 * ✅ NUEVO: Hook personalizado para usar Google Finance API
 */
export const useGoogleFinance = (): UseGoogleFinanceReturn => {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [prices, setPrices] = useState<StockPrice[]>([]);
  const [loadingMultiple, setLoadingMultiple] = useState(false);
  const [errorMultiple, setErrorMultiple] = useState<string | null>(null);

  /**
   * ✅ NUEVO: Obtener precio de una sola acción
   */
  const fetchPrice = useCallback(async (symbol: string) => {
    if (!symbol) {
      setError('Símbolo de acción requerido');
      return;
    }

    setLoading(true);
    setError(null);
    setPrice(null);

    try {
      const response = await fetch(`/api/market-data/google-finance?symbol=${encodeURIComponent(symbol)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setPrice(data.price);
        // console.log(`✅ Precio obtenido para ${symbol}: $${data.price}`);
      } else {
        setError(data.error || `No se pudo obtener precio para ${symbol}`);
        console.error(`❌ Error obteniendo precio para ${symbol}:`, data.error);
      }
    } catch (err: any) {
      const errorMessage = `Error de conexión: ${err.message}`;
      setError(errorMessage);
      console.error(`❌ Error de red para ${symbol}:`, err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * ✅ NUEVO: Obtener precios de múltiples acciones
   */
  const fetchMultiplePrices = useCallback(async (symbols: string[]) => {
    if (!symbols || symbols.length === 0) {
      setErrorMultiple('Array de símbolos requerido');
      return;
    }

    if (symbols.length > 10) {
      setErrorMultiple('Máximo 10 símbolos por request');
      return;
    }

    setLoadingMultiple(true);
    setErrorMultiple(null);
    setPrices([]);

    try {
      const response = await fetch('/api/market-data/google-finance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPrices(data.prices);
        // console.log(`✅ Precios obtenidos: ${data.prices.length}/${symbols.length}`);
        
        if (data.errors && data.errors.length > 0) {
          console.warn(`⚠️ Algunos precios fallaron:`, data.errors);
        }
      } else {
        setErrorMultiple(data.error || 'Error obteniendo precios múltiples');
        console.error(`❌ Error obteniendo precios múltiples:`, data.error);
      }
    } catch (err: any) {
      const errorMessage = `Error de conexión: ${err.message}`;
      setErrorMultiple(errorMessage);
      console.error(`❌ Error de red para precios múltiples:`, err);
    } finally {
      setLoadingMultiple(false);
    }
  }, []);

  /**
   * ✅ NUEVO: Limpiar errores
   */
  const clearError = useCallback(() => {
    setError(null);
    setErrorMultiple(null);
  }, []);

  /**
   * ✅ NUEVO: Limpiar precios
   */
  const clearPrices = useCallback(() => {
    setPrice(null);
    setPrices([]);
  }, []);

  return {
    // Precio individual
    price,
    loading,
    error,
    fetchPrice,
    
    // Precios múltiples
    prices,
    loadingMultiple,
    errorMultiple,
    fetchMultiplePrices,
    
    // Utilidades
    clearError,
    clearPrices,
  };
};

/**
 * ✅ NUEVO: Hook para obtener precio de una acción específica
 */
export const useStockPrice = (symbol: string, autoFetch: boolean = false) => {
  const { price, loading, error, fetchPrice } = useGoogleFinance();

  useEffect(() => {
    if (autoFetch && symbol) {
      fetchPrice(symbol);
    }
  }, [symbol, autoFetch, fetchPrice]);

  return {
    price,
    loading,
    error,
    refetch: () => fetchPrice(symbol),
  };
};

/**
 * ✅ NUEVO: Hook para obtener precios de múltiples acciones
 */
export const useMultipleStockPrices = (symbols: string[], autoFetch: boolean = false) => {
  const { prices, loadingMultiple, errorMultiple, fetchMultiplePrices } = useGoogleFinance();

  useEffect(() => {
    if (autoFetch && symbols && symbols.length > 0) {
      fetchMultiplePrices(symbols);
    }
  }, [symbols, autoFetch, fetchMultiplePrices]);

  return {
    prices,
    loading: loadingMultiple,
    error: errorMultiple,
    refetch: () => fetchMultiplePrices(symbols),
  };
}; 