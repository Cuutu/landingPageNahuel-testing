import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { XCircle, RefreshCw, CreditCard, ArrowLeft, Home } from 'lucide-react';
import styles from '../../../styles/PaymentResult.module.css';

interface TrainingInfo {
  _id: string;
  title: string;
  monthName: string;
  year: number;
  price: number;
}

export default function MonthlyTrainingPaymentFailure() {
  const router = useRouter();
  const { training_id, payment_id, collection_status } = router.query;
  
  const [training, setTraining] = useState<TrainingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (training_id) {
      loadTrainingInfo();
    }
  }, [training_id]);

  const loadTrainingInfo = async () => {
    try {
      const response = await fetch(`/api/monthly-trainings?id=${training_id}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        setTraining(data.data[0]);
      }
    } catch (error) {
      console.error('Error cargando entrenamiento:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!training) return;
    
    setRetrying(true);
    
    try {
      const response = await fetch('/api/payments/mercadopago/create-monthly-training-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId: training._id })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Redirigir a MercadoPago
        window.location.href = process.env.NODE_ENV === 'production' 
          ? data.initPoint 
          : data.sandboxInitPoint;
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error reintentando pago:', error);
      alert('Error al reintentar el pago');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner}></div>
          <p>Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Pago No Procesado - {training?.title || 'Entrenamiento'}</title>
      </Head>

      <div className={styles.failureCard}>
        <div className={styles.failureIcon}>
          <XCircle size={64} />
        </div>

        <h1>Pago No Procesado</h1>
        <p className={styles.failureMessage}>
          Tu pago no pudo ser procesado correctamente
        </p>

        {training && (
          <div className={styles.trainingInfo}>
            <h2>{training.title}</h2>
            <div className={styles.trainingDetails}>
              <span>{training.monthName} {training.year}</span>
              <span>${training.price} USD</span>
            </div>
          </div>
        )}

        {payment_id && (
          <div className={styles.paymentInfo}>
            <h3>Información del Pago</h3>
            <div className={styles.paymentDetails}>
              <div className={styles.paymentDetail}>
                <span className={styles.label}>ID de Pago:</span>
                <span className={styles.value}>{payment_id}</span>
              </div>
              {collection_status && (
                <div className={styles.paymentDetail}>
                  <span className={styles.label}>Estado:</span>
                  <span className={styles.value}>
                    {collection_status === 'rejected' ? 'Rechazado' : 
                     collection_status === 'cancelled' ? 'Cancelado' : collection_status}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.reasonsSection}>
          <h3>Posibles Causas</h3>
          <ul className={styles.reasonsList}>
            <li>Fondos insuficientes en tu tarjeta</li>
            <li>Datos de la tarjeta incorrectos</li>
            <li>Tu banco rechazó la transacción</li>
            <li>Límite de compras excedido</li>
            <li>Problemas temporales con el procesador de pagos</li>
          </ul>
        </div>

        <div className={styles.actions}>
          {training && (
            <button
              onClick={handleRetryPayment}
              disabled={retrying}
              className={styles.retryButton}
            >
              {retrying ? (
                <>
                  <RefreshCw size={20} className={styles.spinning} />
                  Reintentando...
                </>
              ) : (
                <>
                  <CreditCard size={20} />
                  Reintentar Pago
                </>
              )}
            </button>
          )}
          
          <Link href="/entrenamientos/zero2trader" className={styles.secondaryButton}>
            <ArrowLeft size={20} />
            Volver a Entrenamientos
          </Link>
          
          <Link href="/" className={styles.tertiaryButton}>
            <Home size={20} />
            Ir al Inicio
          </Link>
        </div>

        <div className={styles.supportInfo}>
          <h3>¿Necesitas Ayuda?</h3>
          <p>
            Si continúas teniendo problemas, contáctanos a{' '}
            <a href="mailto:soporte@lozanonahuel.com">soporte@lozanonahuel.com</a>
            {' '}o por WhatsApp al{' '}
            <a href="https://wa.me/1234567890" target="_blank" rel="noopener noreferrer">
              +54 9 11 1234-5678
            </a>
          </p>
          
          <div className={styles.supportOptions}>
            <a href="mailto:soporte@lozanonahuel.com" className={styles.supportButton}>
              Enviar Email
            </a>
            <a 
              href="https://wa.me/1234567890" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.supportButton}
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
