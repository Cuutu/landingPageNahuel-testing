/**
 * Script de ROLLBACK COMPLETO - Restaura liquidez y distribuciones del pool TraderCall
 * 
 * OBJETIVO:
 * Restaurar completamente el pool TraderCall con todos los valores del análisis:
 * - 21 distribuciones activas
 * - 4 distribuciones inactivas
 * - Valores de liquidez del pool
 * - Valores de liquidityData en las alertas
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar TODO este script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/rollback-liquidez-tradercall-completo.mongosh.js
 */

// ============================================
// CONFIGURACIÓN - Pool TraderCall
// ============================================
const POOL_ID = "692e228a07dd9dc3da55758c";
const POOL_NAME = "TraderCall";

// Valores del pool según el análisis
const POOL_VALUES = {
  initialLiquidity: 1000.00,
  totalLiquidity: 1012.30,
  availableLiquidity: 106.15,
  distributedLiquidity: 909.34,
  totalProfitLoss: 12.30
};

// ============================================
// DISTRIBUCIONES ACTIVAS (21)
// ============================================
const ACTIVE_DISTRIBUTIONS = [
  {
    alertId: "692e22d674acc255c3c3ff48",
    symbol: "LRCX",
    allocatedAmount: 12.50,
    shares: 0.0806,
    entryPrice: 155.14,
    currentPrice: 154.09,
    profitLoss: -0.08,
    profitLossPercentage: -0.68,
    realizedProfitLoss: 1.53,
    soldShares: 0.2417,
    isActive: true
  },
  {
    alertId: "692e230274acc255c3c3ff84",
    symbol: "RIO",
    allocatedAmount: 21.09,
    shares: 0.2921,
    entryPrice: 72.20,
    currentPrice: 80.83,
    profitLoss: 2.52,
    profitLossPercentage: 11.95,
    realizedProfitLoss: 1.84,
    soldShares: 0.4003,
    isActive: true
  },
  {
    alertId: "692e240ab3a3f04c9b1c6cf7",
    symbol: "BABA",
    allocatedAmount: 50.00,
    shares: 0.2882,
    entryPrice: 173.47,
    currentPrice: 155.68,
    profitLoss: -5.13,
    profitLossPercentage: -10.26,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e2436b3a3f04c9b1c6da6",
    symbol: "LAC",
    allocatedAmount: 50.00,
    shares: 8.0000,
    entryPrice: 5.63,
    currentPrice: 4.61,
    profitLoss: -9.06,
    profitLossPercentage: -18.12,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e2cb15f61b8d59be88bbf",
    symbol: "AMZN",
    allocatedAmount: 48.80,
    shares: 0.2087,
    entryPrice: 233.88,
    currentPrice: 225.53,
    profitLoss: -1.74,
    profitLossPercentage: -3.57,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e2d15278e507707be0f7a",
    symbol: "NVDA",
    allocatedAmount: 36.60,
    shares: 0.1965,
    entryPrice: 186.26,
    currentPrice: 189.40,
    profitLoss: 0.62,
    profitLossPercentage: 1.69,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e2ea7a16956ec58c15135",
    symbol: "PAAS",
    allocatedAmount: 18.30,
    shares: 0.4893,
    entryPrice: 37.40,
    currentPrice: 49.90,
    profitLoss: 6.12,
    profitLossPercentage: 33.42,
    realizedProfitLoss: 1.71,
    soldShares: 1.1631,
    isActive: true
  },
  {
    alertId: "692e2ed0a16956ec58c15181",
    symbol: "AEM",
    allocatedAmount: 48.80,
    shares: 0.2906,
    entryPrice: 167.92,
    currentPrice: 167.07,
    profitLoss: -0.25,
    profitLossPercentage: -0.51,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "692e2f16fba730fc719e0d81",
    symbol: "CDE",
    allocatedAmount: 27.32,
    shares: 1.6875,
    entryPrice: 16.19,
    currentPrice: 17.00,
    profitLoss: 1.37,
    profitLossPercentage: 5.00,
    realizedProfitLoss: 2.41,
    soldShares: 1.3125,
    isActive: true
  },
  {
    alertId: "693af6a3e18b882152d11c69",
    symbol: "EBAY",
    allocatedAmount: 50.44,
    shares: 0.5992,
    entryPrice: 84.18,
    currentPrice: 88.08,
    profitLoss: 2.34,
    profitLossPercentage: 4.63,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "693af815eeddbea6387af917",
    symbol: "LMT",
    allocatedAmount: 50.62,
    shares: 0.1062,
    entryPrice: 476.71,
    currentPrice: 492.77,
    profitLoss: 1.71,
    profitLossPercentage: 3.37,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "693c5fb765191bf650245446",
    symbol: "GE",
    allocatedAmount: 37.60,
    shares: 0.1251,
    entryPrice: 300.49,
    currentPrice: 314.71,
    profitLoss: 1.78,
    profitLossPercentage: 4.73,
    realizedProfitLoss: 0.66,
    soldShares: 0.0417,
    isActive: true
  },
  {
    alertId: "693c64cd16eafdc24e7225f3",
    symbol: "MOS",
    allocatedAmount: 50.30,
    shares: 1.9309,
    entryPrice: 26.05,
    currentPrice: 25.16,
    profitLoss: -1.72,
    profitLossPercentage: -3.42,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "694986522fc3a4cbeafc908e",
    symbol: "ALAB",
    allocatedAmount: 50.99,
    shares: 0.2964,
    entryPrice: 172.03,
    currentPrice: 178.42,
    profitLoss: 1.89,
    profitLossPercentage: 3.71,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "694ad79f7e593d6ec8dec682",
    symbol: "CAH",
    allocatedAmount: 51.44,
    shares: 0.2481,
    entryPrice: 207.38,
    currentPrice: 205.09,
    profitLoss: -0.57,
    profitLossPercentage: -1.10,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "694ec9939dc53eff0e259a78",
    symbol: "XPEV",
    allocatedAmount: 51.21,
    shares: 2.4524,
    entryPrice: 20.88,
    currentPrice: 20.02,
    profitLoss: -2.11,
    profitLossPercentage: -4.12,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "6954065912398bce63254fb2",
    symbol: "MSI",
    allocatedAmount: 51.10,
    shares: 0.1335,
    entryPrice: 382.71,
    currentPrice: 381.18,
    profitLoss: -0.20,
    profitLossPercentage: -0.40,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "695409dcb350a0a6e5f6cf98",
    symbol: "NU",
    allocatedAmount: 50.51,
    shares: 2.9780,
    entryPrice: 16.96,
    currentPrice: 16.93,
    profitLoss: -0.09,
    profitLossPercentage: -0.18,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "6957f5578bbe1e7b4d23034d",
    symbol: "INTC",
    allocatedAmount: 50.54,
    shares: 1.2764,
    entryPrice: 39.60,
    currentPrice: 39.34,
    profitLoss: -0.33,
    profitLossPercentage: -0.66,
    realizedProfitLoss: -0.59,
    soldShares: 1.0000,
    isActive: true
  },
  {
    alertId: "695800ff6cbef03d900d477d",
    symbol: "MRVL",
    allocatedAmount: 50.59,
    shares: 0.5654,
    entryPrice: 89.49,
    currentPrice: 89.31,
    profitLoss: -0.10,
    profitLossPercentage: -0.20,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  },
  {
    alertId: "69580247e7554a11bc495f09",
    symbol: "ETHA",
    allocatedAmount: 50.59,
    shares: 2.1383,
    entryPrice: 23.66,
    currentPrice: 23.59,
    profitLoss: -0.15,
    profitLossPercentage: -0.30,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true
  }
];

