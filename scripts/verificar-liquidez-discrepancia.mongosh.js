/**
 * Script de diagnóstico para verificar discrepancias de liquidez
 * Compara los valores del documento de liquidez con los cálculos reales
 * 
 * Ejecutar: mongosh "tu-connection-string" --file scripts/verificar-liquidez-discrepancia.mongosh.js
 */

const POOL = "TraderCall"; // Cambiar a "SmartMoney" si es necesario
const MARKET_VALUE_ESPERADO = 1018.88; // El valor total de mercado real según la tabla de tenencia

print("\n======================================================================");
print("🔍 DIAGNÓSTICO DE DISCREPANCIA DE LIQUIDEZ");
print("======================================================================");
print(`Pool: ${POOL}`);
print(`Market Value esperado (de tabla Tenencia): $${MARKET_VALUE_ESPERADO.toFixed(2)}`);

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.getCollection("liquidities");

// 1. Obtener documento de liquidez
print("\n=== 1) VALORES ACTUALES EN DOCUMENTO DE LIQUIDEZ ===");
const liquidityDoc = liquidityColl.findOne({ pool: POOL });

if (!liquidityDoc) {
  print("❌ No se encontró documento de liquidez para este pool");
  quit();
}

print(`\n📊 Documento de Liquidez (ID: ${liquidityDoc._id})`);
print(`   initialLiquidity:     $${(liquidityDoc.initialLiquidity || 0).toFixed(2)}`);
print(`   totalLiquidity:       $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}`);
print(`   availableLiquidity:   $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
print(`   distributedLiquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);
print(`   totalProfitLoss:      $${(liquidityDoc.totalProfitLoss || 0).toFixed(2)}`);

// 2. Analizar cada distribución
print("\n=== 2) ANÁLISIS DE DISTRIBUCIONES ===");

const distributions = liquidityDoc.distributions || [];
print(`\nTotal distribuciones: ${distributions.length}`);

let totalAllocated = 0;
let totalMarketValue = 0;
let totalProfitLoss = 0;
let totalRealizedProfitLoss = 0;
let totalUnrealizedProfitLoss = 0;
let activeCount = 0;
let inactiveCount = 0;

print("\n--- Detalle de cada distribución ---");
distributions.forEach((dist, index) => {
  const alert = alertsColl.findOne({ _id: new ObjectId(dist.alertId) });
  const alertStatus = alert ? alert.status : "NO_EXISTE";
  const isActive = dist.isActive !== false;
  const shares = dist.shares || 0;
  const entryPrice = dist.entryPrice || 0;
  const currentPrice = dist.currentPrice || 0;
  const allocatedAmount = dist.allocatedAmount || 0;
  const realizedProfitLoss = dist.realizedProfitLoss || 0;
  const profitLoss = dist.profitLoss || 0;
  
  // Calcular market value real
  const marketValue = shares * currentPrice;
  
  // Calcular P&L no realizado basado en shares
  const unrealizedPL = (currentPrice - entryPrice) * shares;
  
  if (isActive) {
    activeCount++;
    totalAllocated += allocatedAmount;
    totalMarketValue += marketValue;
    totalUnrealizedProfitLoss += unrealizedPL;
  } else {
    inactiveCount++;
  }
  totalRealizedProfitLoss += realizedProfitLoss;
  totalProfitLoss += profitLoss + realizedProfitLoss;
  
  const statusIcon = isActive ? "✅" : "⚪";
  const alertIcon = alertStatus === "ACTIVE" ? "🟢" : (alertStatus === "NO_EXISTE" ? "❌" : "🟡");
  
  print(`\n${statusIcon} ${index + 1}. ${dist.symbol}`);
  print(`   AlertId: ${dist.alertId}`);
  print(`   Alerta status: ${alertIcon} ${alertStatus}`);
  print(`   isActive: ${isActive}`);
  print(`   Shares: ${shares.toFixed(4)}`);
  print(`   Entry Price: $${entryPrice.toFixed(2)}`);
  print(`   Current Price: $${currentPrice.toFixed(2)}`);
  print(`   Allocated Amount: $${allocatedAmount.toFixed(2)}`);
  print(`   Market Value (shares × currentPrice): $${marketValue.toFixed(2)}`);
  print(`   P&L guardado: $${profitLoss.toFixed(2)}`);
  print(`   P&L calculado (unrealized): $${unrealizedPL.toFixed(2)}`);
  print(`   Realized P&L: $${realizedProfitLoss.toFixed(2)}`);
});

