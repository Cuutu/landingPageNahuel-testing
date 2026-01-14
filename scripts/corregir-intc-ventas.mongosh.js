// Script completo para corregir las ventas de INTC:
// 1. Desestimar la venta del 9 de enero (Venta #2)
// 2. Confirmar la venta pendiente del 25% (Venta #3)

const DRY_RUN = false; // Cambiar a false para ejecutar realmente

print('🔧 CORRECCIÓN COMPLETA - Ventas de INTC');
print('==============================================================================');
print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
print('==============================================================================');
print('');

const intcAlert = db.alerts.findOne({ symbol: 'INTC', status: 'ACTIVE' });

if (!intcAlert) {
  print('❌ No se encontró alerta INTC activa');
  quit();
}

const intcAlertId = intcAlert._id;
const intcLiquidityData = intcAlert.liquidityData || {};
const intcPartialSales = intcLiquidityData.partialSales || [];
const originalShares = intcLiquidityData.originalShares || 1.2764;
const originalAllocatedAmount = intcLiquidityData.originalAllocatedAmount || 50.54;
const originalParticipation = intcLiquidityData.originalParticipationPercentage || 100;
const entryPrice = intcAlert.entryPrice || 39.53;
const currentPrice = intcAlert.currentPrice || 47.90;

print('📊 ESTADO ACTUAL:');
print('Acciones originales: ' + originalShares.toFixed(4));
print('Acciones actuales: ' + (intcLiquidityData.shares || 0).toFixed(4));
print('Participación actual: ' + (intcAlert.participationPercentage || 0) + '%');
print('');

// PASO 1: Desestimar la venta del 9 de enero (Venta #2)
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('PASO 1: Desestimar venta del 9 de enero (Venta #2)');
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('');

let sale2Index = -1;
let sale2 = null;

for (let i = 0; i < intcPartialSales.length; i++) {
  const sale = intcPartialSales[i];
  const saleDate = new Date(sale.date || sale.executedAt);
  if (saleDate.getFullYear() === 2026 && 
      saleDate.getMonth() === 0 && 
      saleDate.getDate() === 9 &&
      sale.executed && 
      !sale.discarded) {
    sale2 = sale;
    sale2Index = i;
    break;
  }
}

if (!sale2) {
  print('❌ No se encontró la venta del 9 de enero para desestimar');
  quit();
}

const sale2Shares = sale2.sharesToSell || 0.6382;
const sale2Percentage = sale2.percentage || 50;
const sale2LiquidityReleased = sale2.liquidityReleased || 0;

print('✅ Venta #2 encontrada:');
print('Fecha: ' + sale2.date);
print('% vendido: ' + sale2Percentage + '%');
print('Shares vendidas: ' + sale2Shares.toFixed(4));
print('Liquidez liberada: $' + sale2LiquidityReleased.toFixed(2));
print('');

// PASO 2: Confirmar la venta pendiente del 25% (Venta #3)
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('PASO 2: Confirmar venta pendiente del 25% (Venta #3)');
print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
print('');

let sale3Index = -1;
let sale3 = null;

for (let i = 0; i < intcPartialSales.length; i++) {
  const sale = intcPartialSales[i];
  if (!sale.executed && !sale.discarded && !sale.cancelled) {
    sale3 = sale;
    sale3Index = i;
    break;
  }
}

if (!sale3) {
  print('❌ No se encontró venta pendiente para confirmar');
  quit();
}

const sale3Shares = sale3.sharesToSell || 0.3191;
const sale3Percentage = sale3.percentage || 25;
const sale3PriceRange = sale3.priceRange || { min: 47.00, max: 50.00 };

print('✅ Venta #3 encontrada:');
print('Fecha: ' + sale3.date);
print('% vendido: ' + sale3Percentage + '%');
print('Shares a vender: ' + sale3Shares.toFixed(4));
print('Rango de precio: $' + sale3PriceRange.min.toFixed(2) + ' - $' + sale3PriceRange.max.toFixed(2));
print('');

// Verificar que el precio actual esté en el rango
const priceInRange = currentPrice >= sale3PriceRange.min && currentPrice <= sale3PriceRange.max;
print('📊 Verificación de precio:');
print('Precio actual: $' + currentPrice.toFixed(2));
print('Rango esperado: $' + sale3PriceRange.min.toFixed(2) + ' - $' + sale3PriceRange.max.toFixed(2));
print('¿Está en rango? ' + (priceInRange ? '✅ Sí' : '⚠️ No (se usará el precio actual de todas formas)'));
print('');

// Calcular nuevos valores después de las correcciones
// Estado actual (después de ventas ejecutadas: Venta #1 del 7 de enero = 50%)
const currentShares = intcLiquidityData.shares || 0.3191;
const currentParticipation = intcAlert.participationPercentage || 25;

// Después de desestimar Venta #2: revertir sus efectos
// Shares después de desestimar Venta #2 = actual + shares de Venta #2
const sharesAfterDiscardingSale2 = currentShares + sale2Shares;
const actualPercentageSoldSale2 = originalShares > 0 ? (sale2Shares / originalShares) * 100 : 0;
const participationAfterDiscardingSale2 = currentParticipation + actualPercentageSoldSale2;

