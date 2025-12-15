import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { useEffect, useRef } from 'react';
import Head from 'next/head';

interface SignInProps {
  callbackUrl: string;
}

/**
 * Página de inicio de sesión personalizada
 * Usa signIn('google') del cliente que funciona en TODOS los navegadores
 */
export default function SignInPage({ callbackUrl }: SignInProps) {
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Solo ejecutar una vez
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    // Normalizar callback para evitar loops
    const rawCallback = typeof callbackUrl === 'string' && callbackUrl.length > 0 ? callbackUrl : '/';
    const safeCallback = (rawCallback.includes('/auth/signin') || rawCallback.includes('/api/auth/signin'))
      ? '/'
      : rawCallback;

    // Redirigir directo al endpoint que genera la URL de Google (como en Chrome)
    const target = `/api/auth/google-redirect?callbackUrl=${encodeURIComponent(safeCallback)}`;
    window.location.href = target;
  }, [callbackUrl]);

  return (
    <>
      <Head>
        <title>Iniciando sesión... | Nahuel Lozano</title>
      </Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p>Redirigiendo a Google...</p>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    
    // Obtener callbackUrl
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

    // Pasar callbackUrl al componente
    return {
      props: {
        callbackUrl,
      },
    };
  } catch (error) {
    console.error('💥 [SIGNIN] Error:', error);
    return {
      props: {
        callbackUrl: '/',
      },
    };
  }
};


