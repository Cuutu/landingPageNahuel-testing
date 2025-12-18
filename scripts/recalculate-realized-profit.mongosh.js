/**
 * Script para recalcular ganancias realizadas en MongoDB
 * Replica la lógica del método calculateTotalProfit corregido
 * 
 * Uso: mongosh "tu_connection_string" --file scripts/recalculate-realized-profit.mongosh.js
 * O ejecutar línea por línea en mongosh
 */

// Conectar a la base de datos (ajustar según tu configuración)
// Si ya estás conectado, puedes omitir esta línea
// use('tu_database_name');

print('🔄 Iniciando recálculo de ganancias realizadas...\n');

// Buscar todas las alertas con ventas parciales (sistema nuevo o legacy)
const alerts = db.alerts.find({
  $or: [
    {
      'liquidityData.partialSales': {
        $exists: true,
        $ne: null,
        $not: { $size: 0 }
      }
    },
    {
      'ventasParciales': {
        $exists: true,
        $ne: null,
        $not: { $size: 0 }
      }
    }
  ]
}).toArray();

print(`📊 Encontradas ${alerts.length} alertas con ventas parciales\n`);

let updated = 0;
let errors = 0;
const results = [];

alerts.forEach((alert) => {
  try {
    // Obtener precio de entrada
    const entryPrice = alert.entryPriceRange?.min || alert.entryPrice || 0;
    
    if (entryPrice <= 0) {
      print(`⚠️  ${alert.symbol || alert._id}: Sin precio de entrada, saltando...\n`);
      return;
    }
    
    // Inicializar suma ponderada
    let weightedProfitSum = 0;
    
    // Procesar ventas de liquidityData.partialSales (sistema nuevo)
    if (alert.liquidityData?.partialSales && Array.isArray(alert.liquidityData.partialSales)) {
      const executedSales = alert.liquidityData.partialSales.filter(
        (sale) => sale.executed === true && !sale.discarded
      );
      
      executedSales.forEach((sale) => {
        const saleEntryPrice = entryPrice || 0;
        const saleSellPrice = sale.sellPrice || 0;
        const salePercentage = sale.percentage || 0;
        
        // Calcular ganancia porcentual de esta venta
        let saleProfitPercentage = 0;
        if (saleEntryPrice > 0 && saleSellPrice > 0) {
          saleProfitPercentage = ((saleSellPrice - saleEntryPrice) / saleEntryPrice) * 100;
        }
        
        // Acumular contribución ponderada: percentage * profitPercentage
        weightedProfitSum += salePercentage * saleProfitPercentage;
      });
    }
    
    // Procesar ventas de ventasParciales (sistema legacy)
    if (alert.ventasParciales && Array.isArray(alert.ventasParciales) && alert.ventasParciales.length > 0) {
      alert.ventasParciales.forEach((venta) => {
        const ventaPercentage = venta.porcentajeVendido || 0;
        const ventaProfitPercentage = venta.gananciaRealizada || 0;
        
        // Acumular contribución ponderada
        weightedProfitSum += ventaPercentage * ventaProfitPercentage;
      });
    }
    
    // Dividir por 100 para obtener el porcentaje total ponderado
    const gananciaRealizada = weightedProfitSum / 100;
    
    // Obtener valor anterior para comparación
    const oldValue = alert.gananciaRealizada || 0;
    
    // Actualizar el documento
    db.alerts.updateOne(
      { _id: alert._id },
      { $set: { gananciaRealizada: gananciaRealizada } }
    );
    
    updated++;
    results.push({
      symbol: alert.symbol || 'N/A',
      alertId: alert._id.toString(),
      oldValue: oldValue.toFixed(2),
      newValue: gananciaRealizada.toFixed(2)
    });
    
    if (Math.abs(oldValue - gananciaRealizada) > 0.01) {
      print(`✅ ${alert.symbol || alert._id}: ${oldValue.toFixed(2)}% → ${gananciaRealizada.toFixed(2)}%\n`);
    }
    
  } catch (error) {
    errors++;
    print(`❌ Error procesando ${alert.symbol || alert._id}: ${error.message}\n`);
  }
});

print(`\n🎉 Recálculo completado:\n`);
print(`   ✅ Actualizadas: ${updated}\n`);
print(`   ❌ Errores: ${errors}\n`);
print(`   📊 Total procesadas: ${alerts.length}\n`);

// Mostrar resumen de los primeros 20 cambios
if (results.length > 0) {
  print(`\n📋 Resumen de cambios (primeros ${Math.min(20, results.length)}):\n`);
  results.slice(0, 20).forEach((result) => {
    print(`   ${result.symbol}: ${result.oldValue}% → ${result.newValue}%\n`);
  });
}

print('\n✅ Script completado\n');
