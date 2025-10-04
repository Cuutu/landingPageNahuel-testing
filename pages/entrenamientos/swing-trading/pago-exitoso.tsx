import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Calendar } from 'lucide-react';
import styles from '../../../styles/PaymentSuccess.module.css';

interface PaymentSuccessProps {
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

export default function PaymentSuccessPage({
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
}: PaymentSuccessProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Log para debugging
    console.log('Payment success data:', {
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

    // Simular carga de verificación
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContent}>
          <div className={styles.spinner}></div>
          <p>Verificando tu pago...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Pago Exitoso - Swing Trading | Lozano Nahuel</title>
        <meta name="description" content="¡Tu pago fue procesado exitosamente! Ya tienes acceso al entrenamiento de Swing Trading." />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <CheckCircle size={64} className={styles.successIcon} />
          </div>

          <h1 className={styles.title}>¡Pago Exitoso!</h1>
          
          <p className={styles.description}>
            Tu pago para el entrenamiento de Swing Trading fue procesado correctamente. 
            Ya tienes acceso completo al entrenamiento.
          </p>

          <div className={styles.details}>
            <h3>Detalles del pago:</h3>
            <ul>
              <li><strong>Referencia:</strong> {externalReference || 'No disponible'}</li>
              <li><strong>Estado:</strong> {status || 'Aprobado'}</li>
              <li><strong>ID de Pago:</strong> {paymentId || 'No disponible'}</li>
              <li><strong>ID de Preferencia:</strong> {preferenceId || 'No disponible'}</li>
            </ul>
          </div>

          <div className={styles.accessInfo}>
            <Calendar size={24} />
            <div>
              <h3>Acceso Activo</h3>
              <p>Tu suscripción mensual está activa y tienes acceso completo al entrenamiento.</p>
            </div>
          </div>

          <div className={styles.actions}>
            <Link href="/entrenamientos/swing-trading" className={styles.accessButton}>
              <ArrowRight size={20} />
              Acceder al Entrenamiento
            </Link>

            <Link href="/perfil" className={styles.profileButton}>
              Ver Mi Perfil
            </Link>
          </div>

          <div className={styles.help}>
            <h3>¿Qué sigue?</h3>
            <p>
              Revisa tu email para confirmación del pago y accede al entrenamiento desde tu perfil.
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
