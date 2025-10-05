/**
 * Script para probar la creación de una suscripción con logging detallado
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const testSubscriptionCreation = async () => {
  console.log('🧪 Probando creación de suscripción con logging detallado...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Simular datos de una nueva suscripción
    const subscriptionData = {
      trainingType: 'SwingTrading',
      subscriptionMonth: 10,
      subscriptionYear: 2025
    };

    console.log('📋 Datos de la suscripción:', subscriptionData);
    console.log('⚠️  NOTA: Este endpoint requiere autenticación, por lo que fallará con 401');
    console.log('   Pero los logs en Vercel mostrarán exactamente dónde falla el proceso\n');

    // Llamar al endpoint de creación
    const response = await fetch(`${VERCEL_URL}/api/monthly-training-subscriptions/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    const result = await response.json();

    console.log('\n📊 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    
    if (result.success) {
      console.log('✅ Suscripción creada exitosamente');
      console.log('Checkout URL:', result.checkoutUrl || result.sandboxInitPoint);
      console.log('Payment ID:', result.paymentId);
    } else {
      console.log('❌ Error creando suscripción');
      console.log('Error:', result.error);
      console.log('Details:', result.details);
    }

    console.log('\n💡 Para ver los logs detallados:');
    console.log('1. Ve al dashboard de Vercel');
    console.log('2. Busca la función /api/monthly-training-subscriptions/create-checkout');
    console.log('3. Revisa los logs para ver exactamente dónde falla');

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
};

testSubscriptionCreation();
