import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { CheckCircle, ArrowRight, Home, User, Download, Mail, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/PaymentSuccess.module.css';

interface PaymentDetails {
  success: boolean;
  status: string;
  paymentId: string;
  amount: number;
  currency: string;
  service: string;
  externalReference: string;
  message: string;
  transactionDate?: string;
  paymentMethod?: string;
}

export default function PaymentSuccess() {
  const router = useRouter();
  const { data: session } = useSession();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  useEffect(() => {
    const { reference } = router.query;
    
    if (reference && session) {
      // Verificar el estado del pago
      verifyPayment(reference as string);
    } else {
      setLoading(false);
    }
  }, [router.query, session]);

  const verifyPayment = async (reference: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/payments/mercadopago/verify?reference=${reference}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentDetails(data);

        // Procesamiento inmediato para crear Booking/Calendar/emails
        if (data.status === 'approved') {
          try {
            const processResponse = await fetch('/api/payments/process-immediate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ externalReference: reference, paymentId: data.paymentId })
            });
            
            if (processResponse.ok) {
              setProcessingComplete(true);
            } else {
              console.warn('Procesamiento inmediato falló, pero el pago es válido');
            }
          } catch (e) {
            console.error('Error en process-immediate:', e);
            // No es crítico, el pago ya está aprobado
          }
        }
      } else {
        setError(data.error || 'Error verificando el pago');
      }
    } catch (error) {
      console.error('Error verificando pago:', error);
      setError('Error de conexión. Por favor, verifica tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Verificando tu pago...</p>
          <p className={styles.loadingSubtext}>Esto puede tomar unos segundos</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorIcon}>
            <AlertCircle size={60} />
          </div>
          
          <h1 className={styles.title}>Error Verificando Pago</h1>
          
          <p className={styles.subtitle}>
            {error}
          </p>

          <div className={styles.buttonGroup}>
            <button 
              onClick={() => {
                const { reference } = router.query;
                if (reference) {
                  setLoading(true);
                  setError(null);
                  verifyPayment(reference as string);
                }
              }}
              className={`${styles.button} ${styles.primaryButton}`}
            >
              <RefreshCw size={20} />
              Reintentar
            </button>
            
            <Link href="/" className={`${styles.button} ${styles.secondaryButton}`}>
              <Home size={20} />
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Pago Exitoso - Nahuel Lozano</title>
        <meta name="description" content="Tu pago ha sido procesado exitosamente" />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.successIcon}>
            <CheckCircle size={60} />
          </div>
          
          <h1 className={styles.title}>¡Pago Exitoso!</h1>
          
          <p className={styles.subtitle}>
            Tu pago ha sido procesado correctamente. Ya puedes acceder a todo el contenido.
          </p>

          {paymentDetails && (
            <div className={styles.paymentDetails}>
              <div className={styles.detailRow}>
                <span>Servicio:</span>
                <span>{paymentDetails.service}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Monto:</span>
                <span>${paymentDetails.amount} {paymentDetails.currency}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Estado:</span>
                <span className={styles.statusApproved}>Aprobado</span>
              </div>
              {paymentDetails.paymentId && (
                <div className={styles.detailRow}>
                  <span>ID de Transacción:</span>
                  <span className={styles.transactionId}>{paymentDetails.paymentId}</span>
                </div>
              )}
              {paymentDetails.transactionDate && (
                <div className={styles.detailRow}>
                  <span>Fecha:</span>
                  <span>{new Date(paymentDetails.transactionDate).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Montevideo'
                  })}</span>
                </div>
              )}
            </div>
          )}

          {processingComplete && (
            <div className={styles.processingStatus}>
              <CheckCircle size={20} className={styles.successIcon} />
              <span>Procesamiento completado exitosamente</span>
            </div>
          )}

          <div className={styles.buttonGroup}>
            {paymentDetails?.service && ['TraderCall', 'SmartMoney', 'CashFlow'].includes(paymentDetails.service) && (
              <Link href="/alertas" className={`${styles.button} ${styles.primaryButton}`}>
                Ir a las Alertas
                <ArrowRight size={20} />
              </Link>
            )}
            
            {paymentDetails?.service && ['SwingTrading', 'DowJones'].includes(paymentDetails.service) && (
              <Link href="/entrenamientos" className={`${styles.button} ${styles.primaryButton}`}>
                Ir a Entrenamientos
                <ArrowRight size={20} />
              </Link>
            )}

            {paymentDetails?.service && paymentDetails.service.includes('booking') && (
              <Link href="/reservas" className={`${styles.button} ${styles.primaryButton}`}>
                Ver Mis Reservas
                <Calendar size={20} />
              </Link>
            )}
            
            <Link href="/" className={`${styles.button} ${styles.secondaryButton}`}>
              <Home size={20} />
              Volver al Inicio
            </Link>
          </div>

          <div className={styles.info}>
            <p>
              <strong>¿Qué sigue?</strong>
            </p>
            <ul>
              {paymentDetails?.service && ['TraderCall', 'SmartMoney', 'CashFlow'].includes(paymentDetails.service) && (
                <>
                  <li>Recibirás notificaciones de nuevas alertas</li>
                  <li>Acceso completo a todos los recursos</li>
                  <li>Soporte prioritario durante tu suscripción</li>
                </>
              )}
              {paymentDetails?.service && ['SwingTrading', 'DowJones'].includes(paymentDetails.service) && (
                <>
                  <li>Acceso completo al entrenamiento</li>
                  <li>Materiales descargables disponibles</li>
                  <li>Soporte durante todo el curso</li>
                </>
              )}
              {paymentDetails?.service && paymentDetails.service.includes('booking') && (
                <>
                  <li>Recibirás un email de confirmación</li>
                  <li>Link de Google Meet en tu email</li>
                  <li>Recordatorio 24h antes de la cita</li>
                </>
              )}
            </ul>
          </div>

          <div className={styles.supportInfo}>
            <p>
              <strong>¿Necesitas ayuda?</strong>
            </p>
            <p>
              Si tienes alguna pregunta sobre tu compra, no dudes en contactarnos.
            </p>
            <div className={styles.contactOptions}>
              <a href="mailto:soporte@nahuellozano.com" className={styles.contactLink}>
                <Mail size={16} />
                soporte@nahuellozano.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 