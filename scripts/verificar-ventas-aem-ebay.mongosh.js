// ============================================
// VERIFICACIÓN: Ventas de AEM y EBAY
// Este script verifica que las ventas registradas coincidan con:
// - Las operaciones en la colección operations
// - El estado de la alerta (participationPercentage)
// - El estado de la liquidez (distributions)
// - Las ventas parciales registradas en liquidityData.partialSales
// ============================================

print('🔍 VERIFICACIÓN DE VENTAS - AEM y EBAY\n');
print('='.repeat(80));

// Función para formatear fechas
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toISOString().split('T')[0] + ' ' + new Date(date).toISOString().split('T')[1].substring(0, 5);
}

// Función para verificar una alerta
function verifyAlert(symbol) {
  print(`\n${'='.repeat(80)}`);
  print(`📊 VERIFICANDO: ${symbol}`);
  print('='.repeat(80));
  
  // 1. Buscar la alerta
  const alert = db.alerts.findOne({ 
    symbol: symbol,
    status: { $in: ['ACTIVE', 'CLOSED'] }
  });
  
  if (!alert) {
    print(`❌ No se encontró alerta para ${symbol}`);
    return null;
  }
  
  const alertId = alert._id;
  const pool = alert.tipo || 'TraderCall';
  
  print(`\n✅ Alerta encontrada:`);
  print(`   ID: ${alertId}`);
  print(`   Status: ${alert.status}`);
  print(`   Pool: ${pool}`);
  print(`   Entry Price: $${alert.entryPrice || alert.entryPriceRange?.min || 'N/A'}`);
  print(`   Current Price: $${alert.currentPrice || 'N/A'}`);
  
  // 2. Verificar participationPercentage
  const participationPercentage = alert.participationPercentage || 0;
  const originalParticipation = alert.originalParticipationPercentage || 100;
  const expectedSoldPercentage = originalParticipation - participationPercentage;
  
  print(`\n📊 PARTICIPACIÓN:`);
  print(`   Original: ${originalParticipation}%`);
  print(`   Actual: ${participationPercentage}%`);
  print(`   Vendido (calculado): ${expectedSoldPercentage}%`);
  
  // 3. Verificar liquidityData
  const liquidityData = alert.liquidityData || {};
  const originalShares = liquidityData.originalShares || 0;
  const currentShares = liquidityData.shares || 0;
  const originalAllocatedAmount = liquidityData.originalAllocatedAmount || 0;
  const currentAllocatedAmount = liquidityData.allocatedAmount || 0;
  const partialSales = liquidityData.partialSales || [];
  
  print(`\n💰 LIQUIDEZ EN ALERTA:`);
  print(`   Shares originales: ${originalShares.toFixed(4)}`);
  print(`   Shares actuales: ${currentShares.toFixed(4)}`);
  print(`   Shares vendidas (calculado): ${(originalShares - currentShares).toFixed(4)}`);
  print(`   Monto original asignado: $${originalAllocatedAmount.toFixed(2)}`);
  print(`   Monto actual asignado: $${currentAllocatedAmount.toFixed(2)}`);
  print(`   Monto liberado (calculado): $${(originalAllocatedAmount - currentAllocatedAmount).toFixed(2)}`);
  print(`   Ventas parciales registradas: ${partialSales.length}`);
  
  // 4. Analizar ventas parciales
  let totalPercentageSold = 0;
  let totalSharesSold = 0;
  let totalLiquidityReleased = 0;
  let totalRealizedProfit = 0;
  
  print(`\n📋 VENTAS PARCIALES REGISTRADAS:`);
  if (partialSales.length === 0) {
    print('   ⚠️ No hay ventas parciales registradas');
  } else {
    partialSales.forEach((sale, idx) => {
      const executed = sale.executed === true && !sale.discarded;
      const status = executed ? '✅ EJECUTADA' : (sale.discarded ? '❌ DESCARTADA' : '⏳ PENDIENTE');
      
      print(`\n   Venta ${idx + 1}:`);
      print(`     Status: ${status}`);
      print(`     Fecha: ${formatDate(sale.date || sale.executedAt)}`);
      print(`     Porcentaje: ${sale.percentage || 0}%`);
      print(`     Shares: ${(sale.sharesToSell || 0).toFixed(4)}`);
      print(`     Precio: $${sale.sellPrice || 'N/A'}`);
      print(`     Liquidez liberada: $${(sale.liquidityReleased || 0).toFixed(2)}`);
      print(`     Ganancia realizada: $${(sale.realizedProfit || 0).toFixed(2)}`);
      
      if (executed) {
        totalPercentageSold += sale.percentage || 0;
        totalSharesSold += sale.sharesToSell || 0;
        totalLiquidityReleased += sale.liquidityReleased || 0;
        totalRealizedProfit += sale.realizedProfit || 0;
      }
    });
  }
  
  print(`\n📊 RESUMEN DE VENTAS EJECUTADAS:`);
  print(`   Total % vendido: ${totalPercentageSold.toFixed(2)}%`);
  print(`   Total shares vendidas: ${totalSharesSold.toFixed(4)}`);
  print(`   Total liquidez liberada: $${totalLiquidityReleased.toFixed(2)}`);
  print(`   Total ganancia realizada: $${totalRealizedProfit.toFixed(2)}`);
  
  // 5. Verificar operaciones de venta
  const saleOperations = db.operations.find({
    ticker: symbol,
    operationType: 'VENTA',
    system: pool
  }).sort({ date: 1 }).toArray();
  
  print(`\n📋 OPERACIONES DE VENTA EN BD:`);
  print(`   Total operaciones encontradas: ${saleOperations.length}`);
  
  let totalSharesInOperations = 0;
  let totalAmountInOperations = 0;
  
  if (saleOperations.length === 0) {
    print('   ⚠️ No hay operaciones de venta registradas');
  } else {
    saleOperations.forEach((op, idx) => {
      const shares = Math.abs(op.quantity || 0);
      const amount = Math.abs(op.amount || 0);
      totalSharesInOperations += shares;
      totalAmountInOperations += amount;
      
      print(`\n   Operación ${idx + 1}:`);
      print(`     Fecha: ${formatDate(op.date)}`);
      print(`     Shares: ${shares.toFixed(4)}`);
      print(`     Precio: $${op.price || 'N/A'}`);
      print(`     Monto: $${amount.toFixed(2)}`);
      print(`     % vendido: ${op.partialSalePercentage || 'N/A'}%`);
      print(`     Venta completa: ${op.isPartialSale === false ? 'Sí' : 'No'}`);
      print(`     Notas: ${op.notes || 'N/A'}`);
    });
  }
  
  print(`\n📊 RESUMEN DE OPERACIONES:`);
  print(`   Total shares en operaciones: ${totalSharesInOperations.toFixed(4)}`);
  print(`   Total monto en operaciones: $${totalAmountInOperations.toFixed(2)}`);
  
  // 6. Verificar distribución de liquidez
  const liquidity = db.liquidities.findOne({ 
    pool: pool,
    'distributions.alertId': alertId.toString()
  });
  
  // Declarar distribution fuera del bloque para que esté disponible más adelante
  let distribution = null;
  
  print(`\n💰 DISTRIBUCIÓN DE LIQUIDEZ:`);
  if (!liquidity) {
    print('   ⚠️ No se encontró distribución de liquidez');
  } else {
    distribution = liquidity.distributions.find((d) => {
      return d.alertId && d.alertId.toString() === alertId.toString();
    });
    
    if (!distribution) {
      print('   ⚠️ No se encontró distribución para esta alerta');
    } else {
      print(`   Shares en distribución: ${(distribution.shares || 0).toFixed(4)}`);
      print(`   Shares vendidas (soldShares): ${(distribution.soldShares || 0).toFixed(4)}`);
      print(`   Monto asignado: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
      print(`   Ganancia realizada: $${(distribution.realizedProfitLoss || 0).toFixed(2)}`);
      print(`   Activa: ${distribution.isActive ? 'Sí' : 'No'}`);
      
      // Verificar consistencia
      const distTotalShares = (distribution.shares || 0) + (distribution.soldShares || 0);
      const distSoldShares = distribution.soldShares || 0;
      
      print(`\n   🔍 VERIFICACIÓN:`);
      print(`     Shares totales (actuales + vendidas): ${distTotalShares.toFixed(4)}`);
      print(`     Shares originales en alerta: ${originalShares.toFixed(4)}`);
      
      if (Math.abs(distTotalShares - originalShares) > 0.0001) {
        print(`     ⚠️ DISCREPANCIA: Las shares no coinciden!`);
        print(`        Diferencia: ${(distTotalShares - originalShares).toFixed(4)}`);
      } else {
        print(`     ✅ Las shares coinciden`);
      }
      
      // Verificar soldShares vs ventas parciales
      const sharesSoldInPartialSales = totalSharesSold;
      print(`\n   🔍 VERIFICACIÓN DE SOLD SHARES:`);
      print(`     SoldShares en distribución: ${distSoldShares.toFixed(4)}`);
      print(`     Shares vendidas en ventas parciales: ${sharesSoldInPartialSales.toFixed(4)}`);
      
      if (Math.abs(distSoldShares - sharesSoldInPartialSales) > 0.0001) {
        print(`     ⚠️ DISCREPANCIA: soldShares no coincide con ventas parciales!`);
        print(`        Diferencia: ${(distSoldShares - sharesSoldInPartialSales).toFixed(4)}`);
        print(`        Esto causará que el % vendido se muestre incorrecto en la interfaz`);
      } else {
        print(`     ✅ soldShares coincide con ventas parciales`);
      }
      
      // Calcular % vendido que se mostraría en la interfaz
      const displayedPercentage = distTotalShares > 0 
        ? (distSoldShares / distTotalShares) * 100 
        : 0;
      const correctPercentage = originalShares > 0 
        ? (sharesSoldInPartialSales / originalShares) * 100 
        : 0;
      
      print(`\n   📊 PORCENTAJE VENDIDO:`);
      print(`     % que se muestra actualmente: ${displayedPercentage.toFixed(2)}%`);
      print(`     % correcto (desde ventas parciales): ${correctPercentage.toFixed(2)}%`);
      
      if (Math.abs(displayedPercentage - correctPercentage) > 0.01) {
        print(`     ⚠️ DISCREPANCIA: El % mostrado es incorrecto!`);
        print(`        Diferencia: ${(displayedPercentage - correctPercentage).toFixed(2)}%`);
      } else {
        print(`     ✅ El % mostrado es correcto`);
      }
    }
  }
  
  // 7. ANÁLISIS DE DISCREPANCIAS
  print(`\n${'='.repeat(80)}`);
  print(`🔍 ANÁLISIS DE DISCREPANCIAS`);
  print('='.repeat(80));
  
  const issues = [];
  
  // Verificar participación vs ventas
  if (Math.abs(expectedSoldPercentage - totalPercentageSold) > 0.01) {
    issues.push({
      type: 'PARTICIPATION',
      message: `El participationPercentage indica ${expectedSoldPercentage}% vendido, pero las ventas parciales suman ${totalPercentageSold.toFixed(2)}%`
    });
  }
  
  // Verificar shares en alerta vs ventas
  const sharesSoldInAlerts = originalShares - currentShares;
  if (Math.abs(sharesSoldInAlerts - totalSharesSold) > 0.0001) {
    issues.push({
      type: 'SHARES_ALERT',
      message: `Las shares en la alerta indican ${sharesSoldInAlerts.toFixed(4)} vendidas, pero las ventas parciales suman ${totalSharesSold.toFixed(4)}`
    });
  }
  
  // Verificar shares en operaciones vs ventas
  if (Math.abs(totalSharesInOperations - totalSharesSold) > 0.0001) {
    issues.push({
      type: 'SHARES_OPERATIONS',
      message: `Las operaciones registran ${totalSharesInOperations.toFixed(4)} shares vendidas, pero las ventas parciales suman ${totalSharesSold.toFixed(4)}`
    });
  }
  
  // Verificar liquidez liberada
  const expectedLiquidityReleased = originalAllocatedAmount - currentAllocatedAmount;
  if (Math.abs(expectedLiquidityReleased - totalLiquidityReleased) > 0.01) {
    issues.push({
      type: 'LIQUIDITY',
      message: `La liquidez en la alerta indica $${expectedLiquidityReleased.toFixed(2)} liberada, pero las ventas parciales suman $${totalLiquidityReleased.toFixed(2)}`
    });
  }
  
  // Verificar soldShares en distribución de liquidez
  if (liquidity && distribution) {
    const distSoldShares = distribution.soldShares || 0;
    if (Math.abs(distSoldShares - totalSharesSold) > 0.0001) {
      const displayedPercentage = (distribution.shares || 0) + distSoldShares > 0
        ? (distSoldShares / ((distribution.shares || 0) + distSoldShares)) * 100
        : 0;
      const correctPercentage = originalShares > 0
        ? (totalSharesSold / originalShares) * 100
        : 0;
      
      issues.push({
        type: 'DISTRIBUTION_SOLD_SHARES',
        message: `La distribución de liquidez tiene ${distSoldShares.toFixed(4)} soldShares, pero las ventas parciales suman ${totalSharesSold.toFixed(4)}. Esto hace que se muestre ${displayedPercentage.toFixed(2)}% vendido en lugar de ${correctPercentage.toFixed(2)}%`
      });
    }
  }
  
  if (issues.length === 0) {
    print(`\n✅ No se encontraron discrepancias. Todo está consistente.`);
  } else {
    print(`\n⚠️ Se encontraron ${issues.length} discrepancia(s):`);
    issues.forEach((issue, idx) => {
      print(`\n   ${idx + 1}. [${issue.type}] ${issue.message}`);
    });
  }
  
  return {
    alert,
    participationPercentage,
    expectedSoldPercentage,
    totalPercentageSold,
    totalSharesSold,
    totalSharesInOperations,
    totalLiquidityReleased,
    issues
  };
}

// Verificar AEM
print('\n');
const aemResult = verifyAlert('AEM');

// Verificar EBAY
print('\n');
const ebayResult = verifyAlert('EBAY');

// Resumen final
print(`\n${'='.repeat(80)}`);
print(`📊 RESUMEN FINAL`);
print('='.repeat(80));

if (aemResult) {
  print(`\nAEM:`);
  print(`   Participación actual: ${aemResult.participationPercentage}%`);
  print(`   % vendido esperado: ${aemResult.expectedSoldPercentage.toFixed(2)}%`);
  print(`   % vendido en ventas parciales: ${aemResult.totalPercentageSold.toFixed(2)}%`);
  print(`   Shares vendidas (ventas parciales): ${aemResult.totalSharesSold.toFixed(4)}`);
  print(`   Shares vendidas (operaciones): ${aemResult.totalSharesInOperations.toFixed(4)}`);
  print(`   Discrepancias encontradas: ${aemResult.issues.length}`);
}

if (ebayResult) {
  print(`\nEBAY:`);
  print(`   Participación actual: ${ebayResult.participationPercentage}%`);
  print(`   % vendido esperado: ${ebayResult.expectedSoldPercentage.toFixed(2)}%`);
  print(`   % vendido en ventas parciales: ${ebayResult.totalPercentageSold.toFixed(2)}%`);
  print(`   Shares vendidas (ventas parciales): ${ebayResult.totalSharesSold.toFixed(4)}`);
  print(`   Shares vendidas (operaciones): ${ebayResult.totalSharesInOperations.toFixed(4)}`);
  print(`   Discrepancias encontradas: ${ebayResult.issues.length}`);
}

print(`\n${'='.repeat(80)}`);
print('✅ Verificación completada');
print('='.repeat(80));
