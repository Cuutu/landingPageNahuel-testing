/**
 * Script para ejecutar venta manual de GFI
 * 
 * PROBLEMA: Quedaron 0.1875 shares restantes de GFI en la distribución de liquidez
 * SOLUCIÓN: Ejecutar venta total de los shares restantes al precio actual ($43.20)
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar este script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/venta-manual-gfi.mongosh.js
 */

// ============================================
// PASO 1: DIAGNÓSTICO - Ver estado actual de GFI
// ============================================
print("=".repeat(60));
print("📊 DIAGNÓSTICO GFI - Estado actual");
print("=".repeat(60));

const SYMBOL = "GFI";

// Buscar la distribución de liquidez
const distributions = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.symbol": SYMBOL.toUpperCase(),
      "distributions.shares": { $gt: 0 }
    }
  },
  {
    $project: {
      pool: 1,
      liquidityId: "$_id",
      alertId: "$distributions.alertId",
      symbol: "$distributions.symbol",
      allocatedAmount: "$distributions.allocatedAmount",
      shares: "$distributions.shares",
      soldShares: "$distributions.soldShares",
      entryPrice: "$distributions.entryPrice",
      currentPrice: "$distributions.currentPrice",
      isActive: "$distributions.isActive"
    }
  }
]).toArray();

if (distributions.length === 0) {
  print(`❌ No se encontró distribución de liquidez activa para ${SYMBOL}`);
  print("\n🔍 Buscando todas las distribuciones de GFI...");
  const allDistributions = db.liquidities.aggregate([
    { $unwind: "$distributions" },
    { $match: { "distributions.symbol": SYMBOL.toUpperCase() } },
    {
      $project: {
        pool: 1,
        alertId: "$distributions.alertId",
        symbol: "$distributions.symbol",
        shares: "$distributions.shares",
        allocatedAmount: "$distributions.allocatedAmount",
        isActive: "$distributions.isActive"
      }
    }
  ]).toArray();
  
  allDistributions.forEach(function(dist) {
    print(`  - Pool: ${dist.pool}`);
    print(`    Alert ID: ${dist.alertId}`);
    print(`    Shares: ${dist.shares}`);
    print(`    AllocatedAmount: $${dist.allocatedAmount}`);
    print(`    IsActive: ${dist.isActive}`);
    print("");
  });
} else {
  const dist = distributions[0];
  print(`\n✅ Distribución de liquidez encontrada:`);
  print(`   Pool: ${dist.pool}`);
  print(`   Alert ID: ${dist.alertId}`);
  print(`   Shares restantes: ${dist.shares}`);
  print(`   Shares vendidos: ${dist.soldShares || 0}`);
  print(`   AllocatedAmount: $${dist.allocatedAmount}`);
  print(`   EntryPrice: $${dist.entryPrice}`);
  print(`   CurrentPrice: $${dist.currentPrice}`);
  print(`   IsActive: ${dist.isActive}`);
  
  // Buscar la alerta correspondiente
  const alert = db.alerts.findOne({ _id: dist.alertId });
  
  if (alert) {
    print(`\n📊 Alerta correspondiente:`);
    print(`   Symbol: ${alert.symbol}`);
    print(`   Status: ${alert.status}`);
    print(`   Tipo: ${alert.tipo}`);
    print(`   Participation Percentage: ${alert.participationPercentage || 0}%`);
    if (alert.liquidityData) {
      print(`   LiquidityData.shares: ${alert.liquidityData.shares || 0}`);
      print(`   LiquidityData.allocatedAmount: $${alert.liquidityData.allocatedAmount || 0}`);
    }
    
    // ============================================
    // PASO 2: CÁLCULOS PARA LA VENTA
    // ============================================
    const SELL_PRICE = 43.20; // Precio fijo de venta
    const sharesToSell = dist.shares; // Shares restantes en la distribución
    const entryPrice = dist.entryPrice || alert.entryPrice || 42.28;
    
    // Calcular ganancia/pérdida
    const proceeds = sharesToSell * SELL_PRICE;  // Lo que se recibe
    const costBasis = sharesToSell * entryPrice;  // Lo que costó
    const realizedProfit = proceeds - costBasis;  // Ganancia en USD
    const profitPercentage = entryPrice > 0 ? ((SELL_PRICE - entryPrice) / entryPrice) * 100 : 0;
    
    print(`\n📈 CÁLCULOS DE VENTA:`);
    print(`   Precio de venta: $${SELL_PRICE.toFixed(2)}`);
    print(`   Shares a vender: ${sharesToSell.toFixed(4)}`);
    print(`   Precio de entrada: $${entryPrice.toFixed(2)}`);
    print(`   Ingresos por venta: $${proceeds.toFixed(2)}`);
    print(`   Costo base: $${costBasis.toFixed(2)}`);
    print(`   Ganancia/Pérdida USD: $${realizedProfit.toFixed(2)}`);
    print(`   Ganancia/Pérdida %: ${profitPercentage.toFixed(2)}%`);
    
    // ============================================
    // PASO 3: VER ESTADO DE LIQUIDEZ
    // ============================================
    print(`\n💰 ESTADO DE LIQUIDEZ (${dist.pool}):`);
    const liquidity = db.liquidities.findOne({ _id: dist.liquidityId });
    if (liquidity) {
      print(`   Total Liquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)}`);
      print(`   Available Liquidity: $${(liquidity.availableLiquidity || 0).toFixed(2)}`);
      print(`   Distributed Liquidity: $${(liquidity.distributedLiquidity || 0).toFixed(2)}`);
    }
  } else {
    print(`\n⚠️  No se encontró la alerta correspondiente (Alert ID: ${dist.alertId})`);
  }
}

