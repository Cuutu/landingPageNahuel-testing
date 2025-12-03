import { useState, useEffect, useCallback, useRef } from 'react';

interface UseMarketCloseReturn {
  isMarketOpen: boolean;
  timeUntilClose: string;
  lastCloseCheck: Date | null;
  nextCloseCheck: Date | null;
  startMarketMonitoring: () => void;
  stopMarketMonitoring: () => void;
  forceCloseCheck: () => void;
  error: string | null;
}

/**
 * ✅ NUEVO: Hook para monitoreo de cierre de mercado (alternativa gratuita a cron jobs)
 * 
 * Características:
 * - Verifica cierre de mercado cada 5 minutos
 * - Funciona solo cuando el usuario está en la página
 * - Persiste en localStorage
 * - Maneja horarios de mercado (17:30 America/Montevideo)
 * - Considera días hábiles
 */
export const useMarketClose = (
  closeFunction: () => Promise<void>,
  checkIntervalMinutes: number = 5
): UseMarketCloseReturn => {
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [timeUntilClose, setTimeUntilClose] = useState('');
  const [lastCloseCheck, setLastCloseCheck] = useState<Date | null>(null);
  const [nextCloseCheck, setNextCloseCheck] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  /**
   * ✅ NUEVO: Verificar si el mercado está abierto
   */
  const checkMarketStatus = useCallback(() => {
    const now = new Date();
    const montevideoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Montevideo' }));
    
    // ✅ NUEVO: Verificar si es día hábil (lunes a viernes)
    const dayOfWeek = montevideoTime.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    // ✅ NUEVO: Verificar horario de mercado (9:00 - 17:30)
    const hour = montevideoTime.getHours();
    const minute = montevideoTime.getMinutes();
    const currentTime = hour * 60 + minute;
    const marketOpenTime = 9 * 60; // 9:00
    const marketCloseTime = 17 * 60 + 30; // 17:30
    
    const isOpen = isWeekday && currentTime >= marketOpenTime && currentTime < marketCloseTime;
    
    setIsMarketOpen(isOpen);
    
    // ✅ NUEVO: Calcular tiempo hasta cierre
    if (isOpen) {
      const minutesUntilClose = marketCloseTime - currentTime;
      const hours = Math.floor(minutesUntilClose / 60);
      const minutes = minutesUntilClose % 60;
      setTimeUntilClose(`${hours}h ${minutes}m`);
    } else {
      setTimeUntilClose('Cerrado');
    }
    
    return isOpen;
  }, []);

  /**
   * ✅ NUEVO: Función para verificar cierre de mercado
   */
  const checkMarketClose = useCallback(async () => {
    if (!isActiveRef.current) return;

    try {
      // console.log(`🕐 Verificando estado del mercado...`);
      setError(null);
      
      const isOpen = checkMarketStatus();
      
      // ✅ NUEVO: Si el mercado está por cerrar (últimos 5 minutos), ejecutar función
      if (isOpen) {
        const now = new Date();
        const montevideoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Montevideo' }));
        const hour = montevideoTime.getHours();
        const minute = montevideoTime.getMinutes();
        const currentTime = hour * 60 + minute;
        const marketCloseTime = 17 * 60 + 30; // 17:30
        
        const minutesUntilClose = marketCloseTime - currentTime;
        
        if (minutesUntilClose <= 5 && minutesUntilClose > 0) {
          // console.log(`🔔 Mercado cerrará en ${minutesUntilClose} minutos, ejecutando función de cierre...`);
          await closeFunction();
        }
      }
      
      const now = new Date();
      setLastCloseCheck(now);
      setNextCloseCheck(new Date(now.getTime() + checkIntervalMinutes * 60 * 1000));
      
      // console.log(`✅ Estado del mercado verificado a las ${now.toLocaleTimeString()}`);
      
      // ✅ NUEVO: Guardar en localStorage
      localStorage.setItem('lastMarketCloseCheck', now.toISOString());
      localStorage.setItem('nextMarketCloseCheck', new Date(now.getTime() + checkIntervalMinutes * 60 * 1000).toISOString());
      
    } catch (err: any) {
      const errorMessage = `Error verificando cierre de mercado: ${err.message}`;
      console.error(`❌ ${errorMessage}`);
      setError(errorMessage);
      
      // ✅ NUEVO: Reintentar en 1 minuto si falla
      setTimeout(() => {
        if (isActiveRef.current) {
          checkMarketClose();
        }
      }, 1 * 60 * 1000);
    }
  }, [closeFunction, checkIntervalMinutes, checkMarketStatus]);

  /**
   * ✅ NUEVO: Iniciar monitoreo de mercado
   */
  const startMarketMonitoring = useCallback(() => {
    if (isActiveRef.current) return;

    // console.log(`🚀 Iniciando monitoreo de mercado cada ${checkIntervalMinutes} minutos`);
    
    isActiveRef.current = true;
    
    // ✅ NUEVO: Verificar estado inicial
    checkMarketStatus();
    
    // ✅ NUEVO: Ejecutar verificación inmediatamente
    checkMarketClose();
    
    // ✅ NUEVO: Configurar intervalo
    intervalRef.current = setInterval(checkMarketClose, checkIntervalMinutes * 60 * 1000);
    
    // ✅ NUEVO: Guardar estado en localStorage
    localStorage.setItem('marketMonitoringActive', 'true');
    localStorage.setItem('marketMonitoringInterval', checkIntervalMinutes.toString());
    
    // ✅ NUEVO: Configurar listener para cuando la página vuelve a ser visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
            // console.log('📱 Página visible, verificando estado del mercado...');
        checkMarketStatus();
        
        const lastCheckStr = localStorage.getItem('lastMarketCloseCheck');
        if (lastCheckStr) {
          const lastCheckTime = new Date(lastCheckStr);
          const timeSinceLastCheck = Date.now() - lastCheckTime.getTime();
          const shouldCheck = timeSinceLastCheck >= checkIntervalMinutes * 60 * 1000;
          
          if (shouldCheck) {
            // console.log('⏰ Ha pasado mucho tiempo, verificando mercado...');
            checkMarketClose();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // ✅ NUEVO: Limpiar listener cuando se detenga
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkMarketClose, checkMarketStatus, checkIntervalMinutes]);

  /**
   * ✅ NUEVO: Detener monitoreo de mercado
   */
  const stopMarketMonitoring = useCallback(() => {
    // console.log('⏹️ Deteniendo monitoreo de mercado');
    
    isActiveRef.current = false;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // ✅ NUEVO: Limpiar localStorage
    localStorage.removeItem('marketMonitoringActive');
    localStorage.removeItem('marketMonitoringInterval');
    localStorage.removeItem('lastMarketCloseCheck');
    localStorage.removeItem('nextMarketCloseCheck');
    
    setNextCloseCheck(null);
  }, []);

  /**
   * ✅ NUEVO: Forzar verificación manual
   */
  const forceCloseCheck = useCallback(() => {
    // console.log('🔨 Forzando verificación manual de cierre de mercado');
    checkMarketClose();
  }, [checkMarketClose]);

  /**
   * ✅ NUEVO: Restaurar estado desde localStorage al montar
   */
  useEffect(() => {
    const wasActive = localStorage.getItem('marketMonitoringActive') === 'true';
    const savedInterval = localStorage.getItem('marketMonitoringInterval');
    const lastCheckStr = localStorage.getItem('lastMarketCloseCheck');
    const nextCheckStr = localStorage.getItem('nextMarketCloseCheck');
    
    if (wasActive && savedInterval) {
      const interval = parseInt(savedInterval);
      if (interval === checkIntervalMinutes) {
        // console.log('🔄 Restaurando monitoreo de mercado desde localStorage');
        
        if (lastCheckStr) {
          setLastCloseCheck(new Date(lastCheckStr));
        }
        
        if (nextCheckStr) {
          setNextCloseCheck(new Date(nextCheckStr));
        }
        
        // ✅ NUEVO: Iniciar automáticamente si la página se recarga
        startMarketMonitoring();
      }
    }
  }, [checkIntervalMinutes, startMarketMonitoring]);

  /**
   * ✅ NUEVO: Limpiar al desmontar
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isMarketOpen,
    timeUntilClose,
    lastCloseCheck,
    nextCloseCheck,
    startMarketMonitoring,
    stopMarketMonitoring,
    forceCloseCheck,
    error,
  };
}; 