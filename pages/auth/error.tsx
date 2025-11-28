import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { AlertTriangle, Home, RefreshCw, Trash2 } from 'lucide-react';
import styles from '@/styles/Auth.module.css';

interface AuthErrorProps {
  error?: string;
}

const AuthError: React.FC<AuthErrorProps> = () => {
  const router = useRouter();
  const { error } = router.query;

  const getErrorMessage = (error: string | string[] | undefined) => {
    if (typeof error !== 'string') return 'Error de autenticación desconocido';
    
    switch (error) {
      case 'OAuthAccountNotLinked':
        return 'Error de vinculación de cuenta. Tu cuenta de Google no está correctamente vinculada. Esto puede deberse a cambios en la configuración del sistema.';
      case 'Configuration':
        return 'Error de configuración del proveedor de autenticación';
      case 'AccessDenied':
        return 'Acceso denegado. Verifica tus permisos.';
      case 'Verification':
        return 'Error de verificación. El token pudo haber expirado.';
      case 'Default':
        return 'Error de autenticación. Intenta nuevamente.';
      case 'ClientError':
        return 'Error en el cliente de autenticación';
      case 'Callback':
      case 'OAuthCallback':
        return 'Error en el callback de autenticación. Esto puede deberse a una configuración incorrecta de las URIs de redirección en Google Cloud Console.';
      default:
        return 'Error de autenticación. Intenta nuevamente.';
    }
  };

  const getErrorSolution = (error: string | string[] | undefined) => {
    if (typeof error !== 'string') return null;
    
    switch (error) {
      case 'OAuthAccountNotLinked':
        return {
          steps: [
            'Cierra todas las pestañas del navegador',
            'Borra las cookies del sitio (Configuración → Privacidad → Cookies)',
            'Intenta iniciar sesión nuevamente',
            'Si el problema persiste, contacta al administrador'
          ],
          action: 'Limpiar Datos'
        };
      case 'Callback':
      case 'OAuthCallback':
        return {
          steps: [
            'Verifica que las URIs de redirección estén correctamente configuradas en Google Cloud Console',
            'Asegúrate de que NEXTAUTH_URL esté configurado correctamente en Vercel',
            'Borra las cookies del sitio y intenta nuevamente',
            'Si el problema persiste, contacta al administrador'
          ],
          action: 'Limpiar Datos'
        };
      default:
        return null;
    }
  };

  const handleRetry = () => {
    router.push('/');
  };

  const handleClearData = () => {
    // Limpiar localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      
      // Intentar limpiar cookies relacionadas con NextAuth
      document.cookie.split(";").forEach((c) => {
        if (c.trim().includes('next-auth')) {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      });
      
      // Redirigir a home después de limpiar
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  };

  const solution = getErrorSolution(error);

  return (
    <>
      <Head>
        <title>Error de Autenticación | Nahuel Lozano</title>
        <meta name="description" content="Error de autenticación" />
      </Head>

      <div className={styles.authErrorContainer}>
        <motion.div
          className={styles.errorCard}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.errorIcon}>
            <AlertTriangle size={64} />
          </div>
          
          <h1 className={styles.errorTitle}>
            Error de Autenticación
          </h1>
          
          <p className={styles.errorMessage}>
            {getErrorMessage(error)}
          </p>

          {error === 'OAuthAccountNotLinked' && (
            <div className={styles.errorDetails}>
              <h3>¿Qué significa este error?</h3>
              <p>
                Este error indica que hay un problema con la vinculación de tu cuenta de Google. 
                Puede ocurrir después de cambios en el sistema de autenticación.
              </p>
            </div>
          )}

          {solution && (
            <div className={styles.solutionSteps}>
              <h3>Solución recomendada:</h3>
              <ol>
                {solution.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          
          <div className={styles.errorActions}>
            {solution && (
              <button 
                onClick={handleClearData}
                className={styles.clearButton}
              >
                <Trash2 size={20} />
                {solution.action}
              </button>
            )}
            
            <button 
              onClick={handleRetry}
              className={styles.retryButton}
            >
              <RefreshCw size={20} />
              Intentar Nuevamente
            </button>
            
            <Link href="/" className={styles.homeButton}>
              <Home size={20} />
              Volver al Inicio
            </Link>
          </div>

          {error && (
            <div className={styles.errorCode}>
              <small>Código de error: {error}</small>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default AuthError; 