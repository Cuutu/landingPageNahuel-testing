import React, { useEffect, useState } from 'react';
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
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />
        <p>Verificando permisos de administrador...</p>
      </div>
    </div>
  )
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (status === 'loading') return;

      if (status === 'unauthenticated') {
        // console.log('❌ [ADMIN GUARD] No hay sesión - redirigiendo a login');
        router.push('/api/auth/signin');
        return;
      }

      if (session?.user?.email) {
        // console.log('🔍 [ADMIN GUARD] Verificando rol para:', session.user.email);
        // console.log('🔧 [ADMIN GUARD] Rol en sesión:', session.user.role);

        if (session.user.role === 'admin') {
          // console.log('✅ [ADMIN GUARD] Acceso de admin confirmado');
          setIsAuthorized(true);
        } else {
          // console.log('❌ [ADMIN GUARD] Usuario no es admin - redirigiendo a home');
          router.push('/');
          return;
        }
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [session, status, router]);

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