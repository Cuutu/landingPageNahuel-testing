// Script para consolidar documentos de liquidez duplicados del mismo pool
// Ejecutar en mongosh: mongosh < tu-database > --file scripts/consolidate-liquidity.mongodb.js

print("🔄 Iniciando consolidación de documentos de liquidez...\n");

const pools = ["TraderCall", "SmartMoney"];

pools.forEach(pool => {
  print(`\n📊 Procesando pool: ${pool}`);
  
  // Buscar todos los documentos del pool
  const allDocs = db.liquidities.find({ pool: pool }).toArray();
  print(`   - Documentos encontrados: ${allDocs.length}`);
  
  if (allDocs.length <= 1) {
    print(`   ✅ Solo hay ${allDocs.length} documento(s), no hay duplicados`);
    return;
  }
  
  // Encontrar el documento principal (el que tiene más distribuciones o el más reciente)
  let mainDoc = null;
  let maxDistributions = 0;
  let latestDate = null;
  
  allDocs.forEach(doc => {
    const distCount = (doc.distributions || []).length;
    const updateDate = doc.updatedAt || doc.createdAt || new Date(0);
    
    if (distCount > maxDistributions || 
        (distCount === maxDistributions && updateDate > latestDate)) {
      mainDoc = doc;
      maxDistributions = distCount;
      latestDate = updateDate;
    }
  });
  
  if (!mainDoc) {
    print(`   ⚠️ No se encontró documento principal`);
    return;
  }
  
  print(`   ✅ Documento principal seleccionado: ${mainDoc._id}`);
  print(`      - Distribuciones: ${maxDistributions}`);
  print(`      - initialLiquidity: $${mainDoc.initialLiquidity || 'N/A'}`);
  print(`      - totalLiquidity: $${mainDoc.totalLiquidity || 'N/A'}`);
  
  // Consolidar: combinar todas las distribuciones y valores
  let allDistributions = [...(mainDoc.distributions || [])];
  let totalInitialLiquidity = mainDoc.initialLiquidity || 0;
  let totalTotalLiquidity = mainDoc.totalLiquidity || 0;
  let totalDistributedLiquidity = mainDoc.distributedLiquidity || 0;
  let totalProfitLoss = mainDoc.totalProfitLoss || 0;
  
  // Map para evitar duplicados de distribuciones
  const distributionMap = new Map();
  allDistributions.forEach(dist => {
    const key = dist.alertId?.toString() || dist.symbol;
    if (key) {
      distributionMap.set(key, dist);
    }
  });
  
  // Procesar otros documentos
  allDocs.forEach(doc => {
    if (doc._id.toString() === mainDoc._id.toString()) {
      return; // Saltar el documento principal
    }
    
    print(`   📋 Consolidando documento: ${doc._id}`);
    
    // Agregar distribuciones únicas
    (doc.distributions || []).forEach(dist => {
      const key = dist.alertId?.toString() || dist.symbol;
      if (key && !distributionMap.has(key)) {
        distributionMap.set(key, dist);
        print(`      ✅ Agregada distribución: ${dist.symbol} (${key})`);
      } else if (key) {
        print(`      ⚠️ Distribución duplicada ignorada: ${dist.symbol} (${key})`);
      }
    });
    
    // Sumar valores (usar el mayor para initialLiquidity)
    if (doc.initialLiquidity && doc.initialLiquidity > totalInitialLiquidity) {
      totalInitialLiquidity = doc.initialLiquidity;
    }
    totalTotalLiquidity = Math.max(totalTotalLiquidity, doc.totalLiquidity || 0);
    totalDistributedLiquidity += (doc.distributedLiquidity || 0);
    totalProfitLoss += (doc.totalProfitLoss || 0);
  });
  
  // Convertir map a array
  const consolidatedDistributions = Array.from(distributionMap.values());
  
  // Recalcular distributedLiquidity desde las distribuciones
  const recalculatedDistributed = consolidatedDistributions
    .filter(d => d.isActive !== false)
    .reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
  
  // Calcular availableLiquidity
  const availableLiquidity = totalTotalLiquidity - recalculatedDistributed;
  
  print(`\n   📊 Valores consolidados:`);
  print(`      - Distribuciones: ${consolidatedDistributions.length}`);
  print(`      - initialLiquidity: $${totalInitialLiquidity.toFixed(2)}`);
  print(`      - totalLiquidity: $${totalTotalLiquidity.toFixed(2)}`);
  print(`      - distributedLiquidity: $${recalculatedDistributed.toFixed(2)}`);
  print(`      - availableLiquidity: $${availableLiquidity.toFixed(2)}`);
  print(`      - totalProfitLoss: $${totalProfitLoss.toFixed(2)}`);
  
  // Actualizar el documento principal
  const updateResult = db.liquidities.updateOne(
    { _id: mainDoc._id },
    {
      $set: {
        initialLiquidity: totalInitialLiquidity,
        totalLiquidity: totalTotalLiquidity,
        distributedLiquidity: recalculatedDistributed,
        availableLiquidity: availableLiquidity,
        totalProfitLoss: totalProfitLoss,
        totalProfitLossPercentage: totalInitialLiquidity > 0 
          ? (totalProfitLoss / totalInitialLiquidity) * 100 
          : 0,
        distributions: consolidatedDistributions,
        updatedAt: new Date()
      }
    }
  );
  
  if (updateResult.modifiedCount > 0) {
    print(`   ✅ Documento principal actualizado`);
  }
  
  // Eliminar documentos duplicados
  const idsToDelete = allDocs
    .filter(doc => doc._id.toString() !== mainDoc._id.toString())
    .map(doc => doc._id);
  
  if (idsToDelete.length > 0) {
    const deleteResult = db.liquidities.deleteMany({
      _id: { $in: idsToDelete }
    });
    print(`   🗑️  Documentos duplicados eliminados: ${deleteResult.deletedCount}`);
  }
  
  print(`\n   ✅ Pool ${pool} consolidado exitosamente`);
});

print("\n✅ Consolidación completada!");
