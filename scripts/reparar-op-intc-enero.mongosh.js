    // Reparar operaciones de INTC del 07/01 y 09/01 para evitar conflictos
    // - 09/01 debe quedar confirmada (ACTIVE + isPriceConfirmed)
    // - 07/01 debe quedar desestimada (CANCELLED)
    // Ajusta participacion/shares segun ventas ejecutadas.
    // No crea operaciones nuevas.
    const DRY_RUN = false; // Cambiar a false para ejecutar realmente
    const SELL_PRICE_JAN9 = 45.40; // Precio de venta confirmado para 09/01
    const SELL_PRICE_JAN7 = 42.76; // Precio de venta 07/01 (desestimada)

    function sameDay(date, y, m, d) {
    if (!date) return false;
    const dt = new Date(date);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
    }

    function toNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : (fallback || 0);
    }

    function main() {
    print('🔧 REPARAR OPERACIONES INTC (07/01 y 09/01)');
    print('==============================================================================');
    print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
    print('==============================================================================');
    print('');

    const alert = db.alerts.findOne({ symbol: 'INTC', status: 'ACTIVE' });
    if (!alert) {
        print('❌ No se encontró alerta INTC activa');
        return;
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
        return;
    }

    // Detectar ventas específicas por fecha y % (según historial de enero)
    let saleJan9 = null;
    let saleJan9Index = -1;
    let saleJan7 = null;
    let saleJan7Index = -1;

    for (let i = 0; i < partialSales.length; i++) {
        const sale = partialSales[i];
        if (!sale) continue;
        if (sameDay(sale.date || sale.executedAt, 2026, 0, 9)) {
        saleJan9 = sale;
        saleJan9Index = i;
        }
        if (sameDay(sale.date || sale.executedAt, 2026, 0, 7)) {
        saleJan7 = sale;
        saleJan7Index = i;
        }
    }

    if (!saleJan9) {
        print('❌ No se encontró venta del 09/01 en partialSales');
        return;
    }
    if (!saleJan7) {
        print('❌ No se encontró venta del 07/01 en partialSales');
        return;
    }

    print('📌 Venta 09/01 encontrada:');
    print('   - %: ' + toNumber(saleJan9.percentage, 0) + '%');
    print('   - Ejecutada: ' + (saleJan9.executed ? 'Sí' : 'No'));
    print('   - Desestimada: ' + (saleJan9.discarded ? 'Sí' : 'No'));
    print('');

    print('📌 Venta 07/01 encontrada:');
    print('   - %: ' + toNumber(saleJan7.percentage, 0) + '%');
    print('   - Ejecutada: ' + (saleJan7.executed ? 'Sí' : 'No'));
    print('   - Desestimada: ' + (saleJan7.discarded ? 'Sí' : 'No'));
    print('');

    // Operaciones a tocar
    const opJan9 = db.operations.findOne({
        alertId: alertId,
        operationType: 'VENTA',
        date: { $gte: new Date('2026-01-09T00:00:00.000Z'), $lt: new Date('2026-01-10T00:00:00.000Z') }
    });

    const opJan7 = db.operations.findOne({
        alertId: alertId,
        operationType: 'VENTA',
        date: { $gte: new Date('2026-01-07T00:00:00.000Z'), $lt: new Date('2026-01-08T00:00:00.000Z') }
    });

    if (!opJan9) {
        print('⚠️ No se encontró operación del 09/01');
    }
    if (!opJan7) {
        print('⚠️ No se encontró operación del 07/01');
    }

    const sellPriceJan9 = SELL_PRICE_JAN9 || toNumber(saleJan9.sellPrice, toNumber(opJan9 ? opJan9.price : 0, 0));
    const sharesJan9 = toNumber(saleJan9.sharesToSell, 0);
    const liquidityReleasedJan9 = sharesJan9 && sellPriceJan9
        ? sharesJan9 * sellPriceJan9
        : toNumber(saleJan9.liquidityReleased, toNumber(opJan9 ? opJan9.amount : 0, 0));

    const sellPriceJan7 = SELL_PRICE_JAN7 || toNumber(saleJan7.sellPrice, toNumber(opJan7 ? opJan7.price : 0, 0));
    const sharesJan7 = toNumber(saleJan7.sharesToSell, 0);
    const liquidityReleasedJan7 = sharesJan7 && sellPriceJan7
        ? sharesJan7 * sellPriceJan7
        : toNumber(saleJan7.liquidityReleased, toNumber(opJan7 ? opJan7.amount : 0, 0));

    // Preparar actualización de partialSales
    const updatedPartialSales = partialSales.map((sale, idx) => {
        if (idx === saleJan9Index) {
        return {
            ...sale,
            executed: true,
            executedAt: sale.executedAt || new Date('2026-01-09T00:00:00.000Z'),
            discarded: false,
            cancelled: false,
            sellPrice: sellPriceJan9,
            liquidityReleased: liquidityReleasedJan9
        };
        }
        if (idx === saleJan7Index) {
        return {
            ...sale,
            executed: false,
            discarded: true,
            discardedAt: new Date(),
            discardReason: 'Venta desestimada (conflicto con 09/01)'
        };
        }
        return sale;
    });

    // Recalcular participacion/shares segun ventas ejecutadas
    const executedSales = updatedPartialSales.filter((sale) => {
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
    executedSales.forEach((sale) => {
        totalPercentageSold += getSalePercent(sale);
    });

    if (totalPercentageSold > 100) totalPercentageSold = 100;
    if (totalPercentageSold < 0) totalPercentageSold = 0;

    const remainingPercentage = Math.max(0, 100 - totalPercentageSold);
    const remainingShares = (originalShares * remainingPercentage) / 100;
    const newAllocatedAmount = remainingShares * entryPrice;

    const currentShares = toNumber(liquidityData.shares, 0);
    const currentParticipation = toNumber(alert.participationPercentage, 0);
    const currentAllocatedAmount = toNumber(liquidityData.allocatedAmount, 0);

    if (DRY_RUN) {
        print('🔍 DRY-RUN: No se realizarán cambios');
        print('');
        print('Se actualizaría la alerta (partialSales):');
        print(' - 09/01: executed=true, discarded=false');
        print(' - 07/01: executed=false, discarded=true');
        print('');
        print('Recalculo de participacion:');
        print(' - Shares: ' + currentShares.toFixed(4) + ' → ' + remainingShares.toFixed(4));
        print(' - Participacion: ' + currentParticipation.toFixed(2) + '% → ' + remainingPercentage.toFixed(2) + '%');
        print(' - AllocatedAmount: $' + currentAllocatedAmount.toFixed(2) + ' → $' + newAllocatedAmount.toFixed(2));
        print('');
        print('Se actualizarían operaciones:');
        print(' - 09/01: status=ACTIVE, isPriceConfirmed=true, price=$' + sellPriceJan9.toFixed(2) + ', amount=$' + liquidityReleasedJan9.toFixed(2));
        print(' - 07/01: status=CANCELLED');
        print('');
        print('Reasignación de liquidez (pool):');
        print(' - Remover liquidez 07/01: $' + liquidityReleasedJan7.toFixed(2));
        print(' - Agregar liquidez 09/01: $' + liquidityReleasedJan9.toFixed(2));
        return;
    }

    // Aplicar cambios a la alerta
    db.alerts.updateOne(
        { _id: alertId },
        { $set: { 
        'liquidityData.partialSales': updatedPartialSales,
        'liquidityData.shares': remainingShares,
        'liquidityData.allocatedAmount': newAllocatedAmount,
        participationPercentage: remainingPercentage
        } }
    );
    print('✅ Alerta actualizada (partialSales + participacion)');

    // Aplicar cambios en operaciones
    if (opJan9) {
        db.operations.updateOne(
        { _id: opJan9._id },
        {
            $set: {
            status: 'ACTIVE',
            isPriceConfirmed: true,
            price: sellPriceJan9,
            amount: liquidityReleasedJan9,
            notes: '✅ Venta parcial confirmada (09/01)'
            },
            $unset: {
            priceRange: ''
            }
        }
        );
        print('✅ Operación 09/01 marcada como ACTIVE');
    }

    if (opJan7) {
        db.operations.updateOne(
        { _id: opJan7._id },
        {
            $set: {
            status: 'CANCELLED',
            isPriceConfirmed: true,
            notes: '❌ Venta desestimada (conflicto con 09/01)'
            }
        }
        );
        print('✅ Operación 07/01 marcada como CANCELLED');
    }

    // Actualizar distribution y liquidez del pool
    const liquidity = db.liquidities.findOne({
        pool: 'TraderCall',
        'distributions.alertId': alertId
    });

    if (!liquidity) {
        print('⚠️ No se encontró Liquidity para actualizar');
        return;
    }

    const distributions = liquidity.distributions || [];
    const distributionIndex = distributions.findIndex((d) => {
        return d.alertId && d.alertId.toString() === alertId.toString();
    });

    if (distributionIndex < 0) {
        print('⚠️ No se encontró distribución de INTC en Liquidity');
        return;
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
    const newTotalLiquidity = Math.max(0, currentTotalLiquidity - liquidityReleasedJan7 + liquidityReleasedJan9);
    const newAvailableLiquidity = Math.max(0, newTotalLiquidity - newDistributedLiquidity);

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
            totalLiquidity: newTotalLiquidity,
            availableLiquidity: newAvailableLiquidity
        }
        }
    );

    print('✅ Liquidity actualizada');
    print('   - Shares: ' + distShares.toFixed(4) + ' → ' + remainingShares.toFixed(4));
    print('   - AllocatedAmount: $' + distAllocated.toFixed(2) + ' → $' + newAllocatedAmount.toFixed(2));
    print('   - SoldShares: ' + distSoldShares.toFixed(4) + ' → ' + newSoldShares.toFixed(4));
    print('   - DistributedLiquidity: $' + currentDistributedLiquidity.toFixed(2) + ' → $' + newDistributedLiquidity.toFixed(2));
    print('   - TotalLiquidity: $' + currentTotalLiquidity.toFixed(2) + ' → $' + newTotalLiquidity.toFixed(2));
    print('   - AvailableLiquidity: $' + (toNumber(liquidity.availableLiquidity, 0)).toFixed(2) + ' → $' + newAvailableLiquidity.toFixed(2));

    print('');
    print('==============================================================================');
    print('✅ Proceso completado');
    print('==============================================================================');
    }

    main();
