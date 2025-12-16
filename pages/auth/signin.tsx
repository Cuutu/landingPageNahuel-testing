import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { useEffect } from 'react';
import Head from 'next/head';

interface SignInProps {
  callbackUrl: string;
  error?: string;
}

export default function SignInPage({ callbackUrl, error }: SignInProps) {
  const safeCallback = callbackUrl?.includes('/auth/signin') ? '/' : (callbackUrl || '/');

  // Redirigir automáticamente a Google cuando la página se monta
  useEffect(() => {
    const redirectToGoogle = () => {
      const callbackUrlParam = encodeURIComponent(safeCallback);
      window.location.href = `/api/auth/google-direct?callbackUrl=${callbackUrlParam}`;
    };

    // Pequeño delay para evitar redirecciones muy rápidas que puedan causar problemas
    const timer = setTimeout(redirectToGoogle, 100);
    
    return () => clearTimeout(timer);
  }, [safeCallback]);

  return (
    <>
      <Head>
        <title>Iniciar sesión | Nahuel Lozano</title>
      </Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '1rem'
      }}>
        <div style={{ 
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.5rem'
          }}>
            Nahuel Lozano
          </h1>
          
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '1.5rem',
            fontSize: '0.95rem'
          }}>
            Serás redirigido automáticamente a Google para iniciar sesión
          </p>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              color: '#fca5a5'
            }}>
              Hubo un problema. Redirigiendo de nuevo...
            </div>
          )}

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(255, 255, 255, 0.2)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: '1rem',
              fontWeight: 500,
              margin: 0
            }}>
              Redirigiendo a Google...
            </p>
          </div>
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
    
    let callbackUrl = context.query.callbackUrl as string || '/';
    const error = (context.query.error as string) || '';
    
    try {
      callbackUrl = decodeURIComponent(callbackUrl);
    } catch {}
    
    if (callbackUrl.includes('/auth/signin') || callbackUrl.includes('/api/auth/signin')) {
      callbackUrl = '/';
    }
    
    if (session?.user?.email) {
      return {
        redirect: {
          destination: callbackUrl,
          permanent: false,
        },
      };
    }

    return {
      props: {
        callbackUrl,
        error: error || null,
      },
    };
  } catch {
    return {
      props: {
        callbackUrl: '/',
        error: null,
      },
    };
  }
};
