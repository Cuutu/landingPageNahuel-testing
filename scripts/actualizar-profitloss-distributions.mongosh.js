/*******************************
 * ACTUALIZAR PROFITLOSS EN DISTRIBUTIONS
 * 
 * Actualiza el profitLoss de todas las distributions
 * basándose en el currentPrice de las alerts
 *******************************/
const DRY_RUN = false; // Cambiar a false para aplicar cambios
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF (EJECUTARÁ CAMBIOS)",
  pool: POOL
});

/****************************************
 * 1) Obtener documento principal de Liquidity
 ****************************************/
print("\n=== 1) Buscando documento de Liquidity ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length === 0) {
  print("❌ No se encontró ningún documento de Liquidity para este pool.");
  quit();
}

const mainDoc = liquidityDocs
  .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];

print(`Usando Liquidity._id = ${mainDoc._id} como documento principal.`);

/****************************************
 * 2) Buscar distributions que necesitan actualización
 ****************************************/
print("\n=== 2) Analizando distributions que necesitan actualización ===");

const distributionsParaActualizar = [];

(mainDoc.distributions || []).forEach((dist, distIdx) => {
  if (!dist.isActive || !dist.alertId) {
    return;
  }
  
  // ✅ CORREGIDO: Convertir alertId a ObjectId si es necesario
  let alertIdObj;
  try {
    alertIdObj = typeof dist.alertId === 'string' ? ObjectId(dist.alertId) : dist.alertId;
  } catch (e) {
    print(`⚠️ Distribution ${distIdx + 1} (${dist.symbol}): alertId inválido: ${dist.alertId}`);
    return;
  }
  
  const alert = alertsColl.findOne({ _id: alertIdObj });
  if (!alert) {
    print(`⚠️ Distribution ${distIdx + 1} (${dist.symbol}): Alert no encontrada (alertId: ${dist.alertId})`);
    return;
  }
  
  const currentPrice = alert.currentPrice || 0;
  const entryPrice = dist.entryPrice || 0;
  
  if (currentPrice === 0 || entryPrice === 0) {
    print(`⚠️ Distribution ${distIdx + 1} (${dist.symbol}): Precios inválidos (entry: ${entryPrice}, current: ${currentPrice})`);
    return;
  }
  
  // Calcular profitLossPercentage
  const profitLossPercentage = entryPrice > 0
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : 0;
  
  // Calcular profitLoss en dólares
  const allocatedAmount = dist.allocatedAmount || 0;
  const profitLoss = allocatedAmount > 0
    ? (profitLossPercentage / 100) * allocatedAmount
    : 0;
  
  // Comparar con valores actuales
  const profitLossActual = dist.profitLoss || 0;
  const profitLossPercentageActual = dist.profitLossPercentage || 0;
  
  const diferenciaPL = Math.abs(profitLoss - profitLossActual);
  const diferenciaPLPct = Math.abs(profitLossPercentage - profitLossPercentageActual);
  
  if (diferenciaPL > 0.01 || diferenciaPLPct > 0.01) {
    distributionsParaActualizar.push({
      distributionIndex: distIdx,
      symbol: dist.symbol,
      alertId: dist.alertId,
      entryPrice: entryPrice,
      currentPrice: currentPrice,
      allocatedAmount: allocatedAmount,
      valoresActuales: {
        profitLoss: profitLossActual,
        profitLossPercentage: profitLossPercentageActual
      },
      valoresNuevos: {
        profitLoss: profitLoss,
        profitLossPercentage: profitLossPercentage
      },
      diferenciaPL: diferenciaPL,
      diferenciaPLPct: diferenciaPLPct
    });
    
    print(`\n✅ ${dist.symbol}: Necesita actualización`);
    print(`   Entry Price: $${entryPrice.toFixed(2)}`);
    print(`   Current Price: $${currentPrice.toFixed(2)}`);
    print(`   Profit/Loss %: ${profitLossPercentageActual.toFixed(2)}% -> ${profitLossPercentage.toFixed(2)}%`);
    print(`   Profit/Loss $: $${profitLossActual.toFixed(2)} -> $${profitLoss.toFixed(2)}`);
  }
});

