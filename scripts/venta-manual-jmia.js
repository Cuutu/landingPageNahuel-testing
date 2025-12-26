/**
 * Script para ejecutar venta manual de JMIA
 * 
 * PROBLEMA: Quedaron shares pendientes de JMIA que afectan el rendimiento
 * SOLUCIÓN: Ejecutar venta total de los shares restantes a $12.38
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar este script
 * 
 * O ejecutar con: node scripts/venta-manual-jmia.js
 */

// ============================================
// PASO 1: DIAGNÓSTICO - Ver estado actual de JMIA
// ============================================
print("=" .repeat(60));
print("📊 DIAGNÓSTICO JMIA - Estado actual");
print("=" .repeat(60));

// Buscar la alerta JMIA activa
const alertaJMIA = db.alerts.findOne({ 
  symbol: "JMIA", 
  status: { $in: ["ACTIVE", "CLOSED"] },
  "liquidityData.shares": { $gt: 0 }
});

if (!alertaJMIA) {
  print("❌ No se encontró alerta JMIA activa con shares pendientes");
  print("\n🔍 Buscando todas las alertas JMIA...");
  db.alerts.find({ symbol: "JMIA" }).forEach(function(alert) {
    print(`  - ID: ${alert._id}`);
    print(`    Status: ${alert.status}`);
    print(`    Tipo: ${alert.tipo}`);
    print(`    Shares: ${alert.liquidityData?.shares || 0}`);
    print(`    AllocatedAmount: $${alert.liquidityData?.allocatedAmount || 0}`);
    print(`    EntryPrice: $${alert.entryPrice || alert.entryPriceRange?.min || 'N/A'}`);
    print(`    ParticipationPercentage: ${alert.participationPercentage}%`);
    print("");
  });
} else {
  print(`\n✅ Alerta JMIA encontrada:`);
  print(`   ID: ${alertaJMIA._id}`);
  print(`   Status: ${alertaJMIA.status}`);
  print(`   Tipo: ${alertaJMIA.tipo}`);
  print(`   Shares pendientes: ${alertaJMIA.liquidityData?.shares || 0}`);
  print(`   AllocatedAmount: $${(alertaJMIA.liquidityData?.allocatedAmount || 0).toFixed(2)}`);
  print(`   Original Shares: ${alertaJMIA.liquidityData?.originalShares || 'N/A'}`);
  print(`   EntryPrice: $${alertaJMIA.entryPrice || alertaJMIA.entryPriceRange?.min || 'N/A'}`);
  print(`   ParticipationPercentage: ${alertaJMIA.participationPercentage}%`);
  print(`   Ganancia Realizada: ${alertaJMIA.gananciaRealizada || 0}%`);

  // ============================================
  // PASO 2: CÁLCULOS PARA LA VENTA
  // ============================================
  const SELL_PRICE = 12.38;
  const sharesToSell = alertaJMIA.liquidityData?.shares || 0;
  const entryPrice = alertaJMIA.entryPrice || alertaJMIA.entryPriceRange?.min || alertaJMIA.liquidityData?.entryPrice || 0;
  const allocatedAmount = alertaJMIA.liquidityData?.allocatedAmount || 0;
  
  // Calcular ganancia/pérdida
  const proceeds = sharesToSell * SELL_PRICE;  // Lo que se recibe
  const costBasis = sharesToSell * entryPrice;  // Lo que costó
  const realizedProfit = proceeds - costBasis;  // Ganancia en USD
  const profitPercentage = entryPrice > 0 ? ((SELL_PRICE - entryPrice) / entryPrice) * 100 : 0;

  print(`\n📈 CÁLCULOS DE VENTA:`);
  print(`   Precio de venta: $${SELL_PRICE}`);
  print(`   Shares a vender: ${sharesToSell.toFixed(4)}`);
  print(`   Precio de entrada: $${entryPrice.toFixed(2)}`);
  print(`   Ingresos por venta: $${proceeds.toFixed(2)}`);
  print(`   Costo base: $${costBasis.toFixed(2)}`);
  print(`   Ganancia/Pérdida USD: $${realizedProfit.toFixed(2)}`);
  print(`   Ganancia/Pérdida %: ${profitPercentage.toFixed(2)}%`);

  // ============================================
  // PASO 3: VER ESTADO DE LIQUIDEZ
  // ============================================
  print(`\n💰 ESTADO DE LIQUIDEZ (${alertaJMIA.tipo}):`);
  const liquidity = db.liquidities.findOne({ pool: alertaJMIA.tipo });
  if (liquidity) {
    print(`   Total Liquidity: $${liquidity.totalLiquidity?.toFixed(2) || 'N/A'}`);
    print(`   Available Liquidity: $${liquidity.availableLiquidity?.toFixed(2) || 'N/A'}`);
    print(`   Distributed Liquidity: $${liquidity.distributedLiquidity?.toFixed(2) || 'N/A'}`);
    
    const jmiaDistribution = liquidity.distributions?.find(d => d.symbol === "JMIA");
    if (jmiaDistribution) {
      print(`\n   📊 Distribución JMIA en Liquidity:`);
      print(`      AlertId: ${jmiaDistribution.alertId}`);
      print(`      Shares: ${jmiaDistribution.shares?.toFixed(4) || 0}`);
      print(`      AllocatedAmount: $${jmiaDistribution.allocatedAmount?.toFixed(2) || 0}`);
      print(`      EntryPrice: $${jmiaDistribution.entryPrice?.toFixed(2) || 0}`);
      print(`      SoldShares: ${jmiaDistribution.soldShares?.toFixed(4) || 0}`);
      print(`      RealizedProfitLoss: $${jmiaDistribution.realizedProfitLoss?.toFixed(2) || 0}`);
      print(`      IsActive: ${jmiaDistribution.isActive}`);
    }
  }
}

