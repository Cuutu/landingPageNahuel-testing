import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

/**
 * Componente que monitorea la sesión y la mantiene activa
 * Detecta cuando la sesión se pierde y la refresca automáticamente
 */
export default function SessionMonitor() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const lastCheckRef = useRef<number>(Date.now());
  const retryCountRef = useRef<number>(0);
  const isCheckingRef = useRef<boolean>(false);

  useEffect(() => {
    // Solo monitorear en rutas que no sean de autenticación
    if (router.pathname.startsWith('/api/auth') || router.pathname === '/auth/signin') {
      return;
    }

    const checkSession = async () => {
      // Evitar múltiples checks simultáneos
      if (isCheckingRef.current) return;
      
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheckRef.current;
      
      // Verificar cada 2 minutos si hay sesión activa
      if (timeSinceLastCheck < 2 * 60 * 1000) return;
      
      lastCheckRef.current = now;
      
      // Si el status es 'loading', esperar un poco más
      if (status === 'loading') {
        return;
      }

      // Si hay sesión pero falta información crítica, intentar refrescar
      if (status === 'authenticated' && session) {
        if (!session.user?.email || !session.user?.role) {
          isCheckingRef.current = true;
          try {
            await update();
            retryCountRef.current = 0; // Reset contador si funciona
          } catch (error) {
            console.error('❌ [SESSION MONITOR] Error al refrescar sesión:', error);
            retryCountRef.current++;
            
            // Si falla múltiples veces, puede ser un problema real
            if (retryCountRef.current >= 3) {
              console.warn('⚠️ [SESSION MONITOR] Múltiples fallos al refrescar sesión');
            }
          } finally {
            isCheckingRef.current = false;
          }
        } else {
          // Sesión válida, reset contador
          retryCountRef.current = 0;
        }
      }
    };

    // Verificar inmediatamente si hay problema
    if (status === 'authenticated' && session && (!session.user?.email || !session.user?.role)) {
      checkSession();
    }

    // Configurar intervalo de verificación
    const interval = setInterval(checkSession, 2 * 60 * 1000); // Cada 2 minutos

    return () => clearInterval(interval);
  }, [status, session, update, router.pathname]);

  // Monitorear cambios en el estado de la sesión
  useEffect(() => {
    if (status === 'unauthenticated' && router.pathname !== '/auth/signin' && !router.pathname.startsWith('/api/auth')) {
      // Si la sesión se perdió inesperadamente, intentar refrescar una vez
      const attemptRefresh = async () => {
        try {
          await update();
        } catch (error) {
          // Si falla, la sesión realmente se perdió
          console.warn('⚠️ [SESSION MONITOR] Sesión perdida, usuario necesita re-autenticarse');
        }
      };
      
      // Solo intentar si no estamos en una página pública
      const publicPages = ['/', '/recursos', '/cookies'];
      if (!publicPages.includes(router.pathname)) {
        attemptRefresh();
      }
    }
  }, [status, router.pathname, update]);

  // Este componente no renderiza nada
  return null;
}

