/**
 * Script para debuggear la creación de suscripciones
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const debugSubscriptionCreation = async () => {
  console.log('🔍 Debuggeando creación de suscripciones...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Verificar el estado actual de las suscripciones
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Estado actual de monthlytrainingsubscriptions:');
    console.log('Total suscripciones:', debugResult.data?.totalSubscriptions);
    
    if (debugResult.data?.subscriptions) {
      console.log('\n📋 Suscripciones existentes:');
      debugResult.data.subscriptions.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.paymentStatus} - ${sub.createdAt}`);
      });

      // Buscar específicamente por Franco
      const francoSubscriptions = debugResult.data.subscriptions.filter(sub => 
        sub.userEmail && sub.userEmail.includes('franco')
      );

      console.log(`\n🎯 Suscripciones de Franco: ${francoSubscriptions.length}`);
      
      if (francoSubscriptions.length > 0) {
        francoSubscriptions.forEach((sub, index) => {
          console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.paymentStatus}`);
        });
      } else {
        console.log('❌ No se encontraron suscripciones de Franco en monthlytrainingsubscriptions');
      }
    }

    console.log('\n💡 Análisis del problema:');
    console.log('1. Joaquín tiene 4 suscripciones en monthlytrainingsubscriptions ✅');
    console.log('2. Franco NO tiene suscripciones en monthlytrainingsubscriptions ❌');
    console.log('3. Franco SÍ tiene pago en payments ✅');
    console.log('\n🔍 El problema está en el endpoint create-checkout que no guarda para Franco');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

debugSubscriptionCreation();
