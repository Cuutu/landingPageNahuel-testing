/**
 * Encontrar la VERDADERA fuente de datos del gráfico
 * El gráfico está funcionando, así que hay datos en algún lugar
 */

print('🔍 Buscando la VERDADERA fuente de datos del gráfico...\n');
print('='.repeat(70) + '\n');

// 1. Verificar TODOS los documentos de liquidez (sin filtro)
print('📊 1. TODOS LOS DOCUMENTOS DE LIQUIDEZ EN LA BASE:\n');
const allLiquidityDocs = db.liquidity.find({}).toArray();
print(`   Total documentos: ${allLiquidityDocs.length}\n`);

allLiquidityDocs.forEach((doc, idx) => {
  let distributions = [];
  if (doc.distributions) {
    if (Array.isArray(doc.distributions)) {
      distributions = doc.distributions;
    } else {
      distributions = [doc.distributions];
    }
  }
  
  print(`   ${idx + 1}. ID: ${doc._id}\n`);
  print(`      Pool: ${doc.pool || 'N/A'}\n`);
  print(`      Initial Liquidity: $${(doc.initialLiquidity || 0).toFixed(2)}\n`);
  print(`      Total Liquidity: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
  print(`      Distributions: ${distributions.length}\n`);
  print(`      Created: ${doc.createdAt || 'N/A'}\n`);
  print(`      Updated: ${doc.updatedAt || 'N/A'}\n`);
  
  if (distributions.length > 0) {
    print(`      📋 Símbolos: ${distributions.map(d => d.symbol).join(', ')}\n`);
  }
  print(`\n`);
});

// 2. Verificar si hay caché de API
print('📊 2. VERIFICANDO CACHÉ DE API:\n');
const cacheCollection = db.apicaches || db.apicache || db.getCollection('apicaches');
if (cacheCollection) {
  const liquidityCaches = cacheCollection.find({
    'keyParts.path': { $regex: /liquidity/ }
  }).toArray();
  
  print(`   Entradas de caché de liquidez: ${liquidityCaches.length}\n`);
  
  liquidityCaches.forEach((cache, idx) => {
    print(`   ${idx + 1}. Key: ${cache.key?.substring(0, 20)}...\n`);
    print(`      Path: ${cache.keyParts?.path || 'N/A'}\n`);
    print(`      Pool: ${cache.keyParts?.query?.pool || 'N/A'}\n`);
    print(`      Expires: ${cache.expiresAt || 'N/A'}\n`);
    
    if (cache.payload?.data?.individualDistributions) {
      const dists = cache.payload.data.individualDistributions;
      print(`      Distributions en caché: ${dists.length}\n`);
      if (dists.length > 0) {
        print(`      Símbolos: ${dists.map(d => d.symbol).join(', ')}\n`);
      }
    }
    print(`\n`);
  });
} else {
  print(`   ⚠️  No se encontró colección de caché\n`);
}

// 3. Calcular qué porcentaje daría INTC con los datos actuales de la alerta
print('📊 3. CALCULANDO PORCENTAJE DE INTC:\n');
const intcAlert = db.alerts.findOne({ symbol: 'INTC', tipo: 'TraderCall', status: 'ACTIVE' });

if (intcAlert) {
  const intcAllocated = intcAlert.liquidityData?.allocatedAmount || 0;
  const intcShares = intcAlert.liquidityData?.shares || 0;
  const intcEntryPrice = intcAlert.entryPrice || 0;
  const intcCurrentPrice = parseFloat((intcAlert.currentPrice || '0').toString().replace('$', '')) || 0;
  
  // P&L no realizado
  const unrealizedPL = intcShares > 0 && intcEntryPrice > 0 && intcCurrentPrice > 0
    ? (intcCurrentPrice - intcEntryPrice) * intcShares
    : 0;
  
  const intcCurrentValue = intcAllocated + unrealizedPL;
  
  print(`   INTC desde alert.liquidityData:\n`);
  print(`      Allocated: $${intcAllocated.toFixed(2)}\n`);
  print(`      Shares: ${intcShares.toFixed(4)}\n`);
  print(`      Entry Price: $${intcEntryPrice.toFixed(2)}\n`);
  print(`      Current Price: $${intcCurrentPrice.toFixed(2)}\n`);
  print(`      P&L: $${unrealizedPL.toFixed(2)}\n`);
  print(`      Current Value: $${intcCurrentValue.toFixed(2)}\n`);
  
  // Calcular el total de todas las alertas con liquidez
  const allActiveAlerts = db.alerts.find({ tipo: 'TraderCall', status: 'ACTIVE' }).toArray();
  
  let totalAllocated = 0;
  let totalCurrentValue = 0;
  
  allActiveAlerts.forEach(alert => {
    const allocated = alert.liquidityData?.allocatedAmount || 0;
    const shares = alert.liquidityData?.shares || 0;
    const entryPrice = alert.entryPrice || 0;
    const currentPrice = parseFloat((alert.currentPrice || '0').toString().replace('$', '')) || 0;
    
    if (allocated > 0) {
      totalAllocated += allocated;
      
      const pl = shares > 0 && entryPrice > 0 && currentPrice > 0
        ? (currentPrice - entryPrice) * shares
        : 0;
      
      totalCurrentValue += (allocated + pl);
    }
  });
  
  print(`\n   Total de todas las alertas:\n`);
  print(`      Total Allocated: $${totalAllocated.toFixed(2)}\n`);
  print(`      Total Current Value: $${totalCurrentValue.toFixed(2)}\n`);
  
  // Si el gráfico está usando alert.liquidityData directamente...
  const intcPercentageFromAlerts = totalCurrentValue > 0
    ? (intcCurrentValue / totalCurrentValue) * 100
    : 0;
  
  print(`\n   Si el gráfico usa totalCurrentValue como base:\n`);
  print(`      INTC Current Value: $${intcCurrentValue.toFixed(2)}\n`);
  print(`      Total Current Value: $${totalCurrentValue.toFixed(2)}\n`);
  print(`      INTC Porcentaje: ${intcPercentageFromAlerts.toFixed(2)}%\n`);
  
  // Si el gráfico está usando liquidezTotal del documento...
  const liquidityDoc = db.liquidity.findOne({ pool: 'TraderCall' });
  if (liquidityDoc) {
    const liquidezTotal = liquidityDoc.totalLiquidity || 0;
    const intcPercentageFromDoc = liquidezTotal > 0
      ? (intcCurrentValue / liquidezTotal) * 100
      : 0;
    
    print(`\n   Si el gráfico usa liquidezTotal del documento:\n`);
    print(`      INTC Current Value: $${intcCurrentValue.toFixed(2)}\n`);
    print(`      Liquidez Total: $${liquidezTotal.toFixed(2)}\n`);
    print(`      INTC Porcentaje: ${intcPercentageFromDoc.toFixed(2)}%\n`);
  }
  
  // Verificar si 4.2% coincide con algún cálculo
  print(`\n   💡 El gráfico muestra 4.2%. Esto coincide con:\n`);
  
  if (Math.abs(intcPercentageFromAlerts - 4.2) < 0.3) {
    print(`      ✅ Cálculo desde alertas (${intcPercentageFromAlerts.toFixed(2)}%)\n`);
  }
  
  // Calcular qué totalBase daría 4.2%
  const impliedTotalBase = intcCurrentValue / 0.042;
  print(`\n   Si INTC es 4.2% del total, el total sería:\n`);
  print(`      $${intcCurrentValue.toFixed(2)} / 0.042 = $${impliedTotalBase.toFixed(2)}\n`);
  
  if (Math.abs(impliedTotalBase - totalCurrentValue) < 50) {
    print(`      ✅ Esto coincide con Total Current Value ($${totalCurrentValue.toFixed(2)})\n`);
  }
}

print('\n' + '='.repeat(70) + '\n');
