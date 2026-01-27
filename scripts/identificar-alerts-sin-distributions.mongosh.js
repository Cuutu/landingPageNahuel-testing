/*******************************
 * IDENTIFICAR ALERTS SIN DISTRIBUTIONS
 * 
 * Encuentra alerts activas que tienen operations activas
 * pero NO tienen distributions en Liquidity.
 * Estas son las que causan problemas en el gráfico.
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  pool: POOL
});

/****************************************
 * 1) Obtener todas las alerts activas con operations activas
 ****************************************/
print("\n=== 1) Buscando alerts activas con operations activas ===");

const activeAlerts = alertsColl.find({ status: "ACTIVE" }).toArray();
print(`Total alerts activas: ${activeAlerts.length}`);

const alertsWithOps = [];

activeAlerts.forEach(alert => {
  const alertId = alert._id;
  const activeOps = opsColl.find({
    alertId: alertId,
    status: "ACTIVE",
    operationType: "COMPRA"
  }).toArray();
  
  if (activeOps.length > 0) {
    alertsWithOps.push({
      alertId: alertId,
      symbol: alert.symbol,
      liquidityPercentage: alert.liquidityPercentage,
      profit: alert.profit,
      createdAt: alert.createdAt,
      finalPriceSetAt: alert.finalPriceSetAt,
      operations: activeOps.map(op => ({
        _id: op._id,
        amount: op.amount,
        portfolioPercentage: op.portfolioPercentage
      }))
    });
  }
});

print(`Alerts con operations activas: ${alertsWithOps.length}`);

/****************************************
 * 2) Verificar cuáles tienen distributions en Liquidity
 ****************************************/
print("\n=== 2) Verificando distributions en Liquidity ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();
const allDistributions = [];

liquidityDocs.forEach(doc => {
  (doc.distributions || []).forEach(dist => {
    if (dist.isActive) {
      allDistributions.push({
        alertId: dist.alertId ? dist.alertId.toString() : null,
        symbol: dist.symbol,
        allocatedAmount: dist.allocatedAmount,
        docId: doc._id
      });
    }
  });
});

print(`Total distributions activas en Liquidity: ${allDistributions.length}`);

/****************************************
 * 3) Identificar alerts sin distributions
 ****************************************/
print("\n=== 3) Alerts SIN distributions en Liquidity ===");

const alertsWithoutDistributions = [];

alertsWithOps.forEach(alert => {
  const alertIdStr = alert.alertId.toString();
  const hasDistribution = allDistributions.some(
    dist => dist.alertId && dist.alertId.toString() === alertIdStr
  );
  
  if (!hasDistribution) {
    const totalAmount = alert.operations.reduce(
      (sum, op) => sum + Math.abs(op.amount || 0),
      0
    );
    
    alertsWithoutDistributions.push({
      alertId: alert.alertId,
      symbol: alert.symbol,
      liquidityPercentage: alert.liquidityPercentage,
      profit: alert.profit,
      createdAt: alert.createdAt,
      finalPriceSetAt: alert.finalPriceSetAt,
      totalAmountFromOps: totalAmount,
      operationsCount: alert.operations.length
    });
  }
});

print(`Alerts SIN distributions: ${alertsWithoutDistributions.length}`);

if (alertsWithoutDistributions.length > 0) {
  print("\nDetalle de alerts sin distributions:");
  alertsWithoutDistributions.forEach((alert, idx) => {
    print(`\n${idx + 1}. ${alert.symbol}`);
    print(`   Alert ID: ${alert.alertId}`);
    print(`   liquidityPercentage: ${alert.liquidityPercentage || 'N/A'}%`);
    const profitValue = typeof alert.profit === 'number' ? alert.profit : (alert.profit ? parseFloat(alert.profit) : null);
    print(`   profit: ${profitValue !== null && !isNaN(profitValue) ? profitValue.toFixed(2) : 'N/A'}%`);
    print(`   creada: ${alert.createdAt}`);
    print(`   finalPriceSetAt: ${alert.finalPriceSetAt || 'NO'}`);
    print(`   operations activas: ${alert.operationsCount}`);
    print(`   total desde operations: $${alert.totalAmountFromOps.toFixed(2)}`);
    print(`   ⚠️ PROBLEMA: Esta alert tiene operations pero NO tiene distribution en Liquidity`);
    print(`   Esto causa que el gráfico muestre datos incorrectos.`);
  });
  
  /****************************************
   * 4) Resumen y recomendaciones
   ****************************************/
  print("\n=== 4) RESUMEN Y RECOMENDACIONES ===");
  print(`Total alerts problemáticas: ${alertsWithoutDistributions.length}`);
  print("\nEstas alerts deberían tener distributions en Liquidity pero no las tienen.");
  print("Esto causa que:");
  print("  - El gráfico muestre porcentajes incorrectos");
  print("  - La liquidez disponible no se calcule correctamente");
  print("  - Haya inconsistencias entre alerts, operations y Liquidity");
  print("\nPara corregir esto, necesitás:");
  print("  1. Crear distributions en Liquidity para estas alerts");
  print("  2. O sincronizar el proceso que crea distributions automáticamente");
  print("  3. O revisar por qué el proceso de distribución falló para estas alerts");
  
} else {
  print("✅ Todas las alerts con operations activas tienen distributions en Liquidity.");
}

print("\n=== FIN ANÁLISIS ===");
