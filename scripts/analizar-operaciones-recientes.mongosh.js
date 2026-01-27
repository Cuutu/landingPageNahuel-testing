/*******************************
 * ANÁLISIS DE OPERACIONES RECIENTES
 * 
 * Analiza operations desde el jueves 22 de enero hasta hoy
 * para identificar:
 * - Cuáles se ejecutaron correctamente
 * - Cuáles se desestimaron
 * - Inconsistencias entre operations, alerts y distributions
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall";

// Rango de fechas: desde jueves 22 de enero 2026 hasta hoy (27 de enero 2026)
const FECHA_INICIO = new Date("2026-01-22T00:00:00.000Z");
const FECHA_FIN = new Date("2026-01-27T23:59:59.999Z");

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  pool: POOL,
  fechaInicio: FECHA_INICIO,
  fechaFin: FECHA_FIN
});

/****************************************
 * 1) Obtener todas las operations en el rango de fechas
 ****************************************/
print("\n=== 1) Operations en el rango de fechas ===");

const operations = opsColl
  .find({
    createdAt: {
      $gte: FECHA_INICIO,
      $lte: FECHA_FIN
    },
    system: POOL
  })
  .sort({ createdAt: 1 })
  .toArray();

print(`Total operations encontradas: ${operations.length}`);

if (operations.length === 0) {
  print("⚠️ No se encontraron operations en ese rango de fechas.");
  quit();
}

/****************************************
 * 2) Agrupar por tipo y estado
 ****************************************/
print("\n=== 2) Resumen por tipo y estado ===");

const porTipo = {};
const porEstado = {};

operations.forEach(op => {
  const tipo = op.operationType || "N/A";
  const estado = op.status || "N/A";
  
  if (!porTipo[tipo]) porTipo[tipo] = [];
  if (!porEstado[estado]) porEstado[estado] = [];
  
  porTipo[tipo].push(op);
  porEstado[estado].push(op);
});

print("\nPor tipo de operación:");
Object.keys(porTipo).forEach(tipo => {
  print(`  ${tipo}: ${porTipo[tipo].length}`);
});

print("\nPor estado:");
Object.keys(porEstado).forEach(estado => {
  print(`  ${estado}: ${porEstado[estado].length}`);
});

/****************************************
 * 3) Analizar cada operation en detalle
 ****************************************/
print("\n=== 3) Detalle de cada operation ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();
const mainDoc = liquidityDocs.length > 0 
  ? liquidityDocs.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0]
  : null;

const existingDistsByAlertId = {};
if (mainDoc) {
  (mainDoc.distributions || []).forEach((dist) => {
    if (dist.isActive && dist.alertId) {
      existingDistsByAlertId[dist.alertId.toString()] = true;
    }
  });
}

operations.forEach((op, idx) => {
  const fecha = new Date(op.createdAt);
  const fechaStr = fecha.toISOString().split('T')[0];
  const horaStr = fecha.toTimeString().split(' ')[0];
  
  print(`\n--- Operation ${idx + 1}: ${op.ticker || 'N/A'} (${fechaStr} ${horaStr}) ---`);
  print(`  ID: ${op._id}`);
  print(`  Tipo: ${op.operationType}`);
  print(`  Estado: ${op.status}`);
  const amountValue = typeof op.amount === 'number' ? op.amount : (op.amount ? parseFloat(op.amount) : null);
  print(`  Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
  print(`  Portfolio %: ${op.portfolioPercentage || 'N/A'}%`);
  print(`  Alert ID: ${op.alertId || 'N/A'}`);
  print(`  isPartialSale: ${op.isPartialSale || false}`);
  
  // Verificar alert asociada
  if (op.alertId) {
    const alert = alertsColl.findOne({ _id: op.alertId });
    if (alert) {
      print(`  ✅ Alert encontrada: ${alert.symbol} (status: ${alert.status})`);
      print(`     liquidityPercentage: ${alert.liquidityPercentage || 'N/A'}%`);
      const profitValue = typeof alert.profit === 'number' ? alert.profit : (alert.profit ? parseFloat(alert.profit) : null);
      print(`     profit: ${profitValue !== null && !isNaN(profitValue) ? profitValue.toFixed(2) : 'N/A'}%`);
    } else {
      print(`  ❌ Alert NO encontrada para alertId: ${op.alertId}`);
    }
  } else {
    print(`  ⚠️ Operation sin alertId`);
  }
  
  // Verificar distribution en Liquidity
  if (op.alertId && mainDoc) {
    const alertIdStr = op.alertId.toString();
    const hasDistribution = existingDistsByAlertId[alertIdStr];
    
    if (op.operationType === "COMPRA" && op.status === "ACTIVE") {
      if (hasDistribution) {
        print(`  ✅ Tiene distribution en Liquidity`);
      } else {
        print(`  ❌ NO tiene distribution en Liquidity (PROBLEMA)`);
      }
    }
  }
  
  // Notas adicionales
  if (op.notes) {
    const notesPreview = op.notes.length > 100 ? op.notes.substring(0, 100) + "..." : op.notes;
    print(`  Notes: ${notesPreview}`);
  }
});

/****************************************
 * 4) Operaciones de COMPRA activas sin distribution
 ****************************************/
print("\n=== 4) COMPRAS ACTIVAS sin distribution en Liquidity ===");

const comprasActivasSinDist = operations.filter(op => {
  if (op.operationType !== "COMPRA" || op.status !== "ACTIVE") return false;
  if (!op.alertId) return false;
  const alertIdStr = op.alertId.toString();
  return !existingDistsByAlertId[alertIdStr];
});

print(`Total compras activas SIN distribution: ${comprasActivasSinDist.length}`);

if (comprasActivasSinDist.length > 0) {
  comprasActivasSinDist.forEach((op, idx) => {
    const amountValue = typeof op.amount === 'number' ? op.amount : (op.amount ? parseFloat(op.amount) : null);
    print(`\n${idx + 1}. ${op.ticker}`);
    print(`   Operation ID: ${op._id}`);
    print(`   Alert ID: ${op.alertId}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`   Creada: ${new Date(op.createdAt).toISOString()}`);
    print(`   ⚠️ Esta compra está ACTIVA pero NO tiene distribution`);
  });
} else {
  print("✅ Todas las compras activas tienen distribution.");
}

