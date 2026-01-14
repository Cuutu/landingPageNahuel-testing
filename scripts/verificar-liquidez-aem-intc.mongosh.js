// Script para verificar la liquidez disponible y cómo debería actualizarse
// después de las correcciones de AEM e INTC

print('🔍 VERIFICACIÓN - Liquidez de AEM e INTC');
print('==============================================================================');
print('');

// Obtener liquidez del pool TraderCall
const liquidity = db.liquidities.findOne({ pool: 'TraderCall' });

if (!liquidity) {
  print('❌ No se encontró documento de liquidez para TraderCall');
  quit();
}

print('📊 LIQUIDEZ ACTUAL DEL POOL (TraderCall):');
print('Liquidez Total: $' + (liquidity.totalLiquidity || 0).toFixed(2));
print('Liquidez Distribuida: $' + (liquidity.distributedLiquidity || 0).toFixed(2));
print('Liquidez Disponible: $' + (liquidity.availableLiquidity || 0).toFixed(2));
print('');

// Analizar AEM
print('==============================================================================');
print('📊 AEM - Estado de Liquidez');
print('==============================================================================');
const aemAlert = db.alerts.findOne({ symbol: 'AEM', status: 'ACTIVE' });

if (aemAlert) {
  const aemLiquidityData = aemAlert.liquidityData || {};
  const aemPartialSales = aemLiquidityData.partialSales || [];
  const aemAllocatedAmount = aemLiquidityData.allocatedAmount || 0;
  const aemOriginalAllocatedAmount = aemLiquidityData.originalAllocatedAmount || 0;
  
  print('Liquidez asignada ORIGINAL: $' + aemOriginalAllocatedAmount.toFixed(2));
  print('Liquidez asignada ACTUAL: $' + aemAllocatedAmount.toFixed(2));
  print('Liquidez liberada (vendida): $' + (aemOriginalAllocatedAmount - aemAllocatedAmount).toFixed(2));
  print('');
  
  // Buscar distribución
  const distributions = liquidity.distributions || [];
  const aemDistribution = distributions.find((d) => {
    return d.alertId && d.alertId.toString() === aemAlert._id.toString();
  });
  
  if (aemDistribution) {
    print('📋 DISTRIBUCIÓN EN LIQUIDITY:');
    print('Allocated Amount: $' + (aemDistribution.allocatedAmount || 0).toFixed(2));
    print('Shares: ' + (aemDistribution.shares || 0).toFixed(4));
    print('');
  }
  
  // Calcular liquidez total liberada por ventas ejecutadas
  let aemTotalLiquidityReleased = 0;
  aemPartialSales.forEach((sale) => {
    if (sale.executed && !sale.discarded) {
      aemTotalLiquidityReleased += sale.liquidityReleased || 0;
    }
  });
  
  print('💰 LIQUIDEZ LIBERADA POR VENTAS EJECUTADAS:');
  print('Total liquidez liberada: $' + aemTotalLiquidityReleased.toFixed(2));
  print('Liquidez liberada esperada: $' + (aemOriginalAllocatedAmount - aemAllocatedAmount).toFixed(2));
  print('');
}

// Analizar INTC
print('==============================================================================');
print('📊 INTC - Estado de Liquidez (Antes de correcciones)');
print('==============================================================================');
const intcAlert = db.alerts.findOne({ symbol: 'INTC', status: 'ACTIVE' });

