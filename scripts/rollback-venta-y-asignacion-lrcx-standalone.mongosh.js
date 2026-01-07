/**
 * Script de ROLLBACK STANDALONE - Listo para ejecutar directamente
 * 
 * OBJETIVO:
 * 1. Revertir la venta de shares restantes (restaurar shares y allocatedAmount)
 * 2. Remover la asignación de $154.09 a LRCX
 * 3. Remover las ventas parciales agregadas a las alertas
 * 4. Recalcular la liquidez correctamente
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar TODO este script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/rollback-venta-y-asignacion-lrcx-standalone.mongosh.js
 */

// ============================================
// CONFIGURACIÓN
// ============================================
const LRCX_SYMBOL = "LRCX";
const LIQUIDITY_AMOUNT_TO_REMOVE = 154.09; // Monto que se asignó a LRCX

// Función auxiliar para convertir a número
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

print("=".repeat(80));
print("🔄 EJECUTANDO ROLLBACK");
print("=".repeat(80));
print("");

// ============================================
// PARTE 1: REVERTIR VENTAS DE SHARES RESTANTES
// ============================================
print("📊 PARTE 1: Revirtiendo ventas de shares restantes...");
print("");

// Buscar distribuciones vendidas
const distributionsSold = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.shares": 0,
      "distributions.soldShares": { $gt: 0 },
      "distributions.isActive": false
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

if (distributionsSold.length === 0) {
  print("✅ No hay distribuciones vendidas para revertir");
} else {
  print(`📋 Revirtiendo ${distributionsSold.length} distribución(es)...\n`);
  
  distributionsSold.forEach(function(dist, index) {
    const alertId = dist.alertId;
    const symbol = dist.symbol;
    const pool = dist.pool;
    const sharesToRestore = toNumber(dist.soldShares);
    const entryPrice = toNumber(dist.entryPrice);
    const allocatedAmountToRestore = sharesToRestore * entryPrice;
    const realizedProfitToRemove = toNumber(dist.realizedProfitLoss);
    
    print(`   ${index + 1}. Revirtiendo ${symbol}:`);
    print(`      Shares a restaurar: ${sharesToRestore.toFixed(4)}`);
    print(`      Entry Price: $${entryPrice.toFixed(2)}`);
    print(`      Allocated Amount a restaurar: $${allocatedAmountToRestore.toFixed(2)}`);
    print(`      Realized Profit a remover: $${realizedProfitToRemove.toFixed(2)}`);
    
    // 1. Restaurar la DISTRIBUCIÓN DE LIQUIDEZ
    const liquidity = db.liquidities.findOne({ _id: dist.liquidityId });
    if (liquidity) {
      // Restaurar shares y allocatedAmount
      db.liquidities.updateOne(
        { _id: dist.liquidityId, "distributions.alertId": alertId },
        {
          $set: {
            "distributions.$.shares": sharesToRestore,
            "distributions.$.allocatedAmount": allocatedAmountToRestore,
            "distributions.$.currentPrice": entryPrice,
            "distributions.$.profitLoss": 0,
            "distributions.$.profitLossPercentage": 0,
            "distributions.$.isActive": true,
            "distributions.$.soldShares": 0,
            "distributions.$.realizedProfitLoss": 0,
            "distributions.$.updatedAt": new Date()
          }
        }
      );
      print(`      ✅ Distribución de liquidez restaurada`);
    } else {
      print(`      ⚠️  Liquidez no encontrada`);
    }
    
    // 2. Restaurar la ALERTA
    const alert = db.alerts.findOne({ _id: alertId });
    if (alert) {
      // Remover la última venta parcial manual
      const partialSales = alert.liquidityData?.partialSales || [];
      const recentManualSales = partialSales.filter(sale => 
        sale.executedBy === "admin@manual" && 
        sale.emailMessage && 
        sale.emailMessage.includes("shares restantes")
      );
      
      if (recentManualSales.length > 0) {
        // Remover todas las ventas manuales recientes
        const remainingSales = partialSales.filter(sale => 
          !(sale.executedBy === "admin@manual" && 
            sale.emailMessage && 
            sale.emailMessage.includes("shares restantes"))
        );
        
        // Calcular shares y allocatedAmount originales
        const currentShares = toNumber(alert.liquidityData?.shares) || 0;
        const currentAllocated = toNumber(alert.liquidityData?.allocatedAmount) || 0;
        const restoredShares = currentShares + sharesToRestore;
        const restoredAllocated = currentAllocated + allocatedAmountToRestore;
        
        db.alerts.updateOne(
          { _id: alertId },
          {
            $set: {
              "liquidityData.shares": restoredShares,
              "liquidityData.allocatedAmount": restoredAllocated,
              "liquidityData.partialSales": remainingSales
            }
          }
        );
        print(`      ✅ Alerta restaurada (removidas ${recentManualSales.length} venta(s) parcial(es) manual(es))`);
      } else {
        // Si no hay ventas parciales manuales, solo restaurar shares y allocatedAmount
        const currentShares = toNumber(alert.liquidityData?.shares) || 0;
        const currentAllocated = toNumber(alert.liquidityData?.allocatedAmount) || 0;
        const restoredShares = currentShares + sharesToRestore;
        const restoredAllocated = currentAllocated + allocatedAmountToRestore;
        
        db.alerts.updateOne(
          { _id: alertId },
          {
            $set: {
              "liquidityData.shares": restoredShares,
              "liquidityData.allocatedAmount": restoredAllocated
            }
          }
        );
        print(`      ✅ Alerta restaurada (shares y allocatedAmount)`);
      }
    } else {
      print(`      ⚠️  Alerta no encontrada (Alert ID: ${alertId})`);
    }
    
    print("");
  });
  
  // Recalcular liquidez para todos los pools afectados
  const affectedPools = [...new Set(distributionsSold.map(d => d.pool))];
  
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
      
      print(`   ✅ Liquidez recalculada para ${pool}:`);
      print(`      Total: $${newTotalLiquidity.toFixed(2)}`);
      print(`      Available: $${newAvailableLiquidity.toFixed(2)}`);
      print(`      Distributed: $${montosDistribuidos.toFixed(2)}`);
      print("");
    }
  });
}