// 3. Resumen de cálculos
print("\n=== 3) RESUMEN DE CÁLCULOS ===");
print(`\nDistribuciones activas: ${activeCount}`);
print(`Distribuciones inactivas: ${inactiveCount}`);

print("\n--- Totales calculados de distribuciones activas ---");
print(`   Total Allocated (costo base):     $${totalAllocated.toFixed(2)}`);
print(`   Total Market Value (actual):      $${totalMarketValue.toFixed(2)}`);
print(`   Total Unrealized P&L:             $${totalUnrealizedProfitLoss.toFixed(2)}`);
print(`   Total Realized P&L:               $${totalRealizedProfitLoss.toFixed(2)}`);

// 4. Fórmulas del modelo
print("\n=== 4) VERIFICACIÓN DE FÓRMULAS ===");

const initialLiq = liquidityDoc.initialLiquidity || 0;

// Fórmula del modelo:
// totalLiquidity = initialLiquidity + gananciasRealizadas + gananciasNoRealizadas
const totalLiqCalculado = initialLiq + totalRealizedProfitLoss + totalUnrealizedProfitLoss;

// availableLiquidity = initialLiquidity - montosDistribuidos + gananciasRealizadas
const availableLiqCalculado = initialLiq - totalAllocated + totalRealizedProfitLoss;

print(`\n📐 Según fórmulas del modelo:`);
print(`   totalLiquidity = initial + realized + unrealized`);
print(`   totalLiquidity = $${initialLiq.toFixed(2)} + $${totalRealizedProfitLoss.toFixed(2)} + $${totalUnrealizedProfitLoss.toFixed(2)}`);
print(`   totalLiquidity calculado: $${totalLiqCalculado.toFixed(2)}`);
print(`   totalLiquidity guardado:  $${liquidityDoc.totalLiquidity.toFixed(2)}`);
print(`   Diferencia: $${(liquidityDoc.totalLiquidity - totalLiqCalculado).toFixed(2)}`);

print(`\n   availableLiquidity = initial - distributed + realized`);
print(`   availableLiquidity = $${initialLiq.toFixed(2)} - $${totalAllocated.toFixed(2)} + $${totalRealizedProfitLoss.toFixed(2)}`);
print(`   availableLiquidity calculado: $${availableLiqCalculado.toFixed(2)}`);
print(`   availableLiquidity guardado:  $${liquidityDoc.availableLiquidity.toFixed(2)}`);
print(`   Diferencia: $${(liquidityDoc.availableLiquidity - availableLiqCalculado).toFixed(2)}`);

// 5. Comparación con Market Value esperado
print("\n=== 5) COMPARACIÓN CON VALOR REAL DE MERCADO ===");

// El "Total Liquidity" debería reflejar el valor real de las inversiones
// Una forma de calcularlo: availableLiquidity + marketValue de posiciones activas
const valorTotalReal = (liquidityDoc.availableLiquidity || 0) + totalMarketValue;

