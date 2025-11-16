/**
 * Script para corregir las fechas de suscripción incorrectas
 */

const mongoose = require('mongoose');

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

async function fixSubscriptionDates() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const email = 'franco.l.varela99@gmail.com';
    
    console.log(`🔍 Corrigiendo suscripciones para: ${email}\n`);
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('📋 SUSCRIPCIONES ANTES DE CORREGIR:');
    user.activeSubscriptions.forEach((sub, i) => {
      console.log(`  ${i+1}. ${sub.service}: ${sub.startDate} -> ${sub.expiryDate}`);
    });

    // El último pago fue el 16/11/2025 18:29 por TraderCall
    // Debería dar 30 días de acceso desde esa fecha
    const lastPaymentDate = new Date('2025-11-16T18:29:00');
    const correctExpiryDate = new Date(lastPaymentDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    console.log(`\n✏️  CORRECCIÓN:`);
    console.log(`  Fecha de pago: ${lastPaymentDate.toLocaleString()}`);
    console.log(`  Nueva expiración: ${correctExpiryDate.toLocaleString()}`);

    // Limpiar suscripciones y establecer solo las correctas
    user.activeSubscriptions = [
      {
        service: 'TraderCall',
        startDate: lastPaymentDate,
        expiryDate: correctExpiryDate,
        isActive: true,
        mercadopagoPaymentId: '133507304271',
        amount: 11,
        currency: 'ARS'
      }
    ];

    user.subscriptions = [
      {
        tipo: 'TraderCall',
        precio: 11,
        fechaInicio: lastPaymentDate,
        fechaFin: correctExpiryDate,
        activa: true
      }
    ];

    user.subscriptionExpiry = correctExpiryDate;
    user.lastPaymentDate = lastPaymentDate;

    await user.save();

    console.log('\n✅ SUSCRIPCIONES CORREGIDAS:');
    user.activeSubscriptions.forEach((sub, i) => {
      console.log(`  ${i+1}. ${sub.service}: ${sub.startDate.toLocaleString()} -> ${sub.expiryDate.toLocaleString()}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ CORRECCIÓN COMPLETADA');
    console.log('='.repeat(80));
    console.log(`\n📅 Tu suscripción ahora expira el: ${correctExpiryDate.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

fixSubscriptionDates();

