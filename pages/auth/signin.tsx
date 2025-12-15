import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';

/**
 * Página de inicio de sesión - REDIRECCIÓN AL SIGNIN NATIVO DE NEXTAUTH
 * Preserva el callbackUrl para volver después del login
 */
export default function SignInPage() {
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
    
    // Evitar bucles
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

    // ✅ Redirigir al signin nativo de NextAuth (no causa loops)
    return {
      redirect: {
        destination: `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        permanent: false,
      },
    };
  } catch (error) {
    console.error('💥 [SIGNIN] Error:', error);
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};