if (intcAlert) {
  const intcLiquidityData = intcAlert.liquidityData || {};
  const intcPartialSales = intcLiquidityData.partialSales || [];
  const intcAllocatedAmount = intcLiquidityData.allocatedAmount || 0;
  const intcOriginalAllocatedAmount = intcLiquidityData.originalAllocatedAmount || 0;
  
  print('Liquidez asignada ORIGINAL: $' + intcOriginalAllocatedAmount.toFixed(2));
  print('Liquidez asignada ACTUAL: $' + intcAllocatedAmount.toFixed(2));
  print('Liquidez liberada (vendida): $' + (intcOriginalAllocatedAmount - intcAllocatedAmount).toFixed(2));
  print('');
  
  // Buscar distribución
  const distributions = liquidity.distributions || [];
  const intcDistribution = distributions.find((d) => {
    return d.alertId && d.alertId.toString() === intcAlert._id.toString();
  });
  
  if (intcDistribution) {
    print('📋 DISTRIBUCIÓN EN LIQUIDITY:');
    print('Allocated Amount: $' + (intcDistribution.allocatedAmount || 0).toFixed(2));
    print('Shares: ' + (intcDistribution.shares || 0).toFixed(4));
    print('');
  }
  
  // Analizar ventas
  print('📋 VENTAS PARCIALES:');
  let intcTotalLiquidityReleased = 0;
  let sale2LiquidityReleased = 0; // Venta del 9 de enero (a desestimar)
  let sale3LiquidityReleased = 0; // Venta pendiente (a confirmar)
  
  intcPartialSales.forEach((sale, idx) => {
    const saleDate = new Date(sale.date || sale.executedAt);
    const saleLiquidityReleased = sale.liquidityReleased || 0;
    
    print('  Venta #' + (idx + 1) + ':');
    print('    Fecha: ' + sale.date);
    print('    % vendido: ' + (sale.percentage || 0) + '%');
    print('    Liquidez liberada: $' + saleLiquidityReleased.toFixed(2));
    print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
    print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
    print('');
    
    if (sale.executed && !sale.discarded) {
      intcTotalLiquidityReleased += saleLiquidityReleased;
      
      // Identificar venta del 9 de enero (a desestimar)
      if (saleDate.getFullYear() === 2026 && saleDate.getMonth() === 0 && saleDate.getDate() === 9) {
        sale2LiquidityReleased = saleLiquidityReleased;
      }
    } else if (!sale.executed && !sale.discarded) {
      // Venta pendiente (a confirmar)
      sale3LiquidityReleased = sale.sharesToSell * (intcAlert.currentPrice || 47.90);
    }
  });
  
  print('💰 LIQUIDEZ LIBERADA POR VENTAS EJECUTADAS:');
  print('Total liquidez liberada (actual): $' + intcTotalLiquidityReleased.toFixed(2));
  print('Liquidez liberada esperada: $' + (intcOriginalAllocatedAmount - intcAllocatedAmount).toFixed(2));
  print('');
  
  print('📊 DESPUÉS DE CORRECCIONES:');
  print('');
  print('1. DESESTIMAR VENTA DEL 9 DE ENERO:');
  print('   - Liquidez a REVERTIR (volver a asignar): $' + sale2LiquidityReleased.toFixed(2));
  print('   - Esta liquidez DEBE volver a estar asignada (no disponible)');
  print('');
  print('2. CONFIRMAR VENTA PENDIENTE DEL 25%:');
  print('   - Liquidez a LIBERAR (hacer disponible): ~$' + sale3LiquidityReleased.toFixed(2));
  print('   - Esta liquidez DEBE sumarse a la liquidez disponible');
  print('');
  
  const netLiquidityChange = sale3LiquidityReleased - sale2LiquidityReleased;
  print('📊 CAMBIO NETO EN LIQUIDEZ DISPONIBLE:');
  print('Cambio neto: $' + netLiquidityChange.toFixed(2) + ' (' + (netLiquidityChange > 0 ? 'AUMENTA' : 'DISMINUYE') + ')');
  print('');
  
  const currentAvailable = liquidity.availableLiquidity || 0;
  const newAvailable = currentAvailable + netLiquidityChange;
  const currentDistributed = liquidity.distributedLiquidity || 0;
  const newDistributed = currentDistributed - netLiquidityChange;
  
  print('💰 LIQUIDEZ DESPUÉS DE CORRECCIONES:');
  print('Liquidez Disponible actual: $' + currentAvailable.toFixed(2));
  print('Liquidez Disponible nueva: $' + newAvailable.toFixed(2));
  print('Liquidez Distribuida actual: $' + currentDistributed.toFixed(2));
  print('Liquidez Distribuida nueva: $' + newDistributed.toFixed(2));
  print('');
}

print('==============================================================================');
print('✅ Verificación completada');
print('==============================================================================');
print('');
print('⚠️ IMPORTANTE: Las correcciones de INTC deben actualizar:');
print('   1. La liquidez disponible del pool');
print('   2. La liquidez distribuida del pool');
print('   3. La distribución de INTC en Liquidity');
print('');
