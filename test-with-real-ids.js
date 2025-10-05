/**
 * Script para probar con IDs reales de las suscripciones pendientes
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const testWithRealIds = async () => {
  console.log('🧪 Probando con IDs reales de suscripciones pendientes...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Obtener las suscripciones pendientes
    console.log('📋 Obteniendo suscripciones pendientes...');
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    const pendingSubscriptions = debugResult.data?.subscriptions?.filter(sub => 
      sub.paymentStatus === 'pending'
    ) || [];

    console.log(`📊 Encontradas ${pendingSubscriptions.length} suscripciones pendientes`);

    if (pendingSubscriptions.length === 0) {
      console.log('✅ No hay suscripciones pendientes');
      return;
    }

    // Probar con la primera suscripción
    const firstSubscription = pendingSubscriptions[0];
    console.log(`\n🔄 Probando con suscripción: ${firstSubscription.id}`);
    console.log(`Email: ${firstSubscription.userEmail}`);
    console.log(`Tipo: ${firstSubscription.trainingType}`);

    // Intentar procesar usando el ID de la suscripción como externalReference
    const testData = {
      externalReference: firstSubscription.id
    };

    console.log('📋 Datos de prueba:', testData);

    const response = await fetch(`${VERCEL_URL}/api/payments/process-monthly-training-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();

    console.log('\n📊 Respuesta del servidor:');
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

testWithRealIds();
