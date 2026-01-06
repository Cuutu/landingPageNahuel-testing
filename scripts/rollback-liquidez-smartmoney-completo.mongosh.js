/**
 * Script de ROLLBACK COMPLETO - Restaura liquidez y distribuciones del pool SmartMoney
 * 
 * OBJETIVO:
 * Restaurar completamente el pool SmartMoney con todos los valores del análisis:
 * - 21 distribuciones activas
 * - 0 distribuciones inactivas
 * - Valores de liquidez del pool
 * - Valores de liquidityData en las alertas
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB Compass o mongosh
 * 2. Seleccionar la base de datos correcta
 * 3. Abrir la pestaña MongoSH en Compass
 * 4. Copiar y pegar TODO este script
 * 5. Ejecutar el script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/rollback-liquidez-smartmoney-completo.mongosh.js
 */

// ============================================
// CONFIGURACIÓN - Pool SmartMoney
// ============================================
const POOL_ID = "692e30863d8ea5d9bb6039e9";
const POOL_NAME = "SmartMoney";

// Valores del pool según el análisis
const POOL_VALUES = {
  initialLiquidity: 1000.00,
  totalLiquidity: 1123.94,
  availableLiquidity: 61.74,
  distributedLiquidity: 952.98,
  totalProfitLoss: 123.94
};

// ============================================
// DISTRIBUCIONES ACTIVAS (21)
// ============================================
const ACTIVE_DISTRIBUTIONS = [
  {
    alertId: "692e30863d8ea5d9bb6039e5",
    symbol: "IBIT",
    allocatedAmount: 50.00,
    shares: 0.8696,
    entryPrice: 57.50,
    currentPrice: 51.15,
    profitLoss: -5.52,
    profitLossPercentage: -11.04,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e30fc46eb515a4514c2cd",
    symbol: "PFE",
    allocatedAmount: 75.00,
    shares: 2.0000,
    entryPrice: 28.39,
    currentPrice: 25.09,
    profitLoss: -8.72,
    profitLossPercentage: -11.62,
    realizedProfitLoss: 0.94,
    soldShares: 3.0000,
    isActive: true
  },
  {
    alertId: "692e312f46eb515a4514c949",
    symbol: "YPF",
    allocatedAmount: 50.00,
    shares: 1.0000,
    entryPrice: 38.67,
    currentPrice: 36.14,
    profitLoss: -3.27,
    profitLossPercentage: -6.54,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e315346eb515a4514c9e2",
    symbol: "DE",
    allocatedAmount: 50.00,
    shares: 0.1026,
    entryPrice: 487.24,
    currentPrice: 469.48,
    profitLoss: -1.82,
    profitLossPercentage: -3.65,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e3177486112c90c9b0cdf",
    symbol: "VIST",
    allocatedAmount: 50.00,
    shares: 0.9982,
    entryPrice: 50.09,
    currentPrice: 49.15,
    profitLoss: -0.94,
    profitLossPercentage: -1.88,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e319a486112c90c9b0d3f",
    symbol: "MA",
    allocatedAmount: 50.00,
    shares: 0.0917,
    entryPrice: 545.16,
    currentPrice: 560.49,
    profitLoss: 1.41,
    profitLossPercentage: 2.81,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e345e624af2b3b77e93db",
    symbol: "BRK-B",
    allocatedAmount: 50.00,
    shares: 0.1000,
    entryPrice: 499.89,
    currentPrice: 494.34,
    profitLoss: -0.56,
    profitLossPercentage: -1.11,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e34df3ecafcf049bc0ead",
    symbol: "TGS",
    allocatedAmount: 50.00,
    shares: 1.0000,
    entryPrice: 30.52,
    currentPrice: 30.58,
    profitLoss: 0.10,
    profitLossPercentage: 0.20,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e350b3ecafcf049bc0f25",
    symbol: "META",
    allocatedAmount: 25.00,
    shares: 0.0399,
    entryPrice: 626.31,
    currentPrice: 650.45,
    profitLoss: 0.96,
    profitLossPercentage: 3.85,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e362b224d8d05105345b9",
    symbol: "MELI",
    allocatedAmount: 33.50,
    shares: 0.0177,
    entryPrice: 1895.53,
    currentPrice: 1979.26,
    profitLoss: 1.48,
    profitLossPercentage: 4.42,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e36b5224d8d0510534bc9",
    symbol: "MSFT",
    allocatedAmount: 25.00,
    shares: 0.0591,
    entryPrice: 423.04,
    currentPrice: 471.50,
    profitLoss: 2.86,
    profitLossPercentage: 11.46,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e3756149d0e3bcc9009c6",
    symbol: "DIS",
    allocatedAmount: 50.00,
    shares: 0.5532,
    entryPrice: 90.38,
    currentPrice: 112.25,
    profitLoss: 12.10,
    profitLossPercentage: 24.20,
    realizedProfitLoss: 5.82,
    soldShares: 2.0000,
    isActive: true
  },
  {
    alertId: "692e3782149d0e3bcc901584",
    symbol: "AAPL",
    allocatedAmount: 12.50,
    shares: 0.0537,
    entryPrice: 232.78,
    currentPrice: 269.77,
    profitLoss: 1.99,
    profitLossPercentage: 15.89,
    realizedProfitLoss: 2.07,
    soldShares: 0.0537,
    isActive: true
  },
  {
    alertId: "692e37ee149d0e3bcc901907",
    symbol: "JPM",
    allocatedAmount: 50.00,
    shares: 0.2362,
    entryPrice: 211.70,
    currentPrice: 322.76,
    profitLoss: 26.23,
    profitLossPercentage: 52.46,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e381a624af2b3b77ebbaf",
    symbol: "CAT",
    allocatedAmount: 50.00,
    shares: 0.1295,
    entryPrice: 386.02,
    currentPrice: 594.60,
    profitLoss: 27.02,
    profitLossPercentage: 54.03,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e3893224d8d0510536ced",
    symbol: "GS",
    allocatedAmount: 50.00,
    shares: 0.1030,
    entryPrice: 485.39,
    currentPrice: 903.38,
    profitLoss: 43.06,
    profitLossPercentage: 86.11,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e38e5eac077f0bc37f719",
    symbol: "GOOGL",
    allocatedAmount: 18.75,
    shares: 0.1177,
    entryPrice: 159.36,
    currentPrice: 314.55,
    profitLoss: 18.26,
    profitLossPercentage: 97.38,
    realizedProfitLoss: 5.89,
    soldShares: 0.0392,
    isActive: true
  },
  {
    alertId: "692e3981eac077f0bc37ffb4",
    symbol: "UPST",
    allocatedAmount: 50.00,
    shares: 1.0000,
    entryPrice: 44.26,
    currentPrice: 44.42,
    profitLoss: 0.18,
    profitLossPercentage: 0.36,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e39b9224d8d05105388b1",
    symbol: "TXN",
    allocatedAmount: 50.00,
    shares: 0.2973,
    entryPrice: 168.16,
    currentPrice: 176.77,
    profitLoss: 2.56,
    profitLossPercentage: 5.12,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "693319edf1124cbeb372f8bc",
    symbol: "GLOB",
    allocatedAmount: 56.76,
    shares: 0.7959,
    entryPrice: 71.31,
    currentPrice: 64.20,
    profitLoss: -5.66,
    profitLossPercentage: -9.97,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "694ec7fd9dc53eff0e2591dc",
    symbol: "CRM",
    allocatedAmount: 56.47,
    shares: 0.2127,
    entryPrice: 265.55,
    currentPrice: 253.80,
    profitLoss: -2.50,
    profitLossPercentage: -4.42,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  }
];

