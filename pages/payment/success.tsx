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

  // Función para obtener el mensaje dinámico según el servicio
  const getServiceMessage = (service: string) => {
    const serviceMessages: { [key: string]: string } = {
      'SmartMoney': 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido de SmartMoney.',
      'TraderCall': 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido de TraderCall.',
      'CashFlow': 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido de CashFlow.',
      'SwingTrading': 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido de Swing Trading.',
      'DowJones': 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido de Dow Jones.',
      'Consulta Financiera': 'Gracias por tu pago. En unos segundos vas a poder acceder a tu consulta financiera.',
      'Asesoría': 'Gracias por tu pago. En unos segundos vas a poder acceder a tu asesoría personalizada.'
    };
    
    return serviceMessages[service] || 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido premium.';
  };

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
      
      // ✅ PASO 1: Verificar con MercadoPago ANTES de mostrar "PAGO EXITOSO"
      console.log('🔍 Verificando pago real con MercadoPago...');
      
      const response = await fetch('/api/payments/process-immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalReference: reference })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // ✅ SOLO mostrar "PAGO EXITOSO" si MercadoPago confirma que es real
        console.log('✅ Pago verificado con MercadoPago - Asignando rango al usuario');
        
        setPaymentDetails({
          success: true,
          status: 'approved',
          paymentId: data.payment?.mercadopagoPaymentId || 'verified',
          amount: data.payment?.amount || 0,
          currency: data.payment?.currency || 'ARS',
          service: data.payment?.service || 'Servicio',
          externalReference: reference,
          message: 'Pago verificado exitosamente',
          transactionDate: new Date().toISOString(),
          paymentMethod: 'MercadoPago'
        });
        
        setProcessingComplete(true);
        
        // ✅ El rango ya fue asignado en process-immediate
        console.log('✅ Usuario ya tiene acceso al servicio');
        
      } else {
        // ❌ NO mostrar "PAGO EXITOSO" si no está verificado
        console.error('❌ Pago no verificado:', data.error);
        setError(data.error || 'El pago no ha sido verificado. Por favor, completa el proceso de pago.');
      }
    } catch (error) {
      console.error('❌ Error verificando pago:', error);
      setError('Error de conexión verificando el pago. Por favor, intenta nuevamente.');
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
          
          <h1 className={styles.title}>Tu compra fue exitosa!</h1>
          
          <p className={styles.subtitle}>
            {paymentDetails ? getServiceMessage(paymentDetails.service) : 'Gracias por tu pago. En unos segundos vas a poder acceder a todo el contenido premium.'}
          </p>

          {paymentDetails && (
            <div className={styles.paymentDetails}>
              <h3 className={styles.summaryTitle}>Resumen de tu operación</h3>
              <div className={styles.detailRow}>
                <span>Servicio pagado:</span>
                <span>{paymentDetails.service}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Monto:</span>
                <span>${paymentDetails.amount} {paymentDetails.currency}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Fecha:</span>
                <span>{paymentDetails.transactionDate ? new Date(paymentDetails.transactionDate).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Argentina/Buenos_Aires'
                }) : 'N/A'}</span>
              </div>
              <div className={styles.detailRow}>
                <span>Estado:</span>
                <span className={styles.statusApproved}>Aprobado</span>
              </div>
              {paymentDetails.paymentId && (
                <div className={styles.detailRow}>
                  <span>ID de transacción: {paymentDetails.paymentId}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span>Procesamiento completado con éxito</span>
              </div>
            </div>
          )}

          <div className={styles.buttonGroup}>
            {paymentDetails?.service && ['TraderCall', 'SmartMoney', 'CashFlow'].includes(paymentDetails.service) && (
              <Link href="/alertas" className={`${styles.button} ${styles.actionButton}`}>
                Ir a mis alertas
              </Link>
            )}
            
            {paymentDetails?.service && ['SwingTrading', 'DowJones'].includes(paymentDetails.service) && (
              <Link href="/entrenamientos" className={`${styles.button} ${styles.actionButton}`}>
                Ir a Entrenamientos
              </Link>
            )}

            {paymentDetails?.service && paymentDetails.service.includes('booking') && (
              <Link href="/reservas" className={`${styles.button} ${styles.actionButton}`}>
                Ver Mis Reservas
              </Link>
            )}
            
            <Link href="/" className={`${styles.button} ${styles.actionButton}`}>
              Volver al inicio
            </Link>
          </div>

          <div className={styles.supportInfo}>
            <p className={styles.supportMessage}>
              Necesitas ayuda. soporte@lozanonahuel.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 