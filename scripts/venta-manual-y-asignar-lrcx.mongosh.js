/**
 * Script para vender todos los shares restantes y asignar liquidez a LRCX
 * 
 * OBJETIVO:
 * 1. Vender todos los shares restantes de manera manual (sin crear operación)
 * 2. Asignar $154.09 de liquidez a la alerta LRCX
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar este script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/venta-manual-y-asignar-lrcx.mongosh.js
 */

// ============================================
// CONFIGURACIÓN
// ============================================
const LIQUIDITY_AMOUNT_FOR_LRCX = 154.09; // Monto a asignar a LRCX
const LRCX_SYMBOL = "LRCX";

// Función auxiliar para formatear números
function formatNum(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return num.toFixed(decimals);
}

// Función auxiliar para convertir a número
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

print("=".repeat(80));
print("📊 DIAGNÓSTICO - Shares Restantes y Alerta LRCX");
print("=".repeat(80));
print("");

// ============================================
// PASO 1: BUSCAR DISTRIBUCIONES CON SHARES RESTANTES
// ============================================
print("🔍 PASO 1: Buscando distribuciones con shares restantes...");
print("");

const distributionsWithShares = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
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
      isActive: "$distributions.isActive",
      realizedProfitLoss: "$distributions.realizedProfitLoss"
    }
  }
]).toArray();

if (distributionsWithShares.length === 0) {
  print("✅ No se encontraron distribuciones con shares restantes");
} else {
  print(`📋 Encontradas ${distributionsWithShares.length} distribución(es) con shares restantes:\n`);
  
  distributionsWithShares.forEach((dist, index) => {
    print(`   ${index + 1}. ${dist.symbol} (Pool: ${dist.pool})`);
    print(`      Alert ID: ${dist.alertId}`);
    print(`      Shares restantes: ${formatNum(toNumber(dist.shares), 4)}`);
    print(`      Entry Price: $${formatNum(toNumber(dist.entryPrice))}`);
    print(`      Current Price: $${formatNum(toNumber(dist.currentPrice))}`);
    print(`      Allocated Amount: $${formatNum(toNumber(dist.allocatedAmount))}`);
    print(`      Is Active: ${dist.isActive}`);
    print("");
  });
}

// ============================================
// PASO 2: BUSCAR ALERTA LRCX
// ============================================
print("─".repeat(80));
print(`🔍 PASO 2: Buscando alerta ${LRCX_SYMBOL}...`);
print("");

const lrcxAlert = db.alerts.findOne({ symbol: LRCX_SYMBOL.toUpperCase() });

if (!lrcxAlert) {
  print(`❌ No se encontró la alerta ${LRCX_SYMBOL}`);
  print("   ⚠️  No se podrá asignar liquidez a LRCX");
} else {
  print(`✅ Alerta ${LRCX_SYMBOL} encontrada:`);
  print(`   Alert ID: ${lrcxAlert._id}`);
  print(`   Status: ${lrcxAlert.status}`);
  print(`   Tipo: ${lrcxAlert.tipo}`);
  print(`   Entry Price: $${formatNum(toNumber(lrcxAlert.entryPrice || lrcxAlert.entryPriceRange?.max))}`);
  print(`   Current Price: $${formatNum(toNumber(lrcxAlert.currentPrice))}`);
  
  if (lrcxAlert.status !== "ACTIVE") {
    print(`   ⚠️  ADVERTENCIA: La alerta no está ACTIVE (status: ${lrcxAlert.status})`);
    print(`      Se asignará liquidez de todas formas, pero verifica que sea correcto.`);
  }
  print("");
}

// ============================================
// PASO 3: VER ESTADO DE LIQUIDEZ POR POOL
// ============================================
print("─".repeat(80));
print("💰 PASO 3: Estado de liquidez por pool");
print("");

["TraderCall", "SmartMoney"].forEach(pool => {
  const liquidity = db.liquidities.findOne({ pool: pool });
  if (liquidity) {
    print(`   ${pool}:`);
    print(`      Initial Liquidity: $${formatNum(toNumber(liquidity.initialLiquidity))}`);
    print(`      Total Liquidity: $${formatNum(toNumber(liquidity.totalLiquidity))}`);
    print(`      Available Liquidity: $${formatNum(toNumber(liquidity.availableLiquidity))}`);
    print(`      Distributed Liquidity: $${formatNum(toNumber(liquidity.distributedLiquidity))}`);
    print("");
  } else {
    print(`   ${pool}: ❌ No hay documento de liquidez`);
    print("");
  }
});

