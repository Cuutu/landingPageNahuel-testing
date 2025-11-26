import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Clock, AlertCircle, CreditCard, ArrowLeft, Home, RefreshCw } from 'lucide-react';
import styles from '../../../styles/PaymentResult.module.css';

interface TrainingInfo {
  _id: string;
  title: string;
  monthName: string;
  year: number;
  price: number;
}

export default function MonthlyTrainingPaymentPending() {
  const router = useRouter();
  const { training_id, payment_id, collection_status } = router.query;
  
  const [training, setTraining] = useState<TrainingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);

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

  const checkPaymentStatus = async () => {
    if (!payment_id) return;
    
    setCheckingStatus(true);
    
    try {
      // Simular verificación del estado del pago
      // En una implementación real, aquí consultarías la API de MercadoPago
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Por ahora, solo recargamos la página para que el usuario vea si cambió algo
      window.location.reload();
    } catch (error) {
      console.error('Error verificando estado del pago:', error);
    } finally {
      setCheckingStatus(false);
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
        <title>Pago Pendiente - {training?.title || 'Entrenamiento'}</title>
      </Head>

      <div className={styles.pendingCard}>
        <div className={styles.pendingIcon}>
          <Clock size={64} />
        </div>

        <h1>Pago Pendiente</h1>
        <p className={styles.pendingMessage}>
          Tu pago está siendo procesado
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
                    {collection_status === 'pending' ? 'Pendiente' : 
                     collection_status === 'in_process' ? 'En Proceso' : collection_status}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.pendingInfo}>
          <div className={styles.infoCard}>
            <AlertCircle size={24} />
            <div className={styles.infoContent}>
              <h3>¿Qué significa esto?</h3>
              <p>
                Tu pago está siendo verificado por el procesador. Esto puede tomar desde unos minutos 
                hasta algunas horas, dependiendo del método de pago utilizado.
              </p>
            </div>
          </div>

          <div className={styles.timeframes}>
            <h3>Tiempos de Procesamiento</h3>
            <ul>
              <li><strong>Tarjeta de crédito:</strong> 5-15 minutos</li>
              <li><strong>Tarjeta de débito:</strong> 10-30 minutos</li>
              <li><strong>Transferencia bancaria:</strong> 1-3 días hábiles</li>
              <li><strong>Efectivo (Rapipago/Pago Fácil):</strong> 1-2 días hábiles</li>
            </ul>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            onClick={checkPaymentStatus}
            disabled={checkingStatus}
            className={styles.checkButton}
          >
            {checkingStatus ? (
              <>
                <RefreshCw size={20} className={styles.spinning} />
                Verificando...
              </>
            ) : (
              <>
                <RefreshCw size={20} />
                Verificar Estado
              </>
            )}
          </button>
          
          <Link href="/entrenamientos/zero2trader" className={styles.secondaryButton}>
            <ArrowLeft size={20} />
            Volver a Entrenamientos
          </Link>
          
          <Link href="/" className={styles.tertiaryButton}>
            <Home size={20} />
            Ir al Inicio
          </Link>
        </div>

        <div className={styles.notificationInfo}>
          <h3>Te Notificaremos</h3>
          <p>
            Una vez que tu pago sea procesado, recibirás:
          </p>
          <ul className={styles.notificationList}>
            <li>Email de confirmación de inscripción</li>
            <li>Acceso al grupo privado del entrenamiento</li>
            <li>Cronograma detallado de las clases</li>
            <li>Material de preparación</li>
          </ul>
        </div>

        <div className={styles.supportInfo}>
          <p>
            Si tienes dudas, contáctanos a{' '}
            <a href="mailto:soporte@lozanonahuel.com">soporte@lozanonahuel.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
