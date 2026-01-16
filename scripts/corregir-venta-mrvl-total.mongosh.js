// Corregir venta MRVL: fue parcial (50%) pero debía ser total (100%).
// Ajusta alerta, operación y liquidez. No crea operaciones nuevas.
const DRY_RUN = false; // Cambiar a false para ejecutar realmente
const SYMBOL = 'MRVL';
const SELL_PRICE = 79.49;
const SALE_DATE_START = new Date('2026-01-14T00:00:00.000Z');
const SALE_DATE_END = new Date('2026-01-15T00:00:00.000Z');

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : (fallback || 0);
}

function recalcLiquidity(liquidityDoc) {
  const distributions = liquidityDoc.distributions || [];
  const montosDistribuidos = distributions
    .filter(function(dist) { return dist.isActive && dist.shares > 0; })
    .reduce(function(sum, dist) { return sum + (dist.allocatedAmount || 0); }, 0);

  const gananciasRealizadas = distributions
    .reduce(function(sum, dist) { return sum + (dist.realizedProfitLoss || 0); }, 0);

  const gananciasNoRealizadas = distributions
    .filter(function(dist) { return dist.isActive && dist.shares > 0; })
    .reduce(function(sum, dist) { return sum + (dist.profitLoss || 0); }, 0);

  liquidityDoc.distributedLiquidity = montosDistribuidos;
  liquidityDoc.totalLiquidity = (liquidityDoc.initialLiquidity || 0) + gananciasRealizadas + gananciasNoRealizadas;
  liquidityDoc.availableLiquidity = (liquidityDoc.initialLiquidity || 0) - montosDistribuidos + gananciasRealizadas;

  const totalProfitLoss = gananciasRealizadas + gananciasNoRealizadas;
  liquidityDoc.totalProfitLoss = totalProfitLoss;
  liquidityDoc.totalProfitLossPercentage = liquidityDoc.distributedLiquidity > 0
    ? (totalProfitLoss / liquidityDoc.distributedLiquidity) * 100
    : 0;
}

function findLatestSaleOperation(alertId) {
  const byDate = db.operations.find({
    alertId: alertId,
    operationType: 'VENTA',
    date: { $gte: SALE_DATE_START, $lt: SALE_DATE_END }
  }).sort({ date: -1 }).limit(1).toArray();

  if (byDate && byDate.length) return byDate[0];

  const byPrice = db.operations.find({
    alertId: alertId,
    operationType: 'VENTA',
    price: SELL_PRICE
  }).sort({ date: -1 }).limit(1).toArray();

  if (byPrice && byPrice.length) return byPrice[0];

  const fallback = db.operations.find({
    alertId: alertId,
    operationType: 'VENTA'
  }).sort({ date: -1 }).limit(1).toArray();

  return fallback && fallback.length ? fallback[0] : null;
}

