// Script para analizar en detalle el problema de AEM

print('🔍 ANÁLISIS DETALLADO - Problema con AEM');
print('==============================================================================');
print('');

const aemAlert = db.alerts.findOne({ symbol: 'AEM', status: 'ACTIVE' });

if (!aemAlert) {
  print('❌ No se encontró alerta AEM activa');
  quit();
}

const aemLiquidityData = aemAlert.liquidityData || {};
const aemPartialSales = aemLiquidityData.partialSales || [];
const originalShares = aemLiquidityData.originalShares || 0;
const currentShares = aemLiquidityData.shares || 0;
const originalAllocatedAmount = aemLiquidityData.originalAllocatedAmount || 0;
const currentAllocatedAmount = aemLiquidityData.allocatedAmount || 0;
const originalParticipation = aemLiquidityData.originalParticipationPercentage || 100;
const currentParticipation = aemAlert.participationPercentage || 0;
const entryPrice = aemAlert.entryPrice || 0;

print('📊 ESTADO ACTUAL:');
print('Acciones ORIGINALES: ' + originalShares.toFixed(4));
print('Acciones ACTUALES: ' + currentShares.toFixed(4));
print('Participación ORIGINAL: ' + originalParticipation + '%');
print('Participación ACTUAL: ' + currentParticipation + '%');
print('Liquidez asignada ORIGINAL: $' + originalAllocatedAmount.toFixed(2));
print('Liquidez asignada ACTUAL: $' + currentAllocatedAmount.toFixed(2));
print('Precio de entrada: $' + entryPrice.toFixed(2));
print('');

print('📋 VENTAS PARCIALES:');
let totalSharesSold = 0;
let totalPercentageSold = 0;

aemPartialSales.forEach((sale, idx) => {
  const saleDate = sale.date || sale.executedAt || 'N/A';
  const saleShares = sale.sharesToSell || 0;
  const salePercentage = sale.percentage || 0;
  const executed = sale.executed || false;
  const discarded = sale.discarded || false;
  
  print('  Venta #' + (idx + 1) + ':');
  print('    Fecha: ' + saleDate);
  print('    % vendido: ' + salePercentage + '%');
  print('    Shares vendidas: ' + saleShares.toFixed(4));
  print('    Ejecutada: ' + (executed ? 'Sí' : 'No'));
  print('    Descartada: ' + (discarded ? 'Sí' : 'No'));
  print('');
  
  if (executed && !discarded) {
    totalSharesSold += saleShares;
    totalPercentageSold += salePercentage;
  }
});

print('📊 CÁLCULOS:');
print('Total shares vendidas (ejecutadas): ' + totalSharesSold.toFixed(4));
print('Total % vendido (ejecutadas): ' + totalPercentageSold.toFixed(2) + '%');
print('');

const expectedRemainingShares = originalShares - totalSharesSold;
const expectedRemainingParticipation = originalParticipation - totalPercentageSold;

print('📊 VALORES ESPERADOS:');
print('Shares esperadas restantes: ' + expectedRemainingShares.toFixed(4));
print('Participación esperada restante: ' + expectedRemainingParticipation.toFixed(2) + '%');
print('');

print('📊 VALORES ACTUALES:');
print('Shares actuales en alerta: ' + currentShares.toFixed(4));
print('Participación actual en alerta: ' + currentParticipation.toFixed(2) + '%');
print('');

const sharesDifference = currentShares - expectedRemainingShares;
const participationDifference = currentParticipation - expectedRemainingParticipation;

print('📊 DIFERENCIAS:');
print('Diferencia en shares: ' + sharesDifference.toFixed(4) + ' (' + (sharesDifference > 0 ? 'MÁS' : 'MENOS') + ' de lo esperado)');
print('Diferencia en participación: ' + participationDifference.toFixed(2) + '% (' + (participationDifference > 0 ? 'MÁS' : 'MENOS') + ' de lo esperado)');
print('');

// Buscar la venta más reciente (hoy)
const today = new Date();
today.setHours(0, 0, 0, 0);
const recentSales = aemPartialSales.filter((sale) => {
  const saleDate = new Date(sale.date || sale.executedAt);
  saleDate.setHours(0, 0, 0, 0);
  return saleDate.getTime() === today.getTime();
});

if (recentSales.length > 0) {
  print('📋 VENTA DE HOY:');
  recentSales.forEach((sale, idx) => {
    print('  Venta del día:');
    print('    % vendido: ' + (sale.percentage || 0) + '%');
    print('    Shares vendidas: ' + (sale.sharesToSell || 0).toFixed(4));
    print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
    print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
    print('');
    
    // Calcular qué debería quedar después de esta venta
    const sharesBeforeThisSale = originalShares - (totalSharesSold - (sale.sharesToSell || 0));
    const sharesAfterThisSale = sharesBeforeThisSale - (sale.sharesToSell || 0);
    const participationAfterThisSale = originalParticipation - totalPercentageSold;
    
    print('    📊 Si esta venta se ejecutó correctamente:');
    print('    Shares antes de esta venta: ' + sharesBeforeThisSale.toFixed(4));
    print('    Shares después de esta venta: ' + sharesAfterThisSale.toFixed(4));
    print('    Participación después: ' + participationAfterThisSale.toFixed(2) + '%');
    print('');
  });
}

// Verificar distribución en Liquidity
const liquidity = db.liquidities.findOne({ 
  pool: 'TraderCall',
  'distributions.alertId': aemAlert._id
});

if (liquidity) {
  const distributions = liquidity.distributions || [];
  const distribution = distributions.find((d) => {
    return d.alertId && d.alertId.toString() === aemAlert._id.toString();
  });
  
  if (distribution) {
    print('📋 DISTRIBUCIÓN EN LIQUIDITY:');
    print('Shares en distribución: ' + (distribution.shares || 0).toFixed(4));
    print('Allocated Amount: $' + (distribution.allocatedAmount || 0).toFixed(2));
    print('Sold Shares: ' + (distribution.soldShares || 0).toFixed(4));
    print('');
    
    const distributionDifference = (distribution.shares || 0) - currentShares;
    print('Diferencia entre distribución y alerta: ' + distributionDifference.toFixed(4) + ' shares');
    print('');
  }
}

print('==============================================================================');
print('✅ Análisis completado');
print('==============================================================================');
