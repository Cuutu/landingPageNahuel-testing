import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface PaymentStatusHandlerProps {
  externalReference: string;
  paymentId?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  onRetry: () => void;
}

interface PaymentStatus {
  status: 'checking' | 'approved' | 'pending' | 'rejected' | 'error';
  message: string;
  shouldRetry: boolean;
  mercadopagoStatus?: string;
}

const PaymentStatusHandler: React.FC<PaymentStatusHandlerProps> = ({
  externalReference,
  paymentId,
  onSuccess,
  onError,
  onRetry
}) => {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    status: 'checking',
    message: 'Verificando estado del pago...',
    shouldRetry: false
  });
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const maxRetries = 3;

  const checkPaymentStatus = async (isRetry: boolean = false) => {
    if (isRetry) {
      setIsRetrying(true);
      setRetryCount(prev => prev + 1);
    }

    try {
      const response = await fetch('/api/payments/process-immediate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          externalReference,
          paymentId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPaymentStatus({
          status: 'approved',
          message: '¡Pago verificado exitosamente!',
          shouldRetry: false
        });
        setTimeout(() => onSuccess(), 1500);
      } else {
        const status = data.status || 'pending';
        const shouldRetry = data.shouldRetry && retryCount < maxRetries;
        
        setPaymentStatus({
          status: shouldRetry ? 'pending' : 'rejected',
          message: data.error || 'Error verificando el pago',
          shouldRetry,
          mercadopagoStatus: status
        });

        if (!shouldRetry) {
          onError(data.error || 'No se pudo verificar el pago');
        }
      }
    } catch (error) {
      setPaymentStatus({
        status: 'error',
        message: 'Error de conexión. Verificando...',
        shouldRetry: retryCount < maxRetries
      });
      
      if (retryCount >= maxRetries) {
        onError('Error de conexión. Por favor, intenta nuevamente.');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    checkPaymentStatus(true);
  };

  useEffect(() => {
    // Verificar inmediatamente al montar
    checkPaymentStatus();
  }, []);

  // Auto-retry para pagos pendientes
  useEffect(() => {
    if (paymentStatus.status === 'pending' && paymentStatus.shouldRetry && retryCount < maxRetries) {
      const timer = setTimeout(() => {
        checkPaymentStatus(true);
      }, 3000); // Reintentar cada 3 segundos

      return () => clearTimeout(timer);
    }
  }, [paymentStatus.status, paymentStatus.shouldRetry, retryCount]);

  const getStatusIcon = () => {
    switch (paymentStatus.status) {
      case 'checking':
        return <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />;
      case 'approved':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'pending':
        return <Clock className="w-6 h-6 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'error':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      default:
        return <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (paymentStatus.status) {
      case 'checking':
        return 'border-blue-200 bg-blue-50';
      case 'approved':
        return 'border-green-200 bg-green-50';
      case 'pending':
        return 'border-yellow-200 bg-yellow-50';
      case 'rejected':
        return 'border-red-200 bg-red-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50`}>
      <div className={`bg-white rounded-lg p-6 max-w-md w-full mx-4 border-2 ${getStatusColor()}`}>
        <div className="flex items-center justify-center mb-4">
          {getStatusIcon()}
        </div>
        
        <h3 className="text-lg font-semibold text-center mb-2">
          {paymentStatus.status === 'checking' && 'Verificando Pago'}
          {paymentStatus.status === 'approved' && '¡Pago Exitoso!'}
          {paymentStatus.status === 'pending' && 'Pago Pendiente'}
          {paymentStatus.status === 'rejected' && 'Pago No Verificado'}
          {paymentStatus.status === 'error' && 'Error de Verificación'}
        </h3>
        
        <p className="text-center text-gray-600 mb-4">
          {paymentStatus.message}
        </p>

        {paymentStatus.mercadopagoStatus && (
          <p className="text-center text-sm text-gray-500 mb-4">
            Estado MercadoPago: <span className="font-medium">{paymentStatus.mercadopagoStatus}</span>
          </p>
        )}

        {retryCount > 0 && (
          <p className="text-center text-sm text-gray-500 mb-4">
            Intentos: {retryCount}/{maxRetries}
          </p>
        )}

        {paymentStatus.status === 'pending' && paymentStatus.shouldRetry && retryCount < maxRetries && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              El pago está siendo procesado. Reintentando automáticamente...
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          </div>
        )}

        {paymentStatus.status === 'pending' && !paymentStatus.shouldRetry && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              El pago está pendiente. Por favor, completa el proceso de pago en MercadoPago.
            </p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg flex items-center mx-auto"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Verificar Nuevamente
                </>
              )}
            </button>
          </div>
        )}

        {paymentStatus.status === 'rejected' && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              El pago no pudo ser verificado. Por favor, intenta nuevamente.
            </p>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg flex items-center mx-auto"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Intentar Nuevamente
                </>
              )}
            </button>
          </div>
        )}

        {paymentStatus.status === 'error' && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Error de conexión. Verificando automáticamente...
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentStatusHandler;
