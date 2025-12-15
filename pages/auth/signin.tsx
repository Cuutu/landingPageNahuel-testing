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
 * Página de inicio de sesión personalizada
 * SIEMPRE redirige automáticamente a Google OAuth
 */
export default function SignInPage({ providers, csrfToken, callbackUrl }: SignInProps) {
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedRef = React.useRef(false);

  // ✅ SIEMPRE auto-redirect a Google OAuth
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasAttemptedRef.current) return; // Solo intentar una vez
    
    // Verificar errores en URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      console.log('⚠️ [SIGNIN] Error detectado en URL:', errorParam);
      hasAttemptedRef.current = true;
      
      if (errorParam === 'OAuthAccountNotLinked') {
        setError('Esta cuenta de Google ya está vinculada a otro usuario.');
      } else if (errorParam === 'OAuthCallback' || errorParam === 'Callback') {
        setError('Error en la autenticación. Intentando nuevamente...');
        // Reintentar automáticamente después de un error
        setTimeout(() => {
          hasAttemptedRef.current = false;
          window.location.reload();
        }, 2000);
      } else {
        setError('Error al iniciar sesión. Redirigiendo...');
        setTimeout(() => {
          hasAttemptedRef.current = false;
          window.location.reload();
        }, 2000);
      }
      return;
    }
    
    // ✅ AUTO-REDIRECT INMEDIATO a Google OAuth
    console.log('🚀 [SIGNIN] Auto-redirect a Google OAuth...');
    hasAttemptedRef.current = true;
    
    signIn('google', { 
      callbackUrl: callbackUrl || '/',
      redirect: true
    });
  }, [callbackUrl]);

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
            {error ? 'Error' : 'Iniciando sesión'}
          </h1>

          <div className={styles.loadingContainer}>
            {error ? (
              <div className={styles.errorContainer}>
                <p className={styles.errorText}>{error}</p>
              </div>
            ) : (
              <>
                <div className={styles.spinner}></div>
                <p className={styles.loadingText}>
                  Redirigiendo a Google...
                </p>
              </>
            )}
          </div>

          <p className={styles.securityNote}>
            🔒 Conexión segura con Google
          </p>
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


