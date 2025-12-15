import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';

/**
 * Página de inicio de sesión - REDIRECCIÓN INSTANTÁNEA DESDE EL SERVIDOR
 * No renderiza nada, redirige directamente a Google OAuth
 */
export default function SignInPage() {
  // Esta página nunca se renderiza - siempre redirige desde el servidor
  return null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    
    // Obtener callbackUrl de forma segura
    let callbackUrl = context.query.callbackUrl as string || '/';
    
    // Decodificar si está codificado
    try {
      callbackUrl = decodeURIComponent(callbackUrl);
    } catch {
      // Si falla, usar el valor original
    }
    
    // Evitar bucles - si el callbackUrl es la misma página de signin, usar '/'
    if (callbackUrl.includes('/auth/signin') || callbackUrl.includes('/api/auth/signin')) {
      callbackUrl = '/';
    }
    
    // Si ya tiene sesión, redirigir al destino
    if (session?.user?.email) {
      return {
        redirect: {
          destination: callbackUrl,
          permanent: false,
        },
      };
    }

    // ✅ REDIRECCIÓN INSTANTÁNEA: Ir directo al endpoint de OAuth de NextAuth
    // Esto evita cargar React y hace la redirección desde el servidor
    const baseUrl = process.env.NEXTAUTH_URL || `https://${context.req.headers.host}`;
    const googleSignInUrl = `${baseUrl}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    
    return {
      redirect: {
        destination: googleSignInUrl,
        permanent: false,
      },
    };
  } catch (error) {
    console.error('💥 [SIGNIN] Error:', error);
    
    // En caso de error, ir al signin nativo de NextAuth
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};


