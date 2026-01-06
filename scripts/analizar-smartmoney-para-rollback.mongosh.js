/**
 * Script de ANÁLISIS - Pool SmartMoney
 * 
 * OBJETIVO:
 * Analizar el estado actual del pool SmartMoney para preparar el rollback.
 * Este script muestra todos los valores que necesitas para restaurar.
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB Compass o mongosh
 * 2. Seleccionar la base de datos correcta
 * 3. Copiar y pegar TODO este script
 * 4. Copiar la salida y enviarla para crear el script de rollback
 */

// Función auxiliar para convertir a número
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

// Función auxiliar para formatear números
function formatNum(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return num.toFixed(decimals);
}

print("=".repeat(80));
print("🔍 ANÁLISIS DEL POOL: SmartMoney");
print("=".repeat(80));
print("");

// ============================================
// PASO 1: Buscar el pool SmartMoney
// ============================================
print("🔍 Buscando pool SmartMoney...");
print("");

const liquidity = db.liquidities.findOne({ pool: "SmartMoney" });
if (!liquidity) {
  print("❌ ERROR: No se encontró el pool SmartMoney");
  print("   Verifica que el pool exista en la base de datos.");
  quit(1);
}

print(`✅ Pool encontrado: SmartMoney`);
print(`   ID: ${liquidity._id}`);
print(`   Creado: ${liquidity.createdAt}`);
print(`   Actualizado: ${liquidity.updatedAt}`);
print("");

// ============================================
// PASO 2: Mostrar valores actuales del pool
// ============================================
print("=".repeat(80));
print("📊 VALORES ALMACENADOS EN EL DOCUMENTO");
print("=".repeat(80));
print(`💰 Liquidez Inicial: $${formatNum(toNumber(liquidity.initialLiquidity))}`);
print(`💰 Liquidez Total: $${formatNum(toNumber(liquidity.totalLiquidity))}`);
print(`💰 Liquidez Disponible: $${formatNum(toNumber(liquidity.availableLiquidity))}`);
print(`💰 Liquidez Distribuida: $${formatNum(toNumber(liquidity.distributedLiquidity))}`);
print(`💰 Ganancia/Pérdida Total: $${formatNum(toNumber(liquidity.totalProfitLoss))}`);
print("");

// ============================================
// PASO 3: Analizar distribuciones
// ============================================
print("=".repeat(80));
print("📋 DISTRIBUCIONES EN EL POOL");
print("=".repeat(80));
print("");

const distributions = liquidity.distributions || [];
const activeDistributions = distributions.filter(d => 
  d.isActive && toNumber(d.shares) > 0
);
const inactiveDistributions = distributions.filter(d => 
  !d.isActive || toNumber(d.shares) === 0
);

print(`Total distribuciones: ${distributions.length}`);
print(`   - Activas (shares > 0): ${activeDistributions.length}`);
print(`   - Inactivas (shares = 0): ${inactiveDistributions.length}`);
print("");

