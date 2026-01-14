// Script para hacer rollback de la venta de hoy en AEM
// Revierte el estado a antes de la venta de hoy

const DRY_RUN = false; // Cambiar a false para ejecutar realmente

print('🔧 ROLLBACK - AEM Venta de Hoy');
print('==============================================================================');
print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
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
const originalShares = aemLiquidityData.originalShares || 0;
const originalAllocatedAmount = aemLiquidityData.originalAllocatedAmount || 0;
const originalParticipation = aemLiquidityData.originalParticipationPercentage || 100;
const entryPrice = aemAlert.entryPrice || 0;

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
  print('❌ No se encontró venta ejecutada de hoy para revertir');
  quit();
}

const saleTodayShares = saleToday.sharesToSell || 0;
const saleTodayPercentage = saleToday.percentage || 0;
const saleTodayLiquidityReleased = saleToday.liquidityReleased || 0;

print('✅ VENTA DE HOY ENCONTRADA:');
print('Fecha: ' + saleToday.date);
print('% vendido: ' + saleTodayPercentage + '%');
print('Shares vendidas: ' + saleTodayShares.toFixed(4));
print('Liquidez liberada: $' + saleTodayLiquidityReleased.toFixed(2));
print('');

// Calcular estado ANTES de la venta de hoy
const currentShares = aemLiquidityData.shares || 0;
const currentAllocatedAmount = aemLiquidityData.allocatedAmount || 0;
const currentParticipation = aemAlert.participationPercentage || 0;

const sharesBeforeTodaySale = currentShares + saleTodayShares;
const participationBeforeTodaySale = currentParticipation + saleTodayPercentage;
const allocatedAmountBeforeTodaySale = sharesBeforeTodaySale * entryPrice;

print('📊 ESTADO ACTUAL (después de venta de hoy):');
print('Shares: ' + currentShares.toFixed(4));
print('Participación: ' + currentParticipation.toFixed(2) + '%');
print('AllocatedAmount: $' + currentAllocatedAmount.toFixed(2));
print('');

print('📊 ESTADO DESPUÉS DEL ROLLBACK (antes de venta de hoy):');
print('Shares: ' + sharesBeforeTodaySale.toFixed(4) + ' (+' + saleTodayShares.toFixed(4) + ')');
print('Participación: ' + participationBeforeTodaySale.toFixed(2) + '% (+' + saleTodayPercentage.toFixed(2) + '%)');
print('AllocatedAmount: $' + allocatedAmountBeforeTodaySale.toFixed(2));
print('');

// Eliminar la venta de hoy del array de partialSales
const updatedPartialSales = aemPartialSales.filter((sale, idx) => idx !== saleTodayIndex);

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios');
  print('');
  print('Si esto se ejecutara, se haría:');
  print('1. ALERTA:');
  print('   - Eliminar venta de hoy del array partialSales');
  print('   - Shares: ' + currentShares.toFixed(4) + ' → ' + sharesBeforeTodaySale.toFixed(4));
  print('   - Participación: ' + currentParticipation.toFixed(2) + '% → ' + participationBeforeTodaySale.toFixed(2) + '%');
  print('   - AllocatedAmount: $' + currentAllocatedAmount.toFixed(2) + ' → $' + allocatedAmountBeforeTodaySale.toFixed(2));
  print('');
  print('2. DISTRIBUCIÓN EN LIQUIDITY:');
  print('   - Revertir shares vendidas');
  print('   - Ajustar allocatedAmount');
  print('   - Actualizar liquidez disponible y distribuida');
  print('');
  print('3. OPERACIÓN:');
  print('   - Marcar operación de hoy como CANCELLED o eliminarla');
} else {
  print('🔧 EJECUTANDO ROLLBACK...');
  print('');
  
  // Actualizar la alerta
  db.alerts.updateOne(
    { _id: aemAlertId },
    {
      $set: {
        'liquidityData.partialSales': updatedPartialSales,
        'liquidityData.shares': sharesBeforeTodaySale,
        'liquidityData.allocatedAmount': allocatedAmountBeforeTodaySale,
        'participationPercentage': participationBeforeTodaySale
      }
    }
  );
  print('✅ Alerta actualizada');
  
  // Actualizar distribución en Liquidity
  const liquidity = db.liquidities.findOne({ 
    pool: 'TraderCall',
    'distributions.alertId': aemAlertId
  });
  
  if (liquidity) {
    const distributions = liquidity.distributions || [];
    const distributionIndex = distributions.findIndex((d) => {
      return d.alertId && d.alertId.toString() === aemAlertId.toString();
    });
    
    if (distributionIndex >= 0) {
      const distribution = distributions[distributionIndex];
      const currentDistributionShares = distribution.shares || 0;
      const currentDistributionAllocated = distribution.allocatedAmount || 0;
      const currentDistributionSoldShares = distribution.soldShares || 0;
      
      // Revertir venta de hoy: sumar shares, restar de soldShares
      const newDistributionShares = currentDistributionShares + saleTodayShares;
      const newDistributionAllocated = newDistributionShares * entryPrice;
      const newDistributionSoldShares = Math.max(0, currentDistributionSoldShares - saleTodayShares);
      
      // Calcular cambios en liquidez del pool
      // Al revertir la venta: la liquidez vuelve a estar asignada
      const netDistributedChange = saleTodayLiquidityReleased;
      const currentDistributedLiquidity = liquidity.distributedLiquidity || 0;
      const newDistributedLiquidity = Math.max(0, currentDistributedLiquidity + netDistributedChange);
      
      const currentTotalLiquidity = liquidity.totalLiquidity || 0;
      const currentAvailableLiquidity = liquidity.availableLiquidity || 0;
      const newAvailableLiquidity = currentTotalLiquidity - newDistributedLiquidity;
      
      distributions[distributionIndex] = {
        ...distribution,
        shares: newDistributionShares,
        allocatedAmount: newDistributionAllocated,
        soldShares: newDistributionSoldShares
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
      print('✅ Distribución en Liquidity actualizada');
      print('   - Shares: ' + currentDistributionShares.toFixed(4) + ' → ' + newDistributionShares.toFixed(4));
      print('   - AllocatedAmount: $' + currentDistributionAllocated.toFixed(2) + ' → $' + newDistributionAllocated.toFixed(2));
      print('   - DistributedLiquidity: $' + currentDistributedLiquidity.toFixed(2) + ' → $' + newDistributedLiquidity.toFixed(2));
      print('   - AvailableLiquidity: $' + currentAvailableLiquidity.toFixed(2) + ' → $' + newAvailableLiquidity.toFixed(2));
    }
  }
  
  // Marcar operación de hoy como CANCELLED
  const operationToday = db.operations.findOne({
    alertId: aemAlertId,
    operationType: 'VENTA',
    date: {
      $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    }
  });
  
  if (operationToday) {
    db.operations.updateOne(
      { _id: operationToday._id },
      {
        $set: {
          status: 'CANCELLED',
          isPriceConfirmed: true,
          notes: '❌ ROLLBACK: Venta revertida manualmente'
        }
      }
    );
    print('✅ Operación de hoy cancelada: ' + operationToday._id);
  }
  
  print('');
  print('✅ Rollback completado');
}

print('==============================================================================');
print('✅ Proceso completado');
print('==============================================================================');
print('');
print('📝 PRÓXIMOS PASOS:');
print('Después del rollback, podrás vender manualmente la posición con el % correcto.');
print('');
