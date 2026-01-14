// Recalcular participacion de INTC en base a ventas ejecutadas
// Ajusta alert, distribution y liquidez del pool sin crear operaciones.
const DRY_RUN = true; // Cambiar a false para ejecutar realmente

print('🔧 RECALCULO - Participacion INTC (ejecutadas, no desestimadas)');
print('==============================================================================');
print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
print('==============================================================================');
print('');

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : (fallback || 0);
}

const alert = db.alerts.findOne({ symbol: 'INTC', status: 'ACTIVE' });

if (!alert) {
  print('❌ No se encontró alerta INTC activa');
  quit();
}

const alertId = alert._id;
const liquidityData = alert.liquidityData || {};
const partialSales = liquidityData.partialSales || [];
const entryPrice = toNumber(alert.entryPrice, 0);

let originalShares = toNumber(liquidityData.originalShares, 0);
if (!originalShares) {
  const originalAllocated = toNumber(liquidityData.originalAllocatedAmount, 0);
  if (entryPrice && originalAllocated) {
    originalShares = originalAllocated / entryPrice;
  } else {
    originalShares = toNumber(liquidityData.shares, 0);
  }
}

if (!originalShares) {
  print('❌ No se pudo determinar originalShares');
  quit();
}

const executedSales = partialSales.filter((sale) => {
  return sale && sale.executed && !sale.discarded && !sale.cancelled;
});

function getSalePercent(sale) {
  const saleShares = toNumber(sale.sharesToSell, 0);
  if (saleShares && originalShares) {
    return (saleShares / originalShares) * 100;
  }
  return toNumber(sale.percentage, 0);
}

let totalPercentageSold = 0;
let totalSharesSold = 0;
executedSales.forEach((sale) => {
  const salePercent = getSalePercent(sale);
  totalPercentageSold += salePercent;
  totalSharesSold += toNumber(sale.sharesToSell, 0);
});

if (totalPercentageSold > 100) {
  totalPercentageSold = 100;
}
if (totalPercentageSold < 0) {
  totalPercentageSold = 0;
}

const remainingPercentage = Math.max(0, 100 - totalPercentageSold);
const remainingShares = (originalShares * remainingPercentage) / 100;
const newAllocatedAmount = remainingShares * entryPrice;

const currentShares = toNumber(liquidityData.shares, 0);
const currentParticipation = toNumber(alert.participationPercentage, 0);
const currentAllocatedAmount = toNumber(liquidityData.allocatedAmount, 0);

print('📊 ESTADO ACTUAL:');
print('OriginalShares: ' + originalShares.toFixed(4));
print('Shares actuales: ' + currentShares.toFixed(4));
print('Participacion actual: ' + currentParticipation.toFixed(2) + '%');
print('Allocated actual: $' + currentAllocatedAmount.toFixed(2));
print('');
print('📌 VENTAS EJECUTADAS (no desestimadas): ' + executedSales.length);
print('Total % vendido (calculado): ' + totalPercentageSold.toFixed(2) + '%');
print('Total shares vendidas: ' + totalSharesSold.toFixed(4));
print('');
print('✅ NUEVO ESTADO ESPERADO:');
print('Shares: ' + remainingShares.toFixed(4));
print('Participacion: ' + remainingPercentage.toFixed(2) + '%');
print('Allocated: $' + newAllocatedAmount.toFixed(2));
print('');

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios');
  print('');
  print('Se actualizaria:');
  print('1) Alerta INTC:');
  print('   - liquidityData.shares: ' + currentShares.toFixed(4) + ' → ' + remainingShares.toFixed(4));
  print('   - liquidityData.allocatedAmount: $' + currentAllocatedAmount.toFixed(2) + ' → $' + newAllocatedAmount.toFixed(2));
  print('   - participationPercentage: ' + currentParticipation.toFixed(2) + '% → ' + remainingPercentage.toFixed(2) + '%');
  print('');
  print('2) Liquidity pool:');
  print('   - Actualizar distribucion INTC y ajustar liquidez del pool');
  print('');
  quit();
}

// Actualizar alerta
db.alerts.updateOne(
  { _id: alertId },
  {
    $set: {
      'liquidityData.shares': remainingShares,
      'liquidityData.allocatedAmount': newAllocatedAmount,
      participationPercentage: remainingPercentage
    }
  }
);
print('✅ Alerta INTC actualizada');

// Actualizar distribution y liquidez del pool
const liquidity = db.liquidities.findOne({
  pool: 'TraderCall',
  'distributions.alertId': alertId
});

if (!liquidity) {
  print('⚠️ No se encontró Liquidity para actualizar');
  quit();
}

const distributions = liquidity.distributions || [];
const distributionIndex = distributions.findIndex((d) => {
  return d.alertId && d.alertId.toString() === alertId.toString();
});

if (distributionIndex < 0) {
  print('⚠️ No se encontró distribución de INTC en Liquidity');
  quit();
}

const distribution = distributions[distributionIndex];
const distShares = toNumber(distribution.shares, 0);
const distAllocated = toNumber(distribution.allocatedAmount, 0);
const distSoldShares = toNumber(distribution.soldShares, 0);

const newSoldShares = Math.max(0, originalShares - remainingShares);
const deltaAllocated = newAllocatedAmount - distAllocated;

const currentDistributedLiquidity = toNumber(liquidity.distributedLiquidity, 0);
const currentTotalLiquidity = toNumber(liquidity.totalLiquidity, 0);

const newDistributedLiquidity = Math.max(0, currentDistributedLiquidity + deltaAllocated);
const newAvailableLiquidity = Math.max(0, currentTotalLiquidity - newDistributedLiquidity);

distributions[distributionIndex] = {
  ...distribution,
  shares: remainingShares,
  allocatedAmount: newAllocatedAmount,
  soldShares: newSoldShares
};

db.liquidities.updateOne(
  { _id: liquidity._id },
  {
    $set: {
      distributions: distributions,
      distributedLiquidity: newDistributedLiquidity,
      availableLiquidity: newAvailableLiquidity
    }
  }
);

print('✅ Liquidity actualizada');
print('   - Shares: ' + distShares.toFixed(4) + ' → ' + remainingShares.toFixed(4));
print('   - AllocatedAmount: $' + distAllocated.toFixed(2) + ' → $' + newAllocatedAmount.toFixed(2));
print('   - SoldShares: ' + distSoldShares.toFixed(4) + ' → ' + newSoldShares.toFixed(4));
print('   - DistributedLiquidity: $' + currentDistributedLiquidity.toFixed(2) + ' → $' + newDistributedLiquidity.toFixed(2));
print('   - AvailableLiquidity: $' + (toNumber(liquidity.availableLiquidity, 0)).toFixed(2) + ' → $' + newAvailableLiquidity.toFixed(2));

print('');
print('==============================================================================');
print('✅ Proceso completado');
print('==============================================================================');
