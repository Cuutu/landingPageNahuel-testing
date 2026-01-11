/**
 * DRY RUN - Corregir venta parcial incorrecta
 * 
 * INSTRUCCIONES:
 * 1. Cambia SYMBOL por el símbolo de la alerta (ej: "INTC")
 * 2. Cambia EXPECTED_PERCENTAGE por el porcentaje que se intentó vender (ej: 50)
 * 3. Cambia ACTUAL_PERCENTAGE por el porcentaje que realmente se vendió (ej: 25)
 * 4. Copia y pega este script en mongosh
 * 
 * Este script SOLO MUESTRA los cambios sin ejecutarlos
 */

print('🔍 DRY RUN - Corregir venta parcial incorrecta\n');
print('='.repeat(60) + '\n');

// ============================================
// CONFIGURACIÓN - CAMBIAR ESTOS VALORES
// ============================================
const SYMBOL = 'INTC'; // ⚠️ CAMBIAR: Símbolo de la alerta
const EXPECTED_PERCENTAGE = 50; // ⚠️ CAMBIAR: Porcentaje que se intentó vender
const ACTUAL_PERCENTAGE = 25; // ⚠️ CAMBIAR: Porcentaje que realmente se vendió
// ============================================

print(`📊 Buscando alerta: ${SYMBOL}\n`);
print(`   Porcentaje esperado: ${EXPECTED_PERCENTAGE}%\n`);
print(`   Porcentaje real: ${ACTUAL_PERCENTAGE}%\n`);
print('='.repeat(60) + '\n');

