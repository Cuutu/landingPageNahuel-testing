import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { CheckCircle, ArrowRight, Home, User } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/PaymentSuccess.module.css';

export default function PaymentSuccess() {
  const router = useRouter();
  const { data: session } = useSession();
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch(`/api/payments/mercadopago/verify?reference=${reference}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentDetails(data);

        // Fallback: si está aprobado, disparar procesamiento inmediato para crear Booking/Calendar/emails
        if (data.status === 'approved') {
          try {
            await fetch('/api/payments/process-immediate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ externalReference: reference, paymentId: data.paymentId })
            });
          } catch (e) {
            console.error('Error en fallback process-immediate:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error verificando pago:', error);
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
            </div>
          )}

          <div className={styles.buttonGroup}>
            <Link href="/alertas" className={`${styles.button} ${styles.primaryButton}`}>
              Ir a las Alertas
              <ArrowRight size={20} />
            </Link>
            
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
              <li>Recibirás notificaciones de nuevas alertas</li>
              <li>Acceso completo a todos los recursos</li>
              <li>Soporte prioritario durante tu suscripción</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
} 