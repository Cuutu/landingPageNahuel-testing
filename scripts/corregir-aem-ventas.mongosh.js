// Script para corregir las ventas de AEM
// El problema es que las shares actuales no corresponden con el % de tenencia que quedaría

const DRY_RUN = true; // Cambiar a false para ejecutar realmente

print('🔧 CORRECCIÓN - Ventas de AEM');
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
const originalShares = aemLiquidityData.originalShares || 0.2906;
const originalAllocatedAmount = aemLiquidityData.originalAllocatedAmount || 48.80;
const originalParticipation = aemLiquidityData.originalParticipationPercentage || 100;
const entryPrice = aemAlert.entryPrice || 167.92;
const currentPrice = aemAlert.currentPrice || 199.08;

print('📊 ESTADO ACTUAL:');
print('Acciones originales: ' + originalShares.toFixed(4));
print('Acciones actuales: ' + (aemLiquidityData.shares || 0).toFixed(4));
print('Participación actual: ' + (aemAlert.participationPercentage || 0) + '%');
print('Liquidez asignada actual: $' + (aemLiquidityData.allocatedAmount || 0).toFixed(2));
print('');

// Calcular shares y participación correctas basándose en ventas ejecutadas
let totalSharesSold = 0;
let totalPercentageSold = 0;
let totalLiquidityReleased = 0;
let totalRealizedProfit = 0;

print('📋 ANALIZANDO VENTAS EJECUTADAS:');
aemPartialSales.forEach((sale, idx) => {
  if (sale.executed && !sale.discarded) {
    const saleShares = sale.sharesToSell || 0;
    const salePercentage = sale.percentage || 0;
    const saleLiquidityReleased = sale.liquidityReleased || 0;
    const saleRealizedProfit = sale.realizedProfit || 0;
    
    totalSharesSold += saleShares;
    totalPercentageSold += salePercentage;
    totalLiquidityReleased += saleLiquidityReleased;
    totalRealizedProfit += saleRealizedProfit;
    
    print('  Venta #' + (idx + 1) + ':');
    print('    Fecha: ' + (sale.date || sale.executedAt));
    print('    % vendido: ' + salePercentage + '%');
    print('    Shares vendidas: ' + saleShares.toFixed(4));
    print('    Liquidez liberada: $' + saleLiquidityReleased.toFixed(2));
    print('');
  }
});

print('📊 RESUMEN DE VENTAS EJECUTADAS:');
print('Total shares vendidas: ' + totalSharesSold.toFixed(4));
print('Total % vendido: ' + totalPercentageSold.toFixed(2) + '%');
print('Total liquidez liberada: $' + totalLiquidityReleased.toFixed(2));
print('Total ganancia realizada: $' + totalRealizedProfit.toFixed(2));
print('');

// Calcular valores correctos
const correctRemainingShares = originalShares - totalSharesSold;
const correctRemainingParticipation = originalParticipation - totalPercentageSold;
const correctAllocatedAmount = correctRemainingShares * entryPrice;

print('📊 VALORES CORRECTOS (después de todas las ventas ejecutadas):');
print('Shares correctas restantes: ' + correctRemainingShares.toFixed(4));
print('Participación correcta restante: ' + correctRemainingParticipation.toFixed(2) + '%');
print('Liquidez asignada correcta: $' + correctAllocatedAmount.toFixed(2));
print('');

// Comparar con valores actuales
const currentShares = aemLiquidityData.shares || 0;
const currentParticipation = aemAlert.participationPercentage || 0;
const currentAllocatedAmount = aemLiquidityData.allocatedAmount || 0;

const sharesDifference = currentShares - correctRemainingShares;
const participationDifference = currentParticipation - correctRemainingParticipation;
const allocatedDifference = currentAllocatedAmount - correctAllocatedAmount;

