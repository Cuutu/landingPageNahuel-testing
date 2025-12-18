/**
 * EJECUTAR CAMBIOS - Actualiza las ganancias realizadas en la base de datos
 * ⚠️  ADVERTENCIA: Este script MODIFICA la base de datos
 * Solo ejecutar después de revisar el dry run
 */

print('🔄 Ejecutando actualización de ganancias realizadas...\n');
print('='.repeat(60) + '\n');

// Buscar alertas con ventas parciales
const alerts = db.alerts.find({
  $or: [
    { 'liquidityData.partialSales': { $exists: true, $ne: null, $not: { $size: 0 } } },
    { 'ventasParciales': { $exists: true, $ne: null, $not: { $size: 0 } } }
  ]
}).toArray();

print(`📊 Encontradas ${alerts.length} alertas con ventas parciales\n`);
print('='.repeat(60) + '\n');

let updated = 0;
let noChange = 0;
let errors = 0;

alerts.forEach((alert) => {
  try {
    const entryPrice = alert.entryPriceRange?.min || alert.entryPrice || 0;
    if (entryPrice <= 0) {
      print(`⚠️  ${alert.symbol || alert._id}: Sin precio de entrada, saltando...\n`);
      return;
    }
    
    // ✅ CORREGIDO: Calcular PROMEDIO SIMPLE de rendimientos de ventas ejecutadas
    const profitPercentages = [];
    
    // Sistema nuevo: liquidityData.partialSales
    if (alert.liquidityData?.partialSales) {
      const executedSales = alert.liquidityData.partialSales.filter(s => s.executed && !s.discarded);
      
      executedSales.forEach(sale => {
        if (entryPrice > 0 && sale.sellPrice > 0) {
          const profitPct = ((sale.sellPrice - entryPrice) / entryPrice) * 100;
          profitPercentages.push(profitPct);
        }
      });
    }
    
    // Sistema legacy: ventasParciales
    if (alert.ventasParciales && Array.isArray(alert.ventasParciales)) {
      alert.ventasParciales.forEach(venta => {
        const ventaProfit = venta.gananciaRealizada || 0;
        if (ventaProfit !== 0) {
          profitPercentages.push(ventaProfit);
        }
      });
    }
    
    // Calcular promedio simple
    let newValue = 0;
    if (profitPercentages.length > 0) {
      const sum = profitPercentages.reduce((acc, val) => acc + val, 0);
      newValue = sum / profitPercentages.length;
    }
    const oldValue = alert.gananciaRealizada || 0;
    const diff = Math.abs(oldValue - newValue);
    
    if (diff > 0.01) {
      // Actualizar en la base de datos
      const result = db.alerts.updateOne(
        { _id: alert._id },
        { $set: { gananciaRealizada: newValue } }
      );
      
      if (result.modifiedCount > 0) {
        updated++;
        print(`✅ ${alert.symbol || alert._id}: ${oldValue.toFixed(2)}% → ${newValue.toFixed(2)}%\n`);
      } else {
        print(`⚠️  ${alert.symbol || alert._id}: No se pudo actualizar\n`);
      }
    } else {
      noChange++;
    }
    
  } catch (error) {
    errors++;
    print(`❌ Error procesando ${alert.symbol || alert._id}: ${error.message}\n`);
  }
});

print('\n' + '='.repeat(60) + '\n');
print('📊 RESUMEN FINAL:\n');
print(`   ✅ Actualizadas: ${updated} alertas\n`);
print(`   ➖ Sin cambios:   ${noChange} alertas\n`);
print(`   ❌ Errores:       ${errors} alertas\n`);
print(`   📊 Total:          ${alerts.length} alertas\n`);
print('='.repeat(60) + '\n');
print('✅ Actualización completada\n');
