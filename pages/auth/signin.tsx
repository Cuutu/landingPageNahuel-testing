import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';

interface SignInProps {
  callbackUrl: string;
  error?: string;
}

export default function SignInPage({ callbackUrl, error: initialError }: SignInProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  
  const safeCallback = callbackUrl?.includes('/auth/signin') ? '/' : (callbackUrl || '/');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
        callbackUrl: safeCallback,
      });

      if (result?.error) {
        setError('Usuario o contraseña incorrectos');
        setIsLoading(false);
      } else if (result?.ok) {
        // Redirigir manualmente después del login exitoso
        router.push(safeCallback);
      }
    } catch (err) {
      console.error('❌ [SIGNIN] Error en login:', err);
      setError('Error al iniciar sesión. Intentá de nuevo.');
      setIsLoading(false);
    }
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
            Ingresá tus credenciales para acceder
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
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ textAlign: 'left' }}>
              <label 
                htmlFor="username" 
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'rgba(255,255,255,0.8)'
                }}
              >
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresá tu usuario"
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ textAlign: 'left' }}>
              <label 
                htmlFor="password" 
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'rgba(255,255,255,0.8)'
                }}
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresá tu contraseña"
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: isLoading ? '#4b5563' : '#3b82f6',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s ease',
              }}
            >
              {isLoading ? (
                <>
                  <span style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Ingresando...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
        input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        button:hover:not(:disabled) {
          background: #2563eb !important;
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
