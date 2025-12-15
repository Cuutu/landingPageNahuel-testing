// ============================================
// CONSULTA CON AGREGACIÓN: Operaciones "A confirmar" con alertas
// Más eficiente y muestra toda la información junta
// ============================================

db.operations.aggregate([
  // 1. Filtrar operaciones "A confirmar"
  {
    $match: {
      operationType: "COMPRA",
      $or: [
        { priceRange: { $exists: true, $ne: null }, isPriceConfirmed: { $ne: true } },
        { alertId: { $exists: false }, isPriceConfirmed: { $ne: true } }
      ]
    }
  },
  // 2. Ordenar por fecha
  {
    $sort: { createdAt: -1 }
  },
  // 3. Hacer lookup de la alerta
  {
    $lookup: {
      from: "alerts",
      localField: "alertId",
      foreignField: "_id",
      as: "alert"
    }
  },
  // 4. Desenrollar el array de alerta (solo habrá 0 o 1)
  {
    $unwind: {
      path: "$alert",
      preserveNullAndEmptyArrays: true
    }
  },
  // 5. Proyectar solo los campos necesarios
  {
    $project: {
      ticker: 1,
      system: 1,
      price: 1,
      priceRange: 1,
      isPriceConfirmed: 1,
      status: 1,
      alertId: 1,
      createdAt: 1,
      "alert.symbol": 1,
      "alert.status": 1,
      "alert.availableForPurchase": 1,
      "alert.finalPriceSetAt": 1,
      "alert.currentPrice": 1,
      "alert.finalPrice": 1,
      "alert.date": 1,
      "alert.createdAt": 1,
      "alert.entryPriceRange": 1,
      "alert.precioMinimo": 1,
      "alert.precioMaximo": 1
    }
  }
]).forEach(function(op) {
  print("\n" + "=".repeat(60));
  print(`📊 OPERACIÓN: ${op.ticker}`);
  print("=".repeat(60));
  print(`ID: ${op._id}`);
  print(`Sistema: ${op.system || 'N/A'}`);
  print(`Precio: $${op.price || 'N/A'}`);
  print(`PriceRange: ${op.priceRange ? `$${op.priceRange.min} - $${op.priceRange.max}` : '❌ NO TIENE'}`);
  print(`isPriceConfirmed: ${op.isPriceConfirmed === true ? '✅ SÍ' : '❌ NO'}`);
  print(`Status operación: ${op.status || 'N/A'}`);
  print(`AlertId: ${op.alertId || '❌ NO TIENE'}`);
  print(`Creada: ${op.createdAt}`);
  
  if (op.alert) {
    print(`\n📈 ALERTA ASOCIADA:`);
    print(`  Símbolo: ${op.alert.symbol || 'N/A'}`);
    print(`  Status: ${op.alert.status || 'N/A'}`);
    print(`  availableForPurchase: ${op.alert.availableForPurchase === true ? '✅ SÍ' : '❌ NO'}`);
    print(`  finalPriceSetAt: ${op.alert.finalPriceSetAt || '❌ NO'}`);
    print(`  Precio actual: $${op.alert.currentPrice || 'N/A'}`);
    print(`  Precio final: $${op.alert.finalPrice || 'N/A'}`);
    print(`  Fecha alerta: ${op.alert.date || op.alert.createdAt || 'N/A'}`);
    
    var alertHasRange = (op.alert.entryPriceRange && op.alert.entryPriceRange.min && op.alert.entryPriceRange.max) ||
                        (op.alert.precioMinimo && op.alert.precioMaximo);
    print(`  Alerta tiene range: ${alertHasRange ? '✅ SÍ' : '❌ NO'}`);
    if (alertHasRange) {
      if (op.alert.entryPriceRange) {
        print(`    Range: $${op.alert.entryPriceRange.min} - $${op.alert.entryPriceRange.max}`);
      } else {
        print(`    Range: $${op.alert.precioMinimo} - $${op.alert.precioMaximo}`);
      }
    }
    
    // Análisis de por qué aparece "A confirmar"
    print(`\n🔍 ANÁLISIS:`);
    if (op.priceRange && op.isPriceConfirmed !== true) {
      print(`  ✅ RAZÓN: Tiene priceRange sin confirmar`);
      print(`     → Debería confirmarse automáticamente cuando el precio esté en rango`);
    } else if (!op.alertId) {
      print(`  ✅ RAZÓN: No tiene alerta asociada`);
      print(`     → Puede ser una operación manual o alerta eliminada`);
    } else if (op.alert.status === 'ACTIVE' && op.alert.availableForPurchase === true && !op.priceRange) {
      print(`  ✅ RAZÓN: Alerta activa con availableForPurchase=true, sin priceRange`);
      print(`     → Según lógica frontend, debería aparecer como "A confirmar"`);
    } else {
      print(`  ⚠️ RAZÓN DESCONOCIDA`);
      print(`     → Revisar lógica del frontend en getOperationStatus()`);
    }
  } else {
    print(`\n⚠️ NO TIENE ALERTA ASOCIADA`);
    if (!op.alertId) {
      print(`  → Operación sin alertId (puede ser manual o antigua)`);
    } else {
      print(`  → Alerta no encontrada (puede haber sido eliminada)`);
    }
  }
  
  print("\n");
});

print("\n" + "=".repeat(60));
print("✅ Consulta completada");
print("=".repeat(60));