print("\n" + "=".repeat(60));
print("⚠️  PARA EJECUTAR LA VENTA, VERIFICA LOS DATOS Y EJECUTA EL SCRIPT DE ABAJO");
print("=".repeat(60));

// ============================================
// SCRIPT DE EJECUCIÓN (copiar y pegar después de verificar)
// ============================================

print(`
// ============================================
// 🔴 EJECUTAR VENTA GFI - COPIAR DESDE AQUÍ
// ============================================

// Variables de configuración
const SELL_PRICE = 43.20; // Precio fijo de venta para GFI
const ALERT_SYMBOL = "GFI";

// 1. Buscar la distribución de liquidez
const distributions = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.symbol": ALERT_SYMBOL.toUpperCase(),
      "distributions.shares": { $gt: 0 }
    }
  },
  {
    $project: {
      pool: 1,
      liquidityId: "$_id",
      alertId: "$distributions.alertId",
      symbol: "$distributions.symbol",
      allocatedAmount: "$distributions.allocatedAmount",
      shares: "$distributions.shares",
      soldShares: "$distributions.soldShares",
      entryPrice: "$distributions.entryPrice",
      currentPrice: "$distributions.currentPrice",
      isActive: "$distributions.isActive"
    }
  }
]).toArray();

if (distributions.length === 0) {
  print("❌ No se encontró distribución de liquidez activa para " + ALERT_SYMBOL);
} else {
  const dist = distributions[0];
  const alertId = dist.alertId;
  const pool = dist.pool;
  const sharesToSell = dist.shares;
  const entryPrice = dist.entryPrice;
  const finalSellPrice = SELL_PRICE; // Precio fijo de venta: $43.20
  
  // Calcular valores
  const proceeds = sharesToSell * finalSellPrice;
  const costBasis = sharesToSell * entryPrice;
  const realizedProfit = proceeds - costBasis;
  const profitPercentage = entryPrice > 0 ? ((finalSellPrice - entryPrice) / entryPrice) * 100 : 0;
  
  print("📊 Ejecutando venta...");
  print("   Symbol: " + ALERT_SYMBOL);
  print("   Shares: " + sharesToSell.toFixed(4));
  print("   Precio: $" + finalSellPrice.toFixed(2));
  print("   Entry Price: $" + entryPrice.toFixed(2));
  print("   P&L: $" + realizedProfit.toFixed(2) + " (" + profitPercentage.toFixed(2) + "%)");
  
  // 2. Buscar y actualizar la ALERTA
  const alert = db.alerts.findOne({ _id: alertId });
  if (!alert) {
    print("❌ No se encontró la alerta (Alert ID: " + alertId + ")");
  } else {
    // Calcular participation percentage restante (debería ser 0 después de esta venta)
    const currentParticipation = alert.participationPercentage || 0;
    
    // Registrar la venta parcial en la alerta
    const newPartialSale = {
      date: new Date(),
      percentage: 100, // Venta total del remanente
      sharesToSell: sharesToSell,
      sellPrice: finalSellPrice,
      liquidityReleased: proceeds,
      realizedProfit: realizedProfit,
      executedBy: "admin@manual",
      priceRange: null,
      emailMessage: "Venta manual ejecutada desde MongoDB para cerrar posición residual de GFI",
      emailImageUrl: null,
      isCompleteSale: true,
      executed: true,
      executedAt: new Date()
    };
    
    // Actualizar alerta
    db.alerts.updateOne(
      { _id: alertId },
      {
        $set: {
          status: "CLOSED",
          exitPrice: finalSellPrice,
          exitDate: new Date(),
          exitReason: "MANUAL",
          participationPercentage: 0,
          "liquidityData.shares": 0,
          "liquidityData.allocatedAmount": 0,
          currentPrice: finalSellPrice
        },
        $push: {
          "liquidityData.partialSales": newPartialSale
        }
      }
    );
    print("✅ Alerta actualizada");
  }
  
  // 3. Actualizar DISTRIBUCIÓN DE LIQUIDEZ
  const liquidity = db.liquidities.findOne({ _id: dist.liquidityId });
  if (liquidity) {
    // Actualizar la distribución específica
    db.liquidities.updateOne(
      { _id: dist.liquidityId, "distributions.alertId": alertId },
      {
        $set: {
          "distributions.$.shares": 0,
          "distributions.$.allocatedAmount": 0,
          "distributions.$.currentPrice": finalSellPrice,
          "distributions.$.profitLoss": 0,
          "distributions.$.profitLossPercentage": 0,
          "distributions.$.isActive": false,
          "distributions.$.soldShares": (dist.soldShares || 0) + sharesToSell,
          "distributions.$.realizedProfitLoss": (dist.realizedProfitLoss || 0) + realizedProfit,
          "distributions.$.updatedAt": new Date()
        }
      }
    );
    print("✅ Distribución de liquidez actualizada");
    
    // Recalcular liquidez disponible
    const updatedLiquidity = db.liquidities.findOne({ _id: dist.liquidityId });
    if (updatedLiquidity) {
      // Calcular totales
      let montosDistribuidos = 0;
      let gananciasRealizadas = 0;
      let gananciasNoRealizadas = 0;
      
      updatedLiquidity.distributions.forEach(function(d) {
        if (d.isActive && d.shares > 0) {
          montosDistribuidos += d.allocatedAmount || 0;
          gananciasNoRealizadas += d.profitLoss || 0;
        }
        gananciasRealizadas += d.realizedProfitLoss || 0;
      });
      
      const initialLiquidity = updatedLiquidity.initialLiquidity || 0;
      const newTotalLiquidity = initialLiquidity + gananciasRealizadas + gananciasNoRealizadas;
      const newAvailableLiquidity = initialLiquidity - montosDistribuidos + gananciasRealizadas;
      
      db.liquidities.updateOne(
        { _id: dist.liquidityId },
        {
          $set: {
            totalLiquidity: newTotalLiquidity,
            availableLiquidity: newAvailableLiquidity,
            distributedLiquidity: montosDistribuidos
          }
        }
      );
      print("✅ Liquidez recalculada");
      print("   New Total: $" + newTotalLiquidity.toFixed(2));
      print("   New Available: $" + newAvailableLiquidity.toFixed(2));
      print("   New Distributed: $" + montosDistribuidos.toFixed(2));
    }
  } else {
    print("⚠️ No se encontró liquidez para actualizar");
  }
  
  // NOTA: No se crea operación porque ya existe la operación de venta
  
  print("");
  print("🎉 VENTA COMPLETADA EXITOSAMENTE");
  print("   Symbol: " + ALERT_SYMBOL);
  print("   Shares vendidos: " + sharesToSell.toFixed(4));
  print("   Precio: $" + finalSellPrice.toFixed(2));
  print("   Entry Price: $" + entryPrice.toFixed(2));
  print("   P&L: $" + realizedProfit.toFixed(2) + " (" + profitPercentage.toFixed(2) + "%)");
}
`);

