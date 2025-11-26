import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle, ArrowRight, Calendar, AlertCircle } from 'lucide-react';
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
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

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

    // ✅ VERIFICAR PAGO REAL con MercadoPago
    if (externalReference) {
      verifyPaymentWithMercadoPago(externalReference);
    } else {
      setIsLoading(false);
    }
  }, [externalReference]);

  const verifyPaymentWithMercadoPago = async (reference: string) => {
    try {
      console.log('🔍 Verificando pago de entrenamiento mensual con MercadoPago...');
      
      const response = await fetch('/api/payments/process-monthly-training-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalReference: reference })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('✅ Pago de entrenamiento mensual verificado:', data);
        setPaymentVerified(true);
        setPaymentDetails(data);
      } else {
        console.error('❌ Pago no verificado:', data.error);
        
        // Si es un error de retry, mostrar mensaje específico
        if (data.shouldRetry) {
          setVerificationError('Tu pago está siendo procesado. Por favor, espera unos minutos y verifica tu estado desde tu perfil.');
        } else {
          setVerificationError(data.error || 'El pago no ha sido verificado. Por favor, completa el proceso de pago.');
        }
      }
    } catch (error) {
      console.error('❌ Error verificando pago:', error);
      setVerificationError('Error de conexión verificando el pago. Por favor, intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContent}>
          <div className={styles.spinner}></div>
          <p>Verificando tu pago con MercadoPago...</p>
          <p className={styles.loadingSubtext}>Esto puede tomar unos segundos</p>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <AlertCircle size={64} className={styles.errorIcon} />
          </div>

          <h1 className={styles.title}>Error en la Verificación</h1>
          
          <p className={styles.description}>
            {verificationError}
          </p>

          <div className={styles.actions}>
            <button 
              onClick={() => window.location.reload()} 
              className={styles.retryButton}
            >
              Intentar Nuevamente
            </button>

            <Link href="/entrenamientos/zero2trader" className={styles.profileButton}>
              Volver al Entrenamiento
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentVerified) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <AlertCircle size={64} className={styles.warningIcon} />
          </div>

          <h1 className={styles.title}>Pago Pendiente</h1>
          
          <p className={styles.description}>
            Tu pago está siendo procesado. Por favor, espera unos minutos y verifica tu estado desde tu perfil.
          </p>

          <div className={styles.actions}>
            <Link href="/perfil" className={styles.accessButton}>
              <ArrowRight size={20} />
              Ver Mi Perfil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Pago Exitoso - Zero 2 Trader | Lozano Nahuel</title>
        <meta name="description" content="¡Tu pago fue procesado exitosamente! Tu entrenamiento de Zero 2 Trader ya está agendado." />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <CheckCircle size={64} className={styles.successIcon} />
          </div>

          <h1 className={styles.title}>¡Pago Exitoso!</h1>
          
          <p className={styles.description}>
            Tu pago para el entrenamiento de Zero 2 Trader fue procesado correctamente. 
            Tu entrenamiento de Zero 2 Trader ya está agendado. En las próximas horas recibirás un correo con el link a la reunión.
          </p>

          <div className={styles.details}>
            <h3>Detalles del pago:</h3>
            <ul>
              <li><strong>Referencia:</strong> {externalReference || 'No disponible'}</li>
              <li><strong>Estado:</strong> {paymentDetails?.payment?.status || status || 'Aprobado'}</li>
              <li><strong>ID de Pago:</strong> {paymentDetails?.payment?.mercadopagoPaymentId || paymentId || 'No disponible'}</li>
              <li><strong>Monto:</strong> ${paymentDetails?.payment?.amount || 'No disponible'} {paymentDetails?.payment?.currency || 'ARS'}</li>
            </ul>
          </div>


          <div className={styles.actions}>
            <Link href="/entrenamientos/zero2trader" className={styles.accessButton}>
              <ArrowRight size={20} />
              Ir a mis entrenamientos
            </Link>
            
            <Link href="/perfil" className={styles.profileButton}>
              Ver mi perfil
            </Link>
            
            <Link href="/" className={styles.backButton}>
              Volver al Inicio
            </Link>
          </div>

          <div className={styles.help}>
            <h3>¿Qué sigue?</h3>
            <p>
              Revisa tu email para confirmación del pago y accede al entrenamiento desde el link enviado a tu correo.
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
