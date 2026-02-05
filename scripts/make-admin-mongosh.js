// Script de mongosh para asignar rol de admin a un usuario
// 
// USO:
// 1. Conectate a tu base de datos MongoDB:
//    mongosh "mongodb+srv://usuario:password@cluster.mongodb.net/database"
//
// 2. Copia y pega este script completo, reemplazando TU_EMAIL_AQUI con el email del usuario
//
// 3. O ejecuta línea por línea:

// Reemplaza esto con el email del usuario que querés hacer admin
const userEmail = "TU_EMAIL_AQUI";

// Conectar a la base de datos (si no estás conectado)
// use("tu-database-name"); // Descomenta y reemplaza si es necesario

// Buscar el usuario
const user = db.users.findOne({ email: userEmail });

if (!user) {
  print("❌ Usuario no encontrado con email: " + userEmail);
  print("💡 Verifica que el email sea correcto y que el usuario haya hecho login al menos una vez");
} else {
  print("✅ Usuario encontrado:");
  print("   Nombre: " + user.name);
  print("   Email: " + user.email);
  print("   Rol actual: " + (user.role || "normal"));
  
  if (user.role === "admin") {
    print("ℹ️ El usuario ya es administrador");
  } else {
    // Actualizar rol a admin
    const result = db.users.updateOne(
      { email: userEmail },
      { $set: { role: "admin", updatedAt: new Date() } }
    );
    
    if (result.modifiedCount === 1) {
      print("🎉 ¡Usuario promovido a administrador exitosamente!");
      print("📧 Email: " + userEmail);
      print("🔧 Rol nuevo: admin");
      print("📅 Fecha de promoción: " + new Date().toLocaleString());
    } else {
      print("❌ Error al actualizar el usuario");
    }
  }
  
  // Listar todos los administradores
  print("\n👥 Administradores actuales:");
  const admins = db.users.find({ role: "admin" }).toArray();
  admins.forEach((admin, index) => {
    print("   " + (index + 1) + ". " + admin.name + " (" + admin.email + ")");
  });
}
