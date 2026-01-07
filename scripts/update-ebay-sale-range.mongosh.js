// ============================================
// SCRIPT: Actualizar rango de venta de alerta EBAY
// Ejecutar desde MongoDB Compass: Copiar y pegar el contenido en la consola
// ============================================
// ✅ COMPATIBLE CON MONGODB COMPASS
// Este script actualiza:
// 1. sellRangeMin y sellRangeMax en la alerta
// 2. El rango de precio en liquidityData.partialSales (si existe)
// ============================================

print("\n" + "=".repeat(80));
print("🔄 ACTUALIZANDO RANGO DE VENTA DE ALERTA EBAY");
print("=".repeat(80) + "\n");

// ID de la alerta de EBAY encontrada
var alertId = "693af6a3e18b882152d11c69";
var newMinPrice = 90.00;
var newMaxPrice = 93.00;

print(`📋 Buscando alerta con ID: ${alertId}\n`);

// Buscar la alerta
var alert = db.alerts.findOne({ _id: ObjectId(alertId) });

if (!alert) {
  print(`❌ No se encontró la alerta con ID: ${alertId}\n`);
  print("=".repeat(80) + "\n");
} else {
  print(`✅ Alerta encontrada: ${alert.symbol} - ${alert.action || 'N/A'}\n`);
  
  // Mostrar valores actuales
  print("📊 VALORES ACTUALES:");
  print(`   sellRangeMin: ${alert.sellRangeMin ? '$' + alert.sellRangeMin.toFixed(2) : 'No definido'}`);
  print(`   sellRangeMax: ${alert.sellRangeMax ? '$' + alert.sellRangeMax.toFixed(2) : 'No definido'}`);
  
  if (alert.liquidityData && alert.liquidityData.partialSales) {
    print(`   Ventas parciales programadas: ${alert.liquidityData.partialSales.length}`);
    alert.liquidityData.partialSales.forEach(function(sale, index) {
      if (sale.priceRange) {
        print(`     ${index + 1}. Rango: $${sale.priceRange.min || 'N/A'} - $${sale.priceRange.max || 'N/A'}`);
      }
    });
  }
  
  print(`\n🔄 ACTUALIZANDO A:`);
  print(`   sellRangeMin: $${newMinPrice.toFixed(2)}`);
  print(`   sellRangeMax: $${newMaxPrice.toFixed(2)}\n`);
  
  // Preparar la actualización
  var updateData = {
    $set: {
      sellRangeMin: newMinPrice,
      sellRangeMax: newMaxPrice
    }
  };
  
  // Si hay ventas parciales programadas, actualizar también sus rangos
  if (alert.liquidityData && alert.liquidityData.partialSales && alert.liquidityData.partialSales.length > 0) {
    print("📝 Actualizando rangos en ventas parciales programadas...\n");
    
    // Actualizar cada venta parcial que tenga priceRange
    var partialSales = alert.liquidityData.partialSales.map(function(sale) {
      if (sale.priceRange) {
        return {
          ...sale,
          priceRange: {
            min: newMinPrice,
            max: newMaxPrice
          }
        };
      }
      return sale;
    });
    
    updateData.$set["liquidityData.partialSales"] = partialSales;
    print(`   ✅ ${partialSales.length} venta(s) parcial(es) actualizada(s)\n`);
  }
  
  // Si hay sellPrice, eliminarlo para que use el rango
  if (alert.sellPrice) {
    print("⚠️  La alerta tiene un precio fijo (sellPrice). Se eliminará para usar el rango.\n");
    updateData.$unset = { sellPrice: "" };
  }
  
  // Ejecutar la actualización
  print("💾 Ejecutando actualización...\n");
  
  var result = db.alerts.updateOne(
    { _id: ObjectId(alertId) },
    updateData
  );
  
  if (result.modifiedCount > 0) {
    print("✅ ¡Actualización exitosa!\n");
    print(`   Documentos modificados: ${result.modifiedCount}\n`);
    
    // Verificar los valores actualizados
    var updatedAlert = db.alerts.findOne({ _id: ObjectId(alertId) });
    
    print("📊 VALORES ACTUALIZADOS:");
    print(`   sellRangeMin: ${updatedAlert.sellRangeMin ? '$' + updatedAlert.sellRangeMin.toFixed(2) : 'No definido'}`);
    print(`   sellRangeMax: ${updatedAlert.sellRangeMax ? '$' + updatedAlert.sellRangeMax.toFixed(2) : 'No definido'}`);
    
    if (updatedAlert.liquidityData && updatedAlert.liquidityData.partialSales) {
      print(`   Ventas parciales programadas: ${updatedAlert.liquidityData.partialSales.length}`);
      updatedAlert.liquidityData.partialSales.forEach(function(sale, index) {
        if (sale.priceRange) {
          print(`     ${index + 1}. Rango: $${sale.priceRange.min || 'N/A'} - $${sale.priceRange.max || 'N/A'}`);
        }
      });
    }
    
    // También actualizar la operación de venta pendiente si existe
    print("\n🔍 Buscando operación de venta asociada para actualizar...\n");
    
    var operation = db.operations.findOne({
      alertId: ObjectId(alertId),
      operationType: "VENTA",
      isPriceConfirmed: { $ne: true }
    });
    
    if (operation) {
      print(`✅ Operación encontrada: ${operation._id}\n`);
      print(`   Rango actual: $${operation.priceRange?.min || 'N/A'} - $${operation.priceRange?.max || 'N/A'}\n`);
      
      var operationUpdate = db.operations.updateOne(
        { _id: operation._id },
        {
          $set: {
            "priceRange.min": newMinPrice,
            "priceRange.max": newMaxPrice
          }
        }
      );
      
      if (operationUpdate.modifiedCount > 0) {
        print("✅ Operación de venta actualizada también\n");
      }
    } else {
      print("ℹ️  No se encontró operación de venta pendiente para actualizar\n");
    }
    
  } else {
    print("⚠️  No se modificó ningún documento. Puede que los valores ya estén actualizados.\n");
  }
  
  print("=".repeat(80) + "\n");
}

