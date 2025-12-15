import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import Head from 'next/head';

interface SignInProps {
  callbackUrl: string;
  error?: string;
}

/**
 * Página de inicio de sesión personalizada
 * Usa signIn('google') del cliente que funciona en TODOS los navegadores
 */
export default function SignInPage({ callbackUrl, error }: SignInProps) {
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

    // Si hay error, redirigir inmediatamente a google-redirect (método más confiable)
    if (error) {
      const target = `/api/auth/google-redirect?callbackUrl=${encodeURIComponent(safeCallback)}`;
      window.location.replace(target);
      return;
    }

    // Sin error: intentar método estándar de NextAuth
    signIn('google', { callbackUrl: safeCallback, redirect: true }).catch(() => {
      const target = `/api/auth/google-redirect?callbackUrl=${encodeURIComponent(safeCallback)}`;
      window.location.replace(target);
    });
  }, [callbackUrl, error]);

  const handleRetry = () => {
    const rawCallback = typeof callbackUrl === 'string' && callbackUrl.length > 0 ? callbackUrl : '/';
    const safeCallback = (rawCallback.includes('/auth/signin') || rawCallback.includes('/api/auth/signin'))
      ? '/'
      : rawCallback;
    window.location.href = `/api/auth/google-redirect?callbackUrl=${encodeURIComponent(safeCallback)}`;
  };

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
          {!error && <p>Redirigiendo a Google...</p>}
          {error && (
            <>
              <p style={{ marginBottom: '0.75rem' }}>
                Hubo un problema con la redirección en este navegador.
              </p>
              <button
                onClick={handleRetry}
                style={{
                  padding: '0.65rem 1.1rem',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reintentar con Google
              </button>
            </>
          )}
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
    const error = (context.query.error as string) || '';
    
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

    // Si hay error, también redirigir automáticamente (no mostrar pantalla de error)
    // Esto evita que el usuario tenga que hacer clic en "Reintentar"
    if (error) {
      return {
        redirect: {
          destination: `/api/auth/google-redirect?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          permanent: false,
        },
      };
    }

    // Sin sesión y sin error: redirigir de inmediato a Google para evitar loops de cliente
    return {
      redirect: {
        destination: `/api/auth/google-redirect?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        permanent: false,
      },
    };
  } catch (error) {
    console.error('💥 [SIGNIN] Error:', error);
    return {
      props: {
        callbackUrl: '/',
        error: 'unknown',
      },
    };
  }
};


