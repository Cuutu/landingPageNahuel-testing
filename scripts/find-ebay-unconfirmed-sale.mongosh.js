// ============================================
// SCRIPT: Buscar alerta de venta sin confirmar de EBAY
// Ejecutar con: mongosh <connection-string> < find-ebay-unconfirmed-sale.mongosh.js
// O desde mongosh: load('find-ebay-unconfirmed-sale.mongosh.js')
// O desde MongoDB Compass: Copiar y pegar el contenido en la consola
// ============================================
// ✅ COMPATIBLE CON MONGODB COMPASS (no usa quit())
// Este script busca:
// 1. Alertas de EBAY con acción SELL
// 2. Si no encuentra, busca TODAS las alertas de EBAY
// 3. Busca operaciones de venta sin confirmar directamente por ticker
// 4. Muestra información completa de alertas y operaciones
// ============================================

print("\n" + "=".repeat(80));
print("🔍 BUSCANDO ALERTA DE VENTA SIN CONFIRMAR DE EBAY");
print("=".repeat(80) + "\n");

// 1. Buscar alertas de EBAY con acción SELL
print("📋 PASO 1: Buscando alertas de EBAY con acción SELL...\n");

var ebayAlerts = db.alerts.find({
  symbol: { $regex: /^EBAY$/i },
  action: "SELL"
}).sort({ createdAt: -1 }).toArray();

print(`✅ Encontradas ${ebayAlerts.length} alerta(s) de venta de EBAY\n`);

var shouldContinue = true;

if (ebayAlerts.length === 0) {
  print("⚠️  No se encontraron alertas de venta de EBAY");
  print("🔍 Buscando TODAS las alertas de EBAY (sin importar la acción)...\n");
  
  // Buscar todas las alertas de EBAY sin importar la acción
  var allEbayAlerts = db.alerts.find({
    symbol: { $regex: /^EBAY$/i }
  }).sort({ createdAt: -1 }).toArray();
  
  print(`✅ Encontradas ${allEbayAlerts.length} alerta(s) de EBAY en total\n`);
  
  if (allEbayAlerts.length > 0) {
    print("📋 Alertas encontradas:\n");
    allEbayAlerts.forEach(function(alert, index) {
      print(`  ${index + 1}. ID: ${alert._id}`);
      print(`     Acción: ${alert.action || 'N/A'}`);
      print(`     Estado: ${alert.status || 'N/A'}`);
      print(`     Tipo: ${alert.tipo || 'N/A'}`);
      print(`     Fecha: ${alert.createdAt || 'N/A'}`);
      print(`     Precio actual: ${alert.currentPrice ? '$' + alert.currentPrice.toFixed(2) : 'N/A'}`);
      print("");
    });
    ebayAlerts = allEbayAlerts;
  }
  
  // Continuar buscando operaciones de venta de EBAY directamente
  print("🔍 Buscando operaciones de VENTA de EBAY directamente...\n");
  
  var ebaySaleOperations = db.operations.find({
    ticker: { $regex: /^EBAY$/i },
    operationType: "VENTA",
    $or: [
      { isPriceConfirmed: { $ne: true } },
      { isPriceConfirmed: { $exists: false } },
      { priceRange: { $exists: true, $ne: null } },
      { status: "PENDING" }
    ]
  }).sort({ createdAt: -1 }).toArray();
  
  print(`✅ Encontradas ${ebaySaleOperations.length} operación(es) de venta de EBAY sin confirmar\n`);
  
  if (ebaySaleOperations.length > 0) {
    ebaySaleOperations.forEach(function(op, index) {
      print(`\n💼 OPERACIÓN DE VENTA ${index + 1}:`);
      print(`   ID: ${op._id}`);
      print(`   Ticker: ${op.ticker || 'N/A'}`);
      print(`   Precio: ${op.price ? '$' + op.price.toFixed(2) : 'N/A'}`);
      print(`   Cantidad: ${op.quantity || 'N/A'}`);
      print(`   Estado: ${op.status || 'N/A'}`);
      print(`   Precio confirmado: ${op.isPriceConfirmed === true ? 'Sí' : 'No'}`);
      if (op.priceRange) {
        print(`   Rango precio: $${op.priceRange.min ? op.priceRange.min.toFixed(2) : 'N/A'} - $${op.priceRange.max ? op.priceRange.max.toFixed(2) : 'N/A'}`);
      }
      print(`   Alerta ID: ${op.alertId || 'N/A'}`);
      print(`   Creada: ${op.createdAt || 'N/A'}`);
    });
  }
  
  // Si no hay alertas ni operaciones, no continuar
  if (allEbayAlerts.length === 0 && ebaySaleOperations.length === 0) {
    print("\n❌ No se encontraron alertas ni operaciones de EBAY\n");
    print("=".repeat(80) + "\n");
    shouldContinue = false;
  } else if (allEbayAlerts.length > 0) {
    print("\n⚠️  Continuando con todas las alertas de EBAY encontradas...\n");
  }
}

