/**
 * Script para sincronizar activeSubscriptions con subscriptions (admin)
 * Esto asegura que el panel de admin muestre correctamente las suscripciones
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

async function syncSubscriptionsArrays() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Emails a sincronizar
    const testEmails = [
      'franco.l.varela99@gmail.com',
      'lozanonahuel@gmail.com',
      'nlozano@lozanonahuel.com'
    ];

    console.log('🔄 Sincronizando suscripciones...\n');

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
        console.log('⚠️  No tiene activeSubscriptions para sincronizar\n');
        continue;
      }

      // Limpiar el array subscriptions del admin
      user.subscriptions = [];

      // Copiar cada suscripción de activeSubscriptions a subscriptions
      // IMPORTANTE: Para testing, las marcamos como activas para que aparezcan en el panel
      for (const activeSub of user.activeSubscriptions) {
        user.subscriptions.push({
          tipo: activeSub.service,
          precio: activeSub.amount || 99,
          fechaInicio: activeSub.startDate,
          fechaFin: activeSub.expiryDate,
          activa: true // Marcamos como activa para testing
        });

        const now = new Date();
        const daysUntilExpiry = Math.ceil((activeSub.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const status = daysUntilExpiry > 0 ? `Vence en ${daysUntilExpiry} días` : `Expiró hace ${Math.abs(daysUntilExpiry)} días`;
        
        console.log(`   ✅ Sincronizada: ${activeSub.service} - ${status}`);
      }

      // Guardar cambios
      await user.save();
      console.log(`   💾 Usuario guardado exitosamente`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ SINCRONIZACIÓN COMPLETADA');
    console.log('='.repeat(60));
    console.log('\n📝 Ahora el panel de admin debería mostrar las suscripciones correctamente.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
syncSubscriptionsArrays();

