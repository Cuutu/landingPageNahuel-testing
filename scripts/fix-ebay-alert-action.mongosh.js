// ============================================
// SCRIPT: Corregir acción de alerta EBAY de BUY a SELL
// Ejecutar desde MongoDB Compass: Copiar y pegar el contenido en la consola
// ============================================
// ✅ COMPATIBLE CON MONGODB COMPASS
// Este script corrige la acción de la alerta de BUY a SELL
// ============================================

print("\n" + "=".repeat(80));
print("🔧 CORRIGIENDO ACCIÓN DE ALERTA EBAY (BUY → SELL)");
print("=".repeat(80) + "\n");

// ID de la alerta de EBAY
var alertId = "693af6a3e18b882152d11c69";

print(`📋 Buscando alerta con ID: ${alertId}\n`);

// Buscar la alerta
var alert = db.alerts.findOne({ _id: ObjectId(alertId) });

if (!alert) {
  print(`❌ No se encontró la alerta con ID: ${alertId}\n`);
  print("=".repeat(80) + "\n");
} else {
  print(`✅ Alerta encontrada:\n`);
  print(`   Símbolo: ${alert.symbol}`);
  print(`   Acción actual: ${alert.action || 'N/A'}`);
  print(`   Estado: ${alert.status || 'N/A'}`);
  print(`   Tipo: ${alert.tipo || 'N/A'}\n`);
  
  if (alert.action === "SELL") {
    print("ℹ️  La alerta ya tiene acción SELL. No se requiere cambio.\n");
    print("=".repeat(80) + "\n");
  } else {
    print("🔄 Cambiando acción de BUY a SELL...\n");
    
    // Actualizar la acción
    var result = db.alerts.updateOne(
      { _id: ObjectId(alertId) },
      {
        $set: {
          action: "SELL"
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      print("✅ ¡Acción corregida exitosamente!\n");
      print(`   Documentos modificados: ${result.modifiedCount}\n`);
      
      // Verificar el cambio
      var updatedAlert = db.alerts.findOne({ _id: ObjectId(alertId) });
      
      print("📊 VALORES ACTUALIZADOS:");
      print(`   Símbolo: ${updatedAlert.symbol}`);
      print(`   Acción: ${updatedAlert.action}`);
      print(`   Estado: ${updatedAlert.status}`);
      print(`   Tipo: ${updatedAlert.tipo}`);
      print(`   sellRangeMin: ${updatedAlert.sellRangeMin ? '$' + updatedAlert.sellRangeMin.toFixed(2) : 'No definido'}`);
      print(`   sellRangeMax: ${updatedAlert.sellRangeMax ? '$' + updatedAlert.sellRangeMax.toFixed(2) : 'No definido'}\n`);
      
      print("✅ La alerta ahora está correctamente configurada como SELL\n");
    } else {
      print("⚠️  No se modificó ningún documento. Puede que la acción ya sea SELL.\n");
    }
    
    print("=".repeat(80) + "\n");
  }
}