// ============================================
// PARTE 2: REMOVER ASIGNACIÓN A LRCX
// ============================================
print("─".repeat(80));
print(`💰 PARTE 2: Removiendo asignación de $${LIQUIDITY_AMOUNT_TO_REMOVE} a ${LRCX_SYMBOL}...`);
print("");

// Buscar distribución de LRCX
const lrcxDistributions = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.symbol": LRCX_SYMBOL.toUpperCase()
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
      entryPrice: "$distributions.entryPrice",
      isActive: "$distributions.isActive"
    }
  }
]).toArray();

if (lrcxDistributions.length === 0) {
  print(`ℹ️  No se encontró distribución de ${LRCX_SYMBOL} para remover`);
} else {
  lrcxDistributions.forEach(function(dist, index) {
    const lrcxAlertId = dist.alertId;
    const pool = dist.pool;
    const currentShares = toNumber(dist.shares);
    const currentAllocated = toNumber(dist.allocatedAmount);
    const entryPrice = toNumber(dist.entryPrice);
    
    print(`   ${index + 1}. Removiendo asignación de ${LRCX_SYMBOL}:`);
    print(`      Pool: ${pool}`);
    print(`      Current Shares: ${currentShares.toFixed(4)}`);
    print(`      Current Allocated: $${currentAllocated.toFixed(2)}`);
    print(`      Entry Price: $${entryPrice.toFixed(2)}`);
    
    // Calcular shares a remover
    const sharesToRemove = LIQUIDITY_AMOUNT_TO_REMOVE / entryPrice;
    const allocatedToRemove = sharesToRemove * entryPrice;
    const newShares = currentShares - sharesToRemove;
    const newAllocated = currentAllocated - allocatedToRemove;
    
    print(`      Shares a remover: ${sharesToRemove.toFixed(4)}`);
    print(`      Allocated a remover: $${allocatedToRemove.toFixed(2)}`);
    print(`      New Shares: ${newShares.toFixed(4)}`);
    print(`      New Allocated: $${newAllocated.toFixed(2)}`);
    
    if (newShares <= 0 || newAllocated <= 0) {
      // Remover la distribución completamente
      db.liquidities.updateOne(
        { _id: dist.liquidityId },
        {
          $pull: {
            distributions: { alertId: lrcxAlertId }
          }
        }
      );
      print(`      ✅ Distribución de ${LRCX_SYMBOL} removida completamente`);
    } else {
      // Actualizar la distribución
      const liquidityDoc = db.liquidities.findOne({ _id: dist.liquidityId });
      const newPercentage = liquidityDoc && liquidityDoc.totalLiquidity > 0
        ? (newAllocated / liquidityDoc.totalLiquidity) * 100
        : 0;
      
      db.liquidities.updateOne(
        { _id: dist.liquidityId, "distributions.alertId": lrcxAlertId },
        {
          $set: {
            "distributions.$.shares": newShares,
            "distributions.$.allocatedAmount": newAllocated,
            "distributions.$.percentage": newPercentage,
            "distributions.$.updatedAt": new Date()
          }
        }
      );
      print(`      ✅ Distribución de ${LRCX_SYMBOL} actualizada`);
    }
    
    // Actualizar liquidityData en la alerta
    const lrcxAlert = db.alerts.findOne({ _id: lrcxAlertId });
    if (lrcxAlert) {
      const currentAlertShares = toNumber(lrcxAlert.liquidityData?.shares) || 0;
      const currentAlertAllocated = toNumber(lrcxAlert.liquidityData?.allocatedAmount) || 0;
      const newAlertShares = Math.max(0, currentAlertShares - sharesToRemove);
      const newAlertAllocated = Math.max(0, currentAlertAllocated - allocatedToRemove);
      
      db.alerts.updateOne(
        { _id: lrcxAlertId },
        {
          $set: {
            "liquidityData.shares": newAlertShares,
            "liquidityData.allocatedAmount": newAlertAllocated,
            "liquidityData.originalShares": newAlertShares,
            "liquidityData.originalAllocatedAmount": newAlertAllocated
          }
        }
      );
      print(`      ✅ LiquidityData actualizado en la alerta`);
    }
    
    // Recalcular liquidez del pool
    const liquidity = db.liquidities.findOne({ _id: dist.liquidityId });
    if (liquidity) {
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
      
      print("");
      print(`   ✅ Liquidez del pool ${pool} recalculada:`);
      print(`      Total: $${newTotalLiquidity.toFixed(2)}`);
      print(`      Available: $${newAvailableLiquidity.toFixed(2)}`);
      print(`      Distributed: $${montosDistribuidos.toFixed(2)}`);
    }
    
    print("");
  });
}

print("");
print("=".repeat(80));
print("🎉 ROLLBACK COMPLETADO EXITOSAMENTE");
print("=".repeat(80));
print("");
print("✅ Ventas de shares restantes revertidas");
print(`✅ Asignación a ${LRCX_SYMBOL} removida`);
print("");




