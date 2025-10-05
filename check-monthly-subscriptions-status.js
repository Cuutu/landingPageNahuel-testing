/**
 * Script para verificar el estado actual de las suscripciones mensuales
 * Ejecutar con: node check-monthly-subscriptions-status.js [environment]
 * 
 * Ejemplos:
 * - node check-monthly-subscriptions-status.js local
 * - node check-monthly-subscriptions-status.js vercel
 */

const BASE_URLS = {
  local: 'http://localhost:3000',
  vercel: 'https://lozanonahuel.vercel.app'
};

const checkSubscriptionsStatus = async (environment = 'local') => {
  const baseUrl = BASE_URLS[environment] || BASE_URLS.local;
  
  console.log(`🔍 Verificando estado de suscripciones mensuales en ${environment.toUpperCase()}...`);
  console.log(`🌐 URL base: ${baseUrl}\n`);

  try {
    // Llamar al endpoint de debug
    const response = await fetch(`${baseUrl}/api/debug/monthly-subscriptions`);
    const result = await response.json();

    console.log('📊 Estado actual de las suscripciones:');
    console.log('Total suscripciones:', result.data?.totalSubscriptions || 0);
    
    if (result.data?.subscriptions) {
      console.log('\n📋 Detalles de suscripciones:');
      result.data.subscriptions.forEach((sub, index) => {
        console.log(`\n${index + 1}. Suscripción ID: ${sub.id}`);
        console.log(`   Email: ${sub.userEmail}`);
        console.log(`   Tipo: ${sub.trainingType}`);
        console.log(`   Mes/Año: ${sub.subscriptionMonth}/${sub.subscriptionYear}`);
        console.log(`   Estado Pago: ${sub.paymentStatus}`);
        console.log(`   Activa: ${sub.isActive}`);
        console.log(`   Acceso: ${sub.accessGranted}`);
        console.log(`   Creada: ${sub.createdAt}`);
        console.log(`   Actualizada: ${sub.updatedAt}`);
      });
    }

    if (result.data?.stats) {
      console.log('\n📈 Estadísticas:');
      result.data.stats.forEach(stat => {
        console.log(`   ${stat._id.trainingType} ${stat._id.month}/${stat._id.year}: ${stat.count} total, ${stat.completed} completadas, ${stat.pending} pendientes`);
      });
    }

  } catch (error) {
    console.error('❌ Error verificando suscripciones:', error.message);
  }
};

// Obtener el entorno de los argumentos de línea de comandos
const environment = process.argv[2] || 'local';

// Ejecutar la verificación
checkSubscriptionsStatus(environment);