// Solo continuar si hay alertas para procesar
if (shouldContinue && ebayAlerts.length > 0) {
  // Mostrar información de las alertas encontradas
ebayAlerts.forEach(function(alert, index) {
  print("\n" + "-".repeat(80));
  print(`📊 ALERTA ${index + 1}:`);
  print("-".repeat(80));
  print(`ID: ${alert._id}`);
  print(`Símbolo: ${alert.symbol}`);
  print(`Acción: ${alert.action || 'N/A'}`);
  print(`Estado: ${alert.status || 'N/A'}`);
  print(`Tipo: ${alert.tipo || 'N/A'}`);
  print(`Fecha creación: ${alert.createdAt || 'N/A'}`);
  print(`Precio actual: ${alert.currentPrice ? '$' + alert.currentPrice.toFixed(2) : 'N/A'}`);
  print(`Precio final: ${alert.finalPrice ? '$' + alert.finalPrice.toFixed(2) : 'N/A'}`);
  if (alert.action === 'SELL') {
    print(`Rango venta min: ${alert.sellRangeMin ? '$' + alert.sellRangeMin.toFixed(2) : 'N/A'}`);
    print(`Rango venta max: ${alert.sellRangeMax ? '$' + alert.sellRangeMax.toFixed(2) : 'N/A'}`);
    print(`Precio venta fijo: ${alert.sellPrice ? '$' + alert.sellPrice.toFixed(2) : 'N/A'}`);
  }
  print(`Participación: ${alert.participationPercentage || 100}%`);
  print(`Participación original: ${alert.originalParticipationPercentage || 100}%`);
  
  // Verificar si tiene ventas parciales
  if (alert.ventasParciales && alert.ventasParciales.length > 0) {
    print(`\n💰 Ventas parciales (${alert.ventasParciales.length}):`);
    alert.ventasParciales.forEach(function(venta, vIndex) {
      print(`  ${vIndex + 1}. Fecha: ${venta.fecha || 'N/A'}`);
      print(`     Precio: $${venta.precio ? venta.precio.toFixed(2) : 'N/A'}`);
      print(`     Porcentaje: ${venta.porcentajeVendido || 0}%`);
      print(`     Ganancia: $${venta.gananciaRealizada ? venta.gananciaRealizada.toFixed(2) : '0.00'}`);
    });
  }
  
  // Verificar liquidityData
  if (alert.liquidityData) {
    print(`\n💧 Liquidez:`);
    print(`  Asignada: $${alert.liquidityData.allocatedAmount ? alert.liquidityData.allocatedAmount.toFixed(2) : '0.00'}`);
    print(`  Acciones: ${alert.liquidityData.shares ? alert.liquidityData.shares.toFixed(4) : '0'}`);
    print(`  Precio entrada: $${alert.liquidityData.entryPrice ? alert.liquidityData.entryPrice.toFixed(2) : 'N/A'}`);
    
    if (alert.liquidityData.partialSales && alert.liquidityData.partialSales.length > 0) {
      print(`  Ventas programadas: ${alert.liquidityData.partialSales.length}`);
      alert.liquidityData.partialSales.forEach(function(sale, sIndex) {
        print(`    ${sIndex + 1}. Porcentaje: ${sale.percentage || 0}%`);
        print(`       Ejecutada: ${sale.executed ? 'Sí' : 'No'}`);
        print(`       Fecha ejecución: ${sale.executedAt || 'Pendiente'}`);
        print(`       Rango precio: $${sale.priceRange?.min || 'N/A'} - $${sale.priceRange?.max || 'N/A'}`);
      });
    }
  }
});

// 2. Buscar operaciones de venta sin confirmar asociadas a estas alertas
print("\n\n" + "=".repeat(80));
print("📋 PASO 2: Buscando operaciones de venta SIN CONFIRMAR asociadas...");
print("=".repeat(80) + "\n");

var alertIds = ebayAlerts.map(function(a) { return a._id; });

var unconfirmedOperations = db.operations.find({
  alertId: { $in: alertIds },
  operationType: "VENTA",
  $or: [
    { isPriceConfirmed: { $ne: true } },
    { isPriceConfirmed: { $exists: false } },
    { priceRange: { $exists: true, $ne: null } }
  ]
}).sort({ createdAt: -1 }).toArray();

print(`✅ Encontradas ${unconfirmedOperations.length} operación(es) de venta sin confirmar\n`);

if (unconfirmedOperations.length === 0) {
  print("⚠️  No se encontraron operaciones de venta sin confirmar para estas alertas\n");
} else {
  unconfirmedOperations.forEach(function(op, index) {
    print("\n" + "-".repeat(80));
    print(`💼 OPERACIÓN ${index + 1} (SIN CONFIRMAR):`);
    print("-".repeat(80));
    print(`ID: ${op._id}`);
    print(`Ticker: ${op.ticker || 'N/A'}`);
    print(`Tipo: ${op.operationType || 'N/A'}`);
    print(`Sistema: ${op.system || 'N/A'}`);
    print(`Precio: ${op.price ? '$' + op.price.toFixed(2) : 'N/A'}`);
    print(`Cantidad: ${op.quantity || 'N/A'}`);
    print(`Monto: ${op.amount ? '$' + op.amount.toFixed(2) : 'N/A'}`);
    print(`Fecha: ${op.date || 'N/A'}`);
    print(`Estado: ${op.status || 'N/A'}`);
    print(`Precio confirmado: ${op.isPriceConfirmed === true ? 'Sí' : 'No'}`);
    
    if (op.priceRange) {
      print(`Rango precio: $${op.priceRange.min ? op.priceRange.min.toFixed(2) : 'N/A'} - $${op.priceRange.max ? op.priceRange.max.toFixed(2) : 'N/A'}`);
    }
    
    print(`Venta parcial: ${op.isPartialSale ? 'Sí' : 'No'}`);
    if (op.partialSalePercentage) {
      print(`Porcentaje venta: ${op.partialSalePercentage}%`);
    }
    
    print(`Notas: ${op.notes || 'N/A'}`);
    print(`Creada: ${op.createdAt || 'N/A'}`);
    print(`Actualizada: ${op.updatedAt || 'N/A'}`);
    
    // Buscar la alerta asociada
    var associatedAlert = ebayAlerts.find(function(a) {
      return a._id.toString() === op.alertId.toString();
    });
    
    if (associatedAlert) {
      print(`\n🔗 Alerta asociada:`);
      print(`   ID: ${associatedAlert._id}`);
      print(`   Estado: ${associatedAlert.status || 'N/A'}`);
      print(`   Precio actual: ${associatedAlert.currentPrice ? '$' + associatedAlert.currentPrice.toFixed(2) : 'N/A'}`);
    }
  });
}

// 3. Buscar operaciones de venta pendientes (status: PENDING)
print("\n\n" + "=".repeat(80));
print("📋 PASO 3: Buscando operaciones de venta con STATUS PENDING...");
print("=".repeat(80) + "\n");

var pendingOperations = db.operations.find({
  alertId: { $in: alertIds },
  operationType: "VENTA",
  status: "PENDING"
}).sort({ createdAt: -1 }).toArray();

print(`✅ Encontradas ${pendingOperations.length} operación(es) con status PENDING\n`);

if (pendingOperations.length > 0) {
  pendingOperations.forEach(function(op, index) {
    print(`\n⏳ PENDING ${index + 1}: ${op.ticker || 'N/A'} - Precio: $${op.price ? op.price.toFixed(2) : 'N/A'} - ID: ${op._id}`);
  });
}

// 4. Resumen final
print("\n\n" + "=".repeat(80));
print("📊 RESUMEN FINAL");
print("=".repeat(80));
print(`Total alertas EBAY SELL encontradas: ${ebayAlerts.length}`);
print(`Total operaciones sin confirmar: ${unconfirmedOperations.length}`);
print(`Total operaciones PENDING: ${pendingOperations.length}`);

if (unconfirmedOperations.length > 0 || pendingOperations.length > 0) {
  print("\n⚠️  HAY OPERACIONES DE VENTA SIN CONFIRMAR O PENDIENTES");
  print("\nPara confirmar una operación, puedes ejecutar:");
  print("  db.operations.updateOne(");
  print("    { _id: ObjectId('OPERATION_ID') },");
  print("    { $set: { isPriceConfirmed: true, priceRange: null } }");
  print("  )");
} else {
  print("\n✅ No hay operaciones de venta sin confirmar");
}

print("\n" + "=".repeat(80) + "\n");
}

