import React from 'react';
import { useRouter } from 'next/router';
import { XCircle, RefreshCw, Home, HelpCircle, CreditCard, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/PaymentFailure.module.css';

export default function PaymentFailure() {
  const router = useRouter();
  const { reference, error, type } = router.query;

  // Determinar el tipo de servicio basado en la referencia
  const getServiceInfo = () => {
    if (reference && typeof reference === 'string') {
      if (reference.includes('ConsultorioFinanciero')) {
        return {
          title: 'Consultoría Financiera',
          icon: <CreditCard size={24} />,
          description: 'Tu sesión de consultoría financiera no pudo ser reservada'
        };
      }
      return {
        title: 'Servicio',
        icon: <CreditCard size={24} />,
        description: 'Tu pago no pudo ser procesado'
      };
    }
    return {
      title: 'Servicio',
      icon: <CreditCard size={24} />,
      description: 'Tu pago no pudo ser procesado'
    };
  };

  const serviceInfo = getServiceInfo();

  return (
    <>
      <Head>
        <title>Pago Fallido - Consultoría Financiera | Nahuel Lozano</title>
        <meta name="description" content="Hubo un problema al procesar el pago de tu consultoría financiera. Te ayudamos a resolverlo." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.container}>
        {/* Partículas de fondo animadas */}
        <div className={styles.particles}>
          {[...Array(20)].map((_, i) => (
            <div key={i} className={styles.particle} style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }} />
          ))}
        </div>

        <div className={styles.content}>
          {/* Icono de error con animación */}
          <div className={styles.errorIconContainer}>
            <div className={styles.errorIcon}>
              <XCircle size={80} />
            </div>
            <div className={styles.errorRing}></div>
          </div>
          
          {/* Título principal */}
          <h1 className={styles.title}>Pago No Completado</h1>
          
          {/* Información del servicio */}
          <div className={styles.serviceInfo}>
            <div className={styles.serviceIcon}>{serviceInfo.icon}</div>
            <span className={styles.serviceTitle}>{serviceInfo.title}</span>
          </div>
          
          {/* Mensaje principal */}
          <p className={styles.subtitle}>
            {serviceInfo.description}. No te preocupes, <strong>no se ha cobrado nada</strong> y puedes intentar nuevamente.
          </p>

          {/* Información de seguridad */}
          <div className={styles.securityInfo}>
            <Shield size={20} />
            <span>Tu información está protegida y segura</span>
          </div>

          {/* Detalles del error si existen */}
          {error && (
            <div className={styles.errorDetails}>
              <AlertTriangle size={20} />
              <div className={styles.errorContent}>
                <div className={styles.errorTitle}>Detalles del Error</div>
                <div className={styles.errorDescription}>{error}</div>
              </div>
            </div>
          )}

          {/* Sugerencias de ayuda */}
          <div className={styles.suggestions}>
            <h3 className={styles.suggestionsTitle}>
              <HelpCircle size={20} />
              ¿Necesitas ayuda?
            </h3>
            <div className={styles.suggestionsGrid}>
              <div className={styles.suggestionItem}>
                <CheckCircle size={16} />
                <span>Verifica que tu tarjeta tenga fondos suficientes</span>
              </div>
              <div className={styles.suggestionItem}>
                <CheckCircle size={16} />
                <span>Asegúrate de que los datos sean correctos</span>
              </div>
              <div className={styles.suggestionItem}>
                <CheckCircle size={16} />
                <span>Intenta con otro método de pago</span>
              </div>
              <div className={styles.suggestionItem}>
                <CheckCircle size={16} />
                <span>Contacta a soporte si el problema persiste</span>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className={styles.buttonGroup}>
            <button 
              onClick={() => {
                if (reference && typeof reference === 'string' && reference.includes('ConsultorioFinanciero')) {
                  window.location.href = '/asesorias/consultorio-financiero';
                } else {
                  window.history.back();
                }
              }}
              className={`${styles.button} ${styles.primaryButton}`}
            >
              <RefreshCw size={20} />
              Intentar Nuevamente
            </button>
            
            <Link href="/" className={`${styles.button} ${styles.secondaryButton}`}>
              <Home size={20} />
              Volver al Inicio
            </Link>
          </div>

          {/* Información de soporte */}
          <div className={styles.support}>
            <div className={styles.supportContent}>
              <HelpCircle size={16} />
              <span>¿Necesitas asistencia inmediata?</span>
            </div>
            <a href="mailto:soporte@lozanonahuel.com" className={styles.supportEmail}>
              soporte@lozanonahuel.com
            </a>
          </div>

          {/* Referencia del pago */}
          {reference && (
            <div className={styles.referenceInfo}>
              <small>Referencia: {reference}</small>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 