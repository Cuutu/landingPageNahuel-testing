/**
 * Script para probar el procesamiento de pagos de entrenamientos mensuales
 * Ejecutar con: node test-monthly-training-payment.js
 */

const testPaymentProcessing = async () => {
  console.log('🧪 Probando procesamiento de pagos de entrenamientos mensuales...\n');

  try {
    // Simular datos de prueba
    const testData = {
      externalReference: 'MTS_68e1984cec460c812f3d6bd2_1736021852069' // Ejemplo de ID de suscripción
    };

    console.log('📋 Datos de prueba:', testData);

    // Llamar al endpoint de procesamiento
    const response = await fetch('http://localhost:3000/api/payments/process-monthly-training-payment', {
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

// Ejecutar la prueba
testPaymentProcessing();