print('📊 DESPUÉS DE DESESTIMAR VENTA #2:');
print('Shares: ' + sharesAfterDiscardingSale2.toFixed(4) + ' (+' + sale2Shares.toFixed(4) + ')');
print('Participación: ' + participationAfterDiscardingSale2.toFixed(2) + '% (+' + actualPercentageSoldSale2.toFixed(2) + '%)');
print('');

// Después de confirmar Venta #3: aplicar sus efectos
const sharesAfterConfirmingSale3 = sharesAfterDiscardingSale2 - sale3Shares;
const actualPercentageSoldSale3 = originalShares > 0 ? (sale3Shares / originalShares) * 100 : 0;
const participationAfterConfirmingSale3 = participationAfterDiscardingSale2 - actualPercentageSoldSale3;

// Calcular valores de la venta #3
const sellPrice = currentPrice; // Usar precio actual
const liquidityReleasedSale3 = sale3Shares * sellPrice;
const realizedProfitSale3 = liquidityReleasedSale3 - (sale3Shares * entryPrice);
const newAllocatedAmount = sharesAfterConfirmingSale3 * entryPrice;

print('📊 DESPUÉS DE CONFIRMAR VENTA #3:');
print('Shares: ' + sharesAfterConfirmingSale3.toFixed(4) + ' (-' + sale3Shares.toFixed(4) + ')');
print('Participación: ' + participationAfterConfirmingSale3.toFixed(2) + '% (-' + actualPercentageSoldSale3.toFixed(2) + '%)');
print('Precio de venta: $' + sellPrice.toFixed(2));
print('Liquidez liberada: $' + liquidityReleasedSale3.toFixed(2));
print('Ganancia realizada: $' + realizedProfitSale3.toFixed(2));
print('Liquidez asignada nueva: $' + newAllocatedAmount.toFixed(2));
print('');

