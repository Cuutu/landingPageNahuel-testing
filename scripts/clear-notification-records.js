/**
 * Script para limpiar registros de notificaciones enviadas
 * Esto permite que se reenvíen las notificaciones para testing
 */

const mongoose = require('mongoose');

// MongoDB URI directa para testing
const MONGODB_URI = 'mongodb+srv://Tortu:Las40org@landingpagenahuel.pdccomn.mongodb.net/?retryWrites=true&w=majority&appName=landingPageNahuel';

async function clearNotificationRecords() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection.db;

    // Emails de testing
    const testEmails = [
      'franco.l.varela99@gmail.com',
      'lozanonahuel@gmail.com',
      'nlozano@lozanonahuel.com'
    ];

    console.log('🗑️  Limpiando registros de notificaciones para testing...\n');

    // Eliminar todos los registros de notificaciones para estos emails
    const result = await db.collection('subscriptionNotifications').deleteMany({
      userEmail: { $in: testEmails }
    });

    console.log(`✅ Eliminados ${result.deletedCount} registros de notificaciones`);
    console.log('\n📧 Emails limpiados:');
    testEmails.forEach(email => console.log(`   - ${email}`));

    console.log('\n' + '='.repeat(60));
    console.log('✅ LIMPIEZA COMPLETADA');
    console.log('='.repeat(60));
    console.log('\n🚀 Ahora puedes ejecutar el endpoint de notificaciones:');
    console.log('   Invoke-WebRequest -Uri "https://lozanonahuel.vercel.app/api/cron/subscription-notifications" -Method GET -UserAgent "curl/7.68.0"\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
clearNotificationRecords();

