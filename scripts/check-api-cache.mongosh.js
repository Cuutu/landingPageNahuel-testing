/**
 * Verificar el caché de la API - Esta es probablemente la fuente del 4.2%
 */

print('🔍 Verificando CACHÉ DE API...\n');
print('='.repeat(70) + '\n');

// Buscar colección de caché
const cacheCollection = db.getCollection('apicaches');
const allCaches = cacheCollection.find({}).toArray();

print(`📊 Total entradas de caché: ${allCaches.length}\n`);

// Filtrar solo las de liquidez
print(`\n📊 ENTRADAS DE CACHÉ DE LIQUIDEZ:\n`);

for (let i = 0; i < allCaches.length; i++) {
  const cache = allCaches[i];
  const path = cache.keyParts?.path || '';
  
  if (path.includes('liquidity')) {
    print(`   ${i + 1}. Path: ${path}\n`);
    print(`      Pool: ${cache.keyParts?.query?.pool || 'N/A'}\n`);
    print(`      Expires: ${cache.expiresAt || 'N/A'}\n`);
    
    // Verificar si el caché tiene datos
    if (cache.payload && cache.payload.data) {
      const data = cache.payload.data;
      print(`      Liquidez Inicial: $${(data.liquidezInicial || 0).toFixed(2)}\n`);
      print(`      Liquidez Total: $${(data.liquidezTotal || 0).toFixed(2)}\n`);
      print(`      Liquidez Distribuida: $${(data.liquidezDistribuida || 0).toFixed(2)}\n`);
      
      // Contar distribuciones
      const distributions = data.distributions || [];
      const individualDists = data.individualDistributions || [];
      
      print(`      Distributions (consolidadas): ${distributions.length}\n`);
      print(`      Individual Distributions: ${individualDists.length}\n`);
      
      if (individualDists.length > 0) {
        print(`      📋 Símbolos en individualDistributions:\n`);
        for (let j = 0; j < individualDists.length; j++) {
          const d = individualDists[j];
          print(`         ${j + 1}. ${d.symbol} - Allocated: $${(d.allocatedAmount || 0).toFixed(2)}\n`);
        }
      }
      
      // Buscar INTC específicamente
      const intcDist = individualDists.find(d => d.symbol === 'INTC');
      if (intcDist) {
        const intcCurrentValue = (intcDist.allocatedAmount || 0) + (intcDist.profitLoss || 0);
        const liquidezTotal = data.liquidezTotal || 0;
        const intcPercentage = liquidezTotal > 0 ? (intcCurrentValue / liquidezTotal) * 100 : 0;
        
        print(`\n      💡 INTC en este caché:\n`);
        print(`         Allocated: $${(intcDist.allocatedAmount || 0).toFixed(2)}\n`);
        print(`         Profit Loss: $${(intcDist.profitLoss || 0).toFixed(2)}\n`);
        print(`         Current Value: $${intcCurrentValue.toFixed(2)}\n`);
        print(`         Porcentaje: ${intcPercentage.toFixed(2)}%\n`);
      }
    }
    print(`\n`);
  }
}

// Verificar si el caché tiene datos desactualizados
print(`\n📊 COMPARACIÓN CACHÉ vs BASE DE DATOS:\n`);

const traderCallCache = allCaches.find(c => 
  c.keyParts?.path?.includes('liquidity') && 
  c.keyParts?.query?.pool === 'TraderCall'
);

if (traderCallCache && traderCallCache.payload?.data) {
  const cacheData = traderCallCache.payload.data;
  const dbLiquidity = db.liquidity.findOne({ pool: 'TraderCall' });
  
  print(`   CACHÉ:\n`);
  print(`      Liquidez Total: $${(cacheData.liquidezTotal || 0).toFixed(2)}\n`);
  print(`      Distributions: ${(cacheData.individualDistributions || []).length}\n`);
  
  if (dbLiquidity) {
    const dbDists = dbLiquidity.distributions || [];
    print(`\n   BASE DE DATOS:\n`);
    print(`      Liquidez Total: $${(dbLiquidity.totalLiquidity || 0).toFixed(2)}\n`);
    print(`      Distributions: ${dbDists.length}\n`);
    
    // Comparar
    const cacheDists = (cacheData.individualDistributions || []).length;
    const dbDistsCount = dbDists.length;
    
    if (cacheDists !== dbDistsCount) {
      print(`\n   ⚠️  DIFERENCIA DETECTADA!\n`);
      print(`      Caché tiene ${cacheDists} distribuciones\n`);
      print(`      DB tiene ${dbDistsCount} distribuciones\n`);
      print(`      💡 El caché tiene datos desactualizados!\n`);
    }
  }
}

print('\n' + '='.repeat(70) + '\n');
print('💡 Si el caché tiene más distribuciones que la DB, ese es el problema.\n');
print('   El gráfico está usando datos cacheados de antes de los cambios.\n');
print('='.repeat(70) + '\n');
