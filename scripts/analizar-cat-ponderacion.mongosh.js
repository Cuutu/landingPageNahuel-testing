/**
 * ANALIZAR - Ponderación de CAT en el gráfico de tortas
 * 
 * Este script analiza la alerta CAT de Smart Money para entender por qué
 * aparece con menos del 5% de ponderación en el gráfico cuando debería tener más
 * (compró al 5% y subió casi el doble: de $386 a $629)
 * 
 * INSTRUCCIONES:
 * 1. Ejecutar en mongosh: mongosh <nombre-de-tu-db> < scripts/analizar-cat-ponderacion.mongosh.js
 * 2. O copiar y pegar el contenido en mongosh
 */

print('🔍 ANÁLISIS - Ponderación de CAT en Smart Money\n');
print('='.repeat(80) + '\n');

// ============================================
// CONFIGURACIÓN
// ============================================
const CAT_SYMBOL = 'CAT';
const POOL = 'SmartMoney';
const EXPECTED_PERCENTAGE_AT_BUY = 5; // Porcentaje al comprar
const ENTRY_PRICE = 386; // Precio de entrada esperado
const CURRENT_PRICE = 629; // Precio actual esperado

print(`📊 Símbolo: ${CAT_SYMBOL}\n`);
print(`💰 Pool: ${POOL}\n`);
print(`📈 Precio de entrada: $${ENTRY_PRICE}\n`);
print(`📈 Precio actual: $${CURRENT_PRICE}\n`);
print(`📊 Porcentaje al comprar: ${EXPECTED_PERCENTAGE_AT_BUY}%\n`);
print('='.repeat(80) + '\n');

// Buscar la alerta CAT
const alert = db.alerts.findOne({
  symbol: CAT_SYMBOL.toUpperCase(),
  tipo: 'SmartMoney',
  status: 'ACTIVE'
});

if (!alert) {
  print(`❌ No se encontró la alerta CAT activa en Smart Money\n`);
  quit(1);
}

print(`✅ Alerta encontrada: ${alert.symbol}\n`);
print(`   ID: ${alert._id}\n`);
print(`   Status: ${alert.status}\n`);
print(`   Tipo: ${alert.tipo}\n`);
print(`   Fecha de creación: ${alert.createdAt || alert.date}\n`);

// Información de la alerta
const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || 0;
const currentPrice = alert.currentPrice || 0;
const participationPercentage = alert.participationPercentage || 0;

print(`\n📊 DATOS DE LA ALERTA:\n`);
print(`   Precio de entrada: $${entryPrice.toFixed(2)}\n`);
print(`   Precio actual: $${currentPrice.toFixed(2)}\n`);
print(`   Participación: ${participationPercentage}%\n`);
print(`   Ganancia porcentual: ${entryPrice > 0 ? (((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2) : 0}%\n`);

// Información de liquidez en la alerta
const liquidityData = alert.liquidityData || {};
const allocatedAmount = liquidityData.allocatedAmount || 0;
const shares = liquidityData.shares || 0;
const originalAllocatedAmount = liquidityData.originalAllocatedAmount || allocatedAmount;
const originalShares = liquidityData.originalShares || shares;

print(`\n💰 LIQUIDEZ EN LA ALERTA:\n`);
print(`   Allocated Amount: $${allocatedAmount.toFixed(2)}\n`);
print(`   Shares: ${shares.toFixed(4)}\n`);
print(`   Original Allocated Amount: $${originalAllocatedAmount.toFixed(2)}\n`);
print(`   Original Shares: ${originalShares.toFixed(4)}\n`);

// Buscar distribución en Liquidity
print(`\n🔍 Buscando distribución en Liquidity (Pool: ${POOL})...\n`);

// Primero buscar TODOS los documentos de liquidez del pool (puede haber varios)
const allLiquidityDocs = db.liquidity.find({
  pool: POOL
}).toArray();

print(`   📋 Se encontraron ${allLiquidityDocs.length} documento(s) de liquidez para ${POOL}\n`);

