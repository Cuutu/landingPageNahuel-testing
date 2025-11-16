/**
 * Script para debugear suscripciones de un usuario específico
 */

const mongoose = require('mongoose');

// MongoDB URI directa
const MONGODB_URI = 'mongodb+srv://Tortu:Las40org@landingpagenahuel.pdccomn.mongodb.net/?retryWrites=true&w=majority&appName=landingPageNahuel';

const UserSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: { type: String, required: true, unique: true },
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

const PaymentSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  userEmail: String,
  service: String,
  amount: Number,
  status: String,
  externalReference: String,
  mercadopagoPaymentId: String,
  transactionDate: Date,
  expiryDate: Date,
}, { timestamps: true });

const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);

async function debugUserSubscriptions() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const email = 'franco.l.varela99@gmail.com'; // Tu email

    console.log(`🔍 Buscando usuario: ${email}\n`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('✅ Usuario encontrado');
    console.log('='.repeat(80));
    console.log('INFORMACIÓN DEL USUARIO');
    console.log('='.repeat(80));
    console.log(`Nombre: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Rol: ${user.role}`);
    console.log(`\n📅 FECHAS GENERALES:`);
    console.log(`  subscriptionExpiry: ${user.subscriptionExpiry}`);
    console.log(`  lastPaymentDate: ${user.lastPaymentDate}`);

    console.log('\n' + '='.repeat(80));
    console.log('ACTIVE SUBSCRIPTIONS (MercadoPago)');
    console.log('='.repeat(80));
    if (user.activeSubscriptions && user.activeSubscriptions.length > 0) {
      user.activeSubscriptions.forEach((sub, index) => {
        console.log(`\n[${index + 1}] ${sub.service}`);
        console.log(`  Activa: ${sub.isActive}`);
        console.log(`  Inicio: ${sub.startDate}`);
        console.log(`  Expira: ${sub.expiryDate}`);
        console.log(`  Monto: $${sub.amount} ${sub.currency}`);
        console.log(`  Payment ID: ${sub.mercadopagoPaymentId}`);
      });
    } else {
      console.log('Sin activeSubscriptions');
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUBSCRIPTIONS (Admin)');
    console.log('='.repeat(80));
    if (user.subscriptions && user.subscriptions.length > 0) {
      user.subscriptions.forEach((sub, index) => {
        console.log(`\n[${index + 1}] ${sub.tipo}`);
        console.log(`  Activa: ${sub.activa}`);
        console.log(`  Inicio: ${sub.fechaInicio}`);
        console.log(`  Fin: ${sub.fechaFin}`);
        console.log(`  Precio: $${sub.precio}`);
      });
    } else {
      console.log('Sin subscriptions');
    }

    // Buscar pagos recientes
    console.log('\n' + '='.repeat(80));
    console.log('ÚLTIMOS 10 PAGOS');
    console.log('='.repeat(80));
    const payments = await Payment.find({ userEmail: email })
      .sort({ createdAt: -1 })
      .limit(10);

    if (payments.length > 0) {
      payments.forEach((payment, index) => {
        console.log(`\n[${index + 1}] ${payment.service}`);
        console.log(`  Estado: ${payment.status}`);
        console.log(`  Monto: $${payment.amount}`);
        console.log(`  Fecha: ${payment.transactionDate}`);
        console.log(`  External Ref: ${payment.externalReference}`);
        console.log(`  MP Payment ID: ${payment.mercadopagoPaymentId}`);
        console.log(`  Created At: ${payment.createdAt}`);
      });
    } else {
      console.log('Sin pagos registrados');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ DEBUG COMPLETADO');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

debugUserSubscriptions();

