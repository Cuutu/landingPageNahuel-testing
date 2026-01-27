/*******************************
 * ANALIZAR DONUT CHART
 * 
 * Analiza las alertas activas para entender
 * por qué una con P&L negativo muestra 8% en el donut
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
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
 * 2) Buscar alertas activas con distributions
 ****************************************/
print("\n=== 2) Analizando alertas activas con distributions ===");

const activeAlerts = alertsColl.find({
  status: "ACTIVE",
  tipo: "TraderCall"
}).toArray();

print(`Total alertas activas: ${activeAlerts.length}`);

const alertasConProblema = [];

activeAlerts.forEach((alert) => {
  const distribution = (mainDoc.distributions || []).find((dist) => 
    dist.alertId && dist.alertId.toString() === alert._id.toString() && dist.isActive
  );
  
  if (!distribution) {
    return; // No tiene distribution activa
  }
  
  const profitValue = typeof alert.profit === 'number' ? alert.profit : (alert.profit ? parseFloat(alert.profit) : null);
  
  if (profitValue === null || isNaN(profitValue)) {
    return; // No tiene profit válido
  }
  
  const allocatedAmount = distribution.allocatedAmount || 0;
  // ✅ CORREGIDO: Usar profitLoss directamente de la distribution (como hace el frontend)
  const profitLoss = distribution.profitLoss || 0;
  
  const currentValue = allocatedAmount + profitLoss;
  
  // Calcular porcentaje usando allocatedAmount (como estaba antes)
  const totalAllocated = (mainDoc.distributions || [])
    .filter(d => d.isActive)
    .reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
  
  const availableLiquidity = mainDoc.availableLiquidity || 0;
  const totalBaseOld = totalAllocated + availableLiquidity;
  const porcentajeOld = totalBaseOld > 0 ? (allocatedAmount / totalBaseOld) * 100 : 0;
  
  // Calcular porcentaje usando currentValue (como debería ser ahora)
  // ✅ CORREGIDO: Usar profitLoss directamente de cada distribution
  const totalCurrentValue = (mainDoc.distributions || [])
    .filter(d => d.isActive)
    .reduce((sum, d) => {
      const distAllocated = d.allocatedAmount || 0;
      const distProfitLoss = d.profitLoss || 0;
      return sum + (distAllocated + distProfitLoss);
    }, 0);
  
  const totalBaseNew = totalCurrentValue + availableLiquidity;
  const porcentajeNew = totalBaseNew > 0 ? (currentValue / totalBaseNew) * 100 : 0;
  
  // Mostrar TODAS las alertas con P&L negativo para análisis
  if (profitValue < 0) {
    alertasConProblema.push({
      symbol: alert.symbol,
      alertId: alert._id,
      profit: profitValue,
      allocatedAmount: allocatedAmount,
      profitLoss: profitLoss,
      currentValue: currentValue,
      porcentajeOld: porcentajeOld,
      porcentajeNew: porcentajeNew,
      diferencia: porcentajeOld - porcentajeNew
    });
  }
});

/****************************************
 * 3) Mostrar TODAS las alertas con P&L negativo
 ****************************************/
print("\n=== 3) Todas las alertas con P&L negativo ===");

if (alertasConProblema.length === 0) {
  print("✅ No se encontraron alertas con P&L negativo.");
} else {
  // Ordenar por porcentajeOld descendente para ver las más problemáticas primero
  alertasConProblema.sort((a, b) => b.porcentajeOld - a.porcentajeOld);
  
  alertasConProblema.forEach((item, idx) => {
    print(`\n${idx + 1}. ${item.symbol}`);
    print(`   Alert ID: ${item.alertId}`);
    print(`   P&L: ${item.profit.toFixed(2)}%`);
    print(`   Allocated Amount: $${item.allocatedAmount.toFixed(2)}`);
    print(`   Profit/Loss (de distribution): $${item.profitLoss.toFixed(2)}`);
    print(`   Current Value: $${item.currentValue.toFixed(2)}`);
    print(`   Porcentaje (usando allocatedAmount - VIEJO): ${item.porcentajeOld.toFixed(2)}%`);
    print(`   Porcentaje (usando currentValue - NUEVO): ${item.porcentajeNew.toFixed(2)}%`);
    print(`   Diferencia: ${item.diferencia.toFixed(2)}%`);
    
    if (item.porcentajeOld > 5 && item.profit < 0) {
      print(`   ⚠️ PROBLEMA: Esta alerta muestra ${item.porcentajeOld.toFixed(2)}% pero debería mostrar ${item.porcentajeNew.toFixed(2)}%`);
    }
  });
}

/****************************************
 * 4) Resumen
 ****************************************/
print("\n=== 4) RESUMEN ===");
print(`Total alertas con P&L negativo: ${alertasConProblema.length}`);

const alertasProblematicas = alertasConProblema.filter(a => a.porcentajeOld > 5 && a.profit < 0);
print(`Alertas con P&L negativo y porcentaje > 5% (usando allocatedAmount): ${alertasProblematicas.length}`);

if (alertasProblematicas.length > 0) {
  print("\n⚠️ Estas alertas tienen P&L negativo pero muestran porcentaje alto:");
  alertasProblematicas.forEach((item, idx) => {
    print(`   ${idx + 1}. ${item.symbol}: ${item.porcentajeOld.toFixed(2)}% -> ${item.porcentajeNew.toFixed(2)}%`);
  });
  print("\n✅ Con el cambio a currentValue, estos porcentajes deberían reducirse.");
  print("   El donut chart ahora reflejará el valor actual de cada posición, no el monto inicial.");
} else if (alertasConProblema.length > 0) {
  print("\n✅ Todas las alertas con P&L negativo tienen porcentajes correctos (< 5%).");
}

print("\n=== FIN ANÁLISIS ===");
