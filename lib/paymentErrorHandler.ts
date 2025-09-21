import { logger } from './logger';

export interface PaymentError {
  code: string;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  category: 'validation' | 'payment' | 'network' | 'system';
}

export class PaymentErrorHandler {
  private static errorMap: { [key: string]: PaymentError } = {
    // Errores de validación
    'INVALID_AMOUNT': {
      code: 'INVALID_AMOUNT',
      message: 'Monto inválido proporcionado',
      userMessage: 'El monto del pago no es válido. Por favor, verifica e intenta nuevamente.',
      isRetryable: false,
      category: 'validation'
    },
    'INVALID_SERVICE': {
      code: 'INVALID_SERVICE',
      message: 'Servicio inválido proporcionado',
      userMessage: 'El servicio seleccionado no es válido. Por favor, selecciona un servicio válido.',
      isRetryable: false,
      category: 'validation'
    },
    'MISSING_USER': {
      code: 'MISSING_USER',
      message: 'Usuario no encontrado',
      userMessage: 'No se pudo encontrar tu cuenta. Por favor, inicia sesión nuevamente.',
      isRetryable: false,
      category: 'validation'
    },

    // Errores de MercadoPago
    'cc_rejected_insufficient_amount': {
      code: 'cc_rejected_insufficient_amount',
      message: 'Fondos insuficientes en la tarjeta',
      userMessage: 'No tienes fondos suficientes en tu tarjeta. Por favor, verifica tu saldo o usa otra tarjeta.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_bad_filled_card_number': {
      code: 'cc_rejected_bad_filled_card_number',
      message: 'Número de tarjeta inválido',
      userMessage: 'El número de tarjeta ingresado no es válido. Por favor, verifica los datos.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_bad_filled_date': {
      code: 'cc_rejected_bad_filled_date',
      message: 'Fecha de vencimiento inválida',
      userMessage: 'La fecha de vencimiento de tu tarjeta no es válida. Por favor, verifica los datos.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_bad_filled_security_code': {
      code: 'cc_rejected_bad_filled_security_code',
      message: 'Código de seguridad inválido',
      userMessage: 'El código de seguridad (CVV) no es válido. Por favor, verifica los datos.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_other_reason': {
      code: 'cc_rejected_other_reason',
      message: 'Tarjeta rechazada por el banco',
      userMessage: 'Tu banco rechazó la transacción. Por favor, contacta a tu banco o usa otra tarjeta.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_call_for_authorize': {
      code: 'cc_rejected_call_for_authorize',
      message: 'Pago requiere autorización del banco',
      userMessage: 'Tu banco requiere autorización para este pago. Por favor, contacta a tu banco.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_duplicated_payment': {
      code: 'cc_rejected_duplicated_payment',
      message: 'Pago duplicado detectado',
      userMessage: 'Se detectó un pago duplicado. Por favor, espera unos minutos antes de intentar nuevamente.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_high_risk': {
      code: 'cc_rejected_high_risk',
      message: 'Transacción de alto riesgo',
      userMessage: 'La transacción fue rechazada por motivos de seguridad. Por favor, contacta a soporte.',
      isRetryable: false,
      category: 'payment'
    },
    'cc_rejected_max_attempts': {
      code: 'cc_rejected_max_attempts',
      message: 'Máximo de intentos excedido',
      userMessage: 'Has excedido el máximo de intentos. Por favor, espera 24 horas antes de intentar nuevamente.',
      isRetryable: false,
      category: 'payment'
    },
    'cc_rejected_expired': {
      code: 'cc_rejected_expired',
      message: 'Tarjeta expirada',
      userMessage: 'Tu tarjeta ha expirado. Por favor, usa una tarjeta válida.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_restricted': {
      code: 'cc_rejected_restricted',
      message: 'Tarjeta restringida',
      userMessage: 'Tu tarjeta está restringida. Por favor, contacta a tu banco o usa otra tarjeta.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_use_other_card': {
      code: 'cc_rejected_use_other_card',
      message: 'Usar otra tarjeta',
      userMessage: 'Por favor, intenta con otra tarjeta.',
      isRetryable: true,
      category: 'payment'
    },
    'cc_rejected_use_other_payment_method': {
      code: 'cc_rejected_use_other_payment_method',
      message: 'Usar otro método de pago',
      userMessage: 'Por favor, intenta con otro método de pago.',
      isRetryable: true,
      category: 'payment'
    },

    // Errores de red
    'NETWORK_ERROR': {
      code: 'NETWORK_ERROR',
      message: 'Error de conexión',
      userMessage: 'Error de conexión. Por favor, verifica tu internet e intenta nuevamente.',
      isRetryable: true,
      category: 'network'
    },
    'TIMEOUT_ERROR': {
      code: 'TIMEOUT_ERROR',
      message: 'Tiempo de espera agotado',
      userMessage: 'La operación tardó demasiado. Por favor, intenta nuevamente.',
      isRetryable: true,
      category: 'network'
    },

    // Errores del sistema
    'DATABASE_ERROR': {
      code: 'DATABASE_ERROR',
      message: 'Error de base de datos',
      userMessage: 'Error interno del sistema. Por favor, intenta nuevamente en unos minutos.',
      isRetryable: true,
      category: 'system'
    },
    'EMAIL_ERROR': {
      code: 'EMAIL_ERROR',
      message: 'Error enviando email',
      userMessage: 'El pago se procesó correctamente, pero hubo un problema enviando la confirmación por email.',
      isRetryable: false,
      category: 'system'
    },
    'UNKNOWN_ERROR': {
      code: 'UNKNOWN_ERROR',
      message: 'Error desconocido',
      userMessage: 'Ocurrió un error inesperado. Por favor, contacta a soporte si el problema persiste.',
      isRetryable: true,
      category: 'system'
    }
  };

  /**
   * Obtiene información detallada del error
   */
  static getErrorInfo(errorCode: string, originalError?: any): PaymentError {
    const errorInfo = this.errorMap[errorCode] || this.errorMap['UNKNOWN_ERROR'];
    
    // Log del error original para debugging
    if (originalError) {
      logger.error('Payment error occurred', {
        module: 'paymentErrorHandler',
        errorCode,
        originalError: originalError instanceof Error ? originalError.message : originalError,
        stack: originalError instanceof Error ? originalError.stack : undefined
      });
    }

    return errorInfo;
  }

  /**
   * Determina si un error es recuperable
   */
  static isRetryable(errorCode: string): boolean {
    const errorInfo = this.getErrorInfo(errorCode);
    return errorInfo.isRetryable;
  }

  /**
   * Obtiene el mensaje amigable para el usuario
   */
  static getUserMessage(errorCode: string): string {
    const errorInfo = this.getErrorInfo(errorCode);
    return errorInfo.userMessage;
  }

  /**
   * Categoriza el error
   */
  static getErrorCategory(errorCode: string): string {
    const errorInfo = this.getErrorInfo(errorCode);
    return errorInfo.category;
  }

  /**
   * Maneja errores de MercadoPago y los convierte a códigos internos
   */
  static handleMercadoPagoError(mercadoPagoError: any): PaymentError {
    if (!mercadoPagoError) {
      return this.getErrorInfo('UNKNOWN_ERROR');
    }

    // Si es un error de MercadoPago con status_detail
    if (mercadoPagoError.status_detail) {
      return this.getErrorInfo(mercadoPagoError.status_detail, mercadoPagoError);
    }

    // Si es un error de red
    if (mercadoPagoError.code === 'ECONNREFUSED' || mercadoPagoError.code === 'ENOTFOUND') {
      return this.getErrorInfo('NETWORK_ERROR', mercadoPagoError);
    }

    // Si es un timeout
    if (mercadoPagoError.code === 'ETIMEDOUT') {
      return this.getErrorInfo('TIMEOUT_ERROR', mercadoPagoError);
    }

    // Error genérico
    return this.getErrorInfo('UNKNOWN_ERROR', mercadoPagoError);
  }

  /**
   * Crea una respuesta de error estandarizada
   */
  static createErrorResponse(errorCode: string, originalError?: any) {
    const errorInfo = this.getErrorInfo(errorCode, originalError);
    
    return {
      success: false,
      error: errorInfo.userMessage,
      errorCode: errorInfo.code,
      errorCategory: errorInfo.category,
      isRetryable: errorInfo.isRetryable,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log estructurado de errores de pago
   */
  static logPaymentError(
    context: string,
    errorCode: string,
    additionalData: any = {},
    originalError?: any
  ) {
    const errorInfo = this.getErrorInfo(errorCode, originalError);
    
    logger.error('Payment error logged', {
      module: 'paymentErrorHandler',
      context,
      errorCode: errorInfo.code,
      errorMessage: errorInfo.message,
      userMessage: errorInfo.userMessage,
      category: errorInfo.category,
      isRetryable: errorInfo.isRetryable,
      additionalData,
      originalError: originalError instanceof Error ? originalError.message : originalError,
      timestamp: new Date().toISOString()
    });
  }
}