// Buscar la alerta
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (!alert) {
  print(`❌ No se encontró la alerta con símbolo: ${SYMBOL}\n`);
  print('💡 Verifica que el símbolo sea correcto\n');
} else {
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   ID: ${alert._id}\n`);
  print(`   Status: ${alert.status}\n`);
  print(`   Participation actual: ${alert.participationPercentage || 100}%\n`);
  print(`   Entry Price: $${alert.entryPrice || 'N/A'}\n`);
  print(`   Current Price: $${alert.currentPrice || 'N/A'}\n`);
  
  // Obtener acciones originales y actuales
  const originalShares = alert.liquidityData?.originalShares || alert.liquidityData?.shares || 0;
  const currentShares = alert.liquidityData?.shares || 0;
  const originalParticipation = alert.originalParticipationPercentage || alert.participationPercentage || 100;
  const currentParticipation = alert.participationPercentage || 100;
  
  print(`\n📊 Estado actual:\n`);
  print(`   Acciones originales: ${originalShares.toFixed(4)}\n`);
  print(`   Acciones actuales: ${currentShares.toFixed(4)}\n`);
  print(`   Participación original: ${originalParticipation}%\n`);
  print(`   Participación actual: ${currentParticipation}%\n`);
  
  // Buscar la última venta parcial ejecutada
  const partialSales = alert.liquidityData?.partialSales || [];
  const executedSales = partialSales.filter(s => s.executed && !s.discarded);
  
  if (executedSales.length === 0) {
    print(`\n⚠️  No se encontraron ventas parciales ejecutadas\n`);
    print('💡 Verifica que la venta esté marcada como executed: true\n');
  } else {
    // Buscar la venta que coincide con el porcentaje incorrecto
    const incorrectSale = executedSales.find(s => 
      Math.abs(s.percentage - ACTUAL_PERCENTAGE) < 1 || 
      Math.abs(s.percentage - EXPECTED_PERCENTAGE) < 1
    );
    
    if (!incorrectSale) {
      print(`\n⚠️  No se encontró una venta con porcentaje ${ACTUAL_PERCENTAGE}% o ${EXPECTED_PERCENTAGE}%\n`);
      print(`   Ventas encontradas:\n`);
      executedSales.forEach((sale, idx) => {
        print(`   ${idx + 1}. Porcentaje: ${sale.percentage}%, Fecha: ${sale.executedAt || sale.date}\n`);
      });
    } else {
      print(`\n✅ Venta parcial encontrada:\n`);
      print(`   Porcentaje guardado: ${incorrectSale.percentage}%\n`);
      print(`   Acciones vendidas: ${incorrectSale.sharesToSell || 0}\n`);
      print(`   Precio de venta: $${incorrectSale.sellPrice || 'N/A'}\n`);
      print(`   Fecha: ${incorrectSale.executedAt || incorrectSale.date}\n`);
      
      // Calcular correcciones
      const expectedSharesToSell = originalShares * (EXPECTED_PERCENTAGE / 100);
      const actualSharesSold = incorrectSale.sharesToSell || 0;
      const sharesDifference = expectedSharesToSell - actualSharesSold;
      
      // Calcular nueva participación
      const correctParticipation = originalParticipation - EXPECTED_PERCENTAGE;
      const currentParticipationAfterCorrection = originalParticipation - ACTUAL_PERCENTAGE;
      
      print(`\n📊 CÁLCULOS DE CORRECCIÓN:\n`);
      print(`   Acciones que deberían haberse vendido: ${expectedSharesToSell.toFixed(4)}\n`);
      print(`   Acciones que realmente se vendieron: ${actualSharesSold.toFixed(4)}\n`);
      print(`   Diferencia: ${sharesDifference.toFixed(4)} acciones\n`);
      print(`\n   Participación actual: ${currentParticipation}%\n`);
      print(`   Participación correcta: ${correctParticipation}%\n`);
      print(`   Diferencia: ${(currentParticipation - correctParticipation).toFixed(2)}%\n`);
      
      // Buscar operación de venta asociada
      const operations = db.operations.find({
        alertId: alert._id,
        operationType: 'VENTA',
        partialSalePercentage: { $exists: true }
      }).sort({ date: -1 }).toArray();
      
      print(`\n📋 OPERACIONES DE VENTA ENCONTRADAS: ${operations.length}\n`);
      operations.forEach((op, idx) => {
        const isRelated = Math.abs(op.partialSalePercentage - ACTUAL_PERCENTAGE) < 1 || 
                         Math.abs(op.partialSalePercentage - EXPECTED_PERCENTAGE) < 1;
        const marker = isRelated ? '👉' : '  ';
        print(`${marker} ${idx + 1}. ID: ${op._id}\n`);
        print(`      Porcentaje: ${op.partialSalePercentage || 'N/A'}%\n`);
        print(`      Cantidad: ${op.quantity || 'N/A'}\n`);
        print(`      Precio: $${op.price || 'N/A'}\n`);
        print(`      Fecha: ${op.date}\n`);
      });
      
      print(`\n🔄 CAMBIOS QUE SE REALIZARÍAN:\n`);
      print(`   1. Actualizar participación de la alerta:\n`);
      print(`      ${currentParticipation}% → ${correctParticipation}%\n`);
      print(`\n   2. Actualizar acciones en liquidityData:\n`);
      print(`      shares: ${currentShares.toFixed(4)} → ${(currentShares - sharesDifference).toFixed(4)}\n`);
      print(`\n   3. Actualizar porcentaje en partialSale:\n`);
      print(`      ${incorrectSale.percentage}% → ${EXPECTED_PERCENTAGE}%\n`);
      print(`\n   4. Actualizar sharesToSell en partialSale:\n`);
      print(`      ${actualSharesSold.toFixed(4)} → ${expectedSharesToSell.toFixed(4)}\n`);
      
      if (operations.length > 0) {
        const relatedOp = operations.find(op => 
          Math.abs(op.partialSalePercentage - ACTUAL_PERCENTAGE) < 1 || 
          Math.abs(op.partialSalePercentage - EXPECTED_PERCENTAGE) < 1
        );
        
        if (relatedOp) {
          print(`\n   5. Actualizar operación de venta:\n`);
          print(`      partialSalePercentage: ${relatedOp.partialSalePercentage}% → ${EXPECTED_PERCENTAGE}%\n`);
          print(`      quantity: ${relatedOp.quantity} → ${-expectedSharesToSell}\n`);
        }
      }
      
      print(`\n` + '='.repeat(60) + '\n');
      print('⚠️  DRY RUN - No se realizaron cambios en la base de datos\n');
      print('💡 Para ejecutar los cambios, usa el script fix-partial-sale-execute.mongosh.js\n');
      print('='.repeat(60) + '\n');
    }
  }
}
