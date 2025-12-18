/**
 * DRY RUN - Solo muestra los cambios sin ejecutarlos
 * Copiar y pegar directamente en mongosh
 */

print('🔍 DRY RUN - Mostrando cambios sin ejecutarlos\n');
print('=' .repeat(60) + '\n');

// Buscar alertas con ventas parciales
const alerts = db.alerts.find({
  $or: [
    { 'liquidityData.partialSales': { $exists: true, $ne: null, $not: { $size: 0 } } },
    { 'ventasParciales': { $exists: true, $ne: null, $not: { $size: 0 } } }
  ]
}).toArray();

print(`📊 Encontradas ${alerts.length} alertas con ventas parciales\n`);
print('=' .repeat(60) + '\n');

let willUpdate = 0;
let noChange = 0;
const changes = [];

alerts.forEach((alert) => {
  const entryPrice = alert.entryPriceRange?.min || alert.entryPrice || 0;
  if (entryPrice <= 0) {
    print(`⚠️  ${alert.symbol || alert._id}: Sin precio de entrada, se saltará\n`);
    return;
  }
  
  let weightedSum = 0;
  
  // Sistema nuevo: liquidityData.partialSales
  if (alert.liquidityData?.partialSales) {
    const executedSales = alert.liquidityData.partialSales.filter(s => s.executed && !s.discarded);
    
    executedSales.forEach(sale => {
      if (entryPrice > 0 && sale.sellPrice > 0) {
        const profitPct = ((sale.sellPrice - entryPrice) / entryPrice) * 100;
        weightedSum += (sale.percentage || 0) * profitPct;
      }
    });
  }
  
  // Sistema legacy: ventasParciales
  if (alert.ventasParciales && Array.isArray(alert.ventasParciales)) {
    alert.ventasParciales.forEach(venta => {
      weightedSum += (venta.porcentajeVendido || 0) * (venta.gananciaRealizada || 0);
    });
  }
  
  const newValue = weightedSum / 100;
  const oldValue = alert.gananciaRealizada || 0;
  const diff = Math.abs(oldValue - newValue);
  
  if (diff > 0.01) {
    willUpdate++;
    changes.push({
      symbol: alert.symbol || 'N/A',
      alertId: alert._id.toString(),
      oldValue: oldValue.toFixed(2),
      newValue: newValue.toFixed(2),
      diff: diff.toFixed(2)
    });
    
    print(`📝 ${alert.symbol || alert._id}:\n`);
    print(`   Valor actual:  ${oldValue.toFixed(2)}%\n`);
    print(`   Valor nuevo:   ${newValue.toFixed(2)}%\n`);
    print(`   Diferencia:    ${(newValue - oldValue).toFixed(2)}%\n`);
    print(`   ID:            ${alert._id}\n`);
    print('   ' + '-'.repeat(50) + '\n');
  } else {
    noChange++;
  }
});

print('\n' + '=' .repeat(60) + '\n');
print('📊 RESUMEN:\n');
print(`   ✅ Se actualizarían: ${willUpdate} alertas\n`);
print(`   ➖ Sin cambios:       ${noChange} alertas\n`);
print(`   📊 Total procesadas:  ${alerts.length} alertas\n`);

if (changes.length > 0) {
  print('\n📋 DETALLE DE CAMBIOS:\n');
  changes.forEach((change, index) => {
    print(`${index + 1}. ${change.symbol}:\n`);
    print(`   ${change.oldValue}% → ${change.newValue}% (diff: ${change.diff}%)\n`);
    print(`   ID: ${change.alertId}\n`);
  });
}

print('\n' + '=' .repeat(60) + '\n');
print('⚠️  DRY RUN - No se realizaron cambios en la base de datos\n');
print('💡 Para ejecutar los cambios, usa el script de actualización\n');
print('=' .repeat(60) + '\n');
