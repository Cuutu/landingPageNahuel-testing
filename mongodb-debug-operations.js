// ============================================
// SCRIPT DE MONGODB PARA DEBUG DE OPERACIONES "A CONFIRMAR"
// Ejecutar en MongoDB Compass o mongo shell
// ============================================

// CONSULTA RÁPIDA MEJORADA: Operaciones "A confirmar" con información de alertas
print("\n=== CONSULTA RÁPIDA: OPERACIONES 'A CONFIRMAR' CON ALERTAS ===\n");

var pendingOps = db.operations.find({
  operationType: "COMPRA",
  $or: [
    { priceRange: { $exists: true, $ne: null }, isPriceConfirmed: { $ne: true } },
    { alertId: { $exists: false }, isPriceConfirmed: { $ne: true } }
  ]
}, {
  ticker: 1,
  priceRange: 1,
  isPriceConfirmed: 1,
  price: 1,
  alertId: 1,
  status: 1,
  createdAt: 1,
  system: 1
}).sort({ createdAt: -1 }).toArray();

print(`Total operaciones encontradas: ${pendingOps.length}\n`);

pendingOps.forEach(function(op, index) {
  print(`\n${"=".repeat(60)}`);
  print(`OPERACIÓN ${index + 1}: ${op.ticker}`);
  print(`${"=".repeat(60)}`);
  print(`_id: ${op._id}`);
  print(`Sistema: ${op.system || 'N/A'}`);
  print(`Precio: $${op.price || 'N/A'}`);
  print(`PriceRange: ${op.priceRange ? `$${op.priceRange.min} - $${op.priceRange.max}` : '❌ NO TIENE'}`);
  print(`isPriceConfirmed: ${op.isPriceConfirmed === true ? '✅ SÍ' : '❌ NO'}`);
  print(`Status operación: ${op.status || 'N/A'}`);
  print(`AlertId: ${op.alertId || '❌ NO TIENE ALERTA'}`);
  print(`Creada: ${op.createdAt}`);
  
  if (op.alertId) {
    var alert = db.alerts.findOne({ _id: op.alertId }, {
      symbol: 1,
      status: 1,
      availableForPurchase: 1,
      finalPriceSetAt: 1,
      descartadaAt: 1,
      currentPrice: 1,
      finalPrice: 1,
      date: 1,
      createdAt: 1,
      entryPriceRange: 1,
      precioMinimo: 1,
      precioMaximo: 1
    });
    
    if (alert) {
      print(`\n📊 INFORMACIÓN DE ALERTA:`);
      print(`  Símbolo: ${alert.symbol}`);
      print(`  Status: ${alert.status}`);
      print(`  availableForPurchase: ${alert.availableForPurchase === true ? '✅ SÍ' : '❌ NO'}`);
      print(`  finalPriceSetAt: ${alert.finalPriceSetAt || '❌ NO'}`);
      print(`  descartadaAt: ${alert.descartadaAt || 'NO'}`);
      print(`  Precio actual: $${alert.currentPrice || 'N/A'}`);
      print(`  Precio final: $${alert.finalPrice || 'N/A'}`);
      print(`  Fecha alerta: ${alert.date || alert.createdAt}`);
      
      var alertHasRange = (alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max) ||
                          (alert.precioMinimo && alert.precioMaximo);
      print(`  Alerta tiene range: ${alertHasRange ? '✅ SÍ' : '❌ NO'}`);
      if (alertHasRange) {
        if (alert.entryPriceRange) {
          print(`    Range: $${alert.entryPriceRange.min} - $${alert.entryPriceRange.max}`);
        } else {
          print(`    Range: $${alert.precioMinimo} - $${alert.precioMaximo}`);
        }
      }
      
      // Análisis de por qué aparece "A confirmar"
      print(`\n🔍 ANÁLISIS:`);
      if (op.priceRange && op.isPriceConfirmed !== true) {
        print(`  ✅ RAZÓN: Tiene priceRange sin confirmar`);
      } else if (!op.alertId) {
        print(`  ✅ RAZÓN: No tiene alerta asociada`);
      } else if (alert.status === 'ACTIVE' && alert.availableForPurchase === true && !op.priceRange) {
        print(`  ✅ RAZÓN: Alerta activa con availableForPurchase=true, sin priceRange`);
      } else {
        print(`  ⚠️ RAZÓN DESCONOCIDA - Revisar lógica del frontend`);
      }
    } else {
      print(`\n⚠️ ALERTA NO ENCONTRADA (puede haber sido eliminada)`);
    }
  } else {
    print(`\n⚠️ NO TIENE ALERTA ASOCIADA`);
  }
});

print(`\n\n${"=".repeat(60)}`);
print(`TOTAL: ${pendingOps.length} operaciones "A confirmar"`);
print(`${"=".repeat(60)}\n`);

