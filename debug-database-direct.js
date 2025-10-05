/**
 * Script para debuggear directamente la base de datos
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const debugDatabaseDirect = async () => {
  console.log('🔍 Debuggeando base de datos directamente...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Llamar al endpoint de debug con parámetros adicionales
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Respuesta completa del endpoint:');
    console.log('Success:', debugResult.success);
    console.log('Total:', debugResult.data?.totalSubscriptions);
    
    if (debugResult.data?.subscriptions) {
      console.log('\n📋 Detalles de cada suscripción:');
      debugResult.data.subscriptions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Suscripción completa:`);
        console.log(JSON.stringify(sub, null, 2));
      });
    }

    // Verificar si hay algún problema con el endpoint
    if (debugResult.error) {
      console.log('\n❌ Error en el endpoint:', debugResult.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

debugDatabaseDirect();