// ============================================
// DISTRIBUCIONES INACTIVAS (4)
// ============================================
const INACTIVE_DISTRIBUTIONS = [
  {
    alertId: "692e232b74acc255c3c3fff9",
    symbol: "INTC",
    allocatedAmount: 0.00,
    shares: 0.0000,
    entryPrice: 0,
    currentPrice: 0,
    profitLoss: 0,
    profitLossPercentage: 0,
    realizedProfitLoss: -0.59,
    soldShares: 0,
    isActive: false
  },
  {
    alertId: "692e2d6c3d8ea5d9bb602fae",
    symbol: "GFI",
    allocatedAmount: 0.00,
    shares: 0.0000,
    entryPrice: 0,
    currentPrice: 0,
    profitLoss: 0,
    profitLossPercentage: 0,
    realizedProfitLoss: 0.17,
    soldShares: 0,
    isActive: false
  },
  {
    alertId: "692e2d98317a234490327c15",
    symbol: "TXN",
    allocatedAmount: 0.00,
    shares: 0.0000,
    entryPrice: 0,
    currentPrice: 0,
    profitLoss: 0,
    profitLossPercentage: 0,
    realizedProfitLoss: 3.90,
    soldShares: 0,
    isActive: false
  },
  {
    alertId: "692e2e1cfba730fc719e071a",
    symbol: "JMIA",
    allocatedAmount: 0.00,
    shares: 0.0000,
    entryPrice: 0,
    currentPrice: 0,
    profitLoss: 0,
    profitLossPercentage: 0,
    realizedProfitLoss: 3.86,
    soldShares: 0,
    isActive: false
  }
];

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
print("🔄 ROLLBACK COMPLETO - Pool TraderCall");
print("=".repeat(80));
print("");

// ============================================
// PASO 1: Verificar que el pool existe
// ============================================
print("🔍 PASO 1: Verificando pool TraderCall...");
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



