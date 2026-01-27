/*******************************
 * RECONSTRUIR CÁLCULO DEL DONUT
 * Para entender por qué ALAB muestra 6.1% en el gráfico
 *******************************/
const DRY_RUN = true;
const TARGET_SYMBOL = "ALAB";
const POOL = "TraderCall"; // ajustar si es SmartMoney

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity; // Mongoose pluraliza a "liquiditys" pero en mongosh se accede como db.liquidity

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  targetSymbol: TARGET_SYMBOL,
  pool: POOL
});

/****************************************
 * 1) Obtener distribuciones desde Liquidity
 *    (como lo hace /api/liquidity/summary)
 ****************************************/
print("\n=== 1) Distribuciones desde Liquidity ===");

let liquidityDoc = null;
try {
  const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();
  
  if (liquidityDocs.length > 0) {
    // Usar el documento principal (con distributions)
    const docsWithDistributions = liquidityDocs.filter(doc => 
      doc.distributions && doc.distributions.length > 0
    );
    
    liquidityDoc = docsWithDistributions.length > 0 
      ? docsWithDistributions.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt || 0).getTime() - 
          new Date(a.updatedAt || a.createdAt || 0).getTime()
        )[0]
      : liquidityDocs[0];
    
    print(`Documento Liquidity encontrado: ${liquidityDoc._id}`);
    print(`Total distribuciones: ${(liquidityDoc.distributions || []).length}`);
    
    // Filtrar solo distribuciones activas (como hace el endpoint)
    const activeDistributions = (liquidityDoc.distributions || [])
      .filter(d => d.isActive)
      .map(d => ({
        alertId: d.alertId ? d.alertId.toString() : d.alertId,
        symbol: d.symbol,
        allocatedAmount: d.allocatedAmount,
        shares: d.shares,
        entryPrice: d.entryPrice,
        currentPrice: d.currentPrice,
        profitLoss: d.profitLoss || 0,
        profitLossPercentage: d.profitLossPercentage || 0
      }));
    
    print(`Distribuciones activas: ${activeDistributions.length}`);
    
    // Buscar ALAB específicamente
    const alabDistributions = activeDistributions.filter(d => d.symbol === TARGET_SYMBOL);
    print(`\nDistribuciones de ${TARGET_SYMBOL}:`);
    printjson(alabDistributions);
    
    // Calcular totalAllocated (suma de todos los allocatedAmount activos)
    const totalAllocated = activeDistributions.reduce(
      (sum, d) => sum + Math.abs(d.allocatedAmount || 0),
      0
    );
    
    print(`\nTotal allocated (suma de todos los activos): $${totalAllocated.toFixed(2)}`);
    
    // Obtener liquidez disponible desde el documento
    const initialLiquidity = liquidityDoc.initialLiquidity || 0;
    const distributedLiquidity = liquidityDoc.distributedLiquidity || 0;
    const totalProfitLoss = liquidityDoc.totalProfitLoss || 0;
    
    // Calcular available como lo hace el endpoint
    // available = initial - distributed + realizedGains
    // (simplificado: usamos el valor del documento)
    const available = liquidityDoc.availableLiquidity || 0;
    
    print(`\nLiquidez inicial: $${initialLiquidity.toFixed(2)}`);
    print(`Liquidez distribuida: $${distributedLiquidity.toFixed(2)}`);
    print(`Liquidez disponible: $${available.toFixed(2)}`);
    print(`Total profit/loss: $${totalProfitLoss.toFixed(2)}`);
    
    // Calcular totalBase como lo hace el frontend
    // totalBase = totalAllocated + available
    const totalBase = totalAllocated + Math.max(available, 0);
    
    print(`\nTotal base (totalAllocated + available): $${totalBase.toFixed(2)}`);
    
    // Calcular porcentaje de ALAB como lo hace el frontend
    const alabTotalAllocated = alabDistributions.reduce(
      (sum, d) => sum + Math.abs(d.allocatedAmount || 0),
      0
    );
    
    const alabPercentage = totalBase > 0 
      ? (alabTotalAllocated / totalBase) * 100 
      : 0;
    
    print(`\n=== RESULTADO PARA ${TARGET_SYMBOL} ===`);
    print(`Allocated amount de ${TARGET_SYMBOL}: $${alabTotalAllocated.toFixed(2)}`);
    print(`Porcentaje calculado: ${alabPercentage.toFixed(2)}%`);
    print(`Porcentaje esperado (liquidityPercentage): 5%`);
    print(`Diferencia: ${(alabPercentage - 5).toFixed(2)}%`);
    
    // Mostrar todas las distribuciones ordenadas por porcentaje
    print("\n=== TODAS LAS DISTRIBUCIONES (ordenadas por %) ===");
    const allWithPercentages = activeDistributions.map(d => {
      const allocated = Math.abs(d.allocatedAmount || 0);
      const pct = totalBase > 0 ? (allocated / totalBase) * 100 : 0;
      return {
        symbol: d.symbol,
        allocatedAmount: allocated,
        percentage: Number(pct.toFixed(2)),
        alertId: d.alertId
      };
    }).sort((a, b) => b.percentage - a.percentage);
    
    printjson(allWithPercentages);
    
  } else {
    print("No se encontraron documentos de Liquidity para el pool especificado.");
  }
} catch (e) {
  print(`⚠️ Error: ${e.message}`);
  print("Colecciones disponibles:");
  printjson(db.getCollectionNames());
}

/****************************************
 * 2) Verificar alert de ALAB
 ****************************************/
print("\n=== 2) Alert de ALAB ===");

const alabAlert = alertsColl.findOne(
  { symbol: TARGET_SYMBOL, status: "ACTIVE" },
  {
    symbol: 1,
    liquidityPercentage: 1,
    participationPercentage: 1,
    profit: 1,
    status: 1,
    liquidityData: 1
  }
);

if (alabAlert) {
  printjson(alabAlert);
} else {
  print("No se encontró alert activa de ALAB.");
}

print("\n=== FIN RECONSTRUCCIÓN DONUT ===");
