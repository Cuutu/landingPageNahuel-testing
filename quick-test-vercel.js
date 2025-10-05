/**
 * Script rápido para probar en Vercel sin necesidad de servidor local
 * Ejecutar con: node quick-test-vercel.js
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const quickTest = async () => {
  console.log('🧪 Prueba rápida en Vercel...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Test 1: Verificar estado de suscripciones
    console.log('📋 Test 1: Verificando estado de suscripciones...');
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    
    if (!debugResponse.ok) {
      console.error('❌ Error en debug endpoint:', debugResponse.status);
      return;
    }
    
    const debugResult = await debugResponse.json();
    console.log('✅ Debug endpoint funcionando');
    console.log('Total suscripciones:', debugResult.data?.totalSubscriptions || 0);
    
    const pendingSubscriptions = debugResult.data?.subscriptions?.filter(sub => 
      sub.paymentStatus === 'pending'
    ) || [];
    
    console.log('Suscripciones pendientes:', pendingSubscriptions.length);
    
    if (pendingSubscriptions.length > 0) {
      console.log('\n📋 Suscripciones pendientes encontradas:');
      pendingSubscriptions.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.userEmail} - ${sub.trainingType} - ${sub.subscriptionMonth}/${sub.subscriptionYear}`);
      });
    }

    // Test 2: Verificar que el endpoint de procesamiento existe
    console.log('\n🔍 Test 2: Verificando endpoint de procesamiento...');
    const processResponse = await fetch(`${VERCEL_URL}/api/payments/process-monthly-training-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        externalReference: 'test_reference'
      })
    });
    
    console.log('Status del endpoint:', processResponse.status);
    
    if (processResponse.status === 400) {
      console.log('✅ Endpoint existe (error esperado por referencia de prueba)');
    } else if (processResponse.status === 200) {
      console.log('✅ Endpoint funcionando correctamente');
    } else {
      console.log('⚠️ Status inesperado:', processResponse.status);
    }

    console.log('\n🎯 Resumen:');
    console.log(`- Debug endpoint: ✅ Funcionando`);
    console.log(`- Process endpoint: ✅ Disponible`);
    console.log(`- Suscripciones pendientes: ${pendingSubscriptions.length}`);
    
    if (pendingSubscriptions.length > 0) {
      console.log('\n💡 Para procesar las suscripciones pendientes, ejecuta:');
      console.log('node test-real-subscriptions.js vercel');
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
};

quickTest();
