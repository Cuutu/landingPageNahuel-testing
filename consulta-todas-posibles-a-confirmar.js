// ============================================
// CONSULTA COMPLETA: Todas las operaciones que PODRÍAN aparecer como "A confirmar"
// Replica la lógica exacta del frontend
// ============================================

print("\n" + "=".repeat(70));
print("🔍 BUSCANDO TODAS LAS OPERACIONES QUE PODRÍAN ESTAR 'A CONFIRMAR'");
print("=".repeat(70) + "\n");

// Buscar TODAS las operaciones de compra (sin filtros estrictos)
var allOps = db.operations.find({
  operationType: "COMPRA"
}, {
  ticker: 1,
  priceRange: 1,
  isPriceConfirmed: 1,
  price: 1,
  alertId: 1,
  status: 1,
  createdAt: 1,
  system: 1,
  date: 1
}).sort({ createdAt: -1 }).toArray();

print(`Total operaciones de COMPRA encontradas: ${allOps.length}\n`);

var posiblesAConfirmar = [];

allOps.forEach(function(op) {
  // Replicar la lógica del frontend: hasValidPriceRange
  var hasValidPriceRange = op.priceRange && 
    typeof op.priceRange.min === 'number' && 
    typeof op.priceRange.max === 'number' &&
    op.priceRange.min > 0 && 
    op.priceRange.max > 0;
  
  // Caso 1: Tiene priceRange válido y NO está confirmado
  var caso1 = hasValidPriceRange && op.isPriceConfirmed !== true;
  
  // Caso 2: No tiene alerta (pero esto solo aplica si NO tiene priceRange válido)
  var caso2 = !op.alertId && !hasValidPriceRange;
  
  // Caso 3: Tiene alerta pero necesitamos verificar su estado
  var caso3 = false;
  var alert = null;
  
  if (op.alertId) {
    alert = db.alerts.findOne({ _id: op.alertId }, {
      symbol: 1,
      status: 1,
      availableForPurchase: 1,
      finalPriceSetAt: 1,
      descartadaAt: 1,
      currentPrice: 1,
      finalPrice: 1,
      date: 1,
      createdAt: 1
    });
    
    if (alert) {
      // Según la lógica del frontend, solo es "A confirmar" si tiene priceRange sin confirmar
      // Las alertas activas sin priceRange son "Ejecutada"
      caso3 = hasValidPriceRange && op.isPriceConfirmed !== true;
    }
  }
  
  // Si cumple alguno de los casos, agregarlo a la lista
  if (caso1 || caso2 || caso3) {
    posiblesAConfirmar.push({
      operation: op,
      alert: alert,
      razon: caso1 ? 'Tiene priceRange sin confirmar' : 
             caso2 ? 'No tiene alerta' : 
             caso3 ? 'Tiene priceRange sin confirmar (con alerta)' : 'Desconocida'
    });
  }
});

print(`\n📊 OPERACIONES QUE PODRÍAN APARECER COMO "A CONFIRMAR": ${posiblesAConfirmar.length}\n`);

