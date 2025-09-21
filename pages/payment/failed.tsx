import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { XCircle, RefreshCw, Home, CreditCard, AlertTriangle, Mail, Phone } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/PaymentFailed.module.css';

interface PaymentDetails {
  success: boolean;
  status: string;
  paymentId?: string;
  amount: number;
  currency: string;
  service: string;
  externalReference: string;
  message: string;
  errorCode?: string;
  errorMessage?: string;
}

export default function PaymentFailed() {
  const router = useRouter();
  const { data: session } = useSession();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const { reference, status, error_code, error_message } = router.query;
    
    if (reference && session) {
      // Si tenemos parámetros de error de MercadoPago, usarlos
      if (status === 'rejected' || error_code) {
        setPaymentDetails({
          success: false,
          status: status as string || 'rejected',
          amount: 0, // Se obtendrá de la verificación
          currency: 'UYU',
          service: 'Unknown',
          externalReference: reference as string,
          message: 'Pago rechazado',
          errorCode: error_code as string,
          errorMessage: error_message as string
        });
        setLoading(false);
      } else {
        // Verificar el estado del pago
        verifyPayment(reference as string);
      }
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

  const handleRetryPayment = async () => {
    if (!paymentDetails) return;
    
    setRetrying(true);
    try {
      // Redirigir a la página de checkout nuevamente
      const service = paymentDetails.service;
      const amount = paymentDetails.amount;
      
      // Determinar la ruta correcta según el servicio
      let checkoutUrl = '';
      if (['TraderCall', 'SmartMoney', 'CashFlow'].includes(service)) {
        checkoutUrl = `/checkout?service=${service}&amount=${amount}`;
      } else if (['SwingTrading', 'DowJones'].includes(service)) {
        checkoutUrl = `/checkout-training?service=${service}&amount=${amount}`;
      } else if (service.includes('booking')) {
        checkoutUrl = `/reservas?retry=true`;
      } else {
        checkoutUrl = '/';
      }
      
      router.push(checkoutUrl);
    } catch (error) {
      console.error('Error redirigiendo:', error);
      setError('Error al intentar reintentar el pago');
    } finally {
      setRetrying(false);
    }
  };

  const getErrorMessage = () => {
    if (paymentDetails?.errorCode) {
      const errorMessages: { [key: string]: string } = {
        'cc_rejected_insufficient_amount': 'Fondos insuficientes en tu tarjeta',
        'cc_rejected_bad_filled_card_number': 'Número de tarjeta inválido',
        'cc_rejected_bad_filled_date': 'Fecha de vencimiento inválida',
        'cc_rejected_bad_filled_security_code': 'Código de seguridad inválido',
        'cc_rejected_other_reason': 'Tarjeta rechazada por el banco',
        'cc_rejected_call_for_authorize': 'Debes autorizar el pago con tu banco',
        'cc_rejected_duplicated_payment': 'Pago duplicado',
        'cc_rejected_high_risk': 'Transacción de alto riesgo',
        'cc_rejected_max_attempts': 'Máximo de intentos excedido',
        'cc_rejected_invalid_installments': 'Número de cuotas inválido',
        'cc_rejected_blacklist': 'Tarjeta en lista negra',
        'cc_rejected_insufficient_data': 'Datos insuficientes',
        'cc_rejected_bad_filled_other': 'Datos de la tarjeta incorrectos',
        'cc_rejected_high_risk': 'Transacción rechazada por seguridad',
        'cc_rejected_do_not_honor': 'Banco no autoriza la transacción',
        'cc_rejected_expired': 'Tarjeta expirada',
        'cc_rejected_restricted': 'Tarjeta restringida',
        'cc_rejected_stealing_suspect': 'Transacción sospechosa',
        'cc_rejected_use_other_card': 'Usa otra tarjeta',
        'cc_rejected_use_other_payment_method': 'Usa otro método de pago'
      };
      
      return errorMessages[paymentDetails.errorCode] || paymentDetails.errorMessage || 'Error desconocido';
    }
    
    return 'Tu pago no pudo ser procesado. Por favor, intenta nuevamente.';
  };

  const getErrorIcon = () => {
    if (paymentDetails?.errorCode?.includes('cc_rejected_insufficient_amount')) {
      return <CreditCard size={60} />;
    }
    return <XCircle size={60} />;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Verificando el estado del pago...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Pago Fallido - Nahuel Lozano</title>
        <meta name="description" content="Tu pago no pudo ser procesado" />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorIcon}>
            {getErrorIcon()}
          </div>
          
          <h1 className={styles.title}>Pago No Procesado</h1>
          
          <p className={styles.subtitle}>
            {getErrorMessage()}
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
                <span className={styles.statusFailed}>Rechazado</span>
              </div>
              {paymentDetails.errorCode && (
                <div className={styles.detailRow}>
                  <span>Código de Error:</span>
                  <span className={styles.errorCode}>{paymentDetails.errorCode}</span>
                </div>
              )}
            </div>
          )}

          <div className={styles.actions}>
            <button 
              onClick={handleRetryPayment}
              disabled={retrying}
              className={styles.primaryButton}
            >
              {retrying ? (
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
            
            <Link href="/" className={styles.secondaryButton}>
              <Home size={20} />
              Volver al Inicio
            </Link>
          </div>

          <div className={styles.troubleshooting}>
            <h3>
              <AlertTriangle size={20} />
              ¿Qué puedes hacer?
            </h3>
            <ul>
              <li>Verifica que los datos de tu tarjeta sean correctos</li>
              <li>Asegúrate de tener fondos suficientes</li>
              <li>Intenta con otra tarjeta o método de pago</li>
              <li>Contacta a tu banco si el problema persiste</li>
            </ul>
          </div>

          <div className={styles.supportInfo}>
            <h3>¿Necesitas ayuda?</h3>
            <p>
              Si el problema persiste, nuestro equipo de soporte está aquí para ayudarte.
            </p>
            <div className={styles.contactOptions}>
              <a href="mailto:soporte@nahuellozano.com" className={styles.contactLink}>
                <Mail size={16} />
                soporte@nahuellozano.com
              </a>
              <a href="https://wa.me/59899123456" className={styles.contactLink}>
                <Phone size={16} />
                WhatsApp
              </a>
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <p>{error}</p>
              <button 
                onClick={() => {
                  const { reference } = router.query;
                  if (reference) {
                    setLoading(true);
                    setError(null);
                    verifyPayment(reference as string);
                  }
                }}
                className={styles.retryButton}
              >
                Reintentar Verificación
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