if (allLiquidityDocs.length === 0) {
  print(`   ⚠️  No se encontró documento de liquidez para ${POOL}\n`);
  print(`   💡 Esto ES el problema: el gráfico necesita la distribución en Liquidity\n`);
  print(`   💡 CAT no aparecerá en el gráfico hasta que tenga una distribución en Liquidity\n`);
} else {
  // Buscar el documento principal (el que tiene distribuciones)
  const docsWithDistributions = allLiquidityDocs.filter(doc => 
    doc.distributions && Array.isArray(doc.distributions) && doc.distributions.length > 0
  );
  
  // Usar el documento con más distribuciones o el más reciente
  const liquidity = docsWithDistributions.length > 0
    ? docsWithDistributions.sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || new Date(0);
        const dateB = b.updatedAt || b.createdAt || new Date(0);
        return new Date(dateB) - new Date(dateA);
      })[0]
    : allLiquidityDocs[0];
  
  print(`   ✅ Usando documento principal: ${liquidity._id}\n`);
  print(`   Total Liquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)}\n`);
  print(`   Available Liquidity: $${(liquidity.availableLiquidity || 0).toFixed(2)}\n`);
  print(`   Initial Liquidity: $${(liquidity.initialLiquidity || 0).toFixed(2)}\n`);
  print(`   Distributed Liquidity: $${(liquidity.distributedLiquidity || 0).toFixed(2)}\n`);
  print(`   Total Distributions: ${(liquidity.distributions || []).length}\n`);
  
  if (allLiquidityDocs.length > 1) {
    print(`\n   📋 Información de otros documentos:\n`);
    allLiquidityDocs.forEach((doc, idx) => {
      if (doc._id.toString() !== liquidity._id.toString()) {
        print(`      ${idx + 1}. ID: ${doc._id}, Distribuciones: ${(doc.distributions || []).length}, Total: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
      }
    });
  }
  
  // Buscar distribución específica para CAT por alertId
  const distribution = liquidity.distributions?.find(
    d => d.alertId && d.alertId.toString() === alert._id.toString()
  );
  
  if (distribution) {
    print(`\n   ✅ DISTRIBUCIÓN ENCONTRADA PARA CAT:\n`);
    print(`      Symbol: ${distribution.symbol || 'N/A'}\n`);
    print(`      Percentage: ${(distribution.percentage || 0).toFixed(2)}%\n`);
    print(`      Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}\n`);
    print(`      Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}\n`);
    print(`      Current Price: $${(distribution.currentPrice || 0).toFixed(2)}\n`);
    print(`      Shares: ${(distribution.shares || 0).toFixed(4)}\n`);
    print(`      Sold Shares: ${(distribution.soldShares || 0).toFixed(4)}\n`);
    print(`      Is Active: ${distribution.isActive || false}\n`);
    
    // Calcular valor actual de mercado
    const distShares = distribution.shares || 0;
    const distCurrentPrice = distribution.currentPrice || currentPrice || 0;
    const currentMarketValue = distShares * distCurrentPrice;
    
    print(`\n   💰 VALOR ACTUAL DE MERCADO:\n`);
    print(`      Shares actuales: ${distShares.toFixed(4)}\n`);
    print(`      Precio actual: $${distCurrentPrice.toFixed(2)}\n`);
    print(`      Valor actual: $${currentMarketValue.toFixed(2)}\n`);
    
    // Calcular ponderación esperada vs actual
    const totalLiquidity = liquidity.totalLiquidity || 0;
    const availableLiquidity = liquidity.availableLiquidity || 0;
    const distributedLiquidity = liquidity.distributedLiquidity || 0;
    
    print(`\n   📊 CÁLCULO DE PONDERACIÓN:\n`);
    print(`      Total Liquidity: $${totalLiquidity.toFixed(2)}\n`);
    print(`      Available Liquidity: $${availableLiquidity.toFixed(2)}\n`);
    print(`      Distributed Liquidity: $${distributedLiquidity.toFixed(2)}\n`);
    
    // El gráfico usa allocatedAmount (monto asignado original) para calcular ponderación
    const allocatedAmountForChart = distribution.allocatedAmount || allocatedAmount;
    
    // Opción 1: Ponderación basada en allocatedAmount vs Total Liquidity (lo que hace el gráfico)
    const portfolioBaseForChart = totalLiquidity; // El gráfico usa totalLiquidity como base
    const weightingBasedOnAllocated = portfolioBaseForChart > 0 
      ? (allocatedAmountForChart / portfolioBaseForChart) * 100 
      : 0;
    
    // Opción 2: Ponderación basada en valor actual de mercado
    const currentPortfolioValue = totalLiquidity; // Valor total del portfolio
    const weightingBasedOnCurrentValue = currentPortfolioValue > 0
      ? (currentMarketValue / currentPortfolioValue) * 100
      : 0;
    
    print(`\n   📈 PONDERACIÓN ACTUAL EN EL GRÁFICO (basada en allocatedAmount):\n`);
    print(`      Allocated Amount usado: $${allocatedAmountForChart.toFixed(2)}\n`);
    print(`      Base del portfolio (Total Liquidity): $${portfolioBaseForChart.toFixed(2)}\n`);
    print(`      Ponderación: ${weightingBasedOnAllocated.toFixed(2)}%\n`);
    
    print(`\n   📈 PONDERACIÓN ESPERADA (basada en valor actual de mercado):\n`);
    print(`      Valor actual de mercado: $${currentMarketValue.toFixed(2)}\n`);
    print(`      Valor total del portfolio: $${currentPortfolioValue.toFixed(2)}\n`);
    print(`      Ponderación: ${weightingBasedOnCurrentValue.toFixed(2)}%\n`);
    
    print(`\n   📈 PONDERACIÓN AL COMPRAR (basada en porcentaje original):\n`);
    print(`      Porcentaje original en distribución: ${(distribution.percentage || 0).toFixed(2)}%\n`);
    print(`      Ponderación esperada al comprar: ${EXPECTED_PERCENTAGE_AT_BUY}%\n`);
    
    // Verificar discrepancias
    print(`\n   ✅ VERIFICACIÓN:\n`);
    const diffFromExpected = weightingBasedOnAllocated - EXPECTED_PERCENTAGE_AT_BUY;
    if (Math.abs(diffFromExpected) > 0.1) {
      print(`      ⚠️  DIFERENCIA: La ponderación actual (${weightingBasedOnAllocated.toFixed(2)}%) difiere del ${EXPECTED_PERCENTAGE_AT_BUY}% esperado\n`);
      print(`      💡 Diferencia: ${diffFromExpected > 0 ? '+' : ''}${diffFromExpected.toFixed(2)}%\n`);
      print(`      💡 RAZÓN: Si el portfolio creció (de $${(liquidity.initialLiquidity || 0).toFixed(2)} a $${totalLiquidity.toFixed(2)}), el allocatedAmount sigue siendo $${allocatedAmountForChart.toFixed(2)}\n`);
      print(`      💡 Por lo tanto, la ponderación baja: $${allocatedAmountForChart.toFixed(2)} / $${totalLiquidity.toFixed(2)} = ${weightingBasedOnAllocated.toFixed(2)}%\n`);
    } else {
      print(`      ✅ La ponderación coincide con el ${EXPECTED_PERCENTAGE_AT_BUY}% esperado\n`);
    }
    
    // Calcular si el problema es que el allocatedAmount no se actualizó
    const expectedCurrentValue = originalAllocatedAmount * (currentPrice / entryPrice);
    print(`\n   💰 VALOR ESPERADO vs ACTUAL:\n`);
    print(`      Allocated original: $${originalAllocatedAmount.toFixed(2)}\n`);
    print(`      Valor esperado (si no hubiera ventas): $${expectedCurrentValue.toFixed(2)}\n`);
    print(`      Valor actual (shares * precio): $${currentMarketValue.toFixed(2)}\n`);
    print(`      Diferencia: $${Math.abs(currentMarketValue - expectedCurrentValue).toFixed(2)}\n`);
  } else {
    // No se encontró distribución por alertId, buscar por símbolo
    const distributionBySymbol = liquidity.distributions?.find(
      d => d.symbol && d.symbol.toUpperCase() === CAT_SYMBOL.toUpperCase()
    );
    
    if (distributionBySymbol) {
      print(`\n   ⚠️  Se encontró distribución por símbolo (no por alertId):\n`);
      print(`      Symbol: ${distributionBySymbol.symbol}\n`);
      print(`      Alert ID en distribución: ${distributionBySymbol.alertId ? distributionBySymbol.alertId.toString() : 'N/A'}\n`);
      print(`      Alert ID de la alerta: ${alert._id}\n`);
      print(`      💡 Hay una discrepancia entre el alertId\n`);
    } else {
      print(`\n   ⚠️  PROBLEMA CRÍTICO: CAT NO tiene distribución en Liquidity\n`);
      print(`   💡 Esto explica por qué aparece con menos del 5% en el gráfico\n`);
      print(`   💡 El gráfico necesita la distribución para calcular la ponderación\n`);
      print(`\n   🔍 Verificando todas las distribuciones del pool:\n`);
      if (liquidity.distributions && liquidity.distributions.length > 0) {
        liquidity.distributions.forEach((dist, idx) => {
          print(`      ${idx + 1}. ${dist.symbol || 'N/A'}: $${(dist.allocatedAmount || 0).toFixed(2)} (Alert ID: ${dist.alertId ? dist.alertId.toString() : 'N/A'}, Active: ${dist.isActive || false})\n`);
        });
      }
    }
  }
}

// Buscar operación de compra
print(`\n🔍 Buscando operación de compra...\n`);
const buyOperation = db.operations.findOne({
  alertId: alert._id,
  ticker: CAT_SYMBOL.toUpperCase(),
  operationType: 'COMPRA'
});

if (buyOperation) {
  print(`   ✅ Operación de compra encontrada:\n`);
  print(`      ID: ${buyOperation._id}\n`);
  print(`      Precio: $${(buyOperation.price || 0).toFixed(2)}\n`);
  print(`      Cantidad: ${buyOperation.quantity || 0}\n`);
  print(`      Monto: $${(buyOperation.amount || 0).toFixed(2)}\n`);
  print(`      Portfolio Percentage: ${(buyOperation.portfolioPercentage || 0).toFixed(2)}%\n`);
  print(`      Fecha: ${buyOperation.date || buyOperation.createdAt}\n`);
  
  // Verificar si el portfolioPercentage coincide
  if (buyOperation.portfolioPercentage) {
    const opPercentDiff = Math.abs(buyOperation.portfolioPercentage - EXPECTED_PERCENTAGE_AT_BUY);
    if (opPercentDiff > 0.1) {
      print(`\n   ⚠️  ADVERTENCIA: portfolioPercentage en operación (${buyOperation.portfolioPercentage}%) no coincide con ${EXPECTED_PERCENTAGE_AT_BUY}%\n`);
    }
  }
} else {
  print(`   ⚠️  No se encontró operación de compra\n`);
}

// Resumen final
print(`\n${'='.repeat(80)}\n`);
print(`📊 RESUMEN DEL ANÁLISIS\n`);
print(`${'='.repeat(80)}\n`);

print(`🔍 PROBLEMA IDENTIFICADO:\n`);
print(`   El gráfico de tortas usa allocatedAmount (monto asignado original) para calcular ponderación\n`);
print(`   Si CAT subió ~63% (de $386 a $629), el valor actual debería ser mayor\n`);
print(`   Pero el gráfico muestra basándose en el monto original asignado\n`);
print(`   Si el portfolio SmartMoney creció, la ponderación de CAT baja porque su allocatedAmount no cambia\n`);
print(`\n💡 SOLUCIONES POSIBLES:\n`);
print(`   1. Verificar que CAT tenga una distribución en Liquidity con el alertId correcto\n`);
print(`   2. Verificar que allocatedAmount en la distribución sea correcto (5% de la liquidez inicial)\n`);
print(`   3. Considerar cambiar el gráfico para usar valor actual de mercado en lugar de allocatedAmount\n`);
print(`   4. O recalcular allocatedAmount como porcentaje del total actual (pero esto cambiaría el concepto)\n`);

print(`${'='.repeat(80)}\n`);
