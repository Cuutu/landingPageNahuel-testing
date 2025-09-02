const { MongoClient } = require('mongodb');

async function checkUserRole() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/landingPageNahuel';
  
  try {
    console.log('🔍 Conectando a MongoDB...');
    const client = new MongoClient(uri);
    await client.connect();
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Buscar usuario por email
    const userEmail = 'joaquinperez028@gmail.com'; // Cambiar por el email que quieras verificar
    
    console.log(`🔍 Buscando usuario: ${userEmail}`);
    
    const user = await usersCollection.findOne({ email: userEmail });
    
    if (user) {
      console.log('✅ Usuario encontrado:');
      console.log('   - Email:', user.email);
      console.log('   - Nombre:', user.name);
      console.log('   - Rol:', user.role);
      console.log('   - Google ID:', user.googleId);
      console.log('   - Creado:', user.createdAt);
      console.log('   - Último login:', user.lastLogin);
      
      // Verificar si tiene suscripciones
      if (user.suscripciones && user.suscripciones.length > 0) {
        console.log('   - Suscripciones (legacy):', user.suscripciones.length);
        user.suscripciones.forEach((sub, index) => {
          console.log(`     ${index + 1}. ${sub.servicio} - Activa: ${sub.activa} - Vence: ${sub.fechaVencimiento}`);
        });
      }
      
      if (user.subscriptions && user.subscriptions.length > 0) {
        console.log('   - Subscriptions (nuevo):', user.subscriptions.length);
        user.subscriptions.forEach((sub, index) => {
          console.log(`     ${index + 1}. ${sub.tipo} - Activa: ${sub.activa} - Vence: ${sub.fechaFin || 'Sin fecha fin'}`);
        });
      }
      
    } else {
      console.log('❌ Usuario no encontrado');
    }
    
    // Mostrar todos los usuarios con rol admin
    console.log('\n👑 Usuarios con rol admin:');
    const adminUsers = await usersCollection.find({ role: 'admin' }).toArray();
    
    if (adminUsers.length > 0) {
      adminUsers.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.email} - ${admin.name} - Rol: ${admin.role}`);
      });
    } else {
      console.log('   No hay usuarios admin');
    }
    
    await client.close();
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  checkUserRole();
}

module.exports = { checkUserRole }; 