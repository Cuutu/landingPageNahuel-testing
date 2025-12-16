// Script de mongosh para investigar alertas con liquidez de $1000 incorrecta
// Copiar y pegar este script completo en mongosh

// ============================================
// 1. BUSCAR DISTRIBUCIONES CON ALLOCATED AMOUNT CERCA DE $1000
// ============================================
print("\n🔍 ============================================");
print("1. DISTRIBUCIONES CON ALLOCATED AMOUNT CERCA DE $1000");
print("============================================\n");

const distributionsNear1000 = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.allocatedAmount": {
        $gte: 900,
        $lte: 1100
      }
    }
  },
  {
    $project: {
      pool: 1,
      initialLiquidity: 1,
      totalLiquidity: 1,
      alertId: "$distributions.alertId",
      symbol: "$distributions.symbol",
      allocatedAmount: "$distributions.allocatedAmount",
      shares: "$distributions.shares",
      entryPrice: "$distributions.entryPrice",
      percentage: "$distributions.percentage",
      soldShares: "$distributions.soldShares",
      isActive: "$distributions.isActive"
    }
  }
]).toArray();

print(`📊 Encontradas ${distributionsNear1000.length} distribuciones con allocatedAmount entre $900 y $1100\n`);

distributionsNear1000.forEach((dist, index) => {
  print(`\n--- Distribución ${index + 1} ---`);
  print(`Pool: ${dist.pool}`);
  print(`Alert ID: ${dist.alertId}`);
  print(`Symbol: ${dist.symbol}`);
  print(`Allocated Amount: $${dist.allocatedAmount.toFixed(2)}`);
  print(`Shares: ${dist.shares.toFixed(4)}`);
  print(`Entry Price: $${dist.entryPrice.toFixed(2)}`);
  print(`Percentage: ${dist.percentage.toFixed(2)}%`);
  print(`Sold Shares: ${dist.soldShares || 0}`);
  print(`Is Active: ${dist.isActive}`);
  print(`Total Liquidity del Pool: $${dist.totalLiquidity.toFixed(2)}`);
  print(`Initial Liquidity del Pool: $${dist.initialLiquidity.toFixed(2)}`);
  
  // Calcular si el allocatedAmount coincide con el percentage
  const calculatedAmount = (dist.totalLiquidity * dist.percentage) / 100;
  print(`Calculado desde %: $${calculatedAmount.toFixed(2)}`);
  print(`Diferencia: $${Math.abs(dist.allocatedAmount - calculatedAmount).toFixed(2)}`);
});

// ============================================
// 2. BUSCAR ALERTAS CON LIQUIDITY PERCENTAGE QUE PODRÍAN ESTAR CAUSANDO EL PROBLEMA
// ============================================
print("\n\n🔍 ============================================");
print("2. ALERTAS CON LIQUIDITY PERCENTAGE (sin distribución)");
print("============================================\n");

// Obtener todos los alertIds que tienen distribución
const alertIdsWithDistribution = new Set();
db.liquidities.find({}, { "distributions.alertId": 1 }).forEach(doc => {
  if (doc.distributions && Array.isArray(doc.distributions)) {
    doc.distributions.forEach(dist => {
      if (dist.alertId) {
        alertIdsWithDistribution.add(dist.alertId.toString());
      }
    });
  }
});

print(`📊 Total de alertas con distribución: ${alertIdsWithDistribution.size}\n`);

// Buscar alertas con liquidityPercentage pero SIN distribución
const alertsWithLiquidityPercentage = db.alerts.find({
  liquidityPercentage: { $exists: true, $ne: null, $gt: 0 }
}).toArray();

print(`📊 Total de alertas con liquidityPercentage: ${alertsWithLiquidityPercentage.length}\n`);

const alertsWithoutDistribution = alertsWithLiquidityPercentage.filter(alert => {
  const alertIdStr = alert._id.toString();
  return !alertIdsWithDistribution.has(alertIdStr);
});

print(`⚠️  Alertas con liquidityPercentage PERO SIN distribución: ${alertsWithoutDistribution.length}\n`);

alertsWithoutDistribution.forEach((alert, index) => {
  print(`\n--- Alerta ${index + 1} ---`);
  print(`Alert ID: ${alert._id}`);
  print(`Symbol: ${alert.symbol}`);
  print(`Tipo: ${alert.tipo}`);
  print(`Status: ${alert.status}`);
  print(`Liquidity Percentage: ${alert.liquidityPercentage}%`);
  print(`Participation Percentage: ${alert.participationPercentage || 'N/A'}%`);
  print(`Entry Price: $${alert.entryPrice || alert.entryPriceRange?.min || 'N/A'}`);
  
  // Obtener liquidez total del pool
  const liquidity = db.liquidities.findOne({ pool: alert.tipo });
  if (liquidity) {
    const calculatedAmount = (liquidity.totalLiquidity * alert.liquidityPercentage) / 100;
    print(`Total Liquidity del Pool: $${liquidity.totalLiquidity.toFixed(2)}`);
    print(`⚠️  CALCULADO (incorrecto): $${calculatedAmount.toFixed(2)}`);
    print(`   (Este es el problema: se calcula desde liquidityPercentage sin tener distribución)`);
  }
});

// ============================================
// 3. VERIFICAR ALERTAS ESPECÍFICAS MENCIONADAS (ORLY con $985.52)
// ============================================
print("\n\n🔍 ============================================");
print("3. BUSCAR ALERTA ORLY (ejemplo de $985.52)");
print("============================================\n");

