/**
 * Script simplificado para copiar y pegar directamente en mongosh
 * Recalcula ganancias realizadas usando ponderación correcta
 */

// 1. Buscar alertas con ventas parciales
const alerts = db.alerts.find({
  $or: [
    { 'liquidityData.partialSales': { $exists: true, $ne: null, $not: { $size: 0 } } },
    { 'ventasParciales': { $exists: true, $ne: null, $not: { $size: 0 } } }
  ]
}).toArray();

print(`📊 Encontradas ${alerts.length} alertas\n`);

let updated = 0;

alerts.forEach((alert) => {
  const entryPrice = alert.entryPriceRange?.min || alert.entryPrice || 0;
  if (entryPrice <= 0) return;
  
  let weightedSum = 0;
  
  // Sistema nuevo: liquidityData.partialSales
  if (alert.liquidityData?.partialSales) {
    alert.liquidityData.partialSales
      .filter(s => s.executed && !s.discarded)
      .forEach(sale => {
        if (entryPrice > 0 && sale.sellPrice > 0) {
          const profitPct = ((sale.sellPrice - entryPrice) / entryPrice) * 100;
          weightedSum += (sale.percentage || 0) * profitPct;
        }
      });
  }
  
  // Sistema legacy: ventasParciales
  if (alert.ventasParciales) {
    alert.ventasParciales.forEach(venta => {
      weightedSum += (venta.porcentajeVendido || 0) * (venta.gananciaRealizada || 0);
    });
  }
  
  const newValue = weightedSum / 100;
  const oldValue = alert.gananciaRealizada || 0;
  
  db.alerts.updateOne(
    { _id: alert._id },
    { $set: { gananciaRealizada: newValue } }
  );
  
  if (Math.abs(oldValue - newValue) > 0.01) {
    print(`${alert.symbol || alert._id}: ${oldValue.toFixed(2)}% → ${newValue.toFixed(2)}%\n`);
  }
  
  updated++;
});

print(`\n✅ Actualizadas: ${updated} alertas\n`);
