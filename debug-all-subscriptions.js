/**
 * Script para debuggear todas las suscripciones sin filtros
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const debugAllSubscriptions = async () => {
  console.log('🔍 Debuggeando todas las suscripciones...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    const debugResponse = await fetch(`${VERCEL_URL}/api/debug/monthly-subscriptions`);
    const debugResult = await debugResponse.json();

    console.log('📊 Respuesta completa del endpoint:');
    console.log(JSON.stringify(debugResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

debugAllSubscriptions();