const orlyAlerts = db.alerts.find({ symbol: { $regex: /ORLY/i } }).toArray();

orlyAlerts.forEach((alert, index) => {
  print(`\n--- Alerta ORLY ${index + 1} ---`);
  print(`Alert ID: ${alert._id}`);
  print(`Symbol: ${alert.symbol}`);
  print(`Status: ${alert.status}`);
  print(`Liquidity Percentage: ${alert.liquidityPercentage || 'N/A'}%`);
  print(`Participation Percentage: ${alert.participationPercentage || 'N/A'}%`);
  
  // Buscar distribución
  const liquidity = db.liquidities.findOne({
    "distributions.alertId": alert._id.toString()
  });
  
  if (liquidity) {
    const distribution = liquidity.distributions.find(
      dist => dist.alertId === alert._id.toString()
    );
    if (distribution) {
      print(`✅ TIENE DISTRIBUCIÓN:`);
      print(`   Allocated Amount: $${distribution.allocatedAmount.toFixed(2)}`);
      print(`   Shares: ${distribution.shares.toFixed(4)}`);
      print(`   Entry Price: $${distribution.entryPrice.toFixed(2)}`);
      print(`   Percentage: ${distribution.percentage.toFixed(2)}%`);
    }
  } else {
    print(`❌ NO TIENE DISTRIBUCIÓN`);
    if (alert.liquidityPercentage) {
      const poolLiquidity = db.liquidities.findOne({ pool: alert.tipo });
      if (poolLiquidity) {
        const calculated = (poolLiquidity.totalLiquidity * alert.liquidityPercentage) / 100;
        print(`   ⚠️  Se calcularía incorrectamente: $${calculated.toFixed(2)}`);
      }
    }
  }
});

// ============================================
// 4. RESUMEN DE LIQUIDEZ POR POOL
// ============================================
print("\n\n🔍 ============================================");
print("4. RESUMEN DE LIQUIDEZ POR POOL");
print("============================================\n");

["TraderCall", "SmartMoney"].forEach(pool => {
  const liquidity = db.liquidities.findOne({ pool: pool });
  if (liquidity) {
    print(`\n--- ${pool} ---`);
    print(`Initial Liquidity: $${liquidity.initialLiquidity.toFixed(2)}`);
    print(`Total Liquidity: $${liquidity.totalLiquidity.toFixed(2)}`);
    print(`Available Liquidity: $${liquidity.availableLiquidity.toFixed(2)}`);
    print(`Distributed Liquidity: $${liquidity.distributedLiquidity.toFixed(2)}`);
    print(`Total Distributions: ${liquidity.distributions?.length || 0}`);
    
    if (liquidity.distributions && liquidity.distributions.length > 0) {
      const totalAllocated = liquidity.distributions.reduce((sum, dist) => sum + dist.allocatedAmount, 0);
      print(`Total Allocated (suma): $${totalAllocated.toFixed(2)}`);
      print(`Diferencia con distributedLiquidity: $${Math.abs(totalAllocated - liquidity.distributedLiquidity).toFixed(2)}`);
    }
  } else {
    print(`\n--- ${pool} ---`);
    print(`❌ No hay documento de liquidez para este pool`);
  }
});

// ============================================
// 5. ALERTAS CON ALLOCATED AMOUNT > $500 (sospechosas)
// ============================================
print("\n\n🔍 ============================================");
print("5. ALERTAS CON ALLOCATED AMOUNT > $500 (sospechosas)");
print("============================================\n");

const suspiciousDistributions = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.allocatedAmount": { $gt: 500 }
    }
  },
  {
    $project: {
      pool: 1,
      totalLiquidity: 1,
      alertId: "$distributions.alertId",
      symbol: "$distributions.symbol",
      allocatedAmount: "$distributions.allocatedAmount",
      percentage: "$distributions.percentage",
      shares: "$distributions.shares",
      entryPrice: "$distributions.entryPrice"
    }
  },
  { $sort: { allocatedAmount: -1 } }
]).toArray();

print(`📊 Encontradas ${suspiciousDistributions.length} distribuciones con allocatedAmount > $500\n`);

suspiciousDistributions.forEach((dist, index) => {
  print(`\n--- ${index + 1}. ${dist.symbol} (${dist.pool}) ---`);
  print(`Allocated Amount: $${dist.allocatedAmount.toFixed(2)}`);
  print(`Percentage: ${dist.percentage.toFixed(2)}%`);
  print(`Total Liquidity Pool: $${dist.totalLiquidity.toFixed(2)}`);
  const calculated = (dist.totalLiquidity * dist.percentage) / 100;
  print(`Calculado desde %: $${calculated.toFixed(2)}`);
  print(`Diferencia: $${Math.abs(dist.allocatedAmount - calculated).toFixed(2)}`);
  
  // Verificar si la alerta tiene liquidityPercentage
  const alert = db.alerts.findOne({ _id: ObjectId(dist.alertId) });
  if (alert) {
    print(`Liquidity Percentage en alerta: ${alert.liquidityPercentage || 'N/A'}%`);
    if (alert.liquidityPercentage && alert.liquidityPercentage !== dist.percentage) {
      print(`⚠️  DIFERENCIA: La alerta tiene ${alert.liquidityPercentage}% pero la distribución tiene ${dist.percentage}%`);
    }
  }
});

print("\n\n✅ Análisis completado. Revisa los resultados arriba.\n");