// 1. OPERACIONES CON PRICERANGE SIN CONFIRMAR (deberían estar "A confirmar")
print("\n=== 1. OPERACIONES CON PRICERANGE SIN CONFIRMAR ===");
db.operations.find({
  priceRange: { $exists: true, $ne: null },
  isPriceConfirmed: { $ne: true },
  operationType: "COMPRA"
}, {
  ticker: 1,
  priceRange: 1,
  isPriceConfirmed: 1,
  price: 1,
  alertId: 1,
  createdAt: 1,
  updatedAt: 1
}).forEach(function(op) {
  print(`\nTicker: ${op.ticker}`);
  print(`PriceRange: $${op.priceRange.min} - $${op.priceRange.max}`);
  print(`Precio Actual: $${op.price}`);
  print(`isPriceConfirmed: ${op.isPriceConfirmed}`);
  print(`AlertId: ${op.alertId}`);
  print(`Creada: ${op.createdAt}`);
});

// 2. OPERACIONES SIN PRICERANGE PERO QUE PODRÍAN ESTAR "A CONFIRMAR" (según lógica frontend)
print("\n\n=== 2. OPERACIONES SIN PRICERANGE PERO SIN CONFIRMAR ===");
db.operations.find({
  priceRange: { $exists: false },
  isPriceConfirmed: { $ne: true },
  operationType: "COMPRA"
}, {
  ticker: 1,
  priceRange: 1,
  isPriceConfirmed: 1,
  price: 1,
  alertId: 1,
  status: 1,
  createdAt: 1
}).limit(20).forEach(function(op) {
  print(`\nTicker: ${op.ticker}`);
  print(`Precio: $${op.price}`);
  print(`Status: ${op.status || 'N/A'}`);
  print(`isPriceConfirmed: ${op.isPriceConfirmed}`);
  print(`AlertId: ${op.alertId}`);
});

// 3. OPERACIONES CON ALERTAS ACTIVAS Y availableForPurchase = true (lógica frontend)
print("\n\n=== 3. OPERACIONES CON ALERTAS ACTIVAS (availableForPurchase = true) ===");
var activeAlerts = db.alerts.find({
  status: "ACTIVE",
  availableForPurchase: true
}, { _id: 1, symbol: 1, status: 1, availableForPurchase: 1, finalPriceSetAt: 1, date: 1, createdAt: 1 }).toArray();

print(`\nTotal alertas activas con availableForPurchase=true: ${activeAlerts.length}`);

activeAlerts.forEach(function(alert) {
  var operations = db.operations.find({
    alertId: alert._id,
    operationType: "COMPRA"
  }, {
    ticker: 1,
    priceRange: 1,
    isPriceConfirmed: 1,
    price: 1,
    status: 1
  }).toArray();
  
  if (operations.length > 0) {
    print(`\n--- Alerta: ${alert.symbol} (${alert._id}) ---`);
    print(`Status: ${alert.status}`);
    print(`availableForPurchase: ${alert.availableForPurchase}`);
    print(`finalPriceSetAt: ${alert.finalPriceSetAt || 'NO'}`);
    print(`Fecha alerta: ${alert.date || alert.createdAt}`);
    
    operations.forEach(function(op) {
      print(`  Operación: ${op.ticker}`);
      print(`    PriceRange: ${op.priceRange ? `$${op.priceRange.min}-$${op.priceRange.max}` : 'NO'}`);
      print(`    isPriceConfirmed: ${op.isPriceConfirmed}`);
      print(`    Status: ${op.status || 'N/A'}`);
    });
  }
});

// 4. RESUMEN: TODAS LAS OPERACIONES QUE PODRÍAN ESTAR "A CONFIRMAR"
print("\n\n=== 4. RESUMEN: OPERACIONES QUE DEBERÍAN ESTAR 'A CONFIRMAR' ===");

// Caso 1: Con priceRange sin confirmar
var withRange = db.operations.countDocuments({
  priceRange: { $exists: true, $ne: null },
  isPriceConfirmed: { $ne: true },
  operationType: "COMPRA"
});

// Caso 2: Sin priceRange pero con alerta activa y availableForPurchase
var activeAlertIds = db.alerts.find({
  status: "ACTIVE",
  availableForPurchase: true
}, { _id: 1 }).map(function(a) { return a._id; });

var withoutRangeButActive = db.operations.countDocuments({
  alertId: { $in: activeAlertIds },
  priceRange: { $exists: false },
  isPriceConfirmed: { $ne: true },
  operationType: "COMPRA"
});

// Caso 3: Sin alerta asociada
var withoutAlert = db.operations.countDocuments({
  alertId: { $exists: false },
  isPriceConfirmed: { $ne: true },
  operationType: "COMPRA"
});

