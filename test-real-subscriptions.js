/**
 * Script para probar con suscripciones reales pendientes
 * Ejecutar con: node test-real-subscriptions.js [environment]
 * 
 * Este script:
 * 1. Obtiene las suscripciones pendientes reales
 * 2. Intenta procesar cada una
 * 3. Muestra los resultados
 */

const BASE_URLS = {
  local: 'http://localhost:3000',
  vercel: 'https://lozanonahuel.vercel.app'
};

const testRealSubscriptions = async (environment = 'local') => {
  const baseUrl = BASE_URLS[environment] || BASE_URLS.local;
  
  console.log(`🧪 Probando suscripciones reales pendientes en ${environment.toUpperCase()}...`);
  console.log(`🌐 URL base: ${baseUrl}\n`);

  try {
    // Paso 1: Obtener suscripciones pendientes
    console.log('📋 Paso 1: Obteniendo suscripciones pendientes...');
    const debugResponse = await fetch(`${baseUrl}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    if (!debugResult.success) {
      console.error('❌ Error obteniendo suscripciones:', debugResult.error);
      return;
    }

    const pendingSubscriptions = debugResult.data?.subscriptions?.filter(sub => 
      sub.paymentStatus === 'pending'
    ) || [];

    console.log(`📊 Encontradas ${pendingSubscriptions.length} suscripciones pendientes`);

    if (pendingSubscriptions.length === 0) {
      console.log('✅ No hay suscripciones pendientes para procesar');
      return;
    }

    // Paso 2: Procesar cada suscripción pendiente
    console.log('\n🔄 Paso 2: Procesando suscripciones pendientes...');
    
    for (let i = 0; i < pendingSubscriptions.length; i++) {
      const subscription = pendingSubscriptions[i];
      console.log(`\n--- Procesando suscripción ${i + 1}/${pendingSubscriptions.length} ---`);
      console.log(`ID: ${subscription.id}`);
      console.log(`Email: ${subscription.userEmail}`);
      console.log(`Tipo: ${subscription.trainingType}`);
      console.log(`Estado actual: ${subscription.paymentStatus}`);

      try {
        // Intentar procesar el pago
        const processResponse = await fetch(`${baseUrl}/api/payments/process-monthly-training-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            externalReference: subscription.paymentId || subscription.id
          })
        });

        const processResult = await processResponse.json();

        if (processResult.success) {
          console.log('✅ Suscripción procesada exitosamente');
          console.log('Nuevo estado:', processResult.subscription?.paymentStatus);
        } else {
          console.log('❌ Error procesando suscripción');
          console.log('Error:', processResult.error);
          console.log('Should Retry:', processResult.shouldRetry);
        }

      } catch (error) {
        console.error('❌ Error en la solicitud:', error.message);
      }

      // Pequeña pausa entre solicitudes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Paso 3: Verificar estado final
    console.log('\n📊 Paso 3: Verificando estado final...');
    const finalResponse = await fetch(`${baseUrl}/api/debug/monthly-subscriptions`);
    const finalResult = await finalResponse.json();

    if (finalResult.success) {
      const finalPending = finalResult.data?.subscriptions?.filter(sub => 
        sub.paymentStatus === 'pending'
      ) || [];
      
      const finalCompleted = finalResult.data?.subscriptions?.filter(sub => 
        sub.paymentStatus === 'completed'
      ) || [];

      console.log(`\n📈 Resultado final:`);
      console.log(`   Pendientes: ${finalPending.length}`);
      console.log(`   Completadas: ${finalCompleted.length}`);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
};

// Obtener el entorno de los argumentos de línea de comandos
const environment = process.argv[2] || 'local';

// Ejecutar la prueba
testRealSubscriptions(environment);
