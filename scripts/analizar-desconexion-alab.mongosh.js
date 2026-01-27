/*******************************
 * ANÁLISIS DE DESCONEXIÓN ALAB
 * 
 * ALAB tiene alert activa con liquidityPercentage: 5 y profit < 0,
 * pero NO está en Liquidity.distributions.
 * 
 * Este script analiza por qué hay esta desconexión.
 *******************************/
const TARGET_SYMBOL = "ALAB";
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Análisis de desconexión para ALAB ===");
printjson({
  targetSymbol: TARGET_SYMBOL,
  pool: POOL
});

/****************************************
 * 1) Alert de ALAB
 ****************************************/
print("\n=== 1) Alert de ALAB ===");

const alabAlert = alertsColl.findOne(
  { symbol: TARGET_SYMBOL, status: "ACTIVE" }
);

if (alabAlert) {
  print("Alert encontrada:");
  printjson({
    _id: alabAlert._id,
    symbol: alabAlert.symbol,
    status: alabAlert.status,
    liquidityPercentage: alabAlert.liquidityPercentage,
    participationPercentage: alabAlert.participationPercentage,
    profit: alabAlert.profit,
    liquidityData: alabAlert.liquidityData,
    createdAt: alabAlert.createdAt,
    updatedAt: alabAlert.updatedAt
  });
  
  const alertId = alabAlert._id.toString();
  print(`\nAlert ID: ${alertId}`);
} else {
  print("❌ No se encontró alert activa de ALAB.");
  print("=== FIN SCRIPT ===");
}

/****************************************
 * 2) Operations de ALAB
 ****************************************/
print("\n=== 2) Operations de ALAB ===");

const alabOps = opsColl.find(
  { 
    ticker: TARGET_SYMBOL,
    status: "ACTIVE"
  }
).toArray();

print(`Total operations activas de ${TARGET_SYMBOL}: ${alabOps.length}`);

if (alabOps.length > 0) {
  printjson(alabOps.map(op => ({
    _id: op._id,
    ticker: op.ticker,
    operationType: op.operationType,
    amount: op.amount,
    portfolioPercentage: op.portfolioPercentage,
    alertId: op.alertId,
    status: op.status,
    createdAt: op.createdAt
  })));
} else {
  print("⚠️ No hay operations activas de ALAB.");
}

/****************************************
 * 3) Liquidity distributions
 ****************************************/
print("\n=== 3) Liquidity distributions ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length > 0) {
  liquidityDocs.forEach((doc, idx) => {
    print(`\n--- Documento Liquidity ${idx + 1} (${doc._id}) ---`);
    print(`Total distribuciones: ${(doc.distributions || []).length}`);
    
    const alabDistributions = (doc.distributions || []).filter(
      d => d.symbol === TARGET_SYMBOL
    );
    
    if (alabDistributions.length > 0) {
      print(`✅ Distribuciones de ${TARGET_SYMBOL} encontradas: ${alabDistributions.length}`);
      printjson(alabDistributions.map(d => ({
        alertId: d.alertId,
        symbol: d.symbol,
        allocatedAmount: d.allocatedAmount,
        shares: d.shares,
        isActive: d.isActive,
        profitLoss: d.profitLoss,
        profitLossPercentage: d.profitLossPercentage
      })));
    } else {
      print(`❌ NO hay distribuciones de ${TARGET_SYMBOL} en este documento.`);
      
      // Buscar por alertId
      if (alabAlert) {
        const alertIdStr = alabAlert._id.toString();
        const byAlertId = (doc.distributions || []).filter(
          d => d.alertId && d.alertId.toString() === alertIdStr
        );
        
        if (byAlertId.length > 0) {
          print(`⚠️ Pero SÍ hay distribuciones con alertId ${alertIdStr}:`);
          printjson(byAlertId);
        } else {
          print(`⚠️ Tampoco hay distribuciones con alertId ${alertIdStr}`);
        }
      }
    }
    
    // Mostrar todas las distribuciones activas
    const activeDistributions = (doc.distributions || []).filter(d => d.isActive);
    print(`\nDistribuciones activas totales: ${activeDistributions.length}`);
    print("Símbolos en distribuciones activas:");
    const symbols = [...new Set(activeDistributions.map(d => d.symbol))];
    printjson(symbols);
  });
} else {
  print("❌ No se encontraron documentos de Liquidity para TraderCall.");
}

/****************************************
 * 4) Análisis de la desconexión
 ****************************************/
print("\n=== 4) Análisis de la desconexión ===");

if (alabAlert && alabOps.length > 0) {
  print("✅ ALAB tiene:");
  print("  - Alert activa con liquidityPercentage: 5%");
  print("  - Operations activas asociadas");
  
  const hasLiquidityDistribution = liquidityDocs.some(doc => {
    if (!alabAlert) return false;
    const alertIdStr = alabAlert._id.toString();
    return (doc.distributions || []).some(
      d => d.alertId && d.alertId.toString() === alertIdStr
    );
  });
  
  if (!hasLiquidityDistribution) {
    print("\n❌ PROBLEMA DETECTADO:");
    print("  - ALAB NO está en Liquidity.distributions");
    print("  - Pero SÍ tiene alert activa y operations");
    print("\nPosibles causas:");
    print("  1. La distribución fue removida manualmente");
    print("  2. Hubo un error al crear/actualizar la distribución");
    print("  3. El proceso de sincronización entre alerts y Liquidity falló");
    print("\nImpacto:");
    print("  - El gráfico puede estar usando datos de alerts directamente");
    print("  - Esto puede causar inconsistencias en los porcentajes mostrados");
    print("  - El cálculo del donut puede estar usando otra fuente de datos");
  } else {
    print("\n✅ ALAB SÍ está en Liquidity.distributions");
  }
} else {
  print("⚠️ No hay suficiente información para analizar la desconexión.");
}

print("\n=== FIN ANÁLISIS ===");
