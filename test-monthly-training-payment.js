/**
 * Script para probar el procesamiento de pagos de entrenamientos mensuales
 * Ejecutar con: node test-monthly-training-payment.js [environment]
 * 
 * Ejemplos:
 * - node test-monthly-training-payment.js local
 * - node test-monthly-training-payment.js vercel
 */

const BASE_URLS = {
  local: 'http://localhost:3000',
  vercel: 'https://lozanonahuel.vercel.app'
};

const testPaymentProcessing = async (environment = 'local') => {
  const baseUrl = BASE_URLS[environment] || BASE_URLS.local;
  
  console.log(`🧪 Probando procesamiento de pagos de entrenamientos mensuales en ${environment.toUpperCase()}...`);
  console.log(`🌐 URL base: ${baseUrl}\n`);

  try {
    // Simular datos de prueba - usar IDs reales de las suscripciones pendientes
    const testData = {
      externalReference: 'MTS_68e1984cec460c812f3d6bd2_1736021852069' // Ejemplo de ID de suscripción
    };

    console.log('📋 Datos de prueba:', testData);

    // Llamar al endpoint de procesamiento
    const response = await fetch(`${baseUrl}/api/payments/process-monthly-training-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log('📊 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('✅ Pago procesado exitosamente');
      console.log('Subscription:', result.subscription);
      console.log('Payment:', result.payment);
    } else {
      console.log('❌ Error procesando pago');
      console.log('Error:', result.error);
      console.log('Should Retry:', result.shouldRetry);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
};

// Obtener el entorno de los argumentos de línea de comandos
const environment = process.argv[2] || 'local';

// Ejecutar la prueba
testPaymentProcessing(environment);