print("=".repeat(80));
print("⚠️  PARA EJECUTAR LA VENTA Y ASIGNACIÓN, VERIFICA LOS DATOS Y EJECUTA EL SCRIPT DE ABAJO");
print("=".repeat(80));

// ============================================
// SCRIPT DE EJECUCIÓN (copiar y pegar después de verificar)
// ============================================

print(`
// ============================================
// 🔴 EJECUTAR VENTA Y ASIGNACIÓN A LRCX - COPIAR DESDE AQUÍ
// ============================================

// Variables de configuración
const LIQUIDITY_AMOUNT_FOR_LRCX = ${LIQUIDITY_AMOUNT_FOR_LRCX};
const LRCX_SYMBOL = "${LRCX_SYMBOL}";

// Función auxiliar
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

print("=".repeat(80));
print("🚀 EJECUTANDO VENTA DE SHARES RESTANTES Y ASIGNACIÓN A LRCX");
print("=".repeat(80));
print("");

// ============================================
// PARTE 1: VENDER TODOS LOS SHARES RESTANTES
// ============================================
print("📊 PARTE 1: Vendiendo shares restantes...");
print("");

// Buscar todas las distribuciones con shares > 0
const distributionsToSell = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
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
      isActive: "$distributions.isActive",
      realizedProfitLoss: "$distributions.realizedProfitLoss"
    }
  }
]).toArray();

if (distributionsToSell.length === 0) {
  print("✅ No hay shares restantes para vender");
} else {
  print(\`📋 Vendiendo \${distributionsToSell.length} distribución(es)...\n\`);
  
  distributionsToSell.forEach(function(dist, index) {
    const alertId = dist.alertId;
    const symbol = dist.symbol;
    const pool = dist.pool;
    const sharesToSell = toNumber(dist.shares);
    const entryPrice = toNumber(dist.entryPrice);
    const sellPrice = toNumber(dist.currentPrice) || entryPrice; // Usar currentPrice o entryPrice como fallback
    
    // Calcular valores
    const proceeds = sharesToSell * sellPrice;
    const costBasis = sharesToSell * entryPrice;
    const realizedProfit = proceeds - costBasis;
    const profitPercentage = entryPrice > 0 ? ((sellPrice - entryPrice) / entryPrice) * 100 : 0;
    
    print(\`   \${index + 1}. Vendiendo \${symbol}:\`);
    print(\`      Shares: \${sharesToSell.toFixed(4)}\`);
    print(\`      Precio de venta: $\${sellPrice.toFixed(2)}\`);
    print(\`      Entry Price: $\${entryPrice.toFixed(2)}\`);
    print(\`      Proceeds: $\${proceeds.toFixed(2)}\`);
    print(\`      P&L: $\${realizedProfit.toFixed(2)} (\${profitPercentage.toFixed(2)}%)\`);
    
    // 1. Actualizar la ALERTA
    const alert = db.alerts.findOne({ _id: alertId });
    if (alert) {
      // Registrar la venta parcial en la alerta
      const newPartialSale = {
        date: new Date(),
        percentage: 100, // Venta total del remanente
        sharesToSell: sharesToSell,
        sellPrice: sellPrice,
        liquidityReleased: proceeds,
        realizedProfit: realizedProfit,
        executedBy: "admin@manual",
        priceRange: null,
        emailMessage: "Venta manual ejecutada desde MongoDB - shares restantes",
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
            "liquidityData.shares": 0,
            "liquidityData.allocatedAmount": 0,
            currentPrice: sellPrice
          },
          $push: {
            "liquidityData.partialSales": newPartialSale
          }
        }
      );
      print(\`      ✅ Alerta actualizada\`);
    } else {
      print(\`      ⚠️  Alerta no encontrada (Alert ID: \${alertId})\`);
    }
    
    // 2. Actualizar DISTRIBUCIÓN DE LIQUIDEZ
    const liquidity = db.liquidities.findOne({ _id: dist.liquidityId });
    if (liquidity) {
      // Actualizar la distribución específica
      db.liquidities.updateOne(
        { _id: dist.liquidityId, "distributions.alertId": alertId },
        {
          $set: {
            "distributions.$.shares": 0,
            "distributions.$.allocatedAmount": 0,
            "distributions.$.currentPrice": sellPrice,
            "distributions.$.profitLoss": 0,
            "distributions.$.profitLossPercentage": 0,
            "distributions.$.isActive": false,
            "distributions.$.soldShares": (toNumber(dist.soldShares) || 0) + sharesToSell,
            "distributions.$.realizedProfitLoss": (toNumber(dist.realizedProfitLoss) || 0) + realizedProfit,
            "distributions.$.updatedAt": new Date()
          }
        }
      );
      print(\`      ✅ Distribución de liquidez actualizada\`);
    } else {
      print(\`      ⚠️  Liquidez no encontrada\`);
    }
    
    print("");
  });
  
  // Recalcular liquidez para todos los pools afectados
  const affectedPools = [...new Set(distributionsToSell.map(d => d.pool))];
  
  affectedPools.forEach(function(pool) {
    const liquidity = db.liquidities.findOne({ pool: pool });
    if (liquidity) {
      // Calcular totales
      let montosDistribuidos = 0;
      let gananciasRealizadas = 0;
      let gananciasNoRealizadas = 0;
      
      liquidity.distributions.forEach(function(d) {
        if (d.isActive && toNumber(d.shares) > 0) {
          montosDistribuidos += toNumber(d.allocatedAmount) || 0;
          gananciasNoRealizadas += toNumber(d.profitLoss) || 0;
        }
        gananciasRealizadas += toNumber(d.realizedProfitLoss) || 0;
      });
      
      const initialLiquidity = toNumber(liquidity.initialLiquidity) || 0;
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
      
      print(\`   ✅ Liquidez recalculada para \${pool}:\`);
      print(\`      New Total: $\${newTotalLiquidity.toFixed(2)}\`);
      print(\`      New Available: $\${newAvailableLiquidity.toFixed(2)}\`);
      print(\`      New Distributed: $\${montosDistribuidos.toFixed(2)}\`);
      print("");
    }
  });
}

// ============================================
// PARTE 2: ASIGNAR LIQUIDEZ A LRCX
// ============================================
print("─".repeat(80));
print(\`💰 PARTE 2: Asignando $\${LIQUIDITY_AMOUNT_FOR_LRCX} a \${LRCX_SYMBOL}...\`);
print("");

// Buscar alerta LRCX
const lrcxAlert = db.alerts.findOne({ symbol: LRCX_SYMBOL.toUpperCase() });

if (!lrcxAlert) {
  print(\`❌ No se encontró la alerta \${LRCX_SYMBOL}\`);
  print(\`   ⚠️  No se puede asignar liquidez\`);
} else {
  const lrcxAlertId = lrcxAlert._id.toString();
  const pool = lrcxAlert.tipo === "SmartMoney" ? "SmartMoney" : "TraderCall";
  const entryPrice = toNumber(lrcxAlert.entryPrice || lrcxAlert.entryPriceRange?.max);
  
  if (!entryPrice || entryPrice <= 0) {
    print(\`❌ La alerta \${LRCX_SYMBOL} no tiene precio de entrada válido\`);
  } else {
    print(\`   Alert ID: \${lrcxAlertId}\`);
    print(\`   Pool: \${pool}\`);
    print(\`   Entry Price: $\${entryPrice.toFixed(2)}\`);
    print(\`   Amount to assign: $\${LIQUIDITY_AMOUNT_FOR_LRCX.toFixed(2)}\`);
    
    // Buscar liquidez del pool
    const liquidity = db.liquidities.findOne({ pool: pool });
    
    if (!liquidity) {
      print(\`   ❌ No se encontró liquidez para el pool \${pool}\`);
    } else {
      // Calcular shares
      const shares = LIQUIDITY_AMOUNT_FOR_LRCX / entryPrice;
      const actualAllocatedAmount = shares * entryPrice;
      
      print(\`   Shares calculados: \${shares.toFixed(4)}\`);
      print(\`   Allocated Amount: $\${actualAllocatedAmount.toFixed(2)}\`);
      print("");
      
      // Verificar si ya existe distribución para LRCX
      const existingDistribution = liquidity.distributions.find(
        d => d.alertId && d.alertId.toString() === lrcxAlertId
      );
      
      if (existingDistribution) {
        // Actualizar distribución existente
        const newShares = toNumber(existingDistribution.shares) + shares;
        const newAllocatedAmount = toNumber(existingDistribution.allocatedAmount) + actualAllocatedAmount;
        const newPercentage = (newAllocatedAmount / liquidity.totalLiquidity) * 100;
        
        db.liquidities.updateOne(
          { _id: liquidity._id, "distributions.alertId": lrcxAlertId },
          {
            $set: {
              "distributions.$.shares": newShares,
              "distributions.$.allocatedAmount": newAllocatedAmount,
              "distributions.$.percentage": newPercentage,
              "distributions.$.currentPrice": entryPrice,
              "distributions.$.isActive": true,
              "distributions.$.updatedAt": new Date()
            }
          }
        );
        
        print(\`   ✅ Distribución existente actualizada para \${LRCX_SYMBOL}\`);
        print(\`      New Shares: \${newShares.toFixed(4)}\`);
        print(\`      New Allocated Amount: $\${newAllocatedAmount.toFixed(2)}\`);
        print(\`      New Percentage: \${newPercentage.toFixed(2)}%\`);
      } else {
        // Crear nueva distribución
        const percentage = (actualAllocatedAmount / liquidity.totalLiquidity) * 100;
        
        const newDistribution = {
          alertId: lrcxAlertId,
          symbol: LRCX_SYMBOL.toUpperCase(),
          percentage: percentage,
          allocatedAmount: actualAllocatedAmount,
          entryPrice: entryPrice,
          currentPrice: entryPrice,
          shares: shares,
          profitLoss: 0,
          profitLossPercentage: 0,
          realizedProfitLoss: 0,
          soldShares: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        db.liquidities.updateOne(
          { _id: liquidity._id },
          {
            $push: {
              distributions: newDistribution
            }
          }
        );
        
        print(\`   ✅ Nueva distribución creada para \${LRCX_SYMBOL}\`);
        print(\`      Shares: \${shares.toFixed(4)}\`);
        print(\`      Allocated Amount: $\${actualAllocatedAmount.toFixed(2)}\`);
        print(\`      Percentage: \${percentage.toFixed(2)}%\`);
      }
      
      // Actualizar liquidityData en la alerta
      const currentLiquidityData = lrcxAlert.liquidityData || {};
      const currentShares = toNumber(currentLiquidityData.shares) || 0;
      const currentAllocated = toNumber(currentLiquidityData.allocatedAmount) || 0;
      
      db.alerts.updateOne(
        { _id: lrcxAlert._id },
        {
          $set: {
            "liquidityData.shares": currentShares + shares,
            "liquidityData.allocatedAmount": currentAllocated + actualAllocatedAmount,
            "liquidityData.originalShares": currentShares + shares,
            "liquidityData.originalAllocatedAmount": currentAllocated + actualAllocatedAmount
          }
        }
      );
      
      print(\`   ✅ LiquidityData actualizado en la alerta\`);
      
      // Recalcular liquidez del pool
      const updatedLiquidity = db.liquidities.findOne({ _id: liquidity._id });
      if (updatedLiquidity) {
        let montosDistribuidos = 0;
        let gananciasRealizadas = 0;
        let gananciasNoRealizadas = 0;
        
        updatedLiquidity.distributions.forEach(function(d) {
          if (d.isActive && toNumber(d.shares) > 0) {
            montosDistribuidos += toNumber(d.allocatedAmount) || 0;
            gananciasNoRealizadas += toNumber(d.profitLoss) || 0;
          }
          gananciasRealizadas += toNumber(d.realizedProfitLoss) || 0;
        });
        
        const initialLiquidity = toNumber(updatedLiquidity.initialLiquidity) || 0;
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
        
        print("");
        print(\`   ✅ Liquidez del pool \${pool} recalculada:\`);
        print(\`      Total: $\${newTotalLiquidity.toFixed(2)}\`);
        print(\`      Available: $\${newAvailableLiquidity.toFixed(2)}\`);
        print(\`      Distributed: $\${montosDistribuidos.toFixed(2)}\`);
      }
    }
  }
}

print("");
print("=".repeat(80));
print("🎉 PROCESO COMPLETADO EXITOSAMENTE");
print("=".repeat(80));
print("");
print("✅ Shares restantes vendidos (sin crear operación)");
print(\`✅ $\${LIQUIDITY_AMOUNT_FOR_LRCX} asignados a \${LRCX_SYMBOL}\`);
print("");
`);



