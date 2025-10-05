/**
 * Script para debuggear la conexión a MongoDB y el esquema
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const debugMongoDBConnection = async () => {
  console.log('🔍 Debuggeando conexión a MongoDB y esquema...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Llamar al endpoint de debug para ver si hay problemas de conexión
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Estado de la conexión:');
    console.log('Success:', debugResult.success);
    
    if (debugResult.success) {
      console.log('✅ Conexión a MongoDB funcionando');
      console.log('Total suscripciones:', debugResult.data?.totalSubscriptions);
      
      if (debugResult.data?.subscriptions && debugResult.data.subscriptions.length > 0) {
        console.log('\n📋 Primera suscripción (para verificar esquema):');
        const firstSub = debugResult.data.subscriptions[0];
        console.log('Campos disponibles:', Object.keys(firstSub));
        console.log('Estructura completa:', JSON.stringify(firstSub, null, 2));
      }
    } else {
      console.log('❌ Error en la conexión:', debugResult.error);
    }

    // Verificar si hay algún problema con el endpoint de debug
    console.log('\n🔍 Verificando endpoint de debug...');
    const debugResponse2 = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult2 = await debugResponse2.json();
    
    if (debugResult2.error) {
      console.log('❌ Error en endpoint de debug:', debugResult2.error);
      console.log('Details:', debugResult2.details);
    } else {
      console.log('✅ Endpoint de debug funcionando correctamente');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

debugMongoDBConnection();
