// ============================================
// CONSULTA RÁPIDA: Operaciones "A confirmar"
// Copiar y pegar directamente en MongoDB Compass
// ============================================

db.operations.find({
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
}).sort({ createdAt: -1 }).forEach(function(op) {
  print("\n" + "=".repeat(50));
  print(`TICKER: ${op.ticker}`);
  print(`Sistema: ${op.system || 'N/A'}`);
  print(`Precio: $${op.price || 'N/A'}`);
  print(`PriceRange: ${op.priceRange ? `$${op.priceRange.min} - $${op.priceRange.max}` : '❌ NO TIENE'}`);
  print(`isPriceConfirmed: ${op.isPriceConfirmed === true ? '✅ SÍ' : '❌ NO'}`);
  print(`Status: ${op.status || 'N/A'}`);
  print(`AlertId: ${op.alertId || '❌ NO TIENE'}`);
  
  if (op.alertId) {
    var alert = db.alerts.findOne({ _id: op.alertId }, {
      symbol: 1,
      status: 1,
      availableForPurchase: 1,
      finalPriceSetAt: 1,
      currentPrice: 1,
      date: 1
    });
    
    if (alert) {
      print(`\nAlerta: ${alert.symbol}`);
      print(`  Status: ${alert.status}`);
      print(`  availableForPurchase: ${alert.availableForPurchase === true ? '✅' : '❌'}`);
      print(`  finalPriceSetAt: ${alert.finalPriceSetAt || '❌ NO'}`);
      print(`  Precio actual: $${alert.currentPrice || 'N/A'}`);
      print(`  Fecha: ${alert.date || 'N/A'}`);
    } else {
      print(`\n⚠️ Alerta no encontrada`);
    }
  }
  
  print(`Creada: ${op.createdAt}`);
});


