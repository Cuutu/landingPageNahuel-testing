// Script para analizar AEM antes de la venta de hoy
// Identifica la venta de hoy y muestra el estado previo

print('🔍 ANÁLISIS - AEM Antes de la Venta de Hoy');
print('==============================================================================');
print('');

const aemAlert = db.alerts.findOne({ symbol: 'AEM', status: 'ACTIVE' });

if (!aemAlert) {
  print('❌ No se encontró alerta AEM activa');
  quit();
}

const aemAlertId = aemAlert._id;
const aemLiquidityData = aemAlert.liquidityData || {};
const aemPartialSales = aemLiquidityData.partialSales || [];

print('📊 ESTADO ACTUAL DE AEM:');
print('ID: ' + aemAlertId);
print('Status: ' + aemAlert.status);
print('Participación actual: ' + (aemAlert.participationPercentage || 0) + '%');
print('Shares actuales: ' + (aemLiquidityData.shares || 0).toFixed(4));
print('Liquidez asignada actual: $' + (aemLiquidityData.allocatedAmount || 0).toFixed(2));
print('');

// Buscar venta de hoy
const today = new Date();
today.setHours(0, 0, 0, 0);

let saleTodayIndex = -1;
let saleToday = null;

for (let i = 0; i < aemPartialSales.length; i++) {
  const sale = aemPartialSales[i];
  const saleDate = new Date(sale.date || sale.executedAt);
  saleDate.setHours(0, 0, 0, 0);
  
  if (saleDate.getTime() === today.getTime() && sale.executed && !sale.discarded) {
    saleToday = sale;
    saleTodayIndex = i;
    break;
  }
}

if (!saleToday) {
  print('⚠️ No se encontró venta ejecutada de hoy');
  print('');
  print('Todas las ventas:');
  aemPartialSales.forEach((sale, idx) => {
    print('  Venta #' + (idx + 1) + ':');
    print('    Fecha: ' + sale.date);
    print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
    print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
  });
  quit();
}

print('✅ VENTA DE HOY ENCONTRADA:');
print('Índice en array: ' + saleTodayIndex);
print('Fecha: ' + saleToday.date);
print('% vendido: ' + (saleToday.percentage || 0) + '%');
print('Shares vendidas: ' + (saleToday.sharesToSell || 0).toFixed(4));
print('Precio de venta: $' + (saleToday.sellPrice || 0).toFixed(2));
print('Liquidez liberada: $' + (saleToday.liquidityReleased || 0).toFixed(2));
print('Ganancia realizada: $' + (saleToday.realizedProfit || 0).toFixed(2));
print('');

// Calcular estado ANTES de la venta de hoy
const originalShares = aemLiquidityData.originalShares || 0;
const originalAllocatedAmount = aemLiquidityData.originalAllocatedAmount || 0;
const originalParticipation = aemLiquidityData.originalParticipationPercentage || 100;
const entryPrice = aemAlert.entryPrice || 0;

const currentShares = aemLiquidityData.shares || 0;
const currentAllocatedAmount = aemLiquidityData.allocatedAmount || 0;
const currentParticipation = aemAlert.participationPercentage || 0;

const saleTodayShares = saleToday.sharesToSell || 0;
const saleTodayPercentage = saleToday.percentage || 0;
const saleTodayLiquidityReleased = saleToday.liquidityReleased || 0;

// Estado ANTES de la venta de hoy
const sharesBeforeTodaySale = currentShares + saleTodayShares;
const participationBeforeTodaySale = currentParticipation + saleTodayPercentage;
const allocatedAmountBeforeTodaySale = sharesBeforeTodaySale * entryPrice;

print('📊 ESTADO ANTES DE LA VENTA DE HOY:');
print('Shares: ' + sharesBeforeTodaySale.toFixed(4) + ' (actual: ' + currentShares.toFixed(4) + ' + venta: ' + saleTodayShares.toFixed(4) + ')');
print('Participación: ' + participationBeforeTodaySale.toFixed(2) + '% (actual: ' + currentParticipation.toFixed(2) + '% + venta: ' + saleTodayPercentage.toFixed(2) + '%)');
print('Liquidez asignada: $' + allocatedAmountBeforeTodaySale.toFixed(2) + ' (actual: $' + currentAllocatedAmount.toFixed(2) + ')');
print('');

// Buscar distribución en Liquidity
const liquidity = db.liquidities.findOne({ 
  pool: 'TraderCall',
  'distributions.alertId': aemAlertId
});

let distributionBefore = null;
if (liquidity) {
  const distributions = liquidity.distributions || [];
  const distribution = distributions.find((d) => {
    return d.alertId && d.alertId.toString() === aemAlertId.toString();
  });
  
  if (distribution) {
    distributionBefore = distribution;
    print('📋 DISTRIBUCIÓN ACTUAL EN LIQUIDITY:');
    print('Shares: ' + (distribution.shares || 0).toFixed(4));
    print('Allocated Amount: $' + (distribution.allocatedAmount || 0).toFixed(2));
    print('Sold Shares: ' + (distribution.soldShares || 0).toFixed(4));
    print('');
    
    // Calcular distribución ANTES de la venta de hoy
    const distributionSharesBefore = (distribution.shares || 0) + saleTodayShares;
    const distributionAllocatedBefore = distributionSharesBefore * entryPrice;
    const distributionSoldSharesBefore = (distribution.soldShares || 0) - saleTodayShares;
    
    print('📋 DISTRIBUCIÓN ANTES DE LA VENTA DE HOY:');
    print('Shares: ' + distributionSharesBefore.toFixed(4));
    print('Allocated Amount: $' + distributionAllocatedBefore.toFixed(2));
    print('Sold Shares: ' + distributionSoldSharesBefore.toFixed(4));
    print('');
  }
}

// Buscar operación de venta de hoy
const operationToday = db.operations.findOne({
  alertId: aemAlertId,
  operationType: 'VENTA',
  date: {
    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  }
});

if (operationToday) {
  print('📋 OPERACIÓN DE VENTA DE HOY:');
  print('ID: ' + operationToday._id);
  print('Fecha: ' + operationToday.date);
  print('Cantidad: ' + operationToday.quantity);
  print('Precio: $' + (operationToday.price || 0).toFixed(2));
  print('Monto: $' + (operationToday.amount || 0).toFixed(2));
  print('Status: ' + (operationToday.status || 'N/A'));
  print('isPriceConfirmed: ' + (operationToday.isPriceConfirmed ? 'Sí' : 'No'));
  print('');
}

print('==============================================================================');
print('✅ Análisis completado');
print('==============================================================================');
print('');
print('📋 RESUMEN PARA ROLLBACK:');
print('Estado ANTES de la venta de hoy:');
print('  - Shares: ' + sharesBeforeTodaySale.toFixed(4));
print('  - Participación: ' + participationBeforeTodaySale.toFixed(2) + '%');
print('  - AllocatedAmount: $' + allocatedAmountBeforeTodaySale.toFixed(2));
if (distributionBefore) {
  const distributionSharesBefore = (distributionBefore.shares || 0) + saleTodayShares;
  const distributionAllocatedBefore = distributionSharesBefore * entryPrice;
  const distributionSoldSharesBefore = (distributionBefore.soldShares || 0) - saleTodayShares;
  print('  - Distribution Shares: ' + distributionSharesBefore.toFixed(4));
  print('  - Distribution AllocatedAmount: $' + distributionAllocatedBefore.toFixed(2));
  print('  - Distribution SoldShares: ' + distributionSoldSharesBefore.toFixed(4));
}
print('');
