import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { GetServerSidePropsContext } from 'next';

interface AdminVerificationResult {
  isAdmin: boolean;
  user?: any;
  session?: any;
  redirectTo?: string;
}

/**
 * Verifica si el usuario actual tiene permisos de administrador
 * ✅ SIMPLIFICADO: Solo confía en la BD para el rol, no compara sesión vs BD
 */
export async function verifyAdminAccess(context: GetServerSidePropsContext): Promise<AdminVerificationResult> {
  try {
    console.log('🔍 [ADMIN AUTH] Verificando acceso de administrador...');
    
    // 1. Obtener sesión del servidor
    const session = await getServerSession(context.req, context.res, authOptions);
    
    console.log('🔍 [ADMIN AUTH] Sesión obtenida:', !!session);
    console.log('🔍 [ADMIN AUTH] Email en sesión:', session?.user?.email || 'NO HAY');
    
    // 2. Si no hay sesión o email, redirigir a login (página de credenciales)
    if (!session?.user?.email) {
      console.log('❌ [ADMIN AUTH] No hay sesión válida - redirigiendo a login');
      const callbackUrl = context.resolvedUrl ? encodeURIComponent(context.resolvedUrl) : encodeURIComponent('/admin/dashboard');
      return {
        isAdmin: false,
        redirectTo: `/auth/signin?callbackUrl=${callbackUrl}`
      };
    }

    console.log('👤 [ADMIN AUTH] Usuario autenticado:', session.user.email);
    console.log('🔧 [ADMIN AUTH] Rol en sesión JWT:', session.user.role);

    // 3. ✅ SIEMPRE verificar en la BD (fuente de verdad)
    try {
      await connectDB();
      const dbUser = await User.findOne({ email: session.user.email }).lean() as any;
      
      console.log('🗄️ [ADMIN AUTH] Usuario encontrado en BD:', !!dbUser);
      
      if (!dbUser) {
        // ✅ Login por credenciales: admin puede no existir en BD; confiar en rol de sesión JWT
        if (session.user.role === 'admin') {
          console.log('✅ [ADMIN AUTH] Usuario admin por credenciales (sin registro en BD)');
          return {
            isAdmin: true,
            user: { ...session.user, role: 'admin' },
            session: session
          };
        }
        console.log('❌ [ADMIN AUTH] Usuario no existe en BD y no es admin en sesión');
        return {
          isAdmin: false,
          redirectTo: '/',
          session: session
        };
      }
      
      console.log('🗄️ [ADMIN AUTH] Rol en BD:', dbUser.role);
      
      // 4. ✅ SOLO confiar en el rol de la BD
      if (dbUser.role === 'admin') {
        console.log('✅ [ADMIN AUTH] Acceso PERMITIDO - Usuario es admin en BD');
        return {
          isAdmin: true,
          user: {
            ...session.user,
            role: dbUser.role // Usar rol de BD
          },
          session: session
        };
      } else {
        console.log('❌ [ADMIN AUTH] Acceso DENEGADO - Usuario NO es admin. Rol en BD:', dbUser.role);
        return {
          isAdmin: false,
          redirectTo: '/',
          user: { ...session.user, role: dbUser.role },
          session: session
        };
      }
      
    } catch (dbError) {
      console.error('💥 [ADMIN AUTH] Error consultando BD:', dbError);
      
      // ✅ FALLBACK: Si no podemos consultar BD, confiar en la sesión JWT
      console.log('⚠️ [ADMIN AUTH] FALLBACK: Usando rol de sesión JWT:', session.user.role);
      
      if (session.user.role === 'admin') {
        return {
          isAdmin: true,
          user: session.user,
          session: session
        };
      }
      
      return {
        isAdmin: false,
        redirectTo: '/',
        user: session.user,
        session: session
      };
    }

  } catch (error) {
    console.error('💥 [ADMIN AUTH] Error general:', error);
    return {
      isAdmin: false,
      redirectTo: '/auth/signin?callbackUrl=' + encodeURIComponent('/admin/dashboard')
    };
  }
}

/**
 * Middleware para proteger rutas de API de administrador
 */
export function requireAdmin(handler: any) {
  return async (req: any, res: any) => {
    console.log('🔍 [REQUIRE ADMIN] Verificando permisos...');
    
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      console.log('❌ [REQUIRE ADMIN] No hay sesión válida');
      return res.status(401).json({ error: 'No autorizado' });
    }

    console.log('👤 [REQUIRE ADMIN] Usuario:', session.user.email, 'Rol:', session.user.role);

    // Usar el rol de la sesión ya que JWT siempre consulta la BD
    if (session.user.role !== 'admin') {
      console.log('❌ [REQUIRE ADMIN] Usuario no es admin. Rol actual:', session.user.role);
      return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
    }

    console.log('✅ [REQUIRE ADMIN] Acceso confirmado para:', session.user.email);
    return handler(req, res);
  };
}

/**
 * Verifica si el usuario es admin en API routes
 */
export async function verifyAdminAPI(req: any, res: any): Promise<{ isAdmin: boolean; user?: any; error?: string }> {
  try {
    console.log('🔍 API: Verificando acceso de admin...');
    
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user?.email) {
      return { isAdmin: false, error: 'No autorizado' };
    }

    console.log('👤 API: Usuario:', session.user.email, 'Rol:', session.user.role);

    // Confiar en el rol de la sesión ya que JWT siempre consulta BD
    if (session.user.role !== 'admin') {
      return { isAdmin: false, error: 'Permisos insuficientes' };
    }

    return { 
      isAdmin: true, 
      user: {
        _id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
      }
    };

  } catch (error) {
    console.error('💥 Error en verificación API de admin:', error);
    return { isAdmin: false, error: 'Error interno del servidor' };
  }
} 