// ============================================
// DISTRIBUCIONES INACTIVAS (0)
// ============================================
const INACTIVE_DISTRIBUTIONS = [];

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
print("🔄 ROLLBACK COMPLETO - Pool SmartMoney");
print("=".repeat(80));
print("");

// ============================================
// VALIDACIÓN: Verificar que los datos estén configurados
// ============================================
if (ACTIVE_DISTRIBUTIONS.length === 0) {
  print("❌ ERROR: No hay distribuciones activas configuradas.");
  print("");
  print("📝 INSTRUCCIONES:");
  print("   1. Ejecuta primero: scripts/analizar-smartmoney-para-rollback.mongosh.js");
  print("   2. Copia los datos del análisis (POOL_ID, POOL_VALUES, distribuciones)");
  print("   3. Reemplaza los valores en este script");
  print("   4. Ejecuta este script nuevamente");
  print("");
  quit(1);
}

// ============================================
// PASO 1: Verificar que el pool existe
// ============================================
print("🔍 PASO 1: Verificando pool SmartMoney...");
print("");

const liquidity = db.liquidities.findOne({ _id: ObjectId(POOL_ID) });
if (!liquidity) {
  print(`❌ ERROR: No se encontró el pool con ID ${POOL_ID}`);
  print("   Verifica que el ID sea correcto.");
  quit(1);
}

print(`✅ Pool encontrado: ${POOL_NAME}`);
print(`   ID: ${POOL_ID}`);
print("");

