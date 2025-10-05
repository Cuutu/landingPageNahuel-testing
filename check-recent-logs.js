/**
 * Script para verificar si hay logs recientes de creación de suscripciones
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const checkRecentLogs = async () => {
  console.log('🔍 Verificando si hay logs recientes de creación de suscripciones...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Verificar el estado actual de las suscripciones
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Estado actual:');
    console.log('Total suscripciones:', debugResult.data?.totalSubscriptions);
    
    if (debugResult.data?.subscriptions) {
      console.log('\n📋 Suscripciones ordenadas por fecha de creación:');
      debugResult.data.subscriptions.forEach((sub, index) => {
        const createdDate = new Date(sub.createdAt);
        const now = new Date();
        const diffMinutes = Math.floor((now - createdDate) / (1000 * 60));
        
        console.log(`${index + 1}. ${sub.userEmail} - Creada hace ${diffMinutes} minutos - ${sub.createdAt}`);
      });

      // Buscar suscripciones muy recientes (últimos 30 minutos)
      const recentSubscriptions = debugResult.data.subscriptions.filter(sub => {
        const createdDate = new Date(sub.createdAt);
        const now = new Date();
        const diffMinutes = Math.floor((now - createdDate) / (1000 * 60));
        return diffMinutes <= 30;
      });

      console.log(`\n🕐 Suscripciones creadas en los últimos 30 minutos: ${recentSubscriptions.length}`);
      
      if (recentSubscriptions.length > 0) {
        recentSubscriptions.forEach((sub, index) => {
          console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.paymentStatus}`);
        });
      } else {
        console.log('❌ No hay suscripciones recientes');
      }
    }

    console.log('\n💡 Para ver los logs detallados en Vercel:');
    console.log('1. Ve a https://vercel.com/dashboard');
    console.log('2. Selecciona tu proyecto');
    console.log('3. Ve a la pestaña "Functions"');
    console.log('4. Busca "monthly-training-subscriptions-create-checkout"');
    console.log('5. Revisa los logs para ver exactamente dónde falla');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

checkRecentLogs();
