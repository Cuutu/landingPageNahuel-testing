import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

interface AdminRouteGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ 
  children, 
  fallback = (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827', color: '#f9fafb' }}>
      <div className="text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" style={{ color: '#6366F1' }} />
        <p>Verificando permisos de administrador...</p>
      </div>
    </div>
  )
}) => {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const hasCheckedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // ✅ MEJORADO: Función para verificar rol directamente del servidor si es necesario
  const verifyRoleFromServer = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/verify-role', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [ADMIN GUARD] Verificación directa del servidor:', data);
        return data.role === 'admin';
      }
      return false;
    } catch (error) {
      console.error('❌ [ADMIN GUARD] Error verificando rol del servidor:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      // Evitar múltiples verificaciones simultáneas
      if (hasCheckedRef.current && isAuthorized) return;
      
      console.log('🔍 [ADMIN GUARD] Estado de sesión:', { status, hasSession: !!session, role: session?.user?.role });

      // Si aún está cargando, esperar
      if (status === 'loading') {
        console.log('⏳ [ADMIN GUARD] Sesión cargando...');
        return;
      }

      // Si no está autenticado, redirigir a login
      if (status === 'unauthenticated') {
        console.log('❌ [ADMIN GUARD] No autenticado - redirigiendo a login');
        hasCheckedRef.current = true;
        const callbackUrl = encodeURIComponent(router.asPath || '/admin/dashboard');
        router.push(`/auth/signin?callbackUrl=${callbackUrl}`);
        return;
      }

      // ✅ MEJORADO: Si está autenticado, verificar rol
      if (status === 'authenticated' && session?.user?.email) {
        console.log('🔍 [ADMIN GUARD] Verificando rol para:', session.user.email);
        console.log('🔧 [ADMIN GUARD] Rol en sesión:', session.user.role);

        // Primero intentar con el rol de la sesión del cliente
        if (session.user.role === 'admin') {
          console.log('✅ [ADMIN GUARD] Acceso de admin confirmado desde sesión');
          hasCheckedRef.current = true;
          setIsAuthorized(true);
          setIsChecking(false);
          return;
        }

        // ✅ NUEVO: Si el rol no es admin en la sesión del cliente, verificar directamente del servidor
        // Esto maneja el caso donde la sesión del cliente no está sincronizada con el servidor
        if (retryCountRef.current < maxRetries) {
          console.log('⚠️ [ADMIN GUARD] Rol no es admin en cliente, verificando servidor... (intento', retryCountRef.current + 1, ')');
          retryCountRef.current++;
          
          // Intentar refrescar la sesión primero
          try {
            await update();
            // Esperar un momento para que se actualice
            await new Promise(resolve => setTimeout(resolve, 500));
            return; // El useEffect se volverá a ejecutar con la sesión actualizada
          } catch (error) {
            console.error('❌ [ADMIN GUARD] Error refrescando sesión:', error);
          }
          
          // Si el refresh no funcionó, verificar directamente del servidor
          const isAdminFromServer = await verifyRoleFromServer();
          
          if (isAdminFromServer) {
            console.log('✅ [ADMIN GUARD] Rol admin confirmado desde servidor');
            hasCheckedRef.current = true;
            setIsAuthorized(true);
            setIsChecking(false);
            return;
          }
        }

        // Si llegamos aquí, el usuario no es admin
        console.log('❌ [ADMIN GUARD] Usuario no es admin después de verificación - redirigiendo a home');
        hasCheckedRef.current = true;
        setIsChecking(false);
        router.push('/');
        return;
      }

      // ✅ NUEVO: Si tiene sesión pero no email, puede ser un problema de sincronización
      if (status === 'authenticated' && !session?.user?.email) {
        console.log('⚠️ [ADMIN GUARD] Sesión sin email, intentando refrescar...');
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          try {
            await update();
            await new Promise(resolve => setTimeout(resolve, 500));
            return; // El useEffect se volverá a ejecutar
          } catch (error) {
            console.error('❌ [ADMIN GUARD] Error refrescando sesión sin email:', error);
          }
        }
        
        // Si no se puede obtener el email, redirigir a login
        console.log('❌ [ADMIN GUARD] No se pudo obtener email después de reintentos');
        hasCheckedRef.current = true;
        setIsChecking(false);
        const callbackUrl = encodeURIComponent(router.asPath || '/admin/dashboard');
        router.push(`/auth/signin?callbackUrl=${callbackUrl}`);
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [session, status, router, update, isAuthorized, verifyRoleFromServer]);

  // Mostrar fallback mientras se verifica
  if (isChecking || status === 'loading') {
    return <>{fallback}</>;
  }

  // Si no está autorizado, no mostrar nada (ya se está redirigiendo)
  if (!isAuthorized) {
    return null;
  }

  // Si está autorizado, mostrar el contenido
  return <>{children}</>;
};

export default AdminRouteGuard; 