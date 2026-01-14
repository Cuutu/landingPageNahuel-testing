// Script para vender el 25% de la participación de AEM
// Precio de venta: $200.08

const DRY_RUN = false; // Cambiar a false para ejecutar realmente
const SELL_PERCENTAGE = 25; // 25% del total original
const SELL_PRICE = 200.08; // Precio de venta

print('💰 VENTA MANUAL - AEM 25%');
print('==============================================================================');
print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
print('Porcentaje a vender: ' + SELL_PERCENTAGE + '% (del total original)');
print('Precio de venta: $' + SELL_PRICE.toFixed(2));
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

// Valores originales
const originalShares = aemLiquidityData.originalShares || 0.2906;
const originalAllocatedAmount = aemLiquidityData.originalAllocatedAmount || 48.80;
const originalParticipation = aemLiquidityData.originalParticipationPercentage || 100;

// Valores actuales (después del rollback)
const currentShares = aemLiquidityData.shares || 0.1453;
const currentAllocatedAmount = aemLiquidityData.allocatedAmount || 24.40;
const currentParticipation = aemAlert.participationPercentage || 50;
const entryPrice = aemAlert.entryPrice || 167.92;

print('📊 ESTADO ACTUAL (después del rollback):');
print('Acciones originales: ' + originalShares.toFixed(4));
print('Acciones actuales: ' + currentShares.toFixed(4));
print('Participación actual: ' + currentParticipation + '%');
print('Liquidez asignada actual: $' + currentAllocatedAmount.toFixed(2));
print('Precio de entrada: $' + entryPrice.toFixed(2));
print('');

// Calcular venta del 25% del TOTAL ORIGINAL
const sharesToSell = originalShares * (SELL_PERCENTAGE / 100);
const sharesRemaining = currentShares - sharesToSell;
const actualPercentageSold = originalShares > 0 ? (sharesToSell / originalShares) * 100 : 0;
const newParticipation = Math.max(0, currentParticipation - actualPercentageSold);

print('📊 CÁLCULO DE LA VENTA:');
print('Porcentaje a vender: ' + SELL_PERCENTAGE + '% (del total original)');
print('Shares a vender: ' + sharesToSell.toFixed(4) + ' (25% de ' + originalShares.toFixed(4) + ' originales)');
print('Shares restantes: ' + sharesRemaining.toFixed(4));
print('Participación después de venta: ' + newParticipation.toFixed(2) + '%');
print('');

// Calcular valores financieros
const liquidityReleased = sharesToSell * SELL_PRICE;
const marketValue = sharesToSell * SELL_PRICE;
const costBasis = sharesToSell * entryPrice;
const realizedProfit = marketValue - costBasis;
const newAllocatedAmount = sharesRemaining * entryPrice;

print('💰 VALORES FINANCIEROS:');
print('Precio de venta: $' + SELL_PRICE.toFixed(2));
print('Valor de mercado (proceeds): $' + marketValue.toFixed(2));
print('Costo base: $' + costBasis.toFixed(2));
print('Ganancia realizada: $' + realizedProfit.toFixed(2));
print('Liquidez liberada: $' + liquidityReleased.toFixed(2));
print('Liquidez asignada nueva: $' + newAllocatedAmount.toFixed(2));
print('');

// Verificar si es venta completa
const isCompleteSale = sharesRemaining <= 0.0001 || newParticipation <= 0;

