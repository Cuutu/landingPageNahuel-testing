// Script para verificar los valores de ALAB que afectan el donut chart
// Ejecutar: mongosh <connection-string> < scripts/verificar-alab-donut.mongosh.js

const DRY_RUN = true; // Cambiar a false para ejecutar cambios

print("\n=== VERIFICACIÓN DE ALAB PARA DONUT CHART ===\n");

// 1. Buscar alert de ALAB
const alertId = ObjectId("694986522fc3a4cbeafc908e");
const alert = db.alerts.findOne({ _id: alertId });

if (!alert) {
  print("❌ No se encontró la alerta de ALAB");
  quit(1);
}

print("=== 1) ALERT DE ALAB ===");
printjson({
  _id: alert._id,
  symbol: alert.symbol,
  status: alert.status,
  entryPrice: alert.entryPrice,
  currentPrice: alert.currentPrice,
  profit: alert.profit,
  liquidityPercentage: alert.liquidityPercentage,
  liquidityData: alert.liquidityData
});

// 2. Buscar operation de ALAB
const operation = db.operations.findOne({ 
  alertId: alertId,
  status: "ACTIVE",
  operationType: "COMPRA"
});

print("\n=== 2) OPERATION DE ALAB ===");
if (operation) {
  printjson({
    _id: operation._id,
    ticker: operation.ticker,
    operationType: operation.operationType,
    amount: operation.amount,
    status: operation.status,
    portfolioPercentage: operation.portfolioPercentage
  });
} else {
  print("❌ No se encontró operation activa de ALAB");
}

// 3. Buscar distribution en Liquidity
const liquidityDoc = db.liquidity.findOne({ pool: "TraderCall" });
if (!liquidityDoc) {
  print("\n❌ No se encontró documento de Liquidity para TraderCall");
  quit(1);
}

const distribution = liquidityDoc.distributions?.find(
  (d) => d.alertId && d.alertId.toString() === alertId.toString()
);

print("\n=== 3) DISTRIBUTION EN LIQUIDITY ===");
if (distribution) {
  printjson({
    alertId: distribution.alertId,
    symbol: distribution.symbol,
    allocatedAmount: distribution.allocatedAmount,
    shares: distribution.shares,
    entryPrice: distribution.entryPrice,
    currentPrice: distribution.currentPrice,
    profitLoss: distribution.profitLoss,
    profitLossPercentage: distribution.profitLossPercentage,
    realizedProfitLoss: distribution.realizedProfitLoss,
    isActive: distribution.isActive
  });
  
  // Calcular valores esperados
  const allocated = Number(distribution.allocatedAmount || 0);
  const profitLoss = Number(distribution.profitLoss || 0);
  const currentValue = allocated + profitLoss;
  
  print("\n=== 4) CÁLCULOS ESPERADOS EN FRONTEND ===");
  print(`allocatedAmount: $${allocated.toFixed(2)}`);
  print(`profitLoss: $${profitLoss.toFixed(2)}`);
  print(`currentValue (allocated + profitLoss): $${currentValue.toFixed(2)}`);
  
  // Calcular porcentaje esperado
  // Necesitamos el total de todas las distribuciones activas + liquidez disponible
  const allActiveDistributions = liquidityDoc.distributions?.filter(d => d.isActive && d.shares > 0) || [];
  const totalCurrentValue = allActiveDistributions.reduce((sum, d) => {
    const allocated = Number(d.allocatedAmount || 0);
    const profitLoss = Number(d.profitLoss || 0);
    return sum + allocated + profitLoss;
  }, 0);
  
  const availableLiquidity = Number(liquidityDoc.availableLiquidity || 0);
  const totalBase = totalCurrentValue + availableLiquidity;
  
  const expectedPercentage = totalBase > 0 ? (currentValue / totalBase) * 100 : 0;
  
  print(`\nTotal currentValue de todas las distribuciones activas: $${totalCurrentValue.toFixed(2)}`);
  print(`Liquidez disponible: $${availableLiquidity.toFixed(2)}`);
  print(`Total base (currentValue + disponible): $${totalBase.toFixed(2)}`);
  print(`\nPorcentaje esperado de ALAB: ${expectedPercentage.toFixed(2)}%`);
  print(`Porcentaje actual mostrado: 6.8%`);
  print(`Diferencia: ${(expectedPercentage - 6.8).toFixed(2)}%`);
  
  if (Math.abs(expectedPercentage - 6.8) > 0.1) {
    print("\n⚠️ PROBLEMA DETECTADO: El porcentaje esperado no coincide con el mostrado");
    print("Posibles causas:");
    print("  1. El profitLoss en la distribución está incorrecto");
    print("  2. Hay un problema de caché en el navegador o API");
    print("  3. El código del frontend no está usando currentValue correctamente");
  }
  
} else {
  print("❌ No se encontró distribution de ALAB en Liquidity");
}

// 5. Verificar si hay otras distribuciones que puedan estar afectando
print("\n=== 5) RESUMEN DE TODAS LAS DISTRIBUCIONES ACTIVAS ===");
const activeDistributions = liquidityDoc.distributions?.filter(d => d.isActive && d.shares > 0) || [];
print(`Total distribuciones activas: ${activeDistributions.length}`);

const summary = activeDistributions.map(d => {
  const allocated = Number(d.allocatedAmount || 0);
  const profitLoss = Number(d.profitLoss || 0);
  const currentValue = allocated + profitLoss;
  return {
    symbol: d.symbol,
    allocatedAmount: allocated,
    profitLoss: profitLoss,
    currentValue: currentValue
  };
}).sort((a, b) => b.currentValue - a.currentValue);

printjson(summary.slice(0, 10)); // Mostrar solo las 10 primeras

print("\n=== FIN VERIFICACIÓN ===");
