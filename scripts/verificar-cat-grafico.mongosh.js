/**
 * VERIFICAR - Por qué CAT aparece con 4.9% en lugar de 5% en el gráfico
 * 
 * Este script verifica:
 * 1. El allocatedAmount de CAT en la distribución
 * 2. La liquidez total del portfolio SmartMoney
 * 3. Cómo se calcula la ponderación en el gráfico
 */

print('🔍 VERIFICAR - Ponderación de CAT en el gráfico\n');
print('='.repeat(80) + '\n');

const CAT_SYMBOL = 'CAT';
const POOL = 'SmartMoney';
const CAT_ALERT_ID = ObjectId('692e381a624af2b3b77ebbaf');

print(`📊 Símbolo: ${CAT_SYMBOL}\n`);
print(`💰 Pool: ${POOL}\n`);
print(`📋 Alert ID: ${CAT_ALERT_ID}\n`);
print('='.repeat(80) + '\n');

// Buscar la alerta CAT
const alert = db.alerts.findOne({ _id: CAT_ALERT_ID });

if (!alert) {
  print(`❌ No se encontró la alerta CAT\n`);
  quit(1);
}

print(`✅ Alerta encontrada: ${alert.symbol}\n`);
print(`   Allocated Amount en alerta: $${((alert.liquidityData || {}).allocatedAmount || 0).toFixed(2)}\n`);

// Buscar TODOS los documentos de liquidez del pool (sin filtros)
print(`\n🔍 Buscando documentos de Liquidity para ${POOL}...\n`);

const allLiquidityDocs = db.liquidity.find({ pool: POOL }).toArray();

print(`   📋 Total documentos encontrados: ${allLiquidityDocs.length}\n`);

if (allLiquidityDocs.length === 0) {
  print(`   ⚠️  No se encontraron documentos de Liquidity para ${POOL}\n`);
  print(`   💡 Esto es extraño porque CAT aparece en el gráfico...\n`);
  print(`   💡 Puede que el gráfico esté usando datos de otro lugar\n`);
  quit(0);
}

// Analizar cada documento
allLiquidityDocs.forEach((doc, idx) => {
  print(`\n📄 Documento ${idx + 1}:\n`);
  print(`   ID: ${doc._id}\n`);
  print(`   Initial Liquidity: $${(doc.initialLiquidity || 0).toFixed(2)}\n`);
  print(`   Total Liquidity: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
  print(`   Available Liquidity: $${(doc.availableLiquidity || 0).toFixed(2)}\n`);
  print(`   Distributed Liquidity: $${(doc.distributedLiquidity || 0).toFixed(2)}\n`);
  print(`   Distributions: ${(doc.distributions || []).length}\n`);
  
  // Buscar distribución de CAT
  const catDistribution = (doc.distributions || []).find(
    d => (d.alertId && d.alertId.toString() === CAT_ALERT_ID.toString()) ||
         (d.symbol && d.symbol.toUpperCase() === CAT_SYMBOL.toUpperCase())
  );
  
  if (catDistribution) {
    print(`\n   ✅ DISTRIBUCIÓN DE CAT ENCONTRADA:\n`);
    print(`      Alert ID: ${catDistribution.alertId || 'N/A'}\n`);
    print(`      Symbol: ${catDistribution.symbol || 'N/A'}\n`);
    print(`      Percentage: ${(catDistribution.percentage || 0).toFixed(2)}%\n`);
    print(`      Allocated Amount: $${(catDistribution.allocatedAmount || 0).toFixed(2)}\n`);
    print(`      Entry Price: $${(catDistribution.entryPrice || 0).toFixed(2)}\n`);
    print(`      Current Price: $${(catDistribution.currentPrice || 0).toFixed(2)}\n`);
    print(`      Shares: ${(catDistribution.shares || 0).toFixed(4)}\n`);
    print(`      Is Active: ${catDistribution.isActive || false}\n`);
    
    // Calcular ponderación actual
    const totalLiquidity = doc.totalLiquidity || 0;
    const allocatedAmount = catDistribution.allocatedAmount || 0;
    const currentWeighting = totalLiquidity > 0 
      ? (allocatedAmount / totalLiquidity) * 100 
      : 0;
    
    print(`\n   📊 CÁLCULO DE PONDERACIÓN:\n`);
    print(`      Allocated Amount (CAT): $${allocatedAmount.toFixed(2)}\n`);
    print(`      Total Liquidity: $${totalLiquidity.toFixed(2)}\n`);
    print(`      Ponderación actual: ${currentWeighting.toFixed(2)}%\n`);
    print(`      Ponderación esperada: 5.00%\n`);
    print(`      Diferencia: ${(currentWeighting - 5).toFixed(2)}%\n`);
    
    // Calcular todas las distribuciones activas para ver el total
    const activeDistributions = (doc.distributions || []).filter(d => d.isActive);
    const totalAllocated = activeDistributions.reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
    const availableLiquidity = doc.availableLiquidity || 0;
    const totalInChart = totalAllocated + availableLiquidity;
    
    print(`\n   📊 TOTALES PARA EL GRÁFICO:\n`);
    print(`      Total Allocated (distribuciones activas): $${totalAllocated.toFixed(2)}\n`);
    print(`      Available Liquidity: $${availableLiquidity.toFixed(2)}\n`);
    print(`      Total en gráfico: $${totalInChart.toFixed(2)}\n`);
    print(`      Ponderación de CAT en gráfico: ${totalInChart > 0 ? (allocatedAmount / totalInChart * 100).toFixed(2) : 0}%\n`);
    
    // Verificar si hay otras distribuciones activas
    print(`\n   📋 OTRAS DISTRIBUCIONES ACTIVAS:\n`);
    activeDistributions.forEach((dist, distIdx) => {
      if (dist.symbol !== CAT_SYMBOL.toUpperCase()) {
        print(`      ${distIdx + 1}. ${dist.symbol}: $${(dist.allocatedAmount || 0).toFixed(2)} (${((dist.allocatedAmount || 0) / totalInChart * 100).toFixed(2)}%)\n`);
      }
    });
  } else {
    print(`   ⚠️  No se encontró distribución de CAT en este documento\n`);
  }
});

print(`\n${'='.repeat(80)}\n`);
print(`📊 RESUMEN\n`);
print(`${'='.repeat(80)}\n`);
print(`El gráfico calcula la ponderación como: (allocatedAmount / totalValue) * 100\n`);
print(`Donde totalValue = suma de todos los allocatedAmount + availableLiquidity\n`);
print(`Si CAT aparece con 4.9% en lugar de 5%, significa que:\n`);
print(`- El allocatedAmount de CAT está correcto ($50 para 5% de $1000 inicial)\n`);
print(`- Pero el totalValue del gráfico creció (por ejemplo, a $1020)\n`);
print(`- Por lo tanto: $50 / $1020 = 4.9%\n`);
print(`\nEsto es el comportamiento CORRECTO del gráfico actual\n`);
print(`Si quieres que CAT siempre muestre 5%, necesitarías cambiar la lógica del gráfico\n`);
print(`para usar el porcentaje original en lugar de allocatedAmount\n`);
