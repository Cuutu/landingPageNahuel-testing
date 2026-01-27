/*******************************
 * BACKFILL DE LIQUIDITY.DISTRIBUTIONS DESDE OPERATIONS
 *
 * Crea distribuciones en `db.liquidity` para alerts ACTIVAS
 * que tienen operations ACTIVAS pero NO tienen distribution.
 *
 * 1) Primero corré en DRY_RUN = true (solo muestra lo que haría).
 * 2) Si estás conforme, ponelo en false para escribir.
 *******************************/
const DRY_RUN = false; // Cambiar a false para aplicar cambios
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF (EJECUTARÁ CAMBIOS)",
  pool: POOL
});

/****************************************
 * 1) Obtener documento principal de Liquidity para el pool
 ****************************************/
print("\n=== 1) Buscando documento de Liquidity ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length === 0) {
  print("❌ No se encontró ningún documento de Liquidity para este pool.");
  quit();
}

// Elegimos el doc más actualizado como mainDoc (igual que /api/liquidity/summary.ts)
const mainDoc = liquidityDocs
  .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];

print(`Usando Liquidity._id = ${mainDoc._id} como documento principal.`);

/****************************************
 * 2) Reconstruir lista de alerts con operations activas SIN distribution
 ****************************************/
print("\n=== 2) Detectando alerts activas con operations activas y SIN distribution ===");

const activeAlerts = alertsColl.find({ status: "ACTIVE" }).toArray();
print(`Alerts activas: ${activeAlerts.length}`);

// Mapa rápido de distributions existentes por alertId
const existingDistsByAlertId = {};
(mainDoc.distributions || []).forEach((dist) => {
  if (dist.isActive && dist.alertId) {
    existingDistsByAlertId[dist.alertId.toString()] = true;
  }
});

const alertsNeedingBackfill = [];

activeAlerts.forEach((alert) => {
  const alertId = alert._id;
  const alertIdStr = alertId.toString();

  // ¿ya tiene distribution activa?
  if (existingDistsByAlertId[alertIdStr]) {
    return;
  }

  const activeOps = opsColl
    .find({
      alertId: alertId,
      status: "ACTIVE",
      operationType: "COMPRA"
    })
    .toArray();

  if (activeOps.length === 0) return;

  const totalAmount = activeOps.reduce(
    (sum, op) => sum + Math.abs(op.amount || 0),
    0
  );

  alertsNeedingBackfill.push({
    alertId,
    symbol: alert.symbol,
    liquidityPercentage: alert.liquidityPercentage,
    profit: alert.profit,
    createdAt: alert.createdAt,
    finalPriceSetAt: alert.finalPriceSetAt,
    entryPrice:
      alert.entryPrice ||
      (alert.liquidityData && alert.liquidityData.entryPrice) ||
      null,
    totalAmountFromOps: totalAmount,
    operationsCount: activeOps.length
  });
});

print(`Alerts con operations activas SIN distribution: ${alertsNeedingBackfill.length}`);

if (alertsNeedingBackfill.length === 0) {
  print("✅ No hay nada que backfillear.");
  quit();
}

/****************************************
 * 3) Calcular distribuciones que se crearían
 *    IMPORTANTE: percentage se calcula como (allocatedAmount / initialLiquidity) * 100
 *    para reflejar el peso real en la cartera, no un valor fijo
 ****************************************/
print("\n=== 3) Distribuciones que se crearían ===");

const initialLiquidity = mainDoc.initialLiquidity || 0;
print(`Liquidez inicial del documento: $${initialLiquidity.toFixed(2)}`);

if (initialLiquidity <= 0) {
  print("⚠️ ERROR: initialLiquidity es 0 o inválido. No se pueden calcular porcentajes correctos.");
  print("Revisá el documento de Liquidity antes de continuar.");
  quit();
}

const newDistributions = [];

alertsNeedingBackfill.forEach((alert, idx) => {
  const entryPrice = alert.entryPrice && alert.entryPrice > 0 ? alert.entryPrice : null;
  if (!entryPrice) {
    print(`\n⚠️ Saltando ${alert.symbol} (${alert.alertId}) porque no tiene entryPrice válido.`);
    return;
  }

  const allocatedAmount = alert.totalAmountFromOps;
  if (!allocatedAmount || allocatedAmount <= 0) {
    print(`\n⚠️ Saltando ${alert.symbol} (${alert.alertId}) porque allocatedAmount es inválido: ${allocatedAmount}`);
    return;
  }

  const shares = allocatedAmount / entryPrice;
  
  // ✅ CORREGIDO: Calcular percentage basado en liquidez inicial real
  // Esto refleja el peso real de cada posición en la cartera
  const percentage = (allocatedAmount / initialLiquidity) * 100;

  const dist = {
    alertId: alert.alertId.toString(),
    symbol: (alert.symbol || "").toUpperCase(),
    percentage,
    allocatedAmount,
    entryPrice,
    currentPrice: entryPrice,
    shares,
    profitLoss: 0,
    profitLossPercentage: 0,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  newDistributions.push(dist);

  print(`\n${idx + 1}. ${alert.symbol}`);
  print(`   Alert ID: ${alert.alertId}`);
  print(`   entryPrice: ${entryPrice}`);
  print(`   allocatedAmount (desde operations): $${allocatedAmount.toFixed(2)}`);
  print(`   shares estimadas: ${shares.toFixed(6)}`);
  print(`   percentage (calculado desde initialLiquidity): ${percentage.toFixed(2)}%`);
});

print(`\nTotal distribuciones nuevas que se agregarían: ${newDistributions.length}`);

if (newDistributions.length === 0) {
  print("⚠️ No se generó ninguna distribución válida. Revisá los datos de entryPrice/amount.");
  quit();
}

/****************************************
 * 4) Aplicar cambios (si DRY_RUN = false)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 4) Modo DRY RUN - No se escribirán distribuciones ===");
  print("Si estás conforme, cambiá DRY_RUN = false y volvé a ejecutar.");
} else {
  print("\n=== 4) Aplicando distribuciones nuevas en Liquidity ===");

  const result = liquidityColl.updateOne(
    { _id: mainDoc._id },
    {
      $push: {
        distributions: { $each: newDistributions }
      }
    }
  );

  printjson(result);
  print("\n✅ Distribuciones agregadas. El endpoint /api/liquidity/summary recalculará montos a partir de ellas.");
}

print("\n=== FIN BACKFILL ===");

