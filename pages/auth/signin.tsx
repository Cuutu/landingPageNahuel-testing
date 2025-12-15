import { GetServerSideProps } from 'next';
import { getProviders, signIn, getCsrfToken } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import styles from '@/styles/Auth.module.css';

interface SignInProps {
  providers: Record<string, {
    id: string;
    name: string;
    type: string;
    signinUrl: string;
    callbackUrl: string;
  }>;
  csrfToken: string | undefined;
  callbackUrl: string;
}

/**
 * Detecta si el navegador es Brave
 */
const isBraveBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (navigator as any).brave !== undefined;
};

/**
 * Verifica si las cookies están habilitadas
 */
const checkCookiesEnabled = (): boolean => {
  if (typeof document === 'undefined') return true;
  
  try {
    // Intentar crear una cookie de prueba
    document.cookie = 'cookietest=1; SameSite=Lax';
    const cookiesEnabled = document.cookie.indexOf('cookietest=') !== -1;
    // Eliminar la cookie de prueba
    document.cookie = 'cookietest=1; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    return cookiesEnabled;
  } catch {
    return false;
  }
};

/**
 * Página de inicio de sesión personalizada
 * Redirige automáticamente a Google OAuth para evitar problemas con CSRF
 */
export default function SignInPage({ providers, csrfToken, callbackUrl }: SignInProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cookieWarning, setCookieWarning] = useState<boolean>(false);
  const [isBrave, setIsBrave] = useState<boolean>(false);
  const hasAttemptedRef = React.useRef(false);

  // ✅ MEJORADO: Detectar problemas de cookies y navegador Brave
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detectar Brave
      const brave = isBraveBrowser();
      setIsBrave(brave);
      
      // Verificar cookies
      const cookiesOk = checkCookiesEnabled();
      if (!cookiesOk || brave) {
        // En Brave, siempre mostrar advertencia porque Shields puede bloquear cookies de terceros
        setCookieWarning(true);
      }
      
      // Verificar errores en URL
      const urlParams = new URLSearchParams(window.location.search);
      const errorParam = urlParams.get('error');
      if (errorParam) {
        console.log('⚠️ [SIGNIN] Error detectado en URL:', errorParam);
        if (errorParam === 'OAuthAccountNotLinked') {
          setError('Esta cuenta de Google ya está vinculada a otro usuario.');
        } else if (errorParam === 'OAuthCallback') {
          setError('Error en la autenticación con Google. Intenta nuevamente.');
        } else if (errorParam === 'Callback') {
          // Error común cuando las cookies están bloqueadas
          setError('Error de autenticación. Si usás Brave u otro navegador con bloqueo de cookies, seguí las instrucciones abajo.');
          setCookieWarning(true);
        } else {
          setError('Error al iniciar sesión. Por favor, intenta nuevamente.');
        }
        setIsLoading(false);
      }
    }
  }, []);

  // Fallback manual por si falla la redirección automática
  const handleManualSignIn = () => {
    if (hasAttemptedRef.current && isLoading) return; // Evitar múltiples clicks
    
    setIsLoading(true);
    setError(null);
    hasAttemptedRef.current = true;
    
    signIn('google', { 
      callbackUrl: callbackUrl || '/',
      redirect: true
    }).catch((err) => {
      console.error('Error en signin manual:', err);
      setError('Error al conectar con Google. Por favor, intenta nuevamente.');
      setIsLoading(false);
      hasAttemptedRef.current = false; // Permitir reintento
    });
  };

  return (
    <>
      <Head>
        <title>Iniciar Sesión | Nahuel Lozano</title>
        <meta name="description" content="Iniciar sesión con Google" />
      </Head>

      <div className={styles.authContainer}>
        <motion.div
          className={styles.authCard}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.logoContainer}>
            <img 
              src="/logos/logo-nahuel.png" 
              alt="Nahuel Lozano" 
              className={styles.logo}
            />
          </div>

          <h1 className={styles.title}>
            Iniciar Sesión
          </h1>

          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>
                Conectando con Google...
              </p>
            </div>
          ) : (
            <div className={styles.buttonContainer}>
              {error && (
                <div className={styles.errorContainer}>
                  <p className={styles.errorText}>{error}</p>
                </div>
              )}
              <button 
                onClick={handleManualSignIn}
                className={styles.googleButton}
                disabled={isLoading}
              >
                <svg className={styles.googleIcon} viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Iniciar sesión con Google
              </button>
            </div>
          )}

          <p className={styles.securityNote}>
            🔒 Conexión segura con Google
          </p>

          {/* Advertencia para navegadores con cookies bloqueadas */}
          {cookieWarning && (
            <motion.div
              className={styles.cookieWarning}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={styles.warningHeader}>
                {isBrave ? (
                  <>
                    <span className={styles.braveIcon}>🦁</span>
                    <strong>¿Usás Brave?</strong>
                  </>
                ) : (
                  <>
                    <span>🍪</span>
                    <strong>Problema con cookies</strong>
                  </>
                )}
              </div>
              
              <p className={styles.warningText}>
                {isBrave 
                  ? 'Brave Shields puede bloquear el inicio de sesión. Para solucionarlo:'
                  : 'Las cookies están bloqueadas en tu navegador. Para iniciar sesión:'}
              </p>
              
              <ol className={styles.warningSteps}>
                {isBrave ? (
                  <>
                    <li>Hacé clic en el <strong>ícono del león 🦁</strong> en la barra de direcciones</li>
                    <li>Cambiá <strong>&quot;Block cross-site cookies&quot;</strong> a <strong>&quot;Allow all cookies&quot;</strong></li>
                    <li>O desactivá Shields temporalmente para este sitio</li>
                    <li>Recargá la página e intentá de nuevo</li>
                  </>
                ) : (
                  <>
                    <li>Abrí la configuración de tu navegador</li>
                    <li>Buscá la sección de &quot;Cookies&quot; o &quot;Privacidad&quot;</li>
                    <li>Agregá <strong>lozanonahuel.com</strong> a los sitios permitidos</li>
                    <li>Recargá la página e intentá de nuevo</li> 
                  </>
                )}
              </ol>

              <button 
                onClick={() => window.location.reload()}
                className={styles.reloadButton}
              >
                🔄 Recargar página
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // ✅ CORREGIDO: Usar getServerSession en lugar de getSession
    const session = await getServerSession(context.req, context.res, authOptions);
    
    console.log('🔐 [SIGNIN] Verificando sesión existente...');
    console.log('🔐 [SIGNIN] Sesión encontrada:', !!session);
    
    // Obtener callbackUrl de forma segura
    let callbackUrl = context.query.callbackUrl as string || '/';
    
    // ✅ IMPORTANTE: Evitar bucles - si el callbackUrl es la misma página de signin, usar '/'
    if (callbackUrl.includes('/auth/signin') || callbackUrl.includes('/api/auth/signin')) {
      console.log('⚠️ [SIGNIN] CallbackUrl es signin, cambiando a /');
      callbackUrl = '/';
    }
    
    if (session?.user?.email) {
      console.log('✅ [SIGNIN] Usuario ya autenticado:', session.user.email, '- redirigiendo a:', callbackUrl);
      return {
        redirect: {
          destination: callbackUrl,
          permanent: false,
        },
      };
    }

    console.log('🔐 [SIGNIN] No hay sesión, mostrando página de login');
    
    const providers = await getProviders();
    const csrfToken = await getCsrfToken(context);

    return {
      props: {
        providers: providers ?? {},
        csrfToken: csrfToken ?? null,
        callbackUrl,
      },
    };
  } catch (error) {
    console.error('💥 [SIGNIN] Error en getServerSideProps:', error);
    
    // En caso de error, mostrar la página de login
    return {
      props: {
        providers: {},
        csrfToken: null,
        callbackUrl: '/',
      },
    };
  }
};