/****************************************
 * 5) Operaciones de VENTA
 ****************************************/
print("\n=== 5) Operaciones de VENTA ===");

const ventas = operations.filter(op => op.operationType === "VENTA");

print(`Total ventas en el período: ${ventas.length}`);

if (ventas.length > 0) {
  ventas.forEach((op, idx) => {
    const amountValue = typeof op.amount === 'number' ? op.amount : (op.amount ? parseFloat(op.amount) : null);
    print(`\n${idx + 1}. ${op.ticker}`);
    print(`   Operation ID: ${op._id}`);
    print(`   Estado: ${op.status}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`   isPartialSale: ${op.isPartialSale}`);
    print(`   Alert ID: ${op.alertId}`);
    print(`   Creada: ${new Date(op.createdAt).toISOString()}`);
    
    if (op.status === "ACTIVE") {
      print(`   ⚠️ VENTA con estado ACTIVE (puede ser un problema)`);
    }
  });
} else {
  print("No hay ventas en este período.");
}

/****************************************
 * 6) Operaciones desestimadas o canceladas
 ****************************************/
print("\n=== 6) Operaciones desestimadas/canceladas ===");

const desestimadas = operations.filter(op => 
  op.status !== "ACTIVE" && op.status !== "COMPLETED"
);

print(`Total operaciones desestimadas/canceladas: ${desestimadas.length}`);

if (desestimadas.length > 0) {
  desestimadas.forEach((op, idx) => {
    const amountValue = typeof op.amount === 'number' ? op.amount : (op.amount ? parseFloat(op.amount) : null);
    print(`\n${idx + 1}. ${op.ticker} - ${op.operationType}`);
    print(`   Operation ID: ${op._id}`);
    print(`   Estado: ${op.status}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`   Alert ID: ${op.alertId}`);
    print(`   Creada: ${new Date(op.createdAt).toISOString()}`);
    print(`   Actualizada: ${op.updatedAt ? new Date(op.updatedAt).toISOString() : 'N/A'}`);
  });
} else {
  print("No hay operaciones desestimadas en este período.");
}

/****************************************
 * 7) Resumen de problemas encontrados
 ****************************************/
print("\n=== 7) RESUMEN DE PROBLEMAS ===");

const problemas = [];

// Compras activas sin distribution
if (comprasActivasSinDist.length > 0) {
  problemas.push({
    tipo: "COMPRAS_ACTIVAS_SIN_DISTRIBUTION",
    cantidad: comprasActivasSinDist.length,
    detalle: comprasActivasSinDist.map(op => ({
      ticker: op.ticker,
      operationId: op._id,
      alertId: op.alertId
    }))
  });
}

// Operations sin alert asociada
const opsSinAlert = operations.filter(op => !op.alertId);
if (opsSinAlert.length > 0) {
  problemas.push({
    tipo: "OPERATIONS_SIN_ALERT",
    cantidad: opsSinAlert.length,
    detalle: opsSinAlert.map(op => ({
      ticker: op.ticker,
      operationId: op._id,
      tipo: op.operationType
    }))
  });
}

// Ventas activas (puede ser un problema)
const ventasActivas = ventas.filter(op => op.status === "ACTIVE");
if (ventasActivas.length > 0) {
  problemas.push({
    tipo: "VENTAS_CON_ESTADO_ACTIVE",
    cantidad: ventasActivas.length,
    detalle: ventasActivas.map(op => ({
      ticker: op.ticker,
      operationId: op._id,
      alertId: op.alertId
    }))
  });
}

if (problemas.length > 0) {
  print(`Total problemas encontrados: ${problemas.length}`);
  problemas.forEach((prob, idx) => {
    print(`\n${idx + 1}. ${prob.tipo}: ${prob.cantidad} casos`);
    prob.detalle.forEach(item => {
      print(`   - ${item.ticker || 'N/A'} (Operation: ${item.operationId})`);
    });
  });
} else {
  print("✅ No se encontraron problemas evidentes.");
}

print("\n=== FIN ANÁLISIS ===");
