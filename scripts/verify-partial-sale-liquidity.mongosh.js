/**
 * VERIFICAR - Comprobar que la liquidez se haya restado correctamente después de una venta parcial
 * 
 * INSTRUCCIONES:
 * 1. Cambia SYMBOL por el símbolo de la alerta (ej: "INTC")
 * 2. Cambia EXPECTED_PERCENTAGE por el porcentaje que se intentó vender (ej: 50)
 * 3. Copia y pega este script en mongosh
 */

print('🔍 VERIFICACIÓN - Liquidez después de venta parcial\n');
print('='.repeat(70) + '\n');

// ============================================
// CONFIGURACIÓN - CAMBIAR ESTOS VALORES
// ============================================
const SYMBOL = 'INTC'; // ⚠️ CAMBIAR: Símbolo de la alerta
const EXPECTED_PERCENTAGE = 50; // ⚠️ CAMBIAR: Porcentaje que se intentó vender
// ============================================

print(`📊 Verificando alerta: ${SYMBOL}\n`);
print(`   Porcentaje esperado vendido: ${EXPECTED_PERCENTAGE}%\n`);
print('='.repeat(70) + '\n');

// Buscar la alerta
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (!alert) {
  print(`❌ No se encontró la alerta con símbolo: ${SYMBOL}\n`);
  print('💡 Verifica que el símbolo sea correcto\n');
} else {
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   ID: ${alert._id}\n`);
  print(`   Status: ${alert.status}\n`);
  print(`   Tipo: ${alert.tipo || 'N/A'}\n`);
  
  // Obtener valores de la alerta
  const originalShares = alert.liquidityData?.originalShares || alert.liquidityData?.shares || 0;
  const currentShares = alert.liquidityData?.shares || 0;
  const originalAllocatedAmount = alert.liquidityData?.originalAllocatedAmount || alert.liquidityData?.allocatedAmount || 0;
  const currentAllocatedAmount = alert.liquidityData?.allocatedAmount || 0;
  const originalParticipation = alert.originalParticipationPercentage || alert.participationPercentage || 100;
  const currentParticipation = alert.participationPercentage || 100;
  const entryPrice = alert.entryPrice || 0;
  
  print(`\n📊 ESTADO DE LA ALERTA:\n`);
  print(`   Participación original: ${originalParticipation}%\n`);
  print(`   Participación actual: ${currentParticipation}%\n`);
  print(`   Participación vendida: ${(originalParticipation - currentParticipation).toFixed(2)}%\n`);
  print(`\n   Acciones originales: ${originalShares.toFixed(4)}\n`);
  print(`   Acciones actuales: ${currentShares.toFixed(4)}\n`);
  print(`   Acciones vendidas: ${(originalShares - currentShares).toFixed(4)}\n`);
  print(`\n   Liquidez asignada original: $${originalAllocatedAmount.toFixed(2)}\n`);
  print(`   Liquidez asignada actual: $${currentAllocatedAmount.toFixed(2)}\n`);
  print(`   Liquidez liberada: $${(originalAllocatedAmount - currentAllocatedAmount).toFixed(2)}\n`);
  print(`   Precio de entrada: $${entryPrice.toFixed(2)}\n`);
  
  // Verificar ventas parciales
  const partialSales = alert.liquidityData?.partialSales || [];
  const executedSales = partialSales.filter(s => s.executed && !s.discarded);
  
  print(`\n📋 VENTAS PARCIALES EJECUTADAS: ${executedSales.length}\n`);
  executedSales.forEach((sale, idx) => {
    print(`   ${idx + 1}. Porcentaje: ${sale.percentage}%\n`);
    print(`      Acciones vendidas: ${(sale.sharesToSell || 0).toFixed(4)}\n`);
    print(`      Precio de venta: $${(sale.sellPrice || 0).toFixed(2)}\n`);
    print(`      Liquidez liberada: $${(sale.liquidityReleased || 0).toFixed(2)}\n`);
    print(`      Ganancia realizada: $${(sale.realizedProfit || 0).toFixed(2)}\n`);
    print(`      Fecha: ${sale.executedAt || sale.date}\n`);
  });
  
  // Calcular total vendido
  const totalPercentageSold = executedSales.reduce((sum, s) => sum + (s.percentage || 0), 0);
  const totalSharesSold = executedSales.reduce((sum, s) => sum + (s.sharesToSell || 0), 0);
  
  print(`\n📊 TOTALES DE VENTAS PARCIALES:\n`);
  print(`   Porcentaje total vendido: ${totalPercentageSold.toFixed(2)}%\n`);
  print(`   Acciones totales vendidas: ${totalSharesSold.toFixed(4)}\n`);
  
  // Verificar si coincide con la participación
  const expectedParticipationAfterSale = originalParticipation - EXPECTED_PERCENTAGE;
  print(`\n✅ VERIFICACIÓN DE PARTICIPACIÓN:\n`);
  print(`   Participación esperada después de venta: ${expectedParticipationAfterSale}%\n`);
  print(`   Participación actual: ${currentParticipation}%\n`);
  
  if (Math.abs(currentParticipation - expectedParticipationAfterSale) < 0.01) {
    print(`   ✅ CORRECTO: La participación coincide\n`);
  } else {
    print(`   ⚠️  DIFERENCIA: ${(currentParticipation - expectedParticipationAfterSale).toFixed(2)}%\n`);
    print(`   💡 La participación debería ser ${expectedParticipationAfterSale}% pero es ${currentParticipation}%\n`);
  }
  
  // Verificar acciones
  const expectedSharesAfterSale = originalShares * (expectedParticipationAfterSale / 100);
  print(`\n✅ VERIFICACIÓN DE ACCIONES:\n`);
  print(`   Acciones esperadas después de venta: ${expectedSharesAfterSale.toFixed(4)}\n`);
  print(`   Acciones actuales: ${currentShares.toFixed(4)}\n`);
  
  if (Math.abs(currentShares - expectedSharesAfterSale) < 0.0001) {
    print(`   ✅ CORRECTO: Las acciones coinciden\n`);
  } else {
    const diff = currentShares - expectedSharesAfterSale;
    print(`   ⚠️  DIFERENCIA: ${diff.toFixed(4)} acciones\n`);
    print(`   💡 Las acciones deberían ser ${expectedSharesAfterSale.toFixed(4)} pero son ${currentShares.toFixed(4)}\n`);
  }
  
  // Buscar liquidez en el documento de Liquidity
  const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
  print(`\n💰 VERIFICANDO DOCUMENTO DE LIQUIDEZ (Pool: ${pool})...\n`);
  
  const liquidity = db.liquidity.findOne({
    pool: pool,
    'distributions.alertId': alert._id.toString()
  });
  
  if (!liquidity) {
    print(`   ⚠️  No se encontró documento de liquidez para este pool\n`);
  } else {
    print(`   ✅ Documento de liquidez encontrado\n`);
    print(`   Total Liquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)}\n`);
    print(`   Available Liquidity: $${(liquidity.availableLiquidity || 0).toFixed(2)}\n`);
    print(`   Distributed Liquidity: $${(liquidity.distributedLiquidity || 0).toFixed(2)}\n`);
    print(`   Initial Liquidity: $${(liquidity.initialLiquidity || 0).toFixed(2)}\n`);
    
    // Buscar la distribución específica
    const distribution = liquidity.distributions.find(
      d => d.alertId && d.alertId.toString() === alert._id.toString()
    );
    
    if (!distribution) {
      print(`   ⚠️  No se encontró distribución para esta alerta\n`);
    } else {
      print(`\n   📊 DISTRIBUCIÓN EN LIQUIDEZ:\n`);
      print(`      Symbol: ${distribution.symbol || 'N/A'}\n`);
      print(`      Shares: ${(distribution.shares || 0).toFixed(4)}\n`);
      print(`      Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}\n`);
      print(`      Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}\n`);
      print(`      Current Price: $${(distribution.currentPrice || 0).toFixed(2)}\n`);
      print(`      Sold Shares: ${(distribution.soldShares || 0).toFixed(4)}\n`);
      print(`      Realized Profit/Loss: $${(distribution.realizedProfitLoss || 0).toFixed(2)}\n`);
      print(`      Is Active: ${distribution.isActive || false}\n`);
      
      // Verificar que las acciones en la distribución coincidan con la alerta
      print(`\n   ✅ VERIFICACIÓN DE DISTRIBUCIÓN:\n`);
      print(`      Shares en alerta: ${currentShares.toFixed(4)}\n`);
      print(`      Shares en distribución: ${(distribution.shares || 0).toFixed(4)}\n`);
      
      if (Math.abs(currentShares - (distribution.shares || 0)) < 0.0001) {
        print(`      ✅ CORRECTO: Las acciones coinciden\n`);
      } else {
        const diff = currentShares - (distribution.shares || 0);
        print(`      ⚠️  DIFERENCIA: ${diff.toFixed(4)} acciones\n`);
        print(`      💡 Las acciones en la distribución deberían ser ${currentShares.toFixed(4)} pero son ${(distribution.shares || 0).toFixed(4)}\n`);
      }
      
      // Verificar allocatedAmount
      const expectedAllocated = currentShares * (distribution.entryPrice || entryPrice);
      print(`\n      Allocated Amount en alerta: $${currentAllocatedAmount.toFixed(2)}\n`);
      print(`      Allocated Amount en distribución: $${(distribution.allocatedAmount || 0).toFixed(2)}\n`);
      print(`      Allocated Amount esperado (shares * entryPrice): $${expectedAllocated.toFixed(2)}\n`);
      
      if (Math.abs(currentAllocatedAmount - (distribution.allocatedAmount || 0)) < 0.01) {
        print(`      ✅ CORRECTO: El allocated amount coincide\n`);
      } else {
        print(`      ⚠️  DIFERENCIA: $${Math.abs(currentAllocatedAmount - (distribution.allocatedAmount || 0)).toFixed(2)}\n`);
      }
      
      // Verificar soldShares
      print(`\n      Sold Shares en distribución: ${(distribution.soldShares || 0).toFixed(4)}\n`);
      print(`      Total shares vendidas (de ventas parciales): ${totalSharesSold.toFixed(4)}\n`);
      
      if (Math.abs((distribution.soldShares || 0) - totalSharesSold) < 0.0001) {
        print(`      ✅ CORRECTO: Las acciones vendidas coinciden\n`);
      } else {
        const diff = (distribution.soldShares || 0) - totalSharesSold;
        print(`      ⚠️  DIFERENCIA: ${diff.toFixed(4)} acciones\n`);
      }
    }
  }
  
  // Buscar operaciones de venta
  print(`\n📋 OPERACIONES DE VENTA:\n`);
  const operations = db.operations.find({
    alertId: alert._id,
    operationType: 'VENTA'
  }).sort({ date: -1 }).toArray();
  
  print(`   Total operaciones de venta: ${operations.length}\n`);
  operations.forEach((op, idx) => {
    print(`   ${idx + 1}. ID: ${op._id}\n`);
    print(`      Ticker: ${op.ticker || 'N/A'}\n`);
    print(`      Quantity: ${op.quantity || 0}\n`);
    print(`      Price: $${(op.price || 0).toFixed(2)}\n`);
    print(`      Amount: $${(op.amount || 0).toFixed(2)}\n`);
    print(`      Partial Sale: ${op.isPartialSale || false}\n`);
    print(`      Partial Sale Percentage: ${op.partialSalePercentage || 'N/A'}%\n`);
    print(`      Date: ${op.date}\n`);
  });
  
  // Resumen final
  print(`\n` + '='.repeat(70) + '\n');
  print('📊 RESUMEN DE VERIFICACIÓN:\n');
  print('='.repeat(70) + '\n');
  
  const participationCorrect = Math.abs(currentParticipation - expectedParticipationAfterSale) < 0.01;
  const sharesCorrect = Math.abs(currentShares - expectedSharesAfterSale) < 0.0001;
  
  print(`✅ Participación: ${participationCorrect ? 'CORRECTA' : 'INCORRECTA'}\n`);
  print(`   Esperada: ${expectedParticipationAfterSale}%, Actual: ${currentParticipation}%\n`);
  
  print(`✅ Acciones: ${sharesCorrect ? 'CORRECTAS' : 'INCORRECTAS'}\n`);
  print(`   Esperadas: ${expectedSharesAfterSale.toFixed(4)}, Actuales: ${currentShares.toFixed(4)}\n`);
  
  if (liquidity && distribution) {
    const distributionCorrect = Math.abs(currentShares - (distribution.shares || 0)) < 0.0001;
    print(`✅ Distribución en Liquidez: ${distributionCorrect ? 'CORRECTA' : 'INCORRECTA'}\n`);
    print(`   Shares en alerta: ${currentShares.toFixed(4)}, Shares en distribución: ${(distribution.shares || 0).toFixed(4)}\n`);
  }
  
  print('='.repeat(70) + '\n');
  
  if (participationCorrect && sharesCorrect) {
    print('✅ TODO CORRECTO: La venta parcial se aplicó correctamente\n');
  } else {
    print('⚠️  HAY PROBLEMAS: Revisa los valores mostrados arriba\n');
  }
  
  print('='.repeat(70) + '\n');
}
