import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';

interface SignInProps {
  callbackUrl: string;
  error?: string;
}

/**
 * Detecta si el navegador es Chrome (sin tracking prevention agresivo)
 */
function isChromeBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent;
  
  // Chrome: tiene "Chrome" pero NO tiene "Edg" (Edge) ni "OPR" (Opera)
  const isChrome = /Chrome/.test(ua) && !/Edg|OPR|Brave/.test(ua);
  
  // También verificar que no sea móvil (iOS Safari se disfraza de Chrome a veces)
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  
  // Android Chrome generalmente funciona bien
  const isAndroid = /Android/.test(ua);
  
  // Chrome desktop o Chrome Android funcionan con redirect automático
  return isChrome && !isIOS;
}

/**
 * Página de inicio de sesión
 * - Chrome: redirección automática a Google
 * - Otros navegadores: botón para hacer clic (evita problemas de cookies)
 */
export default function SignInPage({ callbackUrl, error }: SignInProps) {
  const hasTriggeredRef = useRef(false);
  const [showButton, setShowButton] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    const safeCallback = callbackUrl?.includes('/auth/signin') ? '/' : (callbackUrl || '/');

    // Si hay error previo, mostrar botón (el auto-redirect ya falló)
    if (error) {
      setIsRedirecting(false);
      setShowButton(true);
      return;
    }

    // Chrome: redirección automática
    if (isChromeBrowser()) {
      signIn('google', { callbackUrl: safeCallback, redirect: true });
      return;
    }

    // Otros navegadores: mostrar botón
    setIsRedirecting(false);
    setShowButton(true);
  }, [callbackUrl, error]);

  const handleGoogleSignIn = () => {
    const safeCallback = callbackUrl?.includes('/auth/signin') ? '/' : (callbackUrl || '/');
    setIsRedirecting(true);
    setShowButton(false);
    signIn('google', { callbackUrl: safeCallback, redirect: true });
  };

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
          {/* Logo o título */}
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.5rem'
          }}>
            Nahuel Lozano
          </h1>

          {/* Estado: Redirigiendo (Chrome) */}
          {isRedirecting && !showButton && (
            <>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: '#3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '2rem auto 1rem'
              }} />
              <p style={{ color: 'rgba(255,255,255,0.7)' }}>
                Redirigiendo a Google...
              </p>
            </>
          )}

          {/* Estado: Mostrar botón (otros navegadores) */}
          {showButton && (
            <>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '1.5rem',
                fontSize: '0.95rem'
              }}>
                Ingresá con tu cuenta de Google para continuar
              </p>

              {/* Mensaje de error si existe */}
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
                  Hubo un problema. Tocá el botón para intentar de nuevo.
                </div>
              )}

              {/* Botón de Google */}
              <button
                onClick={handleGoogleSignIn}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  background: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#1f2937',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
                }}
              >
                {/* Google Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
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
    
    let callbackUrl = context.query.callbackUrl as string || '/';
    const error = (context.query.error as string) || '';
    
    try {
      callbackUrl = decodeURIComponent(callbackUrl);
    } catch {
      // Si falla, usar el valor original
    }
    
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

    return {
      props: {
        callbackUrl,
        error: error || null,
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
