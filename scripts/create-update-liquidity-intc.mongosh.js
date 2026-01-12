/**
 * Crear o actualizar documento de liquidez para INTC
 * 
 * Este script crea el documento de liquidez si no existe, o lo actualiza con los valores correctos
 */

print('🔄 Creando/Actualizando documento de liquidez para INTC...\n');
print('='.repeat(70) + '\n');

const SYMBOL = 'INTC';
const POOL = 'TraderCall';

// Buscar la alerta
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (!alert) {
  print(`❌ No se encontró la alerta con símbolo: ${SYMBOL}\n`);
} else {
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   ID: ${alert._id}\n`);
  
  const alertId = alert._id.toString();
  const currentShares = alert.liquidityData?.shares || 0;
  const currentAllocatedAmount = alert.liquidityData?.allocatedAmount || 0;
  const entryPrice = alert.entryPrice || 0;
  const currentPrice = parseFloat((alert.currentPrice || '0').toString().replace('$', '')) || 0;
  
  // Obtener ventas parciales ejecutadas
  const partialSales = alert.liquidityData?.partialSales || [];
  const executedSales = partialSales.filter(s => s.executed && !s.discarded);
  const totalSoldShares = executedSales.reduce((sum, s) => sum + (s.sharesToSell || 0), 0);
  const totalRealizedProfitLoss = executedSales.reduce((sum, s) => sum + (s.realizedProfit || 0), 0);
  
  // Calcular P&L no realizado
  const unrealizedProfitLoss = currentShares > 0 && entryPrice > 0 && currentPrice > 0
    ? (currentPrice - entryPrice) * currentShares
    : 0;
  const unrealizedProfitLossPercentage = entryPrice > 0 && currentPrice > 0
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : 0;
  
  print(`\n📊 Valores a usar:\n`);
  print(`   Shares: ${currentShares.toFixed(4)}\n`);
  print(`   Allocated Amount: $${currentAllocatedAmount.toFixed(2)}\n`);
  print(`   Entry Price: $${entryPrice.toFixed(2)}\n`);
  print(`   Current Price: $${currentPrice.toFixed(2)}\n`);
  print(`   Sold Shares: ${totalSoldShares.toFixed(4)}\n`);
  print(`   Realized P&L: $${totalRealizedProfitLoss.toFixed(2)}\n`);
  print(`   Unrealized P&L: $${unrealizedProfitLoss.toFixed(2)} (${unrealizedProfitLossPercentage.toFixed(2)}%)\n`);
  
  // Buscar si existe documento de liquidez
  let liquidity = db.liquidity.findOne({ pool: POOL });
  
  if (!liquidity) {
    print(`\n📝 Creando nuevo documento de liquidez para ${POOL}...\n`);
    
    // ✅ MEJORADO: Calcular liquidez inicial desde la PRIMERA operación del pool
    // Esto evita problemas con balances negativos de operaciones posteriores
    let initialLiquidity = 1000; // Valor por defecto
    
    // Buscar la primera operación del pool (la más antigua)
    const firstOp = db.operations.find({ system: POOL })
      .sort({ date: 1 })  // Ordenar por fecha ascendente (más antigua primero)
      .limit(1)
      .toArray()[0];
    
    if (firstOp && firstOp.balance > 0) {
      // El balance de la primera operación debería ser el balance inicial del pool
      initialLiquidity = firstOp.balance;
      print(`   💡 Liquidez inicial calculada desde primera operación: $${initialLiquidity.toFixed(2)}\n`);
    } else {
      print(`   ⚠️  Usando valor por defecto: $${initialLiquidity.toFixed(2)}\n`);
      print(`   💡 NOTA: Si conoces la liquidez inicial real, actualízala después con:\n`);
      print(`      db.liquidity.updateOne({ pool: "${POOL}" }, { $set: { initialLiquidity: VALOR_REAL } })\n`);
    }
    
    // Crear distribución
    const distribution = {
      alertId: alertId,
      symbol: SYMBOL.toUpperCase(),
      allocatedAmount: currentAllocatedAmount,
      shares: currentShares,
      entryPrice: entryPrice,
      currentPrice: currentPrice,
      profitLoss: unrealizedProfitLoss,
      profitLossPercentage: unrealizedProfitLossPercentage,
      realizedProfitLoss: totalRealizedProfitLoss,
      soldShares: totalSoldShares,
      isActive: currentShares > 0.0001,
      createdAt: alert.date || new Date(),
      updatedAt: new Date()
    };
    
    // Crear documento de liquidez
    const newLiquidity = {
      pool: POOL,
      initialLiquidity: initialLiquidity,
      totalLiquidity: initialLiquidity + totalRealizedProfitLoss + unrealizedProfitLoss,
      availableLiquidity: initialLiquidity - currentAllocatedAmount + totalRealizedProfitLoss,
      distributedLiquidity: currentAllocatedAmount,
      totalProfitLoss: totalRealizedProfitLoss + unrealizedProfitLoss,
      totalProfitLossPercentage: initialLiquidity > 0 
        ? ((totalRealizedProfitLoss + unrealizedProfitLoss) / initialLiquidity) * 100 
        : 0,
      distributions: [distribution],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = db.liquidity.insertOne(newLiquidity);
    
    print(`✅ Documento de liquidez creado:\n`);
    print(`   ID: ${result.insertedId}\n`);
    print(`   Initial Liquidity: $${initialLiquidity.toFixed(2)}\n`);
    print(`   Total Liquidity: $${newLiquidity.totalLiquidity.toFixed(2)}\n`);
    print(`   Distributed: $${currentAllocatedAmount.toFixed(2)}\n`);
    print(`   Available: $${newLiquidity.availableLiquidity.toFixed(2)}\n`);
    
  } else {
    print(`\n📝 Actualizando documento de liquidez existente...\n`);
    print(`   ID: ${liquidity._id}\n`);
    
    // Buscar si ya existe la distribución
    const distributionIndex = liquidity.distributions.findIndex(
      d => d.alertId && d.alertId.toString() === alertId
    );
    
    const distribution = {
      alertId: alertId,
      symbol: SYMBOL.toUpperCase(),
      allocatedAmount: currentAllocatedAmount,
      shares: currentShares,
      entryPrice: entryPrice,
      currentPrice: currentPrice,
      profitLoss: unrealizedProfitLoss,
      profitLossPercentage: unrealizedProfitLossPercentage,
      realizedProfitLoss: totalRealizedProfitLoss,
      soldShares: totalSoldShares,
      isActive: currentShares > 0.0001,
      updatedAt: new Date()
    };
    
    if (distributionIndex >= 0) {
      // Actualizar distribución existente
      liquidity.distributions[distributionIndex] = {
        ...liquidity.distributions[distributionIndex],
        ...distribution,
        createdAt: liquidity.distributions[distributionIndex].createdAt || new Date()
      };
      
      print(`✅ Distribución actualizada en índice ${distributionIndex}\n`);
    } else {
      // Agregar nueva distribución
      distribution.createdAt = new Date();
      liquidity.distributions.push(distribution);
      print(`✅ Nueva distribución agregada\n`);
    }
    
    // Recalcular totales del documento
    const allDistributions = liquidity.distributions || [];
    const activeDistributions = allDistributions.filter(d => d.isActive && d.shares > 0);
    
    const distributedLiquidity = activeDistributions.reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
    const realizedPL = allDistributions.reduce((sum, d) => sum + (d.realizedProfitLoss || 0), 0);
    const unrealizedPL = activeDistributions.reduce((sum, d) => sum + (d.profitLoss || 0), 0);
    const totalPL = realizedPL + unrealizedPL;
    
    const initialLiquidity = liquidity.initialLiquidity || 1000;
    const totalLiquidity = initialLiquidity + totalPL;
    const availableLiquidity = initialLiquidity - distributedLiquidity + realizedPL;
    
    // Actualizar documento
    db.liquidity.updateOne(
      { _id: liquidity._id },
      {
        $set: {
          distributions: liquidity.distributions,
          totalLiquidity: totalLiquidity,
          availableLiquidity: availableLiquidity,
          distributedLiquidity: distributedLiquidity,
          totalProfitLoss: totalPL,
          totalProfitLossPercentage: initialLiquidity > 0 ? (totalPL / initialLiquidity) * 100 : 0,
          updatedAt: new Date()
        }
      }
    );
    
    print(`✅ Documento de liquidez actualizado:\n`);
    print(`   Total Liquidity: $${totalLiquidity.toFixed(2)}\n`);
    print(`   Distributed: $${distributedLiquidity.toFixed(2)}\n`);
    print(`   Available: $${availableLiquidity.toFixed(2)}\n`);
  }
  
  // Calcular porcentaje esperado en el gráfico
  const updatedLiquidity = db.liquidity.findOne({ pool: POOL });
  const totalLiquidityForChart = updatedLiquidity?.totalLiquidity || 1000;
  const expectedPercentage = totalLiquidityForChart > 0 
    ? (currentAllocatedAmount / totalLiquidityForChart) * 100 
    : 0;
  
  // Si hay P&L, el valor actual sería mayor
  const currentValue = currentAllocatedAmount + unrealizedProfitLoss;
  const expectedPercentageWithPL = totalLiquidityForChart > 0
    ? (currentValue / totalLiquidityForChart) * 100
    : 0;
  
  print(`\n📊 Porcentaje esperado en el gráfico:\n`);
  print(`   Sin P&L: ${expectedPercentage.toFixed(2)}%\n`);
  print(`   Con P&L: ${expectedPercentageWithPL.toFixed(2)}%\n`);
  print(`   (El gráfico usa currentValue = allocatedAmount + P&L)\n`);
  
  print('\n' + '='.repeat(70) + '\n');
  print('✅ PROCESO COMPLETADO\n');
  print('💡 Recarga la página para ver el cambio en el gráfico\n');
  print('='.repeat(70) + '\n');
}
