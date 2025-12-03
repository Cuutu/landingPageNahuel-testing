import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import styles from '../../../styles/PaymentFailure.module.css';

interface PaymentFailureProps {
  collectionId: string | null;
  collectionStatus: string | null;
  paymentId: string | null;
  status: string | null;
  externalReference: string | null;
  paymentType: string | null;
  merchantOrderId: string | null;
  preferenceId: string | null;
  siteId: string | null;
  processingMode: string | null;
  merchantAccountId: string | null;
}

export default function PaymentFailurePage({
  collectionId,
  collectionStatus,
  paymentId,
  status,
  externalReference,
  paymentType,
  merchantOrderId,
  preferenceId,
  siteId,
  processingMode,
  merchantAccountId
}: PaymentFailureProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Log para debugging
    // console.log('Payment failure data:', {
    //   collectionId,
    //   collectionStatus,
    //   paymentId,
    //   status,
    //   externalReference,
    //   paymentType,
    //   merchantOrderId,
    //   preferenceId,
    //   siteId,
    //   processingMode,
    //   merchantAccountId
    // });
  }, []);

  const handleRetryPayment = async () => {
    setIsRetrying(true);
    try {
      // Redirigir de vuelta a la página de Zero 2 Trader
      router.push('/entrenamientos/zero2trader');
    } catch (error) {
      console.error('Error al reintentar pago:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      <Head>
        <title>Pago No Completado - Zero 2 Trader | Lozano Nahuel</title>
        <meta name="description" content="Tu pago no pudo ser procesado. Intenta nuevamente para acceder al entrenamiento de Zero 2 Trader." />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <AlertCircle size={64} className={styles.errorIcon} />
          </div>

          <h1 className={styles.title}>Pago No Completado</h1>
          
          <p className={styles.description}>
            Tu pago para el entrenamiento de Zero 2 Trader no pudo ser procesado correctamente.
          </p>

          <div className={styles.details}>
            <h3>Detalles del pago:</h3>
            <ul>
              <li><strong>Referencia:</strong> {externalReference || 'No disponible'}</li>
              <li><strong>Estado:</strong> {status || 'No disponible'}</li>
              <li><strong>ID de Pago:</strong> {paymentId || 'No disponible'}</li>
              <li><strong>ID de Preferencia:</strong> {preferenceId || 'No disponible'}</li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button 
              onClick={handleRetryPayment}
              className={styles.retryButton}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <RefreshCw size={20} className={styles.spinner} />
                  Procesando...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Intentar Nuevamente
                </>
              )}
            </button>

            <Link href="/entrenamientos/zero2trader" className={styles.backButton}>
              <ArrowLeft size={20} />
              Volver al Entrenamiento
            </Link>
          </div>

          <div className={styles.help}>
            <h3>¿Necesitas ayuda?</h3>
            <p>
              Si continúas teniendo problemas con el pago, puedes contactarnos para obtener asistencia.
            </p>
            <Link href="/contact" className={styles.contactLink}>
              Contactar Soporte
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { query } = context;

  return {
    props: {
      collectionId: query.collection_id || null,
      collectionStatus: query.collection_status || null,
      paymentId: query.payment_id || null,
      status: query.status || null,
      externalReference: query.external_reference || null,
      paymentType: query.payment_type || null,
      merchantOrderId: query.merchant_order_id || null,
      preferenceId: query.preference_id || null,
      siteId: query.site_id || null,
      processingMode: query.processing_mode || null,
      merchantAccountId: query.merchant_account_id || null,
    },
  };
};
