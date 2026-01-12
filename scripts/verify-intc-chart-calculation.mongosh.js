/**
 * Verificar el cálculo del porcentaje del gráfico para INTC
 * Este script verifica todos los datos necesarios para entender por qué muestra 4.2%
 */

print('🔍 Verificando cálculo del gráfico para INTC...\n');
print('='.repeat(70) + '\n');

const SYMBOL = 'INTC';
const POOL = 'TraderCall';
const ALERT_ID = '6957f5578bbe1e7b4d23034d';

// 1. Verificar la alerta
print('📊 1. VERIFICANDO ALERTA:\n');
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (!alert) {
  print(`   ❌ Alerta no encontrada\n`);
} else {
  print(`   ✅ Alerta encontrada\n`);
  print(`   ID: ${alert._id}\n`);
  print(`   Symbol: ${alert.symbol}\n`);
  print(`   Participation: ${alert.participationPercentage || 0}%\n`);
  print(`   Entry Price: $${(alert.entryPrice || 0).toFixed(2)}\n`);
  print(`   Current Price: ${alert.currentPrice || 'N/A'}\n`);
  print(`   liquidityData.allocatedAmount: $${(alert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  print(`   liquidityData.shares: ${(alert.liquidityData?.shares || 0).toFixed(4)}\n`);
  
  // Calcular P&L no realizado
  const entryPrice = alert.entryPrice || 0;
  const currentPrice = parseFloat((alert.currentPrice || '0').toString().replace('$', '')) || 0;
  const shares = alert.liquidityData?.shares || 0;
  const allocatedAmount = alert.liquidityData?.allocatedAmount || 0;
  
  const unrealizedPL = shares > 0 && entryPrice > 0 && currentPrice > 0
    ? (currentPrice - entryPrice) * shares
    : 0;
  
  const currentValue = allocatedAmount + unrealizedPL;
  
  print(`   💡 Cálculo P&L:\n`);
  print(`      Entry Price: $${entryPrice.toFixed(2)}\n`);
  print(`      Current Price: $${currentPrice.toFixed(2)}\n`);
  print(`      Shares: ${shares.toFixed(4)}\n`);
  print(`      Unrealized P&L: $${unrealizedPL.toFixed(2)}\n`);
  print(`      Allocated Amount: $${allocatedAmount.toFixed(2)}\n`);
  print(`      Current Value (allocated + P&L): $${currentValue.toFixed(2)}\n`);
}

// 2. Verificar documento de liquidez
print('\n📊 2. VERIFICANDO DOCUMENTO DE LIQUIDEZ:\n');
const liquidity = db.liquidity.findOne({ pool: POOL });

if (!liquidity) {
  print(`   ❌ No se encontró documento de liquidez para ${POOL}\n`);
  print(`   💡 Esto explica por qué el gráfico muestra datos incorrectos\n`);
} else {
  print(`   ✅ Documento de liquidez encontrado\n`);
  print(`   ID: ${liquidity._id}\n`);
  print(`   Pool: ${liquidity.pool}\n`);
  print(`   Initial Liquidity: $${(liquidity.initialLiquidity || 0).toFixed(2)}\n`);
  print(`   Total Liquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)}\n`);
  print(`   Available Liquidity: $${(liquidity.availableLiquidity || 0).toFixed(2)}\n`);
  print(`   Distributed Liquidity: $${(liquidity.distributedLiquidity || 0).toFixed(2)}\n`);
  print(`   Total Profit Loss: $${(liquidity.totalProfitLoss || 0).toFixed(2)}\n`);
  // Convertir distributions a array si es necesario
  let distributions = [];
  if (liquidity.distributions) {
    if (Array.isArray(liquidity.distributions)) {
      distributions = liquidity.distributions;
    } else {
      distributions = [liquidity.distributions];
    }
  }
  
  print(`   Distributions count: ${distributions.length}\n`);
  
  // Buscar distribución de INTC
  let intcDist = null;
  for (let i = 0; i < distributions.length; i++) {
    const d = distributions[i];
    const distAlertId = d.alertId ? d.alertId.toString() : null;
    if (distAlertId === ALERT_ID) {
      intcDist = d;
      break;
    }
  }
  
  if (intcDist) {
    print(`\n   ✅ Distribución de INTC encontrada:\n`);
    print(`      Symbol: ${intcDist.symbol}\n`);
    print(`      Allocated Amount: $${(intcDist.allocatedAmount || 0).toFixed(2)}\n`);
    print(`      Shares: ${(intcDist.shares || 0).toFixed(4)}\n`);
    print(`      Entry Price: $${(intcDist.entryPrice || 0).toFixed(2)}\n`);
    print(`      Current Price: $${(intcDist.currentPrice || 0).toFixed(2)}\n`);
    print(`      Profit Loss: $${(intcDist.profitLoss || 0).toFixed(2)}\n`);
    print(`      Profit Loss %: ${(intcDist.profitLossPercentage || 0).toFixed(2)}%\n`);
    print(`      Realized P&L: $${(intcDist.realizedProfitLoss || 0).toFixed(2)}\n`);
    print(`      Is Active: ${intcDist.isActive || false}\n`);
    
    // Calcular currentValue desde la distribución
    const distCurrentValue = (intcDist.allocatedAmount || 0) + (intcDist.profitLoss || 0);
    print(`      💡 Current Value (allocated + P&L): $${distCurrentValue.toFixed(2)}\n`);
    
    // Calcular porcentaje esperado
    const totalLiquidity = liquidity.totalLiquidity || 0;
    const expectedPercentage = totalLiquidity > 0 
      ? (distCurrentValue / totalLiquidity) * 100 
      : 0;
    
    print(`\n   📊 CÁLCULO DEL PORCENTAJE:\n`);
    print(`      Current Value: $${distCurrentValue.toFixed(2)}\n`);
    print(`      Total Liquidity: $${totalLiquidity.toFixed(2)}\n`);
    print(`      Porcentaje esperado: ${expectedPercentage.toFixed(2)}%\n`);
    print(`      Porcentaje actual en gráfico: 4.2%\n`);
    
    if (Math.abs(expectedPercentage - 4.2) < 0.1) {
      print(`      ✅ El porcentaje coincide aproximadamente\n`);
    } else {
      const diff = expectedPercentage - 4.2;
      print(`      ⚠️  Diferencia: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%\n`);
    }
  } else {
    print(`   ❌ No se encontró distribución de INTC en el documento de liquidez\n`);
    print(`   💡 Esto explica por qué el gráfico muestra datos incorrectos\n`);
  }
  
  // Verificar todas las distribuciones activas
  print(`\n   📋 TODAS LAS DISTRIBUCIONES ACTIVAS:\n`);
  const activeDistributions = [];
  for (let i = 0; i < distributions.length; i++) {
    const d = distributions[i];
    if (d.isActive && d.shares > 0) {
      activeDistributions.push(d);
    }
  }
  print(`      Total activas: ${activeDistributions.length}\n`);
  
  activeDistributions.forEach((dist, idx) => {
    const distCurrentValue = (dist.allocatedAmount || 0) + (dist.profitLoss || 0);
    const distPercentage = liquidity.totalLiquidity > 0 
      ? (distCurrentValue / liquidity.totalLiquidity) * 100 
      : 0;
    print(`      ${idx + 1}. ${dist.symbol}: $${distCurrentValue.toFixed(2)} (${distPercentage.toFixed(2)}%)\n`);
  });
  
  // Calcular suma de todos los currentValues
  const totalCurrentValue = activeDistributions.reduce((sum, d) => {
    return sum + (d.allocatedAmount || 0) + (d.profitLoss || 0);
  }, 0);
  
  print(`\n   💡 Suma de todos los Current Values: $${totalCurrentValue.toFixed(2)}\n`);
  print(`   💡 Total Liquidity del documento: $${liquidity.totalLiquidity.toFixed(2)}\n`);
  
  if (Math.abs(totalCurrentValue - liquidity.totalLiquidity) > 1) {
    print(`   ⚠️  DIFERENCIA: Los valores no coinciden\n`);
    print(`      Diferencia: $${Math.abs(totalCurrentValue - liquidity.totalLiquidity).toFixed(2)}\n`);
  } else {
    print(`   ✅ Los valores coinciden aproximadamente\n`);
  }
}

// 3. Verificar qué devolvería la API /api/liquidity/summary
print('\n📊 3. SIMULANDO RESPUESTA DE /api/liquidity/summary:\n');

if (liquidity) {
  const mainDoc = liquidity;
  
  // Convertir distributions a array
  let allDistributions = [];
  if (mainDoc.distributions) {
    if (Array.isArray(mainDoc.distributions)) {
      allDistributions = mainDoc.distributions;
    } else {
      allDistributions = [mainDoc.distributions];
    }
  }
  
  // Calcular como lo hace la API
  const liquidezInicialGlobal = mainDoc.initialLiquidity || 0;
  
  // Distribuciones activas
  const activeDistributions = [];
  for (let i = 0; i < allDistributions.length; i++) {
    const d = allDistributions[i];
    if (d.isActive && d.shares > 0) {
      activeDistributions.push(d);
    }
  }
  const montosDistribuidos = activeDistributions.reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
  
  // Ganancias realizadas
  const gananciasRealizadas = allDistributions.reduce((sum, d) => sum + (d.realizedProfitLoss || 0), 0);
  
  // Ganancias no realizadas
  const gananciasNoRealizadas = activeDistributions.reduce((sum, d) => sum + (d.profitLoss || 0), 0);
  
  // Ganancia total
  const gananciaTotalSum = gananciasRealizadas + gananciasNoRealizadas;
  
  // Liquidez total
  const liquidezTotalSum = liquidezInicialGlobal + gananciaTotalSum;
  
  print(`   Liquidez Inicial: $${liquidezInicialGlobal.toFixed(2)}\n`);
  print(`   Liquidez Distribuida: $${montosDistribuidos.toFixed(2)}\n`);
  print(`   Ganancias Realizadas: $${gananciasRealizadas.toFixed(2)}\n`);
  print(`   Ganancias No Realizadas: $${gananciasNoRealizadas.toFixed(2)}\n`);
  print(`   Ganancia Total: $${gananciaTotalSum.toFixed(2)}\n`);
  print(`   Liquidez Total: $${liquidezTotalSum.toFixed(2)}\n`);
  
  // Buscar distribución de INTC
  let intcDist = null;
  for (let i = 0; i < activeDistributions.length; i++) {
    const d = activeDistributions[i];
    const distAlertId = d.alertId ? d.alertId.toString() : null;
    if (distAlertId === ALERT_ID) {
      intcDist = d;
      break;
    }
  }
  
  if (intcDist) {
    const intcCurrentValue = (intcDist.allocatedAmount || 0) + (intcDist.profitLoss || 0);
    const intcPercentage = liquidezTotalSum > 0 
      ? (intcCurrentValue / liquidezTotalSum) * 100 
      : 0;
    
    print(`\n   📊 INTC desde la API:\n`);
    print(`      Allocated Amount: $${(intcDist.allocatedAmount || 0).toFixed(2)}\n`);
    print(`      Profit Loss: $${(intcDist.profitLoss || 0).toFixed(2)}\n`);
    print(`      Current Value: $${intcCurrentValue.toFixed(2)}\n`);
    print(`      Liquidez Total: $${liquidezTotalSum.toFixed(2)}\n`);
    print(`      Porcentaje calculado: ${intcPercentage.toFixed(2)}%\n`);
    print(`      Porcentaje en gráfico: 4.2%\n`);
    
    if (Math.abs(intcPercentage - 4.2) < 0.1) {
      print(`      ✅ El porcentaje coincide aproximadamente\n`);
    } else {
      const diff = intcPercentage - 4.2;
      print(`      ⚠️  Diferencia: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%\n`);
      print(`      💡 El gráfico debería mostrar ${intcPercentage.toFixed(2)}% después de recargar\n`);
    }
  }
}

print('\n' + '='.repeat(70) + '\n');
print('💡 CONCLUSIÓN:\n');
print('   Si el porcentaje calculado no coincide con el 4.2% del gráfico,\n');
print('   puede ser:\n');
print('   1. Caché del navegador (recargar con Ctrl+F5)\n');
print('   2. Caché de la API (TTL de 60 segundos)\n');
print('   3. El documento de liquidez no se creó/actualizó correctamente\n');
print('='.repeat(70) + '\n');
