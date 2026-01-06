/**
 * Script para sincronizar liquidityData de alertas con distribuciones de liquidez
 * 
 * OBJETIVO:
 * Reasignar la liquidez correspondiente a todas las alertas que tienen
 * distribuciones de liquidez activas, sincronizando liquidityData en las alertas
 * con los valores de las distribuciones.
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar TODO este script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/sincronizar-liquidez-alertas.mongosh.js
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
print("🔄 SINCRONIZACIÓN DE LIQUIDEZ EN ALERTAS");
print("=".repeat(80));
print("");

// ============================================
// PASO 1: DIAGNÓSTICO - Ver distribuciones actuales
// ============================================
print("🔍 PASO 1: Analizando distribuciones de liquidez...");
print("");

["TraderCall", "SmartMoney"].forEach(function(pool) {
  print(`\n─ Pool: ${pool} ─`);
  
  const liquidity = db.liquidities.findOne({ pool: pool });
  if (!liquidity) {
    print(`   ❌ No se encontró liquidez para ${pool}`);
    return;
  }
  
  const distributions = liquidity.distributions || [];
  const activeDistributions = distributions.filter(d => 
    d.isActive && toNumber(d.shares) > 0
  );
  
  print(`   Total distribuciones: ${distributions.length}`);
  print(`   Distribuciones activas: ${activeDistributions.length}`);
  
  if (activeDistributions.length > 0) {
    print(`\n   Distribuciones activas:`);
    activeDistributions.forEach(function(dist, index) {
      print(`      ${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
      print(`         Shares: ${formatNum(toNumber(dist.shares), 4)}`);
      print(`         Allocated Amount: $${formatNum(toNumber(dist.allocatedAmount))}`);
      print(`         Entry Price: $${formatNum(toNumber(dist.entryPrice))}`);
    });
  }
});

print("\n" + "=".repeat(80));
print("⚠️  PARA EJECUTAR LA SINCRONIZACIÓN, VERIFICA LOS DATOS Y EJECUTA EL SCRIPT DE ABAJO");
print("=".repeat(80));

// ============================================
// SCRIPT DE SINCRONIZACIÓN (copiar y pegar después de verificar)
// ============================================

print(`
// ============================================
// 🔴 EJECUTAR SINCRONIZACIÓN - COPIAR DESDE AQUÍ
// ============================================

// Función auxiliar
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function formatNum(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return num.toFixed(decimals);
}

print("=".repeat(80));
print("🔄 EJECUTANDO SINCRONIZACIÓN DE LIQUIDEZ");
print("=".repeat(80));
print("");

let totalUpdated = 0;
let totalErrors = 0;

["TraderCall", "SmartMoney"].forEach(function(pool) {
  print(\`\n─ Procesando pool: \${pool} ─\`);
  
  const liquidity = db.liquidities.findOne({ pool: pool });
  if (!liquidity) {
    print(\`   ❌ No se encontró liquidez para \${pool}\`);
    return;
  }
  
  const distributions = liquidity.distributions || [];
  const activeDistributions = distributions.filter(d => 
    d.isActive && toNumber(d.shares) > 0
  );
  
  print(\`   📋 Encontradas \${activeDistributions.length} distribución(es) activa(s)\`);
  print("");
  
  activeDistributions.forEach(function(dist, index) {
    const alertId = dist.alertId;
    const symbol = dist.symbol;
    const distributionShares = toNumber(dist.shares);
    const distributionAllocated = toNumber(dist.allocatedAmount);
    const entryPrice = toNumber(dist.entryPrice);
    
    print(\`   \${index + 1}. Sincronizando \${symbol} (AlertId: \${alertId}):\`);
    print(\`      Distribución - Shares: \${formatNum(distributionShares, 4)}, Allocated: $\${formatNum(distributionAllocated)}\`);
    
    // Buscar la alerta
    const alert = db.alerts.findOne({ _id: alertId });
    if (!alert) {
      print(\`      ⚠️  Alerta no encontrada (AlertId: \${alertId})\`);
      totalErrors++;
      return;
    }
    
    // Obtener valores actuales de la alerta
    const currentShares = toNumber(alert.liquidityData?.shares) || 0;
    const currentAllocated = toNumber(alert.liquidityData?.allocatedAmount) || 0;
    
    print(\`      Alerta actual - Shares: \${formatNum(currentShares, 4)}, Allocated: $\${formatNum(currentAllocated)}\`);
    
    // Verificar si necesita actualización
    const sharesDiff = Math.abs(distributionShares - currentShares);
    const allocatedDiff = Math.abs(distributionAllocated - currentAllocated);
    
    if (sharesDiff < 0.0001 && allocatedDiff < 0.01) {
      print(\`      ✅ Ya está sincronizado (sin cambios necesarios)\`);
    } else {
      // Calcular valores originales si no existen
      const originalShares = toNumber(alert.liquidityData?.originalShares) || distributionShares;
      const originalAllocated = toNumber(alert.liquidityData?.originalAllocatedAmount) || distributionAllocated;
      
      // Actualizar la alerta
      const updateResult = db.alerts.updateOne(
        { _id: alertId },
        {
          $set: {
            "liquidityData.shares": distributionShares,
            "liquidityData.allocatedAmount": distributionAllocated,
            "liquidityData.originalShares": originalShares,
            "liquidityData.originalAllocatedAmount": originalAllocated,
            "liquidityData.entryPrice": entryPrice
          }
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        print(\`      ✅ Actualizado:\`);
        print(\`         Shares: \${formatNum(currentShares, 4)} → \${formatNum(distributionShares, 4)}\`);
        print(\`         Allocated: $\${formatNum(currentAllocated)} → $\${formatNum(distributionAllocated)}\`);
        totalUpdated++;
      } else {
        print(\`      ⚠️  No se pudo actualizar (puede que ya esté actualizado)\`);
      }
    }
    
    print("");
  });
  
  // También procesar distribuciones inactivas (vendidas completamente)
  const inactiveDistributions = distributions.filter(d => 
    !d.isActive || toNumber(d.shares) === 0
  );
  
  if (inactiveDistributions.length > 0) {
    print(\`   📋 Procesando \${inactiveDistributions.length} distribución(es) inactiva(s) (vendidas completamente):\`);
    print("");
    
    inactiveDistributions.forEach(function(dist, index) {
      const alertId = dist.alertId;
      const symbol = dist.symbol;
      const soldShares = toNumber(dist.soldShares) || 0;
      const realizedProfit = toNumber(dist.realizedProfitLoss) || 0;
      
      print(\`      \${index + 1}. \${symbol} (AlertId: \${alertId}):\`);
      print(\`         Vendido completamente - Sold Shares: \${formatNum(soldShares, 4)}, Realized P&L: $\${formatNum(realizedProfit)}\`);
      
      // Verificar que la alerta tenga shares = 0
      const alert = db.alerts.findOne({ _id: alertId });
      if (alert) {
        const currentShares = toNumber(alert.liquidityData?.shares) || 0;
        const currentAllocated = toNumber(alert.liquidityData?.allocatedAmount) || 0;
        
        if (currentShares > 0.0001 || currentAllocated > 0.01) {
          print(\`         ⚠️  Alerta tiene shares/allocated > 0, actualizando a 0:\`);
          print(\`            Shares: \${formatNum(currentShares, 4)} → 0.0000\`);
          print(\`            Allocated: $\${formatNum(currentAllocated)} → $0.00\`);
          
          db.alerts.updateOne(
            { _id: alertId },
            {
              $set: {
                "liquidityData.shares": 0,
                "liquidityData.allocatedAmount": 0
              }
            }
          );
          totalUpdated++;
        } else {
          print(\`         ✅ Ya está sincronizado (shares = 0)\`);
        }
      }
      print("");
    });
  }
});

print("=".repeat(80));
print("🎉 SINCRONIZACIÓN COMPLETADA");
print("=".repeat(80));
print("");
print(\`✅ Alertas actualizadas: \${totalUpdated}\`);
print(\`⚠️  Errores encontrados: \${totalErrors}\`);
print("");
print("📊 RESUMEN:");
print("   - Se sincronizaron los valores de liquidityData en las alertas");
print("   - Se actualizaron shares y allocatedAmount para coincidir con las distribuciones");
print("   - Se mantuvieron los valores de originalShares y originalAllocatedAmount");
print("");
`);



