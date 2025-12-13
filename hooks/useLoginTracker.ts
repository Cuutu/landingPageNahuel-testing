import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const LOGIN_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutos
const STORAGE_KEY = 'lastLoginUpdate';

/**
 * ✅ OPTIMIZADO: Hook para trackear login con Page Visibility API
 * Solo actualiza cuando la pestaña está visible
 */
export function useLoginTracker() {
  const { data: session, status } = useSession();
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasUpdatedRef = useRef(false);
  const isVisibleRef = useRef(true);

  const updateLastLogin = useCallback(async () => {
    // No actualizar si la pestaña no está visible
    if (!isVisibleRef.current) return;
    
    try {
      const response = await fetch('/api/profile/update-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
    } catch (error) {
      // Silenciar errores
    }
  }, []);

  const shouldUpdateLogin = useCallback(() => {
    const lastUpdate = localStorage.getItem(STORAGE_KEY);
    if (!lastUpdate) return true;
    return Date.now() - parseInt(lastUpdate) > LOGIN_UPDATE_INTERVAL;
  }, []);

  // Manejar visibilidad de la página
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      
      // Si vuelve a ser visible y pasó el intervalo, actualizar
      if (isVisibleRef.current && hasUpdatedRef.current && shouldUpdateLogin()) {
        updateLastLogin();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [shouldUpdateLogin, updateLastLogin]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email && !hasUpdatedRef.current) {
      if (shouldUpdateLogin()) {
        updateLastLogin();
        hasUpdatedRef.current = true;

        // Solo actualizar si la pestaña está visible
        updateIntervalRef.current = setInterval(() => {
          if (isVisibleRef.current) {
            updateLastLogin();
          }
        }, LOGIN_UPDATE_INTERVAL);
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [status, session, shouldUpdateLogin, updateLastLogin]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      hasUpdatedRef.current = false;
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    }
  }, [status]);
}

export default useLoginTracker; 