import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Configurar MercadoPago con el token de acceso
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});

const preference = new Preference(client);
const payment = new Payment(client);

/**
 * Crear preferencia de pago para suscripciones usando Checkout Pro
 */
export const createSubscriptionPreference = async (
  service: string,
  amount: number,
  currency: string = 'ARS',
  externalReference: string,
  successUrl: string,
  failureUrl: string,
  pendingUrl: string
) => {
  try {
    console.log('🔧 MercadoPago - Creando preferencia de suscripción:', {
      service,
      amount,
      currency,
      externalReference,
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Configurado' : 'No configurado'
    });
    const preferenceData = {
      items: [
        {
          id: `subscription_${service}_${Date.now()}`,
          title: `Suscripción ${service}`,
          unit_price: amount,
          quantity: 1,
          currency_id: currency,
        }
      ],
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      payment_methods: {
        // Permitir más métodos de pago para suscripciones
        installments: 1, // Sin cuotas para suscripciones
        default_installments: 1
        // NO excluir ningún tipo de pago para permitir todos los métodos disponibles
      }
    };

    console.log('🔧 MercadoPago - Datos de preferencia:', preferenceData);
    
    const response = await preference.create({ body: preferenceData });
    
    console.log('✅ MercadoPago - Preferencia creada:', {
      id: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    });
    
    return {
      success: true,
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    };
  } catch (error) {
    console.error('❌ Error creando preferencia de suscripción:', error);
    console.error('🔍 Error detallado:', {
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : 'No stack',
      error: error
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Crear preferencia de pago para entrenamientos usando Checkout Pro
 */
export const createTrainingPreference = async (
  trainingType: string,
  amount: number,
  currency: string = 'ARS',
  externalReference: string,
  successUrl: string,
  failureUrl: string,
  pendingUrl: string
) => {
  try {
    const preferenceData = {
      items: [
        {
          id: `training_${trainingType}_${Date.now()}`,
          title: `Entrenamiento ${trainingType}`,
          unit_price: amount,
          quantity: 1,
          currency_id: currency,
        }
      ],
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      payment_methods: {
        installments: 12, // Permitir hasta 12 cuotas para entrenamientos
        default_installments: 1
        // NO excluir ningún tipo de pago para permitir todos los métodos disponibles
      }
    };

    const response = await preference.create({ body: preferenceData });
    return {
      success: true,
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    };
  } catch (error) {
    console.error('Error creando preferencia de entrenamiento:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Obtener información de un pago de MercadoPago
 */
export const getMercadoPagoPayment = async (paymentId: string) => {
  try {
    const response = await payment.get({ id: paymentId });
    return {
      success: true,
      payment: response
    };
  } catch (error) {
    console.error('Error obteniendo pago de MercadoPago:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Verificar si un pago fue exitoso
 */
export const isPaymentSuccessful = (payment: any): boolean => {
  return payment.status === 'approved' && payment.status_detail === 'accredited';
};

/**
 * Verificar si un pago está pendiente
 */
export const isPaymentPending = (payment: any): boolean => {
  return payment.status === 'pending' || payment.status === 'in_process';
};

/**
 * Verificar si un pago fue rechazado
 */
export const isPaymentRejected = (payment: any): boolean => {
  return payment.status === 'rejected' || payment.status === 'cancelled';
};

/**
 * Crear preferencia de pago para reservas usando Checkout Pro
 */
export const createBookingPreference = async (
  serviceType: string,
  amount: number,
  currency: string = 'ARS',
  externalReference: string,
  successUrl: string,
  failureUrl: string,
  pendingUrl: string,
  reservationData?: any
) => {
  try {
    console.log('🔧 MercadoPago - Creando preferencia de reserva:', {
      serviceType,
      amount,
      currency,
      externalReference,
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Configurado' : 'No configurado'
    });

    const preferenceData = {
      items: [
        {
          id: `booking_${serviceType}_${Date.now()}`,
          title: `Reserva - ${serviceType}`,
          unit_price: amount,
          quantity: 1,
          currency_id: currency,
        }
      ],
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      payment_methods: {
        installments: 12, // Permitir hasta 12 cuotas para reservas
        default_installments: 1
        // NO excluir ningún tipo de pago para permitir todos los métodos disponibles
      }
    };

    console.log('🔧 MercadoPago - Datos de preferencia de reserva:', preferenceData);
    
    const response = await preference.create({ body: preferenceData });
    
    console.log('✅ MercadoPago - Preferencia de reserva creada:', {
      id: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    });
    
    return {
      success: true,
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    };
  } catch (error) {
    console.error('❌ Error creando preferencia de reserva:', error);
    console.error('🔍 Error detallado:', {
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : 'No stack',
      error: error
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Crear preferencia de pago genérica usando Checkout Pro
 */
export const createMercadoPagoPreference = async (
  title: string,
  amount: number,
  currency: string = 'ARS',
  externalReference: string,
  successUrl: string,
  failureUrl: string,
  pendingUrl: string
) => {
  try {
    const preferenceData = {
      items: [
        {
          id: `item_${Date.now()}`,
          title,
          unit_price: amount,
          quantity: 1,
          currency_id: currency,
        }
      ],
      external_reference: externalReference,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
      payment_methods: {
        // Permitir todos los métodos de pago disponibles
        installments: 12, // Permitir hasta 12 cuotas
        default_installments: 1
        // NO excluir ningún tipo de pago para permitir todos los métodos disponibles
      }
    };

    const response = await preference.create({ body: preferenceData });
    return {
      success: true,
      preferenceId: response.id,
      initPoint: response.init_point,
      sandboxInitPoint: response.sandbox_init_point
    };
  } catch (error) {
    console.error('Error creando preferencia de MercadoPago:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}; 