print(`\nOperaciones con priceRange sin confirmar: ${withRange}`);
print(`Operaciones sin priceRange pero alerta activa: ${withoutRangeButActive}`);
print(`Operaciones sin alerta asociada: ${withoutAlert}`);
print(`TOTAL que podrían estar 'A confirmar': ${withRange + withoutRangeButActive + withoutAlert}`);

// 5. DETALLE COMPLETO: Operaciones que aparecen como "A confirmar" en frontend
print("\n\n=== 5. DETALLE COMPLETO: OPERACIONES 'A CONFIRMAR' ===");
print("(Incluye todas las que el frontend mostraría como 'A confirmar')\n");

var allPendingOps = db.operations.find({
  operationType: "COMPRA",
  $or: [
    // Caso 1: Tiene priceRange sin confirmar
    {
      priceRange: { $exists: true, $ne: null },
      isPriceConfirmed: { $ne: true }
    },
    // Caso 2: No tiene alerta
    {
      alertId: { $exists: false },
      isPriceConfirmed: { $ne: true }
    },
    // Caso 3: Alerta activa con availableForPurchase (sin priceRange)
    {
      alertId: { $in: activeAlertIds },
      priceRange: { $exists: false },
      isPriceConfirmed: { $ne: true }
    }
  ]
}, {
  ticker: 1,
  priceRange: 1,
  isPriceConfirmed: 1,
  price: 1,
  alertId: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1
}).sort({ createdAt: -1 });

var count = 0;
allPendingOps.forEach(function(op) {
  count++;
  print(`\n--- Operación ${count}: ${op.ticker} ---`);
  print(`_id: ${op._id}`);
  print(`Precio: $${op.price}`);
  print(`PriceRange: ${op.priceRange ? `$${op.priceRange.min} - $${op.priceRange.max}` : 'NO TIENE'}`);
  print(`isPriceConfirmed: ${op.isPriceConfirmed}`);
  print(`Status operación: ${op.status || 'N/A'}`);
  print(`AlertId: ${op.alertId || 'NO TIENE ALERTA'}`);
  
  if (op.alertId) {
    var alert = db.alerts.findOne({ _id: op.alertId }, {
      symbol: 1,
      status: 1,
      availableForPurchase: 1,
      finalPriceSetAt: 1,
      currentPrice: 1,
      finalPrice: 1,
      date: 1,
      createdAt: 1
    });
    
    if (alert) {
      print(`  Alerta: ${alert.symbol}`);
      print(`  Status alerta: ${alert.status}`);
      print(`  availableForPurchase: ${alert.availableForPurchase}`);
      print(`  finalPriceSetAt: ${alert.finalPriceSetAt || 'NO'}`);
      print(`  Precio actual: $${alert.currentPrice || 'N/A'}`);
      print(`  Precio final: $${alert.finalPrice || 'N/A'}`);
      print(`  Fecha alerta: ${alert.date || alert.createdAt}`);
    } else {
      print(`  ⚠️ ALERTA NO ENCONTRADA`);
    }
  }
  
  print(`Creada: ${op.createdAt}`);
  print(`Actualizada: ${op.updatedAt || 'Nunca'}`);
});

print(`\n\n=== TOTAL OPERACIONES 'A CONFIRMAR': ${count} ===`);

// 6. VERIFICACIÓN: Operaciones que tienen priceRange pero la alerta ya no lo tiene
print("\n\n=== 6. VERIFICACIÓN: OPERACIONES CON PRICERANGE PERO ALERTA SIN RANGO ===");
var opsWithRange = db.operations.find({
  priceRange: { $exists: true, $ne: null },
  operationType: "COMPRA",
  alertId: { $exists: true }
}).toArray();

var inconsistent = 0;
opsWithRange.forEach(function(op) {
  var alert = db.alerts.findOne({ _id: op.alertId }, {
    entryPriceRange: 1,
    precioMinimo: 1,
    precioMaximo: 1,
    symbol: 1
  });
  
  if (alert) {
    var alertHasRange = (alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max) ||
                        (alert.precioMinimo && alert.precioMaximo);
    
    if (!alertHasRange) {
      inconsistent++;
      print(`\n⚠️ INCONSISTENCIA: ${op.ticker}`);
      print(`  Operación tiene range: $${op.priceRange.min} - $${op.priceRange.max}`);
      print(`  Alerta ${alert.symbol} NO tiene range`);
      print(`  isPriceConfirmed: ${op.isPriceConfirmed}`);
    }
  }
});

if (inconsistent === 0) {
  print("✅ No hay inconsistencias");
} else {
  print(`\n⚠️ Total inconsistencias encontradas: ${inconsistent}`);
}

print("\n\n=== FIN DEL SCRIPT ===");