// ============================================
// PASO 2: Restaurar distribuciones en el pool
// ============================================
print("=".repeat(80));
print("📊 PASO 2: Restaurando distribuciones en el pool...");
print("=".repeat(80));
print("");

// Calcular porcentajes para las distribuciones activas
const totalDistributed = ACTIVE_DISTRIBUTIONS.reduce((sum, dist) => sum + dist.allocatedAmount, 0);
ACTIVE_DISTRIBUTIONS.forEach(dist => {
  dist.percentage = (dist.allocatedAmount / POOL_VALUES.initialLiquidity) * 100;
});

// Preparar todas las distribuciones (activas + inactivas)
const allDistributions = [...ACTIVE_DISTRIBUTIONS, ...INACTIVE_DISTRIBUTIONS].map(dist => ({
  alertId: dist.alertId,
  symbol: dist.symbol,
  percentage: dist.percentage || 0,
  allocatedAmount: dist.allocatedAmount,
  entryPrice: dist.entryPrice,
  currentPrice: dist.currentPrice,
  shares: dist.shares,
  profitLoss: dist.profitLoss,
  profitLossPercentage: dist.profitLossPercentage,
  realizedProfitLoss: dist.realizedProfitLoss,
  soldShares: dist.soldShares,
  isActive: dist.isActive,
  createdAt: new Date(),
  updatedAt: new Date()
}));

print(`📋 Total distribuciones a restaurar: ${allDistributions.length}`);
print(`   - Activas: ${ACTIVE_DISTRIBUTIONS.length}`);
print(`   - Inactivas: ${INACTIVE_DISTRIBUTIONS.length}`);
print("");

// Reemplazar todas las distribuciones
const updateResult = db.liquidities.updateOne(
  { _id: ObjectId(POOL_ID) },
  {
    $set: {
      distributions: allDistributions,
      initialLiquidity: POOL_VALUES.initialLiquidity,
      totalLiquidity: POOL_VALUES.totalLiquidity,
      availableLiquidity: POOL_VALUES.availableLiquidity,
      distributedLiquidity: POOL_VALUES.distributedLiquidity,
      totalProfitLoss: POOL_VALUES.totalProfitLoss,
      updatedAt: new Date()
    }
  }
);

if (updateResult.modifiedCount > 0) {
  print("✅ Distribuciones restauradas en el pool");
} else {
  print("⚠️  No se pudo actualizar el pool (puede que ya esté actualizado)");
}
print("");

// ============================================
// PASO 3: Restaurar liquidityData en las alertas
// ============================================
print("=".repeat(80));
print("📊 PASO 3: Restaurando liquidityData en las alertas...");
print("=".repeat(80));
print("");

let totalUpdated = 0;
let totalErrors = 0;

// Procesar distribuciones activas
print(`📋 Procesando ${ACTIVE_DISTRIBUTIONS.length} alerta(s) activa(s):`);
print("");

ACTIVE_DISTRIBUTIONS.forEach(function(dist, index) {
  const alertId = dist.alertId;
  const symbol = dist.symbol;
  
  print(`   ${index + 1}. Restaurando ${symbol} (AlertId: ${alertId}):`);
  print(`      Shares: ${formatNum(dist.shares, 4)}`);
  print(`      Allocated Amount: $${formatNum(dist.allocatedAmount)}`);
  print(`      Entry Price: $${formatNum(dist.entryPrice)}`);
  
  // Buscar la alerta
  const alert = db.alerts.findOne({ _id: ObjectId(alertId) });
  if (!alert) {
    print(`      ❌ Alerta no encontrada`);
    totalErrors++;
    print("");
    return;
  }
  
  // Actualizar la alerta
  const updateResult = db.alerts.updateOne(
    { _id: ObjectId(alertId) },
    {
      $set: {
        "liquidityData.shares": dist.shares,
        "liquidityData.allocatedAmount": dist.allocatedAmount,
        "liquidityData.originalShares": dist.shares,
        "liquidityData.originalAllocatedAmount": dist.allocatedAmount,
        "liquidityData.entryPrice": dist.entryPrice
      }
    }
  );
  
  if (updateResult.modifiedCount > 0) {
    print(`      ✅ Actualizado`);
    totalUpdated++;
  } else {
    print(`      ⚠️  No se pudo actualizar (puede que ya esté actualizado)`);
  }
  
  print("");
});

// Procesar distribuciones inactivas
print(`📋 Procesando ${INACTIVE_DISTRIBUTIONS.length} alerta(s) inactiva(s):`);
print("");