if (isCompleteSale) {
  print('⚠️ Esta venta cerrará completamente la posición');
}

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios');
  print('');
  print('Si esto se ejecutara, se haría:');
  print('');
  print('1. ACTUALIZAR ALERTA:');
  print('   - Agregar venta al array partialSales');
  print('   - Shares: ' + currentShares.toFixed(4) + ' → ' + sharesRemaining.toFixed(4));
  print('   - Participación: ' + currentParticipation.toFixed(2) + '% → ' + newParticipation.toFixed(2) + '%');
  print('   - AllocatedAmount: $' + currentAllocatedAmount.toFixed(2) + ' → $' + newAllocatedAmount.toFixed(2));
  if (isCompleteSale) {
    print('   - Status: ACTIVE → CLOSED');
  }
  print('');
  print('2. ACTUALIZAR DISTRIBUCIÓN EN LIQUIDITY:');
  print('   - Reducir shares en distribución');
  print('   - Aumentar soldShares');
  print('   - Actualizar allocatedAmount');
  print('   - Actualizar liquidez disponible y distribuida del pool');
  print('');
  print('3. OPERACIÓN:');
  print('   - No se creará operación (ya existe en la base de datos)');
} else {
  print('🔧 EJECUTANDO VENTA...');
  print('');
  
  // Crear nueva venta parcial
  const newPartialSale = {
    date: new Date(),
    percentage: actualPercentageSold,
    sharesToSell: sharesToSell,
    sellPrice: SELL_PRICE,
    liquidityReleased: liquidityReleased,
    realizedProfit: realizedProfit,
    executedBy: 'MANUAL_SCRIPT',
    priceRange: null,
    emailMessage: null,
    emailImageUrl: null,
    isCompleteSale: isCompleteSale,
    executed: true,
    executedAt: new Date()
  };
  
  const updatedPartialSales = [...aemPartialSales, newPartialSale];
  
  // Actualizar la alerta
  const updateAlert = {
    'liquidityData.partialSales': updatedPartialSales,
    'liquidityData.shares': Math.max(0, sharesRemaining),
    'liquidityData.allocatedAmount': Math.max(0, newAllocatedAmount),
    'participationPercentage': Math.max(0, newParticipation)
  };
  
  if (isCompleteSale) {
    updateAlert.status = 'CLOSED';
    updateAlert.exitPrice = SELL_PRICE;
    updateAlert.exitDate = new Date();
    updateAlert.exitReason = 'MANUAL';
  }
  
  db.alerts.updateOne(
    { _id: aemAlertId },
    { $set: updateAlert }
  );
  print('✅ Alerta actualizada');
  print('   - Shares: ' + sharesRemaining.toFixed(4));
  print('   - Participación: ' + newParticipation.toFixed(2) + '%');
  print('   - AllocatedAmount: $' + newAllocatedAmount.toFixed(2));
  if (isCompleteSale) {
    print('   - Status: CLOSED');
  }
  
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
      
      // Aplicar venta: reducir shares, aumentar soldShares
      const newDistributionShares = Math.max(0, currentDistributionShares - sharesToSell);
      const newDistributionAllocated = newDistributionShares * entryPrice;
      const newDistributionSoldShares = currentDistributionSoldShares + sharesToSell;
      
      // Calcular cambios en liquidez del pool
      // Al vender: la liquidez se libera (distributedLiquidity disminuye, availableLiquidity aumenta)
      // Pero también recibimos proceeds que aumentan totalLiquidity
      const currentDistributedLiquidity = liquidity.distributedLiquidity || 0;
      const currentTotalLiquidity = liquidity.totalLiquidity || 0;
      const currentAvailableLiquidity = liquidity.availableLiquidity || 0;
      
      // La liquidez distribuida disminuye en el costo base (lo que estaba asignado)
      const distributedLiquidityChange = costBasis;
      const newDistributedLiquidity = Math.max(0, currentDistributedLiquidity - distributedLiquidityChange);
      
      // El totalLiquidity aumenta con los proceeds (dinero recibido)
      const newTotalLiquidity = currentTotalLiquidity + marketValue;
      
      // La liquidez disponible aumenta (dinero recibido menos lo que estaba asignado)
      const newAvailableLiquidity = newTotalLiquidity - newDistributedLiquidity;
      
      distributions[distributionIndex] = {
        ...distribution,
        shares: newDistributionShares,
        allocatedAmount: newDistributionAllocated,
        soldShares: newDistributionSoldShares,
        realizedProfitLoss: (distribution.realizedProfitLoss || 0) + realizedProfit
      };
      
      db.liquidities.updateOne(
        { _id: liquidity._id },
        {
          $set: {
            distributions: distributions,
            distributedLiquidity: newDistributedLiquidity,
            totalLiquidity: newTotalLiquidity,
            availableLiquidity: newAvailableLiquidity
          }
        }
      );
      print('✅ Distribución en Liquidity actualizada');
      print('   - Shares: ' + currentDistributionShares.toFixed(4) + ' → ' + newDistributionShares.toFixed(4));
      print('   - AllocatedAmount: $' + currentDistributionAllocated.toFixed(2) + ' → $' + newDistributionAllocated.toFixed(2));
      print('   - SoldShares: ' + currentDistributionSoldShares.toFixed(4) + ' → ' + newDistributionSoldShares.toFixed(4));
      print('   - TotalLiquidity: $' + currentTotalLiquidity.toFixed(2) + ' → $' + newTotalLiquidity.toFixed(2));
      print('   - DistributedLiquidity: $' + currentDistributedLiquidity.toFixed(2) + ' → $' + newDistributedLiquidity.toFixed(2));
      print('   - AvailableLiquidity: $' + currentAvailableLiquidity.toFixed(2) + ' → $' + newAvailableLiquidity.toFixed(2));
    } else {
      print('⚠️ No se encontró distribución en Liquidity para actualizar');
    }
  } else {
    print('⚠️ No se encontró documento de Liquidity para actualizar');
  }
  
  // ✅ NO crear operación - la operación ya existe en la base de datos
  print('✅ Operación no creada (ya existe en la base de datos)');
  
  print('');
  print('✅ Venta ejecutada correctamente');
}

print('==============================================================================');
print('✅ Proceso completado');
print('==============================================================================');
