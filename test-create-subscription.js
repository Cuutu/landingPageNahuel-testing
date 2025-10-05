/**
 * Script para probar la creación de una suscripción mensual
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const testCreateSubscription = async () => {
  console.log('🧪 Probando creación de suscripción mensual...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Simular datos de una nueva suscripción
    const subscriptionData = {
      trainingType: 'SwingTrading',
      subscriptionMonth: 10,
      subscriptionYear: 2025
    };

    console.log('📋 Datos de la suscripción:', subscriptionData);

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
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
};

testCreateSubscription();
