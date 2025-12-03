import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const LOGIN_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutos
const STORAGE_KEY = 'lastLoginUpdate';

/**
 * Hook para trackear y actualizar el último login del usuario
 * Se ejecuta una vez por sesión y luego cada 5 minutos mientras esté activo
 */
export function useLoginTracker() {
  const { data: session, status } = useSession();
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasUpdatedRef = useRef(false);

  const updateLastLogin = async () => {
    try {
      // console.log('🕐 Actualizando último login...');
      
      const response = await fetch('/api/profile/update-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // console.log('✅ Último login actualizado:', data.lastLogin);
        
        // Guardar timestamp de la última actualización
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      } else {
        console.error('❌ Error al actualizar último login:', response.status);
      }
    } catch (error) {
      console.error('💥 Error al actualizar último login:', error);
    }
  };

  const shouldUpdateLogin = () => {
    const lastUpdate = localStorage.getItem(STORAGE_KEY);
    if (!lastUpdate) return true;
    
    const timeSinceLastUpdate = Date.now() - parseInt(lastUpdate);
    return timeSinceLastUpdate > LOGIN_UPDATE_INTERVAL;
  };

  useEffect(() => {
    // Solo ejecutar si el usuario está autenticado
    if (status === 'authenticated' && session?.user?.email && !hasUpdatedRef.current) {
      
      // Verificar si necesitamos actualizar
      if (shouldUpdateLogin()) {
        updateLastLogin();
        hasUpdatedRef.current = true;

        // Configurar intervalo para actualizaciones periódicas
        updateIntervalRef.current = setInterval(() => {
          updateLastLogin();
        }, LOGIN_UPDATE_INTERVAL);
      }
    }

    // Cleanup del intervalo cuando el componente se desmonte
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [status, session]);

  // Cleanup cuando el usuario se desloguea
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