print("\n" + "=".repeat(60));
print("⚠️  PARA EJECUTAR LA VENTA, COPIA EL SCRIPT DE ABAJO");
print("=".repeat(60));

// ============================================
// SCRIPT DE EJECUCIÓN (copiar y pegar después de verificar)
// ============================================

print(`
// ============================================
// 🔴 EJECUTAR VENTA JMIA - COPIAR DESDE AQUÍ
// ============================================

// Variables de configuración
const SELL_PRICE = 12.38;
const ALERT_SYMBOL = "JMIA";

// 1. Buscar la alerta
const alert = db.alerts.findOne({ 
  symbol: ALERT_SYMBOL, 
  "liquidityData.shares": { $gt: 0 }
});

if (!alert) {
  print("❌ No se encontró la alerta");
} else {
  const alertId = alert._id;
  const pool = alert.tipo;
  const sharesToSell = alert.liquidityData?.shares || 0;
  const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || alert.liquidityData?.entryPrice || 0;
  
  // Calcular valores
  const proceeds = sharesToSell * SELL_PRICE;
  const costBasis = sharesToSell * entryPrice;
  const realizedProfit = proceeds - costBasis;
  const profitPercentage = entryPrice > 0 ? ((SELL_PRICE - entryPrice) / entryPrice) * 100 : 0;

  print("📊 Ejecutando venta...");
  print("   Shares: " + sharesToSell);
  print("   Precio: $" + SELL_PRICE);
  print("   P&L: $" + realizedProfit.toFixed(2) + " (" + profitPercentage.toFixed(2) + "%)");

  // 2. Actualizar la ALERTA
  const newPartialSale = {
    date: new Date(),
    percentage: 100,
    sharesToSell: sharesToSell,
    sellPrice: SELL_PRICE,
    liquidityReleased: proceeds,
    realizedProfit: realizedProfit,
    executedBy: "admin@manual",
    priceRange: null,
    emailMessage: "Venta manual ejecutada desde MongoDB para corregir shares residuales",
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
        exitPrice: SELL_PRICE,
        exitDate: new Date(),
        exitReason: "MANUAL",
        participationPercentage: 0,
        "liquidityData.shares": 0,
        "liquidityData.allocatedAmount": 0,
        currentPrice: SELL_PRICE
      },
      $push: {
        "liquidityData.partialSales": newPartialSale
      }
    }
  );
  print("✅ Alerta actualizada");

  // 3. Actualizar LIQUIDEZ
  const liquidity = db.liquidities.findOne({ pool: pool });
  if (liquidity) {
    const alertIdStr = alertId.toString();
    
    // Buscar la distribución de JMIA
    const distIndex = liquidity.distributions.findIndex(d => 
      d.alertId === alertIdStr || d.symbol === "JMIA"
    );
    
    if (distIndex >= 0) {
      const dist = liquidity.distributions[distIndex];
      
      // Actualizar la distribución
      db.liquidities.updateOne(
        { _id: liquidity._id, "distributions.symbol": "JMIA" },
        {
          $set: {
            "distributions.$.shares": 0,
            "distributions.$.allocatedAmount": 0,
            "distributions.$.currentPrice": SELL_PRICE,
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
      const updatedLiquidity = db.liquidities.findOne({ _id: liquidity._id });
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
          { _id: liquidity._id },
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
      print("⚠️ No se encontró distribución de JMIA en liquidez");
    }
  }

  // 4. Crear OPERACIÓN de venta
  const adminUser = db.users.findOne({ role: "admin" });
  if (adminUser) {
    const lastOperation = db.operations.findOne(
      { system: pool },
      { sort: { date: -1 } }
    );
    const currentBalance = lastOperation?.balance || 0;
    
    db.operations.insertOne({
      ticker: "JMIA",
      operationType: "VENTA",
      quantity: -sharesToSell,
      price: SELL_PRICE,
      amount: -proceeds,
      date: new Date(),
      balance: currentBalance + proceeds,
      alertId: alertId,
      alertSymbol: "JMIA",
      system: pool,
      createdBy: adminUser._id,
      isPartialSale: false,
      partialSalePercentage: 100,
      originalQuantity: sharesToSell,
      liquidityData: {
        allocatedAmount: 0,
        shares: 0,
        entryPrice: entryPrice,
        realizedProfit: realizedProfit
      },
      executedBy: "admin@manual",
      executionMethod: "ADMIN",
      notes: "Venta manual ejecutada desde MongoDB para corregir shares residuales de JMIA",
      status: "COMPLETED",
      isPriceConfirmed: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    print("✅ Operación de venta creada");
  } else {
    print("⚠️ No se encontró usuario admin para crear la operación");
  }

  print("");
  print("🎉 VENTA COMPLETADA EXITOSAMENTE");
  print("   Symbol: JMIA");
  print("   Shares vendidos: " + sharesToSell.toFixed(4));
  print("   Precio: $" + SELL_PRICE);
  print("   P&L: $" + realizedProfit.toFixed(2) + " (" + profitPercentage.toFixed(2) + "%)");
}
`);