function main() {
  print('🔧 CORREGIR VENTA MRVL (50% → 100%)');
  print('==============================================================================');
  print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
  print('==============================================================================');
  print('');

  let alert = db.alerts.findOne({ symbol: SYMBOL, status: 'ACTIVE' });
  if (!alert) {
    alert = db.alerts.find({ symbol: SYMBOL }).sort({ createdAt: -1 }).limit(1).toArray()[0];
  }

  if (!alert) {
    print('❌ No se encontró alerta MRVL');
    return;
  }

  const alertId = alert._id;
  const liquidityData = alert.liquidityData || {};
  const partialSales = liquidityData.partialSales || [];
  const pool = alert.tipo || 'TraderCall';

  const liquidity = db.liquidity.findOne({
    pool: pool,
    'distributions.alertId': String(alertId)
  });

  let distribution = null;
  if (liquidity && liquidity.distributions) {
    for (let i = 0; i < liquidity.distributions.length; i++) {
      const dist = liquidity.distributions[i];
      if (String(dist.alertId) === String(alertId)) {
        distribution = dist;
        break;
      }
    }
  }

  const entryPrice = toNumber(
    distribution ? distribution.entryPrice : alert.entryPrice,
    toNumber(alert.entryPriceRange && alert.entryPriceRange.min, 0)
  );

  let originalShares = toNumber(liquidityData.originalShares, 0);
  if (!originalShares && distribution) {
    originalShares = toNumber(distribution.shares, 0) + toNumber(distribution.soldShares, 0);
  }
  if (!originalShares) {
    const originalAllocated = toNumber(liquidityData.originalAllocatedAmount, 0);
    if (originalAllocated && entryPrice) {
      originalShares = originalAllocated / entryPrice;
    }
  }

  const remainingShares = toNumber(
    distribution ? distribution.shares : liquidityData.shares,
    0
  );

  if (!originalShares) {
    print('❌ No se pudo determinar originalShares');
    return;
  }

  if (remainingShares <= 0) {
    print('⚠️ No hay shares restantes en MRVL. La venta ya estaría totalizada.');
    return;
  }

  const remainingPercentage = originalShares > 0 ? (remainingShares / originalShares) * 100 : 0;
  const totalProceeds = originalShares * SELL_PRICE;
  const totalRealizedProfit = (SELL_PRICE - entryPrice) * originalShares;
  const remainingProceeds = remainingShares * SELL_PRICE;
  const remainingRealizedProfit = (SELL_PRICE - entryPrice) * remainingShares;

  const op = findLatestSaleOperation(alertId);

  let saleIndex = -1;
  for (let i = 0; i < partialSales.length; i++) {
    const sale = partialSales[i];
    if (!sale) continue;
    const salePrice = toNumber(sale.sellPrice, 0);
    if (sale.executed && Math.abs(salePrice - SELL_PRICE) < 0.01) {
      saleIndex = i;
      break;
    }
  }

  const executedAt = op && op.date ? op.date : new Date();

  const correctedSale = {
    date: executedAt,
    percentage: 100,
    sharesToSell: originalShares,
    sellPrice: SELL_PRICE,
    liquidityReleased: totalProceeds,
    realizedProfit: totalRealizedProfit,
    executedBy: (partialSales[saleIndex] && partialSales[saleIndex].executedBy) || 'system',
    priceRange: (partialSales[saleIndex] && partialSales[saleIndex].priceRange) || null,
    emailMessage: (partialSales[saleIndex] && partialSales[saleIndex].emailMessage) || null,
    emailImageUrl: (partialSales[saleIndex] && partialSales[saleIndex].emailImageUrl) || null,
    isCompleteSale: true,
    executed: true,
    executedAt: executedAt
  };

  const updatedPartialSales = partialSales.slice();
  if (saleIndex >= 0) {
    updatedPartialSales[saleIndex] = correctedSale;
  } else {
    updatedPartialSales.push(correctedSale);
  }

  if (DRY_RUN) {
    print('🔍 DRY-RUN: No se realizarán cambios');
    print('');
    print('📌 Alerta: ' + alert.symbol + ' (' + alertId + ')');
    print(' - Pool: ' + pool);
    print(' - EntryPrice: $' + entryPrice.toFixed(2));
    print(' - OriginalShares: ' + originalShares.toFixed(4));
    print(' - Shares restantes: ' + remainingShares.toFixed(4) + ' (' + remainingPercentage.toFixed(2) + '%)');
    print(' - Precio de venta: $' + SELL_PRICE.toFixed(2));
    print('');
    print('✅ Se corregirá a venta TOTAL (100%):');
    print(' - Proceeds totales: $' + totalProceeds.toFixed(2));
    print(' - Ganancia total: $' + totalRealizedProfit.toFixed(2));
    print(' - Proceeds restantes a liberar: $' + remainingProceeds.toFixed(2));
    print(' - Ganancia restante: $' + remainingRealizedProfit.toFixed(2));
    print('');
    if (op) {
      print('📌 Operación encontrada: ' + op._id);
      print(' - Parcial actual: ' + (op.isPartialSale ? 'Sí' : 'No') + ' (' + toNumber(op.partialSalePercentage, 0) + '%)');
    } else {
      print('⚠️ No se encontró operación para ajustar');
    }
    print('');
    print('Se actualizaría la alerta:');
    print(' - status: ' + (alert.status || 'N/A') + ' → CLOSED');
    print(' - participationPercentage: ' + toNumber(alert.participationPercentage, 0).toFixed(2) + '% → 0%');
    print(' - liquidityData.shares: ' + toNumber(liquidityData.shares, 0).toFixed(4) + ' → 0');
    print(' - liquidityData.allocatedAmount: $' + toNumber(liquidityData.allocatedAmount, 0).toFixed(2) + ' → $0.00');
    print('');
    print('Se actualizaría Liquidity:');
    if (liquidity && distribution) {
      print(' - Distribución encontrada: ' + distribution.symbol);
      print(' - Shares actuales: ' + toNumber(distribution.shares, 0).toFixed(4) + ' → 0');
    } else {
      print(' - No se encontró distribución en Liquidity');
    }
    return;
  }

  // Actualizar alerta
  db.alerts.updateOne(
    { _id: alertId },
    {
      $set: {
        status: 'CLOSED',
        participationPercentage: 0,
        exitPrice: SELL_PRICE,
        exitDate: executedAt,
        exitReason: 'MANUAL',
        'liquidityData.shares': 0,
        'liquidityData.allocatedAmount': 0,
        'liquidityData.partialSales': updatedPartialSales
      }
    }
  );
  print('✅ Alerta actualizada: CLOSED + participación 0%');

  // Actualizar operación
  if (op) {
    const newNotes = '✅ Venta total (100%) ejecutada automáticamente a precio de cierre $' + SELL_PRICE.toFixed(2);
    db.operations.updateOne(
      { _id: op._id },
      {
        $set: {
          isPartialSale: false,
          partialSalePercentage: 100,
          quantity: -originalShares,
          price: SELL_PRICE,
          amount: -(originalShares * SELL_PRICE),
          notes: newNotes
        }
      }
    );
    print('✅ Operación actualizada a venta total');
  }

  // Actualizar liquidez
  if (liquidity && distribution) {
    // Actualizar la distribución a 0 shares (venta total)
    distribution.shares = 0;
    distribution.soldShares = originalShares;
    distribution.realizedProfitLoss = totalRealizedProfit;
    distribution.currentPrice = SELL_PRICE;
    distribution.allocatedAmount = 0;
    distribution.profitLoss = 0;
    distribution.profitLossPercentage = 0;
    distribution.isActive = false;
    distribution.updatedAt = new Date();

    // Remover distribución para mantener consistencia con ventas totales
    liquidity.distributions = liquidity.distributions.filter(function(dist) {
      return String(dist.alertId) !== String(alertId);
    });

    // Recalcular totales
    recalcLiquidity(liquidity);

    db.liquidity.updateOne(
      { _id: liquidity._id },
      {
        $set: {
          distributions: liquidity.distributions,
          distributedLiquidity: liquidity.distributedLiquidity,
          availableLiquidity: liquidity.availableLiquidity,
          totalLiquidity: liquidity.totalLiquidity,
          totalProfitLoss: liquidity.totalProfitLoss,
          totalProfitLossPercentage: liquidity.totalProfitLossPercentage
        }
      }
    );
    print('✅ Liquidez actualizada (distribución removida)');
  } else {
    print('⚠️ No se encontró Liquidity/distribución para actualizar');
  }

  print('==============================================================================');
  print('✅ Proceso completado');
  print('==============================================================================');
}

main();