INACTIVE_DISTRIBUTIONS.forEach(function(dist, index) {
  const alertId = dist.alertId;
  const symbol = dist.symbol;
  
  print(`   ${index + 1}. Verificando ${symbol} (AlertId: ${alertId}):`);
  print(`      Vendida completamente - Shares: 0, Allocated: $0`);
  
  // Buscar la alerta
  const alert = db.alerts.findOne({ _id: ObjectId(alertId) });
  if (!alert) {
    print(`      ⚠️  Alerta no encontrada (puede estar eliminada)`);
    print("");
    return;
  }
  
  // Verificar si necesita actualización
  const currentShares = toNumber(alert.liquidityData?.shares) || 0;
  const currentAllocated = toNumber(alert.liquidityData?.allocatedAmount) || 0;
  
  if (currentShares < 0.0001 && currentAllocated < 0.01) {
    print(`      ✅ Ya está correcto (shares = 0)`);
  } else {
    // Actualizar a 0
    const updateResult = db.alerts.updateOne(
      { _id: ObjectId(alertId) },
      {
        $set: {
          "liquidityData.shares": 0,
          "liquidityData.allocatedAmount": 0
        }
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      print(`      ✅ Actualizado a 0`);
      totalUpdated++;
    } else {
      print(`      ⚠️  No se pudo actualizar`);
    }
  }
  
  print("");
});

// ============================================
// PASO 4: Verificación final
// ============================================
print("=".repeat(80));
print("✅ VERIFICACIÓN FINAL");
print("=".repeat(80));
print("");

const finalLiquidity = db.liquidities.findOne({ _id: ObjectId(POOL_ID) });
if (finalLiquidity) {
  print("📊 Valores del pool después del rollback:");
  print(`   Initial Liquidity: $${formatNum(toNumber(finalLiquidity.initialLiquidity))}`);
  print(`   Total Liquidity: $${formatNum(toNumber(finalLiquidity.totalLiquidity))}`);
  print(`   Available Liquidity: $${formatNum(toNumber(finalLiquidity.availableLiquidity))}`);
  print(`   Distributed Liquidity: $${formatNum(toNumber(finalLiquidity.distributedLiquidity))}`);
  print(`   Total Profit/Loss: $${formatNum(toNumber(finalLiquidity.totalProfitLoss))}`);
  print(`   Total Distributions: ${(finalLiquidity.distributions || []).length}`);
  print("");
  
  const activeCount = (finalLiquidity.distributions || []).filter(d => d.isActive && toNumber(d.shares) > 0).length;
  print(`   Distribuciones activas: ${activeCount}`);
  print("");
  
  // Verificar diferencias
  const initialDiff = Math.abs(toNumber(finalLiquidity.initialLiquidity) - POOL_VALUES.initialLiquidity);
  const totalDiff = Math.abs(toNumber(finalLiquidity.totalLiquidity) - POOL_VALUES.totalLiquidity);
  const availableDiff = Math.abs(toNumber(finalLiquidity.availableLiquidity) - POOL_VALUES.availableLiquidity);
  const distributedDiff = Math.abs(toNumber(finalLiquidity.distributedLiquidity) - POOL_VALUES.distributedLiquidity);
  const profitDiff = Math.abs(toNumber(finalLiquidity.totalProfitLoss) - POOL_VALUES.totalProfitLoss);
  
  if (initialDiff < 0.01 && totalDiff < 0.01 && availableDiff < 0.01 && distributedDiff < 0.01 && profitDiff < 0.01) {
    print("✅ Todos los valores coinciden con el análisis");
  } else {
    print("⚠️  ADVERTENCIA: Hay diferencias en los valores:");
    if (initialDiff >= 0.01) print(`   Initial Liquidity: diferencia de $${formatNum(initialDiff)}`);
    if (totalDiff >= 0.01) print(`   Total Liquidity: diferencia de $${formatNum(totalDiff)}`);
    if (availableDiff >= 0.01) print(`   Available Liquidity: diferencia de $${formatNum(availableDiff)}`);
    if (distributedDiff >= 0.01) print(`   Distributed Liquidity: diferencia de $${formatNum(distributedDiff)}`);
    if (profitDiff >= 0.01) print(`   Total Profit/Loss: diferencia de $${formatNum(profitDiff)}`);
  }
}

print("");
print("=".repeat(80));
print("🎉 ROLLBACK COMPLETADO");
print("=".repeat(80));
print("");
print(`✅ Alertas actualizadas: ${totalUpdated}`);
print(`⚠️  Errores encontrados: ${totalErrors}`);
print("");
print("📊 RESUMEN:");
print("   - Se restauraron todas las distribuciones en el pool");
print("   - Se restauraron los valores de liquidityData en las alertas");
print("   - Se restauraron los valores del pool (initial, total, available, distributed, profit/loss)");
print("");

