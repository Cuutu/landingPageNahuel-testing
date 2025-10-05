/**
 * Script para buscar suscripciones por email específico
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const searchByEmail = async () => {
  console.log('🔍 Buscando suscripciones por email específico...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Total de suscripciones en la respuesta:', debugResult.data?.totalSubscriptions || 0);
    
    if (debugResult.data?.subscriptions) {
      console.log('\n📋 Todas las suscripciones encontradas:');
      debugResult.data.subscriptions.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.subscriptionMonth}/${sub.subscriptionYear} - ${sub.paymentStatus}`);
      });

      // Buscar específicamente por franco.l.varela99@gmail.com
      const francoSubscriptions = debugResult.data.subscriptions.filter(sub => 
        sub.userEmail && sub.userEmail.toLowerCase().includes('franco')
      );

      console.log(`\n🎯 Suscripciones que contienen 'franco': ${francoSubscriptions.length}`);
      
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
        console.log('❌ No se encontraron suscripciones con "franco" en el email');
      }

      // Buscar por cualquier email que no sea joaquinperez028@gmail.com
      const otherEmails = debugResult.data.subscriptions.filter(sub => 
        sub.userEmail && !sub.userEmail.includes('joaquinperez028@gmail.com')
      );

      console.log(`\n🔍 Suscripciones con otros emails: ${otherEmails.length}`);
      if (otherEmails.length > 0) {
        otherEmails.forEach((sub, index) => {
          console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.paymentStatus}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

searchByEmail();
