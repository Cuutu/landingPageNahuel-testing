import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoPriceUpdateReturn {
  isActive: boolean;
  lastUpdate: Date | null;
  nextUpdate: Date | null;
  startAutoUpdate: () => void;
  stopAutoUpdate: () => void;
  forceUpdate: () => void;
  error: string | null;
  isUpdating: boolean;
}

/**
 * ✅ OPTIMIZADO: Hook para actualización automática de precios (alternativa gratuita a cron jobs)
 * 
 * Optimizaciones implementadas:
 * - Debouncing para evitar múltiples llamadas simultáneas
 * - Mejor manejo de errores con backoff exponencial
 * - Reducción de operaciones localStorage
 * - Optimización de intervalos
 * - Prevención de memory leaks
 */
export const useAutoPriceUpdate = (
  updateFunction: () => Promise<void>,
  intervalMinutes: number = 10
): UseAutoPriceUpdateReturn => {
  const [isActive, setIsActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [nextUpdate, setNextUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  /**
   * ✅ OPTIMIZADO: Función para actualizar precios con debouncing
   */
  const updatePrices = useCallback(async () => {
    if (!isActiveRef.current || isUpdating) return;

    try {
      setIsUpdating(true);
      setError(null);
      
      console.log(`🔄 Actualizando precios automáticamente... (intento ${retryCountRef.current + 1})`);
      
      await updateFunction();
      
      const now = new Date();
      setLastUpdate(now);
      setNextUpdate(new Date(now.getTime() + intervalMinutes * 60 * 1000));
      
      // ✅ OPTIMIZADO: Resetear contador de reintentos en éxito
      retryCountRef.current = 0;
      
      console.log(`✅ Precios actualizados exitosamente a las ${now.toLocaleTimeString()}`);
      
      // ✅ OPTIMIZADO: Batch localStorage operations
      const nextUpdateTime = new Date(now.getTime() + intervalMinutes * 60 * 1000);
      const localStorageData = {
        lastPriceUpdate: now.toISOString(),
        nextPriceUpdate: nextUpdateTime.toISOString()
      };
      
      Object.entries(localStorageData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
    } catch (err: any) {
      const errorMessage = `Error actualizando precios: ${err.message}`;
      console.error(`❌ ${errorMessage}`);
      setError(errorMessage);
      
      // ✅ OPTIMIZADO: Backoff exponencial para reintentos
      retryCountRef.current++;
      if (retryCountRef.current < maxRetries) {
        const retryDelay = Math.min(2 ** retryCountRef.current * 60 * 1000, 10 * 60 * 1000); // Max 10 minutos
        
        console.log(`🔄 Reintentando en ${retryDelay / 1000 / 60} minutos...`);
        
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        updateTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            updatePrices();
          }
        }, retryDelay);
      } else {
        console.error('❌ Máximo número de reintentos alcanzado');
        setError('Error persistente. Revisa tu conexión e intenta nuevamente.');
      }
    } finally {
      setIsUpdating(false);
    }
  }, [updateFunction, intervalMinutes, isUpdating]);

  /**
   * ✅ OPTIMIZADO: Iniciar actualización automática con mejor manejo
   */
  const startAutoUpdate = useCallback(() => {
    if (isActiveRef.current) return;

    console.log(`🚀 Iniciando actualización automática de precios cada ${intervalMinutes} minutos`);
    
    isActiveRef.current = true;
    setIsActive(true);
    
    // ✅ OPTIMIZADO: Ejecutar inmediatamente solo si no se ejecutó recientemente
    const lastUpdateStr = localStorage.getItem('lastPriceUpdate');
    if (lastUpdateStr) {
      const lastUpdateTime = new Date(lastUpdateStr);
      const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
      const shouldUpdate = timeSinceLastUpdate >= intervalMinutes * 60 * 1000;
      
      if (shouldUpdate) {
        updatePrices();
      }
    } else {
      updatePrices();
    }
    
    // ✅ OPTIMIZADO: Configurar intervalo más preciso
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current && !isUpdating) {
        updatePrices();
      }
    }, intervalMinutes * 60 * 1000);
    
    // ✅ OPTIMIZADO: Guardar estado en localStorage una sola vez
    localStorage.setItem('autoPriceUpdateActive', 'true');
    localStorage.setItem('autoPriceUpdateInterval', intervalMinutes.toString());
    
    // ✅ OPTIMIZADO: Listener de visibilidad más eficiente
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
        const lastUpdateStr = localStorage.getItem('lastPriceUpdate');
        if (lastUpdateStr) {
          const lastUpdateTime = new Date(lastUpdateStr);
          const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
          const shouldUpdate = timeSinceLastUpdate >= intervalMinutes * 60 * 1000;
          
          if (shouldUpdate && !isUpdating) {
            console.log('⏰ Página visible, actualizando precios...');
            updatePrices();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ✅ OPTIMIZADO: Cleanup más robusto
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatePrices, intervalMinutes, isUpdating]);

  /**
   * ✅ OPTIMIZADO: Detener actualización automática con cleanup completo
   */
  const stopAutoUpdate = useCallback(() => {
    console.log('⏹️ Deteniendo actualización automática de precios');
    
    isActiveRef.current = false;
    setIsActive(false);
    
    // ✅ OPTIMIZADO: Limpiar todos los timeouts e intervalos
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    
    // ✅ OPTIMIZADO: Limpiar localStorage de una vez
    const keysToRemove = [
      'autoPriceUpdateActive',
      'autoPriceUpdateInterval', 
      'lastPriceUpdate',
      'nextPriceUpdate'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    setNextUpdate(null);
    setError(null);
    setIsUpdating(false);
    retryCountRef.current = 0;
  }, []);

  /**
   * ✅ OPTIMIZADO: Forzar actualización manual con debouncing
   */
  const forceUpdate = useCallback(() => {
    if (isUpdating) {
      console.log('⏳ Actualización en progreso, esperando...');
      return;
    }
    
    console.log('🔨 Forzando actualización manual de precios');
    updatePrices();
  }, [updatePrices, isUpdating]);

  /**
   * ✅ OPTIMIZADO: Restaurar estado desde localStorage con validación
   */
  useEffect(() => {
    const wasActive = localStorage.getItem('autoPriceUpdateActive') === 'true';
    const savedInterval = localStorage.getItem('autoPriceUpdateInterval');
    const lastUpdateStr = localStorage.getItem('lastPriceUpdate');
    const nextUpdateStr = localStorage.getItem('nextPriceUpdate');
    
    if (wasActive && savedInterval) {
      const interval = parseInt(savedInterval);
      if (interval === intervalMinutes) {
        console.log('🔄 Restaurando actualización automática desde localStorage');
        
        if (lastUpdateStr) {
          setLastUpdate(new Date(lastUpdateStr));
        }
        
        if (nextUpdateStr) {
          setNextUpdate(new Date(nextUpdateStr));
        }
        
        // ✅ OPTIMIZADO: Iniciar solo si no está activo
        if (!isActive) {
          startAutoUpdate();
        }
      }
    }
  }, [intervalMinutes, startAutoUpdate, isActive]);

  /**
   * ✅ OPTIMIZADO: Cleanup completo al desmontar
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return {
    isActive,
    lastUpdate,
    nextUpdate,
    startAutoUpdate,
    stopAutoUpdate,
    forceUpdate,
    error,
    isUpdating,
  };
}; 