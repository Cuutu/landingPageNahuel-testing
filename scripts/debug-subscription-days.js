/**
 * Script para debugear el cálculo de días hasta expiración
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
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function debugSubscriptionDays() {
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

    const now = new Date();
    console.log(`⏰ Hora actual: ${now.toLocaleString()}\n`);

    for (const email of testEmails) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📧 Email: ${email}`);
      console.log('='.repeat(60));

      const user = await User.findOne({ email });

      if (!user) {
        console.log('❌ Usuario NO encontrado\n');
        continue;
      }

      console.log(`✅ Usuario encontrado: ${user.name}`);

      if (!user.activeSubscriptions || user.activeSubscriptions.length === 0) {
        console.log('⚠️  No tiene activeSubscriptions\n');
        continue;
      }

      for (const sub of user.activeSubscriptions) {
        console.log(`\n   📦 Servicio: ${sub.service}`);
        console.log(`   📅 Expira: ${sub.expiryDate.toLocaleString()}`);
        console.log(`   ✅ Activa: ${sub.isActive}`);
        
        const timeUntilExpiry = sub.expiryDate.getTime() - now.getTime();
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
        const daysUntilExpiry = Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24));
        
        console.log(`\n   🧮 CÁLCULOS:`);
        console.log(`      • Milisegundos hasta expiración: ${timeUntilExpiry}`);
        console.log(`      • Horas hasta expiración: ${hoursUntilExpiry.toFixed(2)}`);
        console.log(`      • Días (Math.ceil): ${daysUntilExpiry}`);
        
        console.log(`\n   📧 NOTIFICACIONES:`);
        if (daysUntilExpiry === 5) {
          console.log(`      ✅ SE ENVIARÍA email: "Vence en 5 días"`);
        } else if (daysUntilExpiry === 1) {
          console.log(`      ✅ SE ENVIARÍA email: "Vence en 1 día"`);
        } else if (daysUntilExpiry <= 0 && daysUntilExpiry >= -1) {
          console.log(`      ✅ SE ENVIARÍA email: "Ha expirado"`);
        } else {
          console.log(`      ❌ NO se enviaría email (días: ${daysUntilExpiry})`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ DEBUG COMPLETADO');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
debugSubscriptionDays();

