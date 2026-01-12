/**
 * DRY RUN - Crear o actualizar documento de liquidez para INTC
 * 
 * Este script SOLO MUESTRA los cambios sin ejecutarlos
 */

print('🔍 DRY RUN - Crear/Actualizar documento de liquidez para INTC\n');
print('='.repeat(70) + '\n');
print('⚠️  Este script NO MODIFICA la base de datos\n');
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
  
  print(`\n📊 VALORES ACTUALES DE LA ALERTA:\n`);
  print(`   Shares: ${currentShares.toFixed(4)}\n`);
  print(`   Allocated Amount: $${currentAllocatedAmount.toFixed(2)}\n`);
  print(`   Entry Price: $${entryPrice.toFixed(2)}\n`);
  print(`   Current Price: $${currentPrice.toFixed(2)}\n`);
  print(`   Sold Shares: ${totalSoldShares.toFixed(4)}\n`);
  print(`   Realized P&L: $${totalRealizedProfitLoss.toFixed(2)}\n`);
  print(`   Unrealized P&L: $${unrealizedProfitLoss.toFixed(2)} (${unrealizedProfitLossPercentage.toFixed(2)}%)\n`);
  
  // Buscar si existe documento de liquidez
  const liquidity = db.liquidity.findOne({ pool: POOL });
  
  if (!liquidity) {
    print(`\n📝 ACCIÓN: Crear nuevo documento de liquidez para ${POOL}\n`);
    
    // ✅ MEJORADO: Calcular liquidez inicial desde la PRIMERA operación del pool
    // Esto evita problemas con balances negativos de operaciones posteriores
    let initialLiquidity = 1000; // Valor por defecto
    
    // Buscar la primera operación del pool (la más antigua)
    const firstOp = db.operations.find({ system: POOL })
      .sort({ date: 1 })  // Ordenar por fecha ascendente (más antigua primero)
      .limit(1)
      .toArray()[0];
    
    if (firstOp) {
      // El balance de la primera operación debería ser el balance inicial del pool
      const initialBalance = firstOp.balance || 0;
      
      if (initialBalance > 0) {
        initialLiquidity = initialBalance;
        print(`   💡 Calculando desde PRIMERA operación del pool ${POOL}:\n`);
        print(`      Fecha: ${firstOp.date}\n`);
        print(`      Balance inicial del pool: $${initialBalance.toFixed(2)}\n`);
        print(`      Initial Liquidity: $${initialLiquidity.toFixed(2)}\n`);
      } else {
        print(`   ⚠️  Balance inicial negativo o cero: $${initialBalance.toFixed(2)}\n`);
        print(`   💡 Usando valor por defecto: $${initialLiquidity.toFixed(2)}\n`);
        print(`   💡 NOTA: Si conoces la liquidez inicial real del pool, deberías actualizarla manualmente después\n`);
      }
    } else {
      print(`   ⚠️  No se encontraron operaciones del pool ${POOL}\n`);
      print(`   💡 Usando valor por defecto: $${initialLiquidity.toFixed(2)}\n`);
      print(`   💡 NOTA: Si conoces la liquidez inicial real del pool, deberías actualizarla manualmente después\n`);
    }
    
    // Calcular totales
    const totalLiquidity = initialLiquidity + totalRealizedProfitLoss + unrealizedProfitLoss;
    const availableLiquidity = initialLiquidity - currentAllocatedAmount + totalRealizedProfitLoss;
    const totalPL = totalRealizedProfitLoss + unrealizedProfitLoss;
    
    print(`\n   📋 DISTRIBUCIÓN QUE SE CREARÍA:\n`);
    print(`      alertId: ${alertId}\n`);
    print(`      symbol: ${SYMBOL.toUpperCase()}\n`);
    print(`      allocatedAmount: $${currentAllocatedAmount.toFixed(2)}\n`);
    print(`      shares: ${currentShares.toFixed(4)}\n`);
    print(`      entryPrice: $${entryPrice.toFixed(2)}\n`);
    print(`      currentPrice: $${currentPrice.toFixed(2)}\n`);
    print(`      profitLoss: $${unrealizedProfitLoss.toFixed(2)}\n`);
    print(`      profitLossPercentage: ${unrealizedProfitLossPercentage.toFixed(2)}%\n`);
    print(`      realizedProfitLoss: $${totalRealizedProfitLoss.toFixed(2)}\n`);
    print(`      soldShares: ${totalSoldShares.toFixed(4)}\n`);
    print(`      isActive: ${currentShares > 0.0001}\n`);
    
    print(`\n   📋 DOCUMENTO DE LIQUIDEZ QUE SE CREARÍA:\n`);
    print(`      pool: ${POOL}\n`);
    print(`      initialLiquidity: $${initialLiquidity.toFixed(2)}\n`);
    print(`      totalLiquidity: $${totalLiquidity.toFixed(2)}\n`);
    print(`      availableLiquidity: $${availableLiquidity.toFixed(2)}\n`);
    print(`      distributedLiquidity: $${currentAllocatedAmount.toFixed(2)}\n`);
    print(`      totalProfitLoss: $${totalPL.toFixed(2)}\n`);
    print(`      totalProfitLossPercentage: ${initialLiquidity > 0 ? (totalPL / initialLiquidity * 100).toFixed(2) : 0}%\n`);
    print(`      distributions: [1 distribución de INTC]\n`);
    
  } else {
    print(`\n📝 ACCIÓN: Actualizar documento de liquidez existente\n`);
    print(`   ID actual: ${liquidity._id}\n`);
    print(`   Pool: ${liquidity.pool}\n`);
    print(`   Initial Liquidity actual: $${(liquidity.initialLiquidity || 0).toFixed(2)}\n`);
    print(`   Total Liquidity actual: $${(liquidity.totalLiquidity || 0).toFixed(2)}\n`);
    print(`   Distribuciones actuales: ${(liquidity.distributions || []).length}\n`);
    
    // Buscar si ya existe la distribución
    const distributionIndex = liquidity.distributions.findIndex(
      d => d.alertId && d.alertId.toString() === alertId
    );
    
    if (distributionIndex >= 0) {
      const existingDist = liquidity.distributions[distributionIndex];
      print(`\n   📋 DISTRIBUCIÓN EXISTENTE (índice ${distributionIndex}):\n`);
      print(`      Symbol: ${existingDist.symbol || 'N/A'}\n`);
      print(`      Allocated Amount actual: $${(existingDist.allocatedAmount || 0).toFixed(2)}\n`);
      print(`      Shares actuales: ${(existingDist.shares || 0).toFixed(4)}\n`);
      print(`      Sold Shares actuales: ${(existingDist.soldShares || 0).toFixed(4)}\n`);
      
      print(`\n   📋 VALORES QUE SE ACTUALIZARÍAN:\n`);
      print(`      allocatedAmount: $${(existingDist.allocatedAmount || 0).toFixed(2)} → $${currentAllocatedAmount.toFixed(2)}\n`);
      print(`      shares: ${(existingDist.shares || 0).toFixed(4)} → ${currentShares.toFixed(4)}\n`);
      print(`      soldShares: ${(existingDist.soldShares || 0).toFixed(4)} → ${totalSoldShares.toFixed(4)}\n`);
      print(`      profitLoss: $${(existingDist.profitLoss || 0).toFixed(2)} → $${unrealizedProfitLoss.toFixed(2)}\n`);
      print(`      profitLossPercentage: ${(existingDist.profitLossPercentage || 0).toFixed(2)}% → ${unrealizedProfitLossPercentage.toFixed(2)}%\n`);
      print(`      realizedProfitLoss: $${(existingDist.realizedProfitLoss || 0).toFixed(2)} → $${totalRealizedProfitLoss.toFixed(2)}\n`);
      print(`      isActive: ${existingDist.isActive || false} → ${currentShares > 0.0001}\n`);
    } else {
      print(`\n   📋 NUEVA DISTRIBUCIÓN QUE SE AGREGARÍA:\n`);
      print(`      alertId: ${alertId}\n`);
      print(`      symbol: ${SYMBOL.toUpperCase()}\n`);
      print(`      allocatedAmount: $${currentAllocatedAmount.toFixed(2)}\n`);
      print(`      shares: ${currentShares.toFixed(4)}\n`);
      print(`      entryPrice: $${entryPrice.toFixed(2)}\n`);
      print(`      currentPrice: $${currentPrice.toFixed(2)}\n`);
      print(`      profitLoss: $${unrealizedProfitLoss.toFixed(2)}\n`);
      print(`      realizedProfitLoss: $${totalRealizedProfitLoss.toFixed(2)}\n`);
      print(`      soldShares: ${totalSoldShares.toFixed(4)}\n`);
    }
    
    // Calcular nuevos totales
    const allDistributions = liquidity.distributions || [];
    const updatedDistributions = [...allDistributions];
    
    if (distributionIndex >= 0) {
      updatedDistributions[distributionIndex] = {
        ...updatedDistributions[distributionIndex],
        allocatedAmount: currentAllocatedAmount,
        shares: currentShares,
        soldShares: totalSoldShares,
        profitLoss: unrealizedProfitLoss,
        profitLossPercentage: unrealizedProfitLossPercentage,
        realizedProfitLoss: totalRealizedProfitLoss,
        isActive: currentShares > 0.0001
      };
    } else {
      updatedDistributions.push({
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
        isActive: currentShares > 0.0001
      });
    }
    
    const activeDistributions = updatedDistributions.filter(d => d.isActive && d.shares > 0);
    const distributedLiquidity = activeDistributions.reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
    const realizedPL = updatedDistributions.reduce((sum, d) => sum + (d.realizedProfitLoss || 0), 0);
    const unrealizedPL = activeDistributions.reduce((sum, d) => sum + (d.profitLoss || 0), 0);
    const totalPL = realizedPL + unrealizedPL;
    
    const initialLiquidity = liquidity.initialLiquidity || 1000;
    const newTotalLiquidity = initialLiquidity + totalPL;
    const newAvailableLiquidity = initialLiquidity - distributedLiquidity + realizedPL;
    
    print(`\n   📋 TOTALES QUE SE ACTUALIZARÍAN:\n`);
    print(`      totalLiquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)} → $${newTotalLiquidity.toFixed(2)}\n`);
    print(`      distributedLiquidity: $${(liquidity.distributedLiquidity || 0).toFixed(2)} → $${distributedLiquidity.toFixed(2)}\n`);
    print(`      availableLiquidity: $${(liquidity.availableLiquidity || 0).toFixed(2)} → $${newAvailableLiquidity.toFixed(2)}\n`);
    print(`      totalProfitLoss: $${(liquidity.totalProfitLoss || 0).toFixed(2)} → $${totalPL.toFixed(2)}\n`);
    print(`      totalProfitLossPercentage: ${(liquidity.totalProfitLossPercentage || 0).toFixed(2)}% → ${(initialLiquidity > 0 ? totalPL / initialLiquidity * 100 : 0).toFixed(2)}%\n`);
    print(`      distributions: ${allDistributions.length} → ${updatedDistributions.length}\n`);
  }
  
  // Calcular porcentaje esperado en el gráfico
  const estimatedTotalLiquidity = liquidity 
    ? (liquidity.initialLiquidity || 1000) + (liquidity.totalProfitLoss || 0)
    : 1000 + totalRealizedProfitLoss + unrealizedProfitLoss;
  
  const expectedPercentage = estimatedTotalLiquidity > 0 
    ? (currentAllocatedAmount / estimatedTotalLiquidity) * 100 
    : 0;
  
  const currentValue = currentAllocatedAmount + unrealizedProfitLoss;
  const expectedPercentageWithPL = estimatedTotalLiquidity > 0
    ? (currentValue / estimatedTotalLiquidity) * 100
    : 0;
  
  print(`\n📊 PORCENTAJE ESPERADO EN EL GRÁFICO:\n`);
  print(`   Liquidez total estimada: $${estimatedTotalLiquidity.toFixed(2)}\n`);
  print(`   Allocated Amount: $${currentAllocatedAmount.toFixed(2)}\n`);
  print(`   Current Value (con P&L): $${currentValue.toFixed(2)}\n`);
  print(`   Porcentaje sin P&L: ${expectedPercentage.toFixed(2)}%\n`);
  print(`   Porcentaje con P&L: ${expectedPercentageWithPL.toFixed(2)}%\n`);
  print(`   (El gráfico usa currentValue = allocatedAmount + P&L)\n`);
  
  print(`\n   💡 COMPARACIÓN:\n`);
  print(`      Porcentaje actual en gráfico: 4.2%\n`);
  print(`      Porcentaje esperado (sin P&L): ${expectedPercentage.toFixed(2)}%\n`);
  print(`      Porcentaje esperado (con P&L): ${expectedPercentageWithPL.toFixed(2)}%\n`);
  
  if (Math.abs(expectedPercentageWithPL - 4.2) < 0.1) {
    print(`      ✅ El porcentaje con P&L coincide aproximadamente con el actual\n`);
  } else {
    const diff = expectedPercentageWithPL - 4.2;
    print(`      ⚠️  Diferencia: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%\n`);
    print(`      💡 Después de ejecutar el script, el gráfico debería mostrar ${expectedPercentageWithPL.toFixed(2)}%\n`);
  }
  
  print('\n' + '='.repeat(70) + '\n');
  print('⚠️  DRY RUN - No se realizaron cambios en la base de datos\n');
  print('💡 Para ejecutar los cambios, usa el script create-update-liquidity-intc.mongosh.js\n');
  print('='.repeat(70) + '\n');
}
