const mongoose = require('mongoose');
require('dotenv').config();

// Conectar a MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/landing-page-nahuel');
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Esquema de Usuario
const UserSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: { type: String, unique: true },
  picture: String,
  role: {
    type: String,
    enum: ['normal', 'suscriptor', 'admin'],
    default: 'normal'
  },
  // ... otros campos
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Función para forzar actualización de sesión
async function forceSessionUpdate() {
  try {
    await connectDB();

    const email = 'saramaieluno@gmail.com';
    
    console.log('🔍 Verificando usuario:', email);
    
    // Buscar usuario
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ Usuario no encontrado:', email);
      process.exit(1);
    }

    console.log('👤 Usuario encontrado:');
    console.log('   - Nombre:', user.name);
    console.log('   - Email:', user.email);
    console.log('   - Rol actual:', user.role);
    console.log('   - Última actualización:', user.updatedAt);

    // Verificar que sea admin
    if (user.role !== 'admin') {
      console.log('❌ El usuario no tiene rol de admin en la base de datos');
      console.log('💡 Ejecuta primero: node scripts/setup-admin.js saramaieluno@gmail.com');
      process.exit(1);
    }

    // Forzar actualización del timestamp para invalidar cachés
    user.updatedAt = new Date();
    await user.save();

    console.log('✅ Usuario actualizado en la base de datos');
    console.log('🔄 Timestamp actualizado:', user.updatedAt);
    
    console.log('\n📋 Próximos pasos:');
    console.log('1. Cierra completamente el navegador');
    console.log('2. Borra las cookies del sitio');
    console.log('3. Vuelve a hacer login');
    console.log('4. O visita: /api/auth/signin?callbackUrl=/admin');
    
    console.log('\n🔧 Alternativa - Forzar logout/login:');
    console.log('1. Visita: /api/auth/signout');
    console.log('2. Luego visita: /api/auth/signin?callbackUrl=/admin');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
forceSessionUpdate();