print(`\nTotal distributions que necesitan actualización: ${distributionsParaActualizar.length}`);

if (distributionsParaActualizar.length === 0) {
  print("✅ Todas las distributions están actualizadas.");
  quit();
}

/****************************************
 * 3) Aplicar cambios (si DRY_RUN = false)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 3) Modo DRY RUN - No se actualizarán distributions ===");
  print("Si estás conforme, cambiá DRY_RUN = false y volvé a ejecutar.");
} else {
  print("\n=== 3) Actualizando profitLoss en distributions ===");
  
  let actualizadas = 0;
  let errores = 0;
  
  distributionsParaActualizar.forEach((item, idx) => {
    try {
      const updatePath = `distributions.${item.distributionIndex}`;
      
      const result = liquidityColl.updateOne(
        { _id: mainDoc._id },
        {
          $set: {
            [`${updatePath}.currentPrice`]: item.currentPrice,
            [`${updatePath}.profitLossPercentage`]: item.valoresNuevos.profitLossPercentage,
            [`${updatePath}.profitLoss`]: item.valoresNuevos.profitLoss,
            [`${updatePath}.updatedAt`]: new Date()
          }
        }
      );
      
      if (result.modifiedCount === 1) {
        actualizadas++;
        print(`✅ ${idx + 1}. ${item.symbol} - Actualizado (P&L: ${item.valoresNuevos.profitLossPercentage.toFixed(2)}%, $${item.valoresNuevos.profitLoss.toFixed(2)})`);
      } else {
        errores++;
        print(`⚠️ ${idx + 1}. ${item.symbol} - No se pudo actualizar`);
      }
    } catch (error) {
      errores++;
      print(`❌ ${idx + 1}. ${item.symbol} - Error: ${error.message}`);
    }
  });
  
  print(`\n=== RESUMEN ACTUALIZACIÓN ===`);
  print(`Distributions actualizadas: ${actualizadas}`);
  print(`Errores: ${errores}`);
  print(`Total procesadas: ${distributionsParaActualizar.length}`);
  
  // Recalcular totalProfitLoss del documento
  if (actualizadas > 0) {
    print("\n=== 4) Recalculando totalProfitLoss ===");
    
    const updatedDoc = liquidityColl.findOne({ _id: mainDoc._id });
    
    let totalUnrealizedPL = 0;
    let totalRealizedPL = 0;
    
    (updatedDoc.distributions || []).forEach((dist) => {
      totalUnrealizedPL += dist.profitLoss || 0;
      totalRealizedPL += dist.realizedProfitLoss || 0;
    });
    
    const totalProfitLoss = totalUnrealizedPL + totalRealizedPL;
    const totalProfitLossPercentage = (updatedDoc.distributedLiquidity || 0) > 0
      ? (totalProfitLoss / updatedDoc.distributedLiquidity) * 100
      : 0;
    
    const result = liquidityColl.updateOne(
      { _id: mainDoc._id },
      {
        $set: {
          totalProfitLoss: totalProfitLoss,
          totalProfitLossPercentage: totalProfitLossPercentage,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount === 1) {
      print(`✅ Total Profit/Loss recalculado: $${totalProfitLoss.toFixed(2)} (${totalProfitLossPercentage.toFixed(2)}%)`);
      print(`   Unrealized: $${totalUnrealizedPL.toFixed(2)}`);
      print(`   Realized: $${totalRealizedPL.toFixed(2)}`);
    } else {
      print(`⚠️ No se pudo actualizar totalProfitLoss`);
    }
  }
}

print("\n=== FIN ACTUALIZACIÓN ===");
