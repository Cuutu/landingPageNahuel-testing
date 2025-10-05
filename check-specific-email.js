/**
 * Script para verificar suscripciones de un email específico
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const checkSpecificEmail = async () => {
  console.log('🔍 Verificando suscripciones para franco.l.varela99@gmail.com...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Total de suscripciones:', debugResult.data?.totalSubscriptions || 0);
    
    if (debugResult.data?.subscriptions) {
      console.log('\n📋 Todas las suscripciones:');
      debugResult.data.subscriptions.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.subscriptionMonth}/${sub.subscriptionYear} - ${sub.paymentStatus}`);
      });

      // Filtrar por el email específico
      const francoSubscriptions = debugResult.data.subscriptions.filter(sub => 
        sub.userEmail === 'franco.l.varela99@gmail.com'
      );

      console.log(`\n🎯 Suscripciones de franco.l.varela99@gmail.com: ${francoSubscriptions.length}`);
      
      if (francoSubscriptions.length > 0) {
        francoSubscriptions.forEach((sub, index) => {
          console.log(`\n${index + 1}. Suscripción ID: ${sub.id}`);
          console.log(`   Email: ${sub.userEmail}`);
          console.log(`   Tipo: ${sub.trainingType}`);
          console.log(`   Mes/Año: ${sub.subscriptionMonth}/${sub.subscriptionYear}`);
          console.log(`   Estado Pago: ${sub.paymentStatus}`);
          console.log(`   Activa: ${sub.isActive}`);
          console.log(`   Acceso: ${sub.accessGranted}`);
          console.log(`   Creada: ${sub.createdAt}`);
        });
      } else {
        console.log('❌ No se encontraron suscripciones para franco.l.varela99@gmail.com');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

checkSpecificEmail();