print(`\n📊 Valor total de cartera:`);
print(`   Disponible actual: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
print(`   + Market Value posiciones: $${totalMarketValue.toFixed(2)}`);
print(`   = Valor total calculado: $${valorTotalReal.toFixed(2)}`);

print(`\n📈 Comparación con tabla de Tenencia:`);
print(`   Market Value esperado (Tenencia): $${MARKET_VALUE_ESPERADO.toFixed(2)}`);
print(`   Market Value calculado: $${totalMarketValue.toFixed(2)}`);
print(`   Diferencia en Market Value: $${(totalMarketValue - MARKET_VALUE_ESPERADO).toFixed(2)}`);

// 6. Identificar problemas específicos
print("\n=== 6) POSIBLES PROBLEMAS IDENTIFICADOS ===");

const discrepanciaTotal = liquidityDoc.totalLiquidity - totalLiqCalculado;
const discrepanciaMarket = totalMarketValue - MARKET_VALUE_ESPERADO;

if (Math.abs(discrepanciaTotal) > 0.01) {
  print(`\n⚠️  El totalLiquidity guardado no coincide con el calculado`);
  print(`   Esto puede indicar que recalculateDistributions() no se ejecutó correctamente`);
}

if (Math.abs(discrepanciaMarket) > 0.01) {
  print(`\n⚠️  El Market Value de las distribuciones NO coincide con la tabla de Tenencia`);
  print(`   Diferencia: $${discrepanciaMarket.toFixed(2)}`);
  
  // Buscar posibles causas
  print(`\n   Posibles causas:`);
  print(`   1. Precios desactualizados en distribuciones`);
  print(`   2. Distribuciones activas que no deberían existir`);
  print(`   3. Shares incorrectos en alguna distribución`);
}

// 7. Verificar si hay distribuciones con precios muy diferentes a los actuales
print("\n=== 7) VERIFICACIÓN DE PRECIOS ACTUALES ===");
print("(Comparando currentPrice de distribución vs precio actual de alerta)\n");

let preciosDesactualizados = 0;
distributions.filter(d => d.isActive !== false && d.shares > 0).forEach(dist => {
  const alert = alertsColl.findOne({ _id: new ObjectId(dist.alertId) });
  if (alert && alert.currentPrice) {
    const diffPct = Math.abs((dist.currentPrice - alert.currentPrice) / alert.currentPrice * 100);
    if (diffPct > 1) { // Más de 1% de diferencia
      print(`⚠️  ${dist.symbol}: Distribución=$${dist.currentPrice.toFixed(2)}, Alerta=$${alert.currentPrice.toFixed(2)} (${diffPct.toFixed(1)}% diff)`);
      preciosDesactualizados++;
    }
  }
});

if (preciosDesactualizados === 0) {
  print("✅ Todos los precios están sincronizados");
}

// 8. Listar alertas en tabla de Tenencia que NO tienen distribución
print("\n=== 8) ALERTAS ACTIVAS SIN DISTRIBUCIÓN ===");

const alertasActivas = alertsColl.find({ 
  status: "ACTIVE", 
  $or: [
    { tipo: POOL },
    { pool: POOL }
  ]
}).toArray();

const alertIdsConDistribucion = distributions.map(d => d.alertId);

let alertasSinDist = 0;
alertasActivas.forEach(alert => {
  if (!alertIdsConDistribucion.includes(alert._id.toString())) {
    print(`⚠️  ${alert.symbol}: Alerta ACTIVE sin distribución de liquidez`);
    alertasSinDist++;
  }
});

if (alertasSinDist === 0) {
  print("✅ Todas las alertas activas tienen distribución");
}

print("\n======================================================================");
print("📊 RESUMEN FINAL");
print("======================================================================");
print(`\n   Initial Liquidity: $${initialLiq.toFixed(2)}`);
print(`   Allocated (costo base): $${totalAllocated.toFixed(2)}`);
print(`   Market Value (distribuciones): $${totalMarketValue.toFixed(2)}`);
print(`   Market Value (esperado): $${MARKET_VALUE_ESPERADO.toFixed(2)}`);
print(`   Diferencia Market Value: $${(totalMarketValue - MARKET_VALUE_ESPERADO).toFixed(2)}`);
print(`\n   Total Liquidity guardado: $${liquidityDoc.totalLiquidity.toFixed(2)}`);
print(`   Total Liquidity calculado: $${totalLiqCalculado.toFixed(2)}`);
print(`   Diferencia Total Liquidity: $${(liquidityDoc.totalLiquidity - totalLiqCalculado).toFixed(2)}`);

print("\n======================================================================");
print("FIN DEL DIAGNÓSTICO");
print("======================================================================");
