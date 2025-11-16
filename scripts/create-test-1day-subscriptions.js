/**
 * Script para crear suscripciones de prueba de 1 día
 * Objetivo: Testear el sistema de notificaciones de expiración
 */

const mongoose = require('mongoose');

// MongoDB URI directa para testing
const MONGODB_URI = 'mongodb+srv://Tortu:Las40org@landingpagenahuel.pdccomn.mongodb.net/?retryWrites=true&w=majority&appName=landingPageNahuel';

// Definir el esquema de User directamente
const UserSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: { type: String, required: true, unique: true },
  picture: String,
  role: {
    type: String,
    enum: ['normal', 'suscriptor', 'admin'],
    default: 'normal'
  },
  activeSubscriptions: [{
    service: {
      type: String,
      enum: ['TraderCall', 'SmartMoney', 'CashFlow'],
      required: true
    },
    startDate: { type: Date, required: true, default: Date.now },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    mercadopagoPaymentId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'ARS' }
  }],
  subscriptionExpiry: Date,
  lastPaymentDate: Date,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createTestSubscriptions() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Emails de prueba
    const testEmails = [
      'franco.l.varela99@gmail.com',
      'lozanonahuel@gmail.com',
      'nlozano@lozanonahuel.com'
    ];

    // Servicios a activar
    const services = ['TraderCall', 'SmartMoney'];

    console.log('📧 Creando suscripciones de 1 día para:');
    testEmails.forEach(email => console.log(`   - ${email}`));
    console.log(`\n📦 Servicios: ${services.join(', ')}\n`);

    for (const email of testEmails) {
      console.log(`\n🔍 Procesando: ${email}`);

      // Buscar o crear usuario
      let user = await User.findOne({ email });

      if (!user) {
        console.log('   ⚠️  Usuario no encontrado, creando uno nuevo...');
        user = new User({
          email,
          googleId: `test-${Date.now()}-${Math.random()}`,
          name: email.split('@')[0],
          role: 'normal',
          picture: '',
          activeSubscriptions: []
        });
      }

      // Configurar fechas: 1 día de duración
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      console.log(`   📅 Inicio: ${now.toLocaleString()}`);
      console.log(`   ⏰ Expira: ${oneDayFromNow.toLocaleString()} (en 24 horas)`);

      // Limpiar suscripciones existentes para estos servicios
      user.activeSubscriptions = user.activeSubscriptions.filter(
        sub => !services.includes(sub.service)
      );

      // Agregar las nuevas suscripciones
      for (const service of services) {
        user.activeSubscriptions.push({
          service,
          startDate: now,
          expiryDate: oneDayFromNow,
          isActive: true,
          mercadopagoPaymentId: `test-1day-${Date.now()}`,
          amount: 99,
          currency: 'ARS'
        });
        console.log(`   ✅ Agregada suscripción: ${service}`);
      }

      // Actualizar campos generales
      user.subscriptionExpiry = oneDayFromNow;
      user.lastPaymentDate = now;
      
      // Actualizar rol a suscriptor
      if (user.role === 'normal') {
        user.role = 'suscriptor';
        console.log('   👤 Rol actualizado a: suscriptor');
      }

      // Guardar
      await user.save();
      console.log(`   💾 Usuario guardado exitosamente`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESO COMPLETADO');
    console.log('='.repeat(60));
    console.log('\n📊 Resumen:');
    console.log(`   • Usuarios procesados: ${testEmails.length}`);
    console.log(`   • Servicios por usuario: ${services.length}`);
    console.log(`   • Total de suscripciones: ${testEmails.length * services.length}`);
    console.log(`   • Duración: 1 día (24 horas)`);
    console.log(`   • Expiran: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString()}`);
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   Las notificaciones de expiración deberían enviarse:');
    console.log('   • A las 10:00 de mañana (si la suscripción expira mañana)');
    console.log('   • Revisa los logs del cron job en Vercel');
    console.log('   • Endpoint: /api/cron/check-subscription-expiry\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
createTestSubscriptions();

