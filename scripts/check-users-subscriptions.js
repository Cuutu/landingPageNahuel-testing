/**
 * Script para verificar el estado de las suscripciones de usuarios específicos
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

async function checkUsersSubscriptions() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Emails a verificar
    const testEmails = [
      'franco.l.varela99@gmail.com',
      'lozanonahuel@gmail.com',
      'nlozano@lozanonahuel.com'
    ];

    console.log('🔍 Verificando usuarios...\n');

    for (const email of testEmails) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📧 Email: ${email}`);
      console.log('='.repeat(60));

      const user = await User.findOne({ email });

      if (!user) {
        console.log('❌ Usuario NO encontrado en la base de datos\n');
        continue;
      }

      console.log(`✅ Usuario encontrado:`);
      console.log(`   • Nombre: ${user.name}`);
      console.log(`   • Rol: ${user.role}`);
      console.log(`   • Google ID: ${user.googleId}`);
      console.log(`\n📦 activeSubscriptions (${user.activeSubscriptions?.length || 0}):`);
      
      if (user.activeSubscriptions && user.activeSubscriptions.length > 0) {
        user.activeSubscriptions.forEach((sub, index) => {
          console.log(`\n   Suscripción ${index + 1}:`);
          console.log(`      - Servicio: ${sub.service}`);
          console.log(`      - Activa: ${sub.isActive}`);
          console.log(`      - Inicio: ${sub.startDate?.toLocaleString() || 'N/A'}`);
          console.log(`      - Expira: ${sub.expiryDate?.toLocaleString() || 'N/A'}`);
          console.log(`      - Monto: ${sub.amount} ${sub.currency}`);
          console.log(`      - Payment ID: ${sub.mercadopagoPaymentId || 'N/A'}`);
          
          const now = new Date();
          const daysUntilExpiry = Math.ceil((sub.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`      - Estado: ${daysUntilExpiry > 0 ? `Vence en ${daysUntilExpiry} días` : `❌ Expiró hace ${Math.abs(daysUntilExpiry)} días`}`);
        });
      } else {
        console.log('   ⚠️  Sin suscripciones en activeSubscriptions');
      }

      console.log(`\n📦 subscriptions (admin) (${user.subscriptions?.length || 0}):`);
      
      if (user.subscriptions && user.subscriptions.length > 0) {
        user.subscriptions.forEach((sub, index) => {
          console.log(`\n   Suscripción ${index + 1}:`);
          console.log(`      - Tipo: ${sub.tipo}`);
          console.log(`      - Activa: ${sub.activa}`);
          console.log(`      - Inicio: ${sub.fechaInicio?.toLocaleString() || 'N/A'}`);
          console.log(`      - Fin: ${sub.fechaFin?.toLocaleString() || 'N/A'}`);
          console.log(`      - Precio: ${sub.precio}`);
        });
      } else {
        console.log('   ⚠️  Sin suscripciones en subscriptions (admin)');
      }

      console.log(`\n⏰ Fechas generales:`);
      console.log(`   • subscriptionExpiry: ${user.subscriptionExpiry?.toLocaleString() || 'N/A'}`);
      console.log(`   • lastPaymentDate: ${user.lastPaymentDate?.toLocaleString() || 'N/A'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICACIÓN COMPLETADA');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
checkUsersSubscriptions();

