/**
 * Script para debuggear la estructura de las suscripciones
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const debugSubscriptionStructure = async () => {
  console.log('🔍 Debuggeando estructura de suscripciones...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    const firstSubscription = debugResult.data?.subscriptions?.[0];
    
    if (firstSubscription) {
      console.log('📋 Estructura de la primera suscripción:');
      console.log(JSON.stringify(firstSubscription, null, 2));
      
      console.log('\n🔑 Campos importantes:');
      console.log(`- _id: ${firstSubscription.id}`);
      console.log(`- paymentId: ${firstSubscription.paymentId || 'NO DEFINIDO'}`);
      console.log(`- userEmail: ${firstSubscription.userEmail}`);
      console.log(`- paymentStatus: ${firstSubscription.paymentStatus}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

debugSubscriptionStructure();
