// ============================================
// CONSULTA DE CONTEO: Resumen de operaciones "A confirmar"
// Ejecutar primero para ver cuántas hay
// ============================================

print("\n" + "=".repeat(60));
print("📊 RESUMEN DE OPERACIONES 'A CONFIRMAR'");
print("=".repeat(60) + "\n");

// Contar por tipo
var conPriceRange = db.operations.countDocuments({
  operationType: "COMPRA",
  priceRange: { $exists: true, $ne: null },
  isPriceConfirmed: { $ne: true }
});

var sinAlerta = db.operations.countDocuments({
  operationType: "COMPRA",
  alertId: { $exists: false },
  isPriceConfirmed: { $ne: true }
});

var total = db.operations.countDocuments({
  operationType: "COMPRA",
  $or: [
    { priceRange: { $exists: true, $ne: null }, isPriceConfirmed: { $ne: true } },
    { alertId: { $exists: false }, isPriceConfirmed: { $ne: true } }
  ]
});

print(`✅ Con priceRange sin confirmar: ${conPriceRange}`);
print(`✅ Sin alerta asociada: ${sinAlerta}`);
print(`\n📊 TOTAL: ${total} operaciones "A confirmar"`);

// Contar por sistema
print("\n" + "-".repeat(60));
print("Por Sistema:");
print("-".repeat(60));

var porSistema = db.operations.aggregate([
  {
    $match: {
      operationType: "COMPRA",
      $or: [
        { priceRange: { $exists: true, $ne: null }, isPriceConfirmed: { $ne: true } },
        { alertId: { $exists: false }, isPriceConfirmed: { $ne: true } }
      ]
    }
  },
  {
    $group: {
      _id: "$system",
      count: { $sum: 1 }
    }
  },
  {
    $sort: { count: -1 }
  }
]);

porSistema.forEach(function(item) {
  print(`  ${item._id || 'Sin sistema'}: ${item.count}`);
});

print("\n" + "=".repeat(60) + "\n");