// Actualizar arrays de partialSales
const updatedPartialSales = intcPartialSales.map((sale, idx) => {
  if (idx === sale2Index) {
    // Desestimar Venta #2
    return {
      ...sale,
      executed: false,
      discarded: true,
      discardedAt: new Date(),
      discardReason: 'Venta desestimada - precio fuera de rango'
    };
  } else if (idx === sale3Index) {
    // Confirmar Venta #3
    return {
      ...sale,
      executed: true,
      executedAt: new Date(),
      sellPrice: sellPrice,
      liquidityReleased: liquidityReleasedSale3,
      realizedProfit: realizedProfitSale3,
      priceRange: null
    };
  }
  return sale;
});

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios');
  print('');
  print('Si esto se ejecutara, se haría:');
  print('');
  print('1. VENTA #2 (Desestimar):');
  print('   - Marcar como discarded: true, executed: false');
  print('   - Revertir shares: ' + currentShares.toFixed(4) + ' → ' + sharesAfterDiscardingSale2.toFixed(4));
  print('   - Revertir participación: ' + currentParticipation.toFixed(2) + '% → ' + participationAfterDiscardingSale2.toFixed(2) + '%');
  print('');
  print('2. VENTA #3 (Confirmar):');
  print('   - Marcar como executed: true');
  print('   - Precio de venta: $' + sellPrice.toFixed(2));
  print('   - Liquidez liberada: $' + liquidityReleasedSale3.toFixed(2));
  print('   - Ganancia realizada: $' + realizedProfitSale3.toFixed(2));
  print('   - Aplicar venta: ' + sharesAfterDiscardingSale2.toFixed(4) + ' → ' + sharesAfterConfirmingSale3.toFixed(4));
  print('   - Participación final: ' + participationAfterConfirmingSale3.toFixed(2) + '%');
  print('');
  print('3. ACTUALIZAR ALERTA:');
  print('   - Shares: ' + sharesAfterConfirmingSale3.toFixed(4));
  print('   - Participación: ' + participationAfterConfirmingSale3.toFixed(2) + '%');
  print('   - AllocatedAmount: $' + newAllocatedAmount.toFixed(2));
  print('');
  print('4. ACTUALIZAR OPERACIONES:');
  print('   - Operación del 9 de enero: Status → CANCELLED');
  print('   - Operación pendiente del 25%: isPriceConfirmed → true, precio → $' + sellPrice.toFixed(2));
  print('');
  print('5. ACTUALIZAR LIQUIDEZ DEL POOL:');
  print('   - Al desestimar Venta #2: $' + sale2LiquidityReleased.toFixed(2) + ' vuelve a estar asignada');
  print('   - Al confirmar Venta #3: $' + liquidityReleasedSale3.toFixed(2) + ' se libera');
  print('   - Cambio neto en DistributedLiquidity: $' + (sale2LiquidityReleased - liquidityReleasedSale3).toFixed(2));
  print('   - Cambio neto en AvailableLiquidity: $' + (liquidityReleasedSale3 - sale2LiquidityReleased).toFixed(2));
} else {
  print('🔧 EJECUTANDO CORRECCIONES...');
  print('');
  
  // Actualizar la alerta
  db.alerts.updateOne(
    { _id: intcAlertId },
    {
      $set: {
        'liquidityData.partialSales': updatedPartialSales,
        'liquidityData.shares': sharesAfterConfirmingSale3,
        'liquidityData.allocatedAmount': newAllocatedAmount,
        'participationPercentage': participationAfterConfirmingSale3
      }
    }
  );
  print('✅ Alerta actualizada');
  
  // Actualizar operación del 9 de enero (desestimar)
  const operationJan9 = db.operations.findOne({
    alertId: intcAlertId,
    operationType: 'VENTA',
    date: {
      $gte: new Date('2026-01-09T00:00:00.000Z'),
      $lt: new Date('2026-01-10T00:00:00.000Z')
    }
  });
  
  if (operationJan9) {
    db.operations.updateOne(
      { _id: operationJan9._id },
      {
        $set: {
          status: 'CANCELLED',
          isPriceConfirmed: true,
          notes: '❌ VENTA DESESTIMADA: Precio fuera de rango'
        }
      }
    );
    print('✅ Operación del 9 de enero cancelada: ' + operationJan9._id);
  }
  
  // Actualizar operación pendiente del 25% (confirmar)
  const operationPending = db.operations.findOne({
    alertId: intcAlertId,
    operationType: 'VENTA',
    isPriceConfirmed: { $ne: true },
    status: 'ACTIVE'
  });
  
  if (operationPending) {
    db.operations.updateOne(
      { _id: operationPending._id },
      {
        $set: {
          isPriceConfirmed: true,
          price: sellPrice,
          amount: liquidityReleasedSale3,
          notes: '✅ Venta parcial (25%) confirmada manualmente a precio de cierre $' + sellPrice.toFixed(2)
        },
        $unset: {
          priceRange: ''
        }
      }
    );
    print('✅ Operación pendiente confirmada: ' + operationPending._id);
  }
  
  // Actualizar distribución en Liquidity Y la liquidez del pool
  const liquidity = db.liquidities.findOne({ 
    pool: 'TraderCall',
    'distributions.alertId': intcAlertId
  });
  
  if (liquidity) {
    const distributions = liquidity.distributions || [];
    const distributionIndex = distributions.findIndex((d) => {
      return d.alertId && d.alertId.toString() === intcAlertId.toString();
    });
    
    if (distributionIndex >= 0) {
      const distribution = distributions[distributionIndex];
      const currentDistributionShares = distribution.shares || 0;
      const currentDistributionAllocated = distribution.allocatedAmount || 0;
      
      // Revertir venta #2: sumar shares (la liquidez vuelve a estar asignada)
      const sharesAfterDiscarding = currentDistributionShares + sale2Shares;
      const allocatedAfterDiscarding = sharesAfterDiscarding * entryPrice;
      const allocatedChangeSale2 = sale2LiquidityReleased; // Liquidez que vuelve a estar asignada
      
      // Aplicar venta #3: restar shares (la liquidez se libera)
      const newDistributionShares = sharesAfterDiscarding - sale3Shares;
      const newDistributionAllocated = newDistributionShares * entryPrice;
      const newSoldShares = (distribution.soldShares || 0) - sale2Shares + sale3Shares;
      const allocatedChangeSale3 = liquidityReleasedSale3; // Liquidez que se libera
      
      // Calcular cambios en liquidez del pool
      // Al desestimar Venta #2: la liquidez vuelve a estar asignada (distributedLiquidity aumenta)
      // Al confirmar Venta #3: la liquidez se libera (distributedLiquidity disminuye)
      const netDistributedChange = allocatedChangeSale2 - allocatedChangeSale3;
      const currentDistributedLiquidity = liquidity.distributedLiquidity || 0;
      const newDistributedLiquidity = Math.max(0, currentDistributedLiquidity + netDistributedChange);
      
      // La liquidez disponible es totalLiquidity - distributedLiquidity
      const currentTotalLiquidity = liquidity.totalLiquidity || 0;
      const currentAvailableLiquidity = liquidity.availableLiquidity || 0;
      const newAvailableLiquidity = currentTotalLiquidity - newDistributedLiquidity;
      
      distributions[distributionIndex] = {
        ...distribution,
        shares: newDistributionShares,
        allocatedAmount: newDistributionAllocated,
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
      print('✅ Distribución en Liquidity actualizada');
      print('   - Shares: ' + currentDistributionShares.toFixed(4) + ' → ' + newDistributionShares.toFixed(4));
      print('   - AllocatedAmount: $' + currentDistributionAllocated.toFixed(2) + ' → $' + newDistributionAllocated.toFixed(2));
      print('   - DistributedLiquidity: $' + currentDistributedLiquidity.toFixed(2) + ' → $' + newDistributedLiquidity.toFixed(2));
      print('   - AvailableLiquidity: $' + currentAvailableLiquidity.toFixed(2) + ' → $' + newAvailableLiquidity.toFixed(2));
    }
  }
  
  print('');
  print('✅ Todas las correcciones aplicadas');
}

print('==============================================================================');
print('✅ Proceso completado');
print('==============================================================================');