print('📊 COMPARACIÓN:');
print('Shares actuales: ' + currentShares.toFixed(4));
print('Shares correctas: ' + correctRemainingShares.toFixed(4));
print('Diferencia: ' + sharesDifference.toFixed(4) + ' (' + (sharesDifference > 0 ? 'MÁS' : 'MENOS') + ' de lo correcto)');
print('');
print('Participación actual: ' + currentParticipation.toFixed(2) + '%');
print('Participación correcta: ' + correctRemainingParticipation.toFixed(2) + '%');
print('Diferencia: ' + participationDifference.toFixed(2) + '% (' + (participationDifference > 0 ? 'MÁS' : 'MENOS') + ' de lo correcto)');
print('');
print('Liquidez asignada actual: $' + currentAllocatedAmount.toFixed(2));
print('Liquidez asignada correcta: $' + correctAllocatedAmount.toFixed(2));
print('Diferencia: $' + allocatedDifference.toFixed(2));
print('');

if (Math.abs(sharesDifference) < 0.0001 && Math.abs(participationDifference) < 0.01) {
  print('✅ Los valores actuales son correctos. No se necesita corrección.');
  quit();
}

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios');
  print('');
  print('Si esto se ejecutara, se haría:');
  print('1. ACTUALIZAR ALERTA:');
  print('   - Shares: ' + currentShares.toFixed(4) + ' → ' + correctRemainingShares.toFixed(4));
  print('   - Participación: ' + currentParticipation.toFixed(2) + '% → ' + correctRemainingParticipation.toFixed(2) + '%');
  print('   - AllocatedAmount: $' + currentAllocatedAmount.toFixed(2) + ' → $' + correctAllocatedAmount.toFixed(2));
  print('');
  print('2. ACTUALIZAR DISTRIBUCIÓN EN LIQUIDITY:');
  print('   - Ajustar shares y allocatedAmount en la distribución de TraderCall');
} else {
  print('🔧 EJECUTANDO CORRECCIONES...');
  print('');
  
  // Actualizar la alerta
  db.alerts.updateOne(
    { _id: aemAlertId },
    {
      $set: {
        'liquidityData.shares': correctRemainingShares,
        'liquidityData.allocatedAmount': correctAllocatedAmount,
        'participationPercentage': correctRemainingParticipation
      }
    }
  );
  print('✅ Alerta actualizada');
  print('   - Shares: ' + correctRemainingShares.toFixed(4));
  print('   - Participación: ' + correctRemainingParticipation.toFixed(2) + '%');
  print('   - AllocatedAmount: $' + correctAllocatedAmount.toFixed(2));
  
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
      
      // Calcular la diferencia
      const sharesDiff = correctRemainingShares - currentDistributionShares;
      const allocatedDiff = correctAllocatedAmount - currentDistributionAllocated;
      
      // Ajustar soldShares (si las shares aumentan, significa que vendimos menos)
      const currentSoldShares = distribution.soldShares || 0;
      const newSoldShares = currentSoldShares - sharesDiff; // Si shares aumentan, soldShares disminuye
      
      distributions[distributionIndex] = {
        ...distribution,
        shares: correctRemainingShares,
        allocatedAmount: correctAllocatedAmount,
        soldShares: Math.max(0, newSoldShares)
      };
      
      db.liquidities.updateOne(
        { _id: liquidity._id },
        {
          $set: {
            distributions: distributions
          }
        }
      );
      print('✅ Distribución en Liquidity actualizada');
      print('   - Shares: ' + currentDistributionShares.toFixed(4) + ' → ' + correctRemainingShares.toFixed(4));
      print('   - AllocatedAmount: $' + currentDistributionAllocated.toFixed(2) + ' → $' + correctAllocatedAmount.toFixed(2));
    } else {
      print('⚠️ No se encontró distribución en Liquidity para actualizar');
    }
  } else {
    print('⚠️ No se encontró documento de Liquidity para actualizar');
  }
  
  print('');
  print('✅ Corrección aplicada');
}

print('==============================================================================');
print('✅ Proceso completado');
print('==============================================================================');