// ============================================
// PASO 4: Mostrar distribuciones activas
// ============================================
if (activeDistributions.length > 0) {
  print("=".repeat(80));
  print("✅ DISTRIBUCIONES ACTIVAS");
  print("=".repeat(80));
  print("");
  
  activeDistributions.forEach((dist, index) => {
    print(`${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
    print(`   - Allocated Amount: $${formatNum(toNumber(dist.allocatedAmount))}`);
    print(`   - Shares: ${formatNum(toNumber(dist.shares), 4)}`);
    print(`   - Entry Price: $${formatNum(toNumber(dist.entryPrice))}`);
    print(`   - Current Price: $${formatNum(toNumber(dist.currentPrice))}`);
    print(`   - Profit/Loss: $${formatNum(toNumber(dist.profitLoss))}`);
    print(`   - Profit/Loss %: ${formatNum(toNumber(dist.profitLossPercentage))}%`);
    print(`   - Realized Profit/Loss: $${formatNum(toNumber(dist.realizedProfitLoss))}`);
    print(`   - Sold Shares: ${formatNum(toNumber(dist.soldShares), 4)}`);
    print(`   - Is Active: ${dist.isActive}`);
    print("");
  });
} else {
  print("⚠️  No hay distribuciones activas");
  print("");
}

// ============================================
// PASO 5: Mostrar distribuciones inactivas
// ============================================
if (inactiveDistributions.length > 0) {
  print("=".repeat(80));
  print("❌ DISTRIBUCIONES INACTIVAS (vendidas completamente)");
  print("=".repeat(80));
  print("");
  
  inactiveDistributions.forEach((dist, index) => {
    print(`${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
    print(`   - Is Active: ${dist.isActive}`);
    print(`   - Shares: ${formatNum(toNumber(dist.shares), 4)}`);
    print(`   - Allocated Amount: $${formatNum(toNumber(dist.allocatedAmount))}`);
    print(`   - Realized Profit/Loss: $${formatNum(toNumber(dist.realizedProfitLoss))}`);
    print("");
  });
}

// ============================================
// PASO 6: Calcular valores según fórmula del endpoint
// ============================================
print("=".repeat(80));
print("🧮 CÁLCULO MANUAL (fórmula del endpoint /api/liquidity/summary)");
print("=".repeat(80));
print("");

// 1. Liquidez Inicial Global
const initialLiquidity = toNumber(liquidity.initialLiquidity);
print(`1️⃣  Liquidez Inicial Global: $${formatNum(initialLiquidity)}`);

// 2. Montos Distribuidos (solo distribuciones activas con shares > 0)
const montosDistribuidos = activeDistributions.reduce((sum, dist) => 
  sum + toNumber(dist.allocatedAmount), 0
);
print(`2️⃣  Montos Distribuidos (solo distribuciones activas con shares > 0):`);
print(`   Total distribuciones activas: ${activeDistributions.length}`);
print(`   💰 TOTAL MONTOS DISTRIBUIDOS: $${formatNum(montosDistribuidos)}`);

// 3. Ganancias REALIZADAS (de ventas completadas)
const gananciasRealizadas = distributions.reduce((sum, dist) => 
  sum + toNumber(dist.realizedProfitLoss || 0), 0
);
print(`3️⃣  Ganancias REALIZADAS (de ventas completadas):`);
print(`   💰 TOTAL GANANCIAS REALIZADAS: $${formatNum(gananciasRealizadas)}`);

// 4. Ganancias NO Realizadas (paper gains/losses de posiciones activas)
const gananciasNoRealizadas = activeDistributions.reduce((sum, dist) => 
  sum + toNumber(dist.profitLoss || 0), 0
);
print(`4️⃣  Ganancias NO Realizadas (paper gains/losses de posiciones activas):`);
print(`   💰 TOTAL GANANCIAS NO REALIZADAS: $${formatNum(gananciasNoRealizadas)}`);

// 5. Ganancia Total
const gananciaTotal = gananciasRealizadas + gananciasNoRealizadas;
print(`5️⃣  Ganancia Total (Realizadas + No Realizadas): $${formatNum(gananciaTotal)}`);

// 6. Liquidez Total
const liquidezTotal = initialLiquidity + gananciaTotal;
print(`6️⃣  Liquidez Total (Inicial + Ganancia Total): $${formatNum(liquidezTotal)}`);

// 7. Liquidez Disponible
const liquidezDisponible = initialLiquidity - montosDistribuidos + gananciasRealizadas;
print(`7️⃣  Liquidez Disponible (Inicial - Distribuida + Ganancias Realizadas):`);
print(`   $${formatNum(initialLiquidity)} - $${formatNum(montosDistribuidos)} + $${formatNum(gananciasRealizadas)} = $${formatNum(liquidezDisponible)}`);

print("");
print("=".repeat(80));
print("⚖️  COMPARACIÓN: Valores Almacenados vs Cálculo Manual");
print("=".repeat(80));
print(`💰 Liquidez Total:`);
print(`   Almacenado: $${formatNum(toNumber(liquidity.totalLiquidity))}`);
print(`   Calculado:  $${formatNum(liquidezTotal)}`);
print(`   Diferencia: $${formatNum(Math.abs(toNumber(liquidity.totalLiquidity) - liquidezTotal))} ${Math.abs(toNumber(liquidity.totalLiquidity) - liquidezTotal) < 0.01 ? '✅ OK' : '⚠️ DIFERENCIA'}`);
print(`💰 Liquidez Disponible:`);
print(`   Almacenado: $${formatNum(toNumber(liquidity.availableLiquidity))}`);
print(`   Calculado:  $${formatNum(liquidezDisponible)}`);
print(`   Diferencia: $${formatNum(Math.abs(toNumber(liquidity.availableLiquidity) - liquidezDisponible))} ${Math.abs(toNumber(liquidity.availableLiquidity) - liquidezDisponible) < 0.01 ? '✅ OK' : '⚠️ DIFERENCIA'}`);
print(`💰 Liquidez Distribuida:`);
print(`   Almacenado: $${formatNum(toNumber(liquidity.distributedLiquidity))}`);
print(`   Calculado:  $${formatNum(montosDistribuidos)}`);
print(`   Diferencia: $${formatNum(Math.abs(toNumber(liquidity.distributedLiquidity) - montosDistribuidos))} ${Math.abs(toNumber(liquidity.distributedLiquidity) - montosDistribuidos) < 0.01 ? '✅ OK' : '⚠️ DIFERENCIA'}`);
print(`💰 Ganancia/Pérdida Total:`);
print(`   Almacenado: $${formatNum(toNumber(liquidity.totalProfitLoss))}`);
print(`   Calculado:  $${formatNum(gananciaTotal)}`);
print(`   Diferencia: $${formatNum(Math.abs(toNumber(liquidity.totalProfitLoss) - gananciaTotal))} ${Math.abs(toNumber(liquidity.totalProfitLoss) - gananciaTotal) < 0.01 ? '✅ OK' : '⚠️ DIFERENCIA'}`);
print("");

// ============================================
// PASO 7: Generar datos para el script de rollback
// ============================================
print("=".repeat(80));
print("📋 DATOS PARA EL SCRIPT DE ROLLBACK");
print("=".repeat(80));
print("");
print(`POOL_ID: "${liquidity._id}"`);
print(`POOL_NAME: "SmartMoney"`);
print("");
print("POOL_VALUES:");
print(`  initialLiquidity: ${formatNum(initialLiquidity)}`);
print(`  totalLiquidity: ${formatNum(liquidezTotal)}`);
print(`  availableLiquidity: ${formatNum(liquidezDisponible)}`);
print(`  distributedLiquidity: ${formatNum(montosDistribuidos)}`);
print(`  totalProfitLoss: ${formatNum(gananciaTotal)}`);
print("");
print("ACTIVE_DISTRIBUTIONS:");
activeDistributions.forEach((dist, index) => {
  print(`  ${index + 1}. {`);
  print(`    alertId: "${dist.alertId}",`);
  print(`    symbol: "${dist.symbol}",`);
  print(`    allocatedAmount: ${formatNum(toNumber(dist.allocatedAmount))},`);
  print(`    shares: ${formatNum(toNumber(dist.shares), 4)},`);
  print(`    entryPrice: ${formatNum(toNumber(dist.entryPrice))},`);
  print(`    currentPrice: ${formatNum(toNumber(dist.currentPrice))},`);
  print(`    profitLoss: ${formatNum(toNumber(dist.profitLoss))},`);
  print(`    profitLossPercentage: ${formatNum(toNumber(dist.profitLossPercentage))},`);
  print(`    realizedProfitLoss: ${formatNum(toNumber(dist.realizedProfitLoss))},`);
  print(`    soldShares: ${formatNum(toNumber(dist.soldShares), 4)},`);
  print(`    isActive: true`);
  print(`  }`);
});
print("");
print("INACTIVE_DISTRIBUTIONS:");
inactiveDistributions.forEach((dist, index) => {
  print(`  ${index + 1}. {`);
  print(`    alertId: "${dist.alertId}",`);
  print(`    symbol: "${dist.symbol}",`);
  print(`    allocatedAmount: 0.00,`);
  print(`    shares: 0.0000,`);
  print(`    entryPrice: 0,`);
  print(`    currentPrice: 0,`);
  print(`    profitLoss: 0,`);
  print(`    profitLossPercentage: 0,`);
  print(`    realizedProfitLoss: ${formatNum(toNumber(dist.realizedProfitLoss))},`);
  print(`    soldShares: 0,`);
  print(`    isActive: false`);
  print(`  }`);
});
print("");
print("=".repeat(80));
print("✅ ANÁLISIS COMPLETADO");
print("=".repeat(80));
print("");
print("📝 INSTRUCCIONES:");
print("   1. Copia toda la salida de este script");
print("   2. Envíala para crear el script de rollback completo");
print("   3. O usa los datos de arriba para completar el script manualmente");
print("");



