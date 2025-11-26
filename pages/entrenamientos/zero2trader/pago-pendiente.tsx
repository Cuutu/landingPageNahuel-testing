import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import styles from '../../../styles/PaymentPending.module.css';

interface PaymentPendingProps {
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

export default function PaymentPendingPage({
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
}: PaymentPendingProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Log para debugging
    console.log('Payment pending data:', {
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
    });
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simular verificación de estado
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Aquí podrías hacer una llamada a la API para verificar el estado del pago
      router.reload();
    } catch (error) {
      console.error('Error al verificar estado:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Pago Pendiente - Zero 2 Trader | Lozano Nahuel</title>
        <meta name="description" content="Tu pago está siendo procesado. Te notificaremos cuando esté confirmado." />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <Clock size={64} className={styles.pendingIcon} />
          </div>

          <h1 className={styles.title}>Pago Pendiente</h1>
          
          <p className={styles.description}>
            Tu pago para el entrenamiento de Zero 2 Trader está siendo procesado. 
            Te notificaremos por email cuando esté confirmado.
          </p>

          <div className={styles.details}>
            <h3>Detalles del pago:</h3>
            <ul>
              <li><strong>Referencia:</strong> {externalReference || 'No disponible'}</li>
              <li><strong>Estado:</strong> {status || 'Pendiente'}</li>
              <li><strong>ID de Pago:</strong> {paymentId || 'No disponible'}</li>
              <li><strong>ID de Preferencia:</strong> {preferenceId || 'No disponible'}</li>
            </ul>
          </div>

          <div className={styles.pendingInfo}>
            <Clock size={24} />
            <div>
              <h3>Procesando Pago</h3>
              <p>Algunos métodos de pago pueden tardar hasta 24 horas en confirmarse.</p>
            </div>
          </div>

          <div className={styles.actions}>
            <button 
              onClick={handleRefresh}
              className={styles.refreshButton}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw size={20} className={styles.spinner} />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Verificar Estado
                </>
              )}
            </button>

            <Link href="/entrenamientos/zero2trader" className={styles.backButton}>
              <ArrowLeft size={20} />
              Volver al Entrenamiento
            </Link>
          </div>

          <div className={styles.help}>
            <h3>¿Qué hacer ahora?</h3>
            <p>
              Revisa tu email para confirmación del pago. Una vez confirmado, 
              tendrás acceso completo al entrenamiento.
            </p>
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
