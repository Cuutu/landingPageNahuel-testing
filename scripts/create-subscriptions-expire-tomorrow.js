/**
 * Script para crear suscripciones que expiran MAÑANA (en 24 horas)
 * Esto permite:
 * 1. Acceder al contenido HOY (suscripción activa)
 * 2. Recibir email de "vence en 1 día" cuando corra el cron
 * 3. Testear el flujo completo de notificaciones
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
  role: String,
  activeSubscriptions: [{
    service: String,
    startDate: Date,
    expiryDate: Date,
    isActive: Boolean,
    mercadopagoPaymentId: String,
    amount: Number,
    currency: String
  }],
  subscriptions: [{
    tipo: String,
    precio: Number,
    fechaInicio: Date,
    fechaFin: Date,
    activa: Boolean
  }],
  subscriptionExpiry: Date,
  lastPaymentDate: Date,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createSubscriptionsExpireTomorrow() {
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

    console.log('📧 Creando suscripciones que EXPIRAN MAÑANA para:');
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
          activeSubscriptions: [],
          subscriptions: []
        });
      }

      // Configurar fechas: Expira en EXACTAMENTE 24 horas (mañana a esta hora)
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); // Inicio hace 29 días

      console.log(`   📅 Inicio: ${startDate.toLocaleString()} (hace 29 días)`);
      console.log(`   ⏰ Expira: ${tomorrow.toLocaleString()} (en 24 horas - MAÑANA)`);
      console.log(`   ✅ Estado: ACTIVA (aún no expiró)`);

      // Limpiar suscripciones existentes
      user.activeSubscriptions = [];
      user.subscriptions = [];

      // Agregar las nuevas suscripciones a activeSubscriptions
      for (const service of services) {
        user.activeSubscriptions.push({
          service,
          startDate: startDate,
          expiryDate: tomorrow,
          isActive: true,
          mercadopagoPaymentId: `test-tomorrow-${Date.now()}`,
          amount: 99,
          currency: 'ARS'
        });

        // También agregar a subscriptions (para el panel de admin)
        user.subscriptions.push({
          tipo: service,
          precio: 99,
          fechaInicio: startDate,
          fechaFin: tomorrow,
          activa: true
        });

        console.log(`   ✅ Agregada suscripción: ${service}`);
      }

      // Actualizar campos generales
      user.subscriptionExpiry = tomorrow;
      user.lastPaymentDate = startDate;
      
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
    console.log(`   • Estado: ✅ ACTIVAS (expiran mañana)`);
    console.log(`   • Expiran: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString()}`);
    
    console.log('\n🎯 QUE PODES HACER AHORA:');
    console.log('   1. ✅ Acceder a TraderCall y SmartMoney (suscripción activa)');
    console.log('   2. 📧 Cuando ejecutes el cron, recibirás email de "vence en 1 día"');
    console.log('   3. ⏰ Mañana a esta hora, la suscripción expirará');
    
    console.log('\n🧪 Para testear notificaciones ahora:');
    console.log('   Invoke-WebRequest -Uri "https://lozanonahuel.vercel.app/api/cron/subscription-notifications" -Method GET -UserAgent "curl/7.68.0"\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
createSubscriptionsExpireTomorrow();

