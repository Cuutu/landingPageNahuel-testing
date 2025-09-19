import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Clock, RefreshCw, Home, CheckCircle } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/PaymentPending.module.css';

export default function PaymentPending() {
  const router = useRouter();
  const { data: session } = useSession();
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const { reference } = router.query;
    
    if (reference && session) {
      // Verificar el estado del pago cada 30 segundos
      const interval = setInterval(() => {
        checkPaymentStatus(reference as string);
      }, 30000);

      // Verificación inicial
      checkPaymentStatus(reference as string);

      return () => clearInterval(interval);
    }
  }, [router.query, session]);

  const checkPaymentStatus = async (reference: string) => {
    if (checking) return;
    
    setChecking(true);
    try {
      const response = await fetch(`/api/payments/mercadopago/verify?reference=${reference}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentStatus(data);
        
        // Si el pago fue aprobado, redirigir a éxito
        if (data.status === 'approved') {
          try {
            await fetch('/api/payments/process-immediate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ externalReference: reference, paymentId: data.paymentId })
            });
          } catch (e) {
            console.error('Error en fallback process-immediate (pending):', e);
          }
          router.push(`/payment/success?reference=${reference}`);
        }
      }
    } catch (error) {
      console.error('Error verificando pago:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleManualCheck = () => {
    const { reference } = router.query;
    if (reference) {
      checkPaymentStatus(reference as string);
    }
  };

  return (
    <>
      <Head>
        <title>Pago en Proceso - Nahuel Lozano</title>
        <meta name="description" content="Tu pago está siendo procesado" />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.pendingIcon}>
            <Clock size={60} />
          </div>
          
          <h1 className={styles.title}>Pago en Proceso</h1>
          
          <p className={styles.subtitle}>
            Tu pago está siendo procesado por el banco. Esto puede tomar unos minutos.
          </p>

          <div className={styles.statusInfo}>
            <div className={styles.statusCard}>
              <Clock size={24} />
              <h3>Estado Actual</h3>
              <p>Pendiente de confirmación</p>
            </div>

            <div className={styles.statusCard}>
              <RefreshCw size={24} />
              <h3>Verificación Automática</h3>
              <p>Revisando cada 30 segundos</p>
            </div>
          </div>

          {paymentStatus && (
            <div className={styles.paymentDetails}>
              <div className={styles.detailRow}>
                <span>Servicio:</span>
                <span>{paymentStatus.service}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Monto:</span>
                <span>${paymentStatus.amount} {paymentStatus.currency}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Estado:</span>
                <span className={styles.statusPending}>En Proceso</span>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button 
              onClick={handleManualCheck}
              disabled={checking}
              className={styles.primaryButton}
            >
              {checking ? (
                <>
                  <RefreshCw size={20} className={styles.spinner} />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Verificar Ahora
                </>
              )}
            </button>
            
            <Link href="/" className={styles.secondaryButton}>
              <Home size={20} />
              Volver al Inicio
            </Link>
          </div>

          <div className={styles.info}>
            <h3>¿Qué está pasando?</h3>
            <ul>
              <li>Tu banco está procesando la transacción</li>
              <li>Esto es normal y puede tomar hasta 24 horas</li>
              <li>Recibirás una notificación cuando se complete</li>
              <li>Tu acceso se activará automáticamente</li>
            </ul>
            
            <div className={styles.note}>
              <p>
                <strong>Nota:</strong> Si el pago no se completa en 24 horas, 
                contacta a soporte para verificar el estado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 