if (posiblesAConfirmar.length === 0) {
  print("✅ No se encontraron operaciones que deberían estar 'A confirmar'");
  print("\n⚠️ Si en el frontend SÍ aparecen como 'A confirmar', el problema puede ser:");
  print("   1. Las alertas no se están populando correctamente");
  print("   2. Hay un problema con la validación de priceRange en el frontend");
  print("   3. El campo isPriceConfirmed tiene valores inesperados (null, undefined, etc.)");
} else {
  posiblesAConfirmar.forEach(function(item, index) {
    var op = item.operation;
    var alert = item.alert;
    
    print("\n" + "=".repeat(70));
    print(`OPERACIÓN ${index + 1}: ${op.ticker}`);
    print("=".repeat(70));
    print(`ID: ${op._id}`);
    print(`Sistema: ${op.system || 'N/A'}`);
    print(`Precio: $${op.price || 'N/A'}`);
    print(`PriceRange: ${op.priceRange ? `$${op.priceRange.min} - $${op.priceRange.max}` : '❌ NO TIENE'}`);
    print(`isPriceConfirmed: ${op.isPriceConfirmed === true ? '✅ true' : op.isPriceConfirmed === false ? '❌ false' : `⚠️ ${op.isPriceConfirmed} (${typeof op.isPriceConfirmed})`}`);
    print(`Status operación: ${op.status || 'N/A'}`);
    print(`AlertId: ${op.alertId || '❌ NO TIENE'}`);
    print(`Fecha operación: ${op.date || op.createdAt}`);
    print(`Creada: ${op.createdAt}`);
    print(`\n🔍 RAZÓN: ${item.razon}`);
    
    // Validar priceRange según lógica frontend
    var hasValidPriceRange = op.priceRange && 
      typeof op.priceRange.min === 'number' && 
      typeof op.priceRange.max === 'number' &&
      op.priceRange.min > 0 && 
      op.priceRange.max > 0;
    
    print(`\n📋 VALIDACIÓN:`);
    print(`  priceRange existe: ${op.priceRange ? '✅' : '❌'}`);
    if (op.priceRange) {
      print(`  priceRange.min es number: ${typeof op.priceRange.min === 'number' ? '✅' : '❌'} (valor: ${op.priceRange.min}, tipo: ${typeof op.priceRange.min})`);
      print(`  priceRange.max es number: ${typeof op.priceRange.max === 'number' ? '✅' : '❌'} (valor: ${op.priceRange.max}, tipo: ${typeof op.priceRange.max})`);
      print(`  priceRange.min > 0: ${op.priceRange.min > 0 ? '✅' : '❌'}`);
      print(`  priceRange.max > 0: ${op.priceRange.max > 0 ? '✅' : '❌'}`);
    }
    print(`  hasValidPriceRange (frontend): ${hasValidPriceRange ? '✅' : '❌'}`);
    print(`  isPriceConfirmed !== true: ${op.isPriceConfirmed !== true ? '✅' : '❌'}`);
    
    if (alert) {
      print(`\n📈 ALERTA ASOCIADA:`);
      print(`  Símbolo: ${alert.symbol || 'N/A'}`);
      print(`  Status: ${alert.status || 'N/A'}`);
      print(`  availableForPurchase: ${alert.availableForPurchase === true ? '✅ SÍ' : '❌ NO'}`);
      print(`  finalPriceSetAt: ${alert.finalPriceSetAt || '❌ NO'}`);
      print(`  Precio actual: $${alert.currentPrice || 'N/A'}`);
      print(`  Precio final: $${alert.finalPrice || 'N/A'}`);
      print(`  Fecha alerta: ${alert.date || alert.createdAt || 'N/A'}`);
    } else if (op.alertId) {
      print(`\n⚠️ ALERTA NO ENCONTRADA (ID: ${op.alertId})`);
    } else {
      print(`\n⚠️ NO TIENE ALERTA ASOCIADA`);
    }
    
    print("\n");
  });
}

// También buscar operaciones con isPriceConfirmed en estados inesperados
print("\n" + "=".repeat(70));
print("🔍 BUSCANDO OPERACIONES CON isPriceConfirmed EN ESTADOS INESPERADOS");
print("=".repeat(70) + "\n");

var opsInesperadas = db.operations.find({
  operationType: "COMPRA",
  $or: [
    { isPriceConfirmed: null },
    { isPriceConfirmed: { $exists: false } },
    { isPriceConfirmed: "" },
    { priceRange: { $exists: true, $ne: null }, isPriceConfirmed: { $ne: true, $ne: false } }
  ]
}, {
  ticker: 1,
  priceRange: 1,
  isPriceConfirmed: 1,
  price: 1,
  alertId: 1,
  status: 1
}).limit(10).toArray();

if (opsInesperadas.length > 0) {
  print(`⚠️ Encontradas ${opsInesperadas.length} operaciones con isPriceConfirmed en estado inesperado:\n`);
  opsInesperadas.forEach(function(op) {
    print(`  ${op.ticker}: isPriceConfirmed = ${op.isPriceConfirmed} (tipo: ${typeof op.isPriceConfirmed})`);
  });
} else {
  print("✅ No se encontraron operaciones con isPriceConfirmed en estados inesperados");
}

print("\n" + "=".repeat(70));
print("✅ Consulta completada");
print("=".repeat(70) + "\n");


