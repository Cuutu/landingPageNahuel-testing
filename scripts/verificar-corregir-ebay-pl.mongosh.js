// ============================================
// VERIFICACIÓN Y CORRECCIÓN: EBAY - P&L incorrecto
// Este script verifica y corrige el P&L de EBAY cuando está en negativo
// pero el precio actual es mayor que el precio de entrada
// ============================================

// ⚠️ MODO DRY RUN: Cambiar a false para aplicar cambios reales
const DRY_RUN = false;

print('🔍 VERIFICACIÓN Y CORRECCIÓN - EBAY P&L\n');
if (DRY_RUN) {
  print('⚠️  MODO DRY RUN - No se aplicarán cambios reales\n');
}
print('='.repeat(80));

const symbol = 'EBAY';
const pool = 'TraderCall';

// 1. Buscar la alerta de EBAY
const alert = db.alerts.findOne({    
  symbol: symbol,
  status: { $in: ['ACTIVE', 'CLOSED'] }
});

if (!alert) {
  print(`❌ No se encontró alerta para ${symbol}`);
  quit();
}

const alertId = alert._id;
const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || 0;
const currentPrice = alert.currentPrice || 0;
const action = alert.action || 'BUY';

print(`✅ Alerta encontrada:`);
print(`   ID: ${alertId}`);
print(`   Symbol: ${alert.symbol}`);
print(`   Action: ${action}`);
print(`   Status: ${alert.status}`);
print(`   Entry Price: $${entryPrice}`);
print(`   Current Price: $${currentPrice}`);
print(`   Profit (alerta): ${(alert.profit || 0).toFixed(2)}%`);

// 2. Buscar distribución de liquidez
const liquidity = db.liquidities.findOne({ 
  pool: pool,
  'distributions.alertId': alertId.toString()
});

if (!liquidity) {
  print(`\n❌ No se encontró documento de liquidez para ${pool}`);
  quit();
}

const distribution = liquidity.distributions.find((d) => {
  return d.alertId && d.alertId.toString() === alertId.toString();
});

if (!distribution) {
  print(`\n❌ No se encontró distribución para esta alerta`);
  quit();
}

print(`\n💰 DISTRIBUCIÓN ACTUAL:`);
print(`   Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}`);
print(`   Current Price: $${(distribution.currentPrice || 0).toFixed(2)}`);
print(`   Profit Loss %: ${(distribution.profitLossPercentage || 0).toFixed(2)}%`);
print(`   Profit Loss $: $${(distribution.profitLoss || 0).toFixed(2)}`);
print(`   Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
print(`   Shares: ${(distribution.shares || 0).toFixed(4)}`);

// 3. Verificar si la acción es correcta (debería ser BUY, no SELL)
const shouldBeBUY = action === 'SELL'; // Si es SELL, debería ser BUY
const correctAction = shouldBeBUY ? 'BUY' : action;

// 3. Calcular P&L correcto (siempre como BUY)
const distEntryPrice = distribution.entryPrice || entryPrice;
const distCurrentPrice = distribution.currentPrice || currentPrice;

// Para BUY: P&L = ((currentPrice - entryPrice) / entryPrice) * 100
// Siempre calcular como BUY porque no tenemos alertas SELL
let correctPLPercentage = 0;
if (distEntryPrice > 0) {
  correctPLPercentage = ((distCurrentPrice - distEntryPrice) / distEntryPrice) * 100;
}

// Calcular P&L en dólares
const correctPL = (correctPLPercentage / 100) * (distribution.allocatedAmount || 0);

// Calcular profit correcto para la alerta (siempre como BUY)
let correctAlertProfit = 0;
if (entryPrice > 0) {
  correctAlertProfit = ((currentPrice - entryPrice) / entryPrice) * 100;
}

print(`\n📊 CÁLCULOS:`);
print(`   Precio entrada (dist): $${distEntryPrice.toFixed(2)}`);
print(`   Precio actual (dist): $${distCurrentPrice.toFixed(2)}`);
print(`   Precio entrada (alerta): $${entryPrice.toFixed(2)}`);
print(`   Precio actual (alerta): $${currentPrice.toFixed(2)}`);
print(`   Acción: ${action}`);
print(`   P&L % correcto (dist): ${correctPLPercentage.toFixed(2)}%`);
print(`   P&L $ correcto (dist): $${correctPL.toFixed(2)}`);
print(`   Profit % correcto (alerta): ${correctAlertProfit.toFixed(2)}%`);

// 4. Verificar si hay problema
const currentPLPercentage = distribution.profitLossPercentage || 0;
const currentAlertProfit = alert.profit || 0;
const difference = Math.abs(currentPLPercentage - correctPLPercentage);
const alertDifference = Math.abs(currentAlertProfit - correctAlertProfit);
const hasProblem = shouldBeBUY || // Si la acción es SELL, hay problema
  difference > 0.01 || 
  alertDifference > 0.01 || 
  (correctPLPercentage > 0 && currentPLPercentage < 0) || 
  (correctPLPercentage < 0 && currentPLPercentage > 0) ||
  (correctAlertProfit > 0 && currentAlertProfit < 0) ||
  (correctAlertProfit < 0 && currentAlertProfit > 0);

print(`\n🔍 VERIFICACIÓN:`);
print(`   P&L % actual (dist): ${currentPLPercentage.toFixed(2)}%`);
print(`   P&L % correcto (dist): ${correctPLPercentage.toFixed(2)}%`);
print(`   Diferencia (dist): ${difference.toFixed(2)}%`);
print(`   Profit % actual (alerta): ${currentAlertProfit.toFixed(2)}%`);
print(`   Profit % correcto (alerta): ${correctAlertProfit.toFixed(2)}%`);
print(`   Diferencia (alerta): ${alertDifference.toFixed(2)}%`);
print(`   ¿Hay problema?: ${hasProblem ? '❌ SÍ' : '✅ NO'}`);

if (!hasProblem) {
  print(`\n✅ El P&L ya está correcto. No se necesita corrección.`);
  quit();
}

// 5. Mostrar resumen del problema
print(`\n⚠️  PROBLEMA DETECTADO:`);
if (shouldBeBUY) {
  print(`   ❌ La alerta está marcada como SELL, pero debería ser BUY.`);
  print(`   El precio actual ($${distCurrentPrice.toFixed(2)}) es MAYOR que el precio de entrada ($${distEntryPrice.toFixed(2)})`);
  print(`   Para una operación BUY, el P&L debería ser POSITIVO (+${correctPLPercentage.toFixed(2)}%), pero está calculado como SELL (${currentPLPercentage.toFixed(2)}%).`);
} else if (distCurrentPrice > distEntryPrice && action === 'BUY' && currentPLPercentage < 0) {
  print(`   El precio actual ($${distCurrentPrice.toFixed(2)}) es MAYOR que el precio de entrada ($${distEntryPrice.toFixed(2)})`);
  print(`   Para una operación BUY, el P&L debería ser POSITIVO, pero está en NEGATIVO.`);
} else if (distCurrentPrice < distEntryPrice && action === 'BUY' && currentPLPercentage > 0) {
  print(`   El precio actual ($${distCurrentPrice.toFixed(2)}) es MENOR que el precio de entrada ($${distEntryPrice.toFixed(2)})`);
  print(`   Para una operación BUY, el P&L debería ser NEGATIVO, pero está en POSITIVO.`);
} else {
  print(`   Los valores de P&L no coinciden con los precios actuales.`);
  print(`   Acción: ${action}, Precio entrada: $${distEntryPrice.toFixed(2)}, Precio actual: $${distCurrentPrice.toFixed(2)}`);
  print(`   P&L actual: ${currentPLPercentage.toFixed(2)}%, P&L correcto: ${correctPLPercentage.toFixed(2)}%`);
}

// 6. Mostrar cambios propuestos
if (DRY_RUN) {
  print(`\n📋 CAMBIOS PROPUESTOS (DRY RUN):`);
} else {
  print(`\n🔄 CORRIGIENDO VALORES...`);
}

if (shouldBeBUY) {
  print(`\n   ALERTA (cambiar acción):`);
  print(`   - action: ${action} → ${correctAction}`);
}
print(`\n   DISTRIBUCIÓN:`);
print(`   - currentPrice: $${(distribution.currentPrice || 0).toFixed(2)} → $${distCurrentPrice.toFixed(2)}`);
print(`   - profitLossPercentage: ${(distribution.profitLossPercentage || 0).toFixed(2)}% → ${correctPLPercentage.toFixed(2)}%`);
print(`   - profitLoss: $${(distribution.profitLoss || 0).toFixed(2)} → $${correctPL.toFixed(2)}`);
print(`\n   ALERTA:`);
print(`   - currentPrice: $${currentPrice.toFixed(2)} (ya está actualizado)`);
if (shouldBeBUY) {
  print(`   - action: ${action} → ${correctAction}`);
}
print(`   - profit: ${currentAlertProfit.toFixed(2)}% → ${correctAlertProfit.toFixed(2)}%`);

if (DRY_RUN) {
  print(`\n⚠️  DRY RUN: Los cambios anteriores NO se aplicarán.`);
  print(`   Para aplicar los cambios, cambia DRY_RUN a false en el script.`);
} else {
  // Actualizar distribución
  const result1 = db.liquidities.updateOne(
  { 
    _id: liquidity._id,
    'distributions.alertId': alertId.toString()
  },
    {
      $set: {
        'distributions.$.currentPrice': distCurrentPrice,
        'distributions.$.profitLossPercentage': correctPLPercentage,
        'distributions.$.profitLoss': correctPL,
        'distributions.$.updatedAt': new Date()
      }
    }
  );

  if (result1.modifiedCount > 0) {
    print(`✅ Distribución actualizada exitosamente (método 1)`);
  } else {
    print(`⚠️  Método 1 no funcionó. Intentando método alternativo...`);
    
    // Método alternativo: actualizar el array completo
    const distributionIndex = liquidity.distributions.findIndex((d) => {
      return d.alertId && d.alertId.toString() === alertId.toString();
    });
    
    if (distributionIndex >= 0) {
      const updatedDistributions = liquidity.distributions.map((dist, idx) => {
        if (idx === distributionIndex) {
          return {
            ...dist,
            currentPrice: distCurrentPrice,
            profitLossPercentage: correctPLPercentage,
            profitLoss: correctPL,
            updatedAt: new Date()
          };
        }
        return dist;
      });
      
      const result2 = db.liquidities.updateOne(
        { _id: liquidity._id },
        {
          $set: {
            distributions: updatedDistributions
          }
        }
      );
      
      if (result2.modifiedCount > 0) {
        print(`✅ Distribución actualizada exitosamente (método 2)`);
      } else {
        print(`❌ Error: No se pudo actualizar con ningún método`);
        print(`\n💡 Intenta ejecutar manualmente:`);
        print(`\ndb.liquidities.updateOne(`);
        print(`  { _id: ObjectId("${liquidity._id}"), 'distributions.alertId': '${alertId.toString()}' },`);
        print(`  {`);
        print(`    $set: {`);
        print(`      'distributions.$.currentPrice': ${distCurrentPrice},`);
        print(`      'distributions.$.profitLossPercentage': ${correctPLPercentage},`);
        print(`      'distributions.$.profitLoss': ${correctPL},`);
        print(`      'distributions.$.updatedAt': new Date()`);
        print(`    }`);
        print(`  }`);
        print(`);`);
      }
    } else {
      print(`❌ No se encontró el índice de la distribución`);
    }
  }

  // Actualizar el campo profit y action de la alerta (lo que se muestra en la UI)
  print(`\n🔄 Actualizando alerta...`);
  const alertUpdateFields = {
    profit: correctAlertProfit,
    currentPrice: currentPrice, // Asegurar que el precio actual esté actualizado
    updatedAt: new Date()
  };
  
  // Si la acción es SELL, cambiarla a BUY
  if (shouldBeBUY) {
    alertUpdateFields.action = 'BUY';
    print(`   - Cambiando action: ${action} → BUY`);
  }
  
  const alertUpdateResult = db.alerts.updateOne(
    { _id: alertId },
    {
      $set: alertUpdateFields
    }
  );

  if (alertUpdateResult.modifiedCount > 0) {
    if (shouldBeBUY) {
      print(`✅ Alerta actualizada: action cambiado a BUY, profit actualizado: ${currentAlertProfit.toFixed(2)}% → ${correctAlertProfit.toFixed(2)}%`);
    } else {
      print(`✅ Campo profit de la alerta actualizado: ${currentAlertProfit.toFixed(2)}% → ${correctAlertProfit.toFixed(2)}%`);
    }
  } else {
    print(`⚠️  No se pudo actualizar la alerta (puede que ya esté correcto)`);
  }
}

// 7. Recalcular totalProfitLoss de la liquidez
if (DRY_RUN) {
  print(`\n📋 CAMBIOS PROPUESTOS PARA totalProfitLoss (DRY RUN):`);
} else {
  print(`\n🔄 Recalculando totalProfitLoss de la liquidez...`);
}

// Simular los cambios para calcular el nuevo totalProfitLoss
const simulatedDistributions = liquidity.distributions.map((dist) => {
  if (dist.alertId && dist.alertId.toString() === alertId.toString()) {
    return {
      ...dist,
      currentPrice: distCurrentPrice,
      profitLossPercentage: correctPLPercentage,
      profitLoss: correctPL
    };
  }
  return dist;
});

// Calcular totalProfitLoss manualmente con los valores simulados
let totalUnrealizedPL = 0;
let totalRealizedPL = 0;
simulatedDistributions.forEach((dist) => {
  totalUnrealizedPL += dist.profitLoss || 0;
  totalRealizedPL += dist.realizedProfitLoss || 0;
});
const newTotalProfitLoss = totalUnrealizedPL + totalRealizedPL;
const distributedLiquidity = simulatedDistributions
  .filter((dist) => dist.isActive && dist.shares > 0)
  .reduce((sum, dist) => sum + (dist.allocatedAmount || 0), 0);
const newTotalProfitLossPercentage = distributedLiquidity > 0
  ? (newTotalProfitLoss / distributedLiquidity) * 100
  : 0;

print(`   - totalProfitLoss: $${(liquidity.totalProfitLoss || 0).toFixed(2)} → $${newTotalProfitLoss.toFixed(2)}`);
print(`   - totalProfitLossPercentage: ${(liquidity.totalProfitLossPercentage || 0).toFixed(2)}% → ${newTotalProfitLossPercentage.toFixed(2)}%`);

if (!DRY_RUN) {
  const result3 = db.liquidities.updateOne(
    { _id: liquidity._id },
    {
      $set: {
        totalProfitLoss: newTotalProfitLoss,
        totalProfitLossPercentage: newTotalProfitLossPercentage,
        updatedAt: new Date()
      }
    }
  );

  if (result3.modifiedCount > 0) {
    print(`✅ TotalProfitLoss actualizado`);
  } else {
    print(`⚠️  No se pudo actualizar totalProfitLoss (puede que ya esté correcto)`);
  }
} else {
  print(`\n⚠️  DRY RUN: Los cambios anteriores NO se aplicarán.`);
}

// 8. Resumen final
if (DRY_RUN) {
  print(`\n📋 RESUMEN DE CAMBIOS PROPUESTOS:`);
  print(`   Si se aplican estos cambios:`);
  print(`\n   DISTRIBUCIÓN:`);
  print(`   - Entry Price: $${distEntryPrice.toFixed(2)}`);
  print(`   - Current Price: $${distCurrentPrice.toFixed(2)}`);
  print(`   - Profit Loss %: ${correctPLPercentage.toFixed(2)}% (actualmente: ${(distribution.profitLossPercentage || 0).toFixed(2)}%)`);
  print(`   - Profit Loss $: $${correctPL.toFixed(2)} (actualmente: $${(distribution.profitLoss || 0).toFixed(2)})`);
  print(`\n   ALERTA (lo que se muestra en la UI):`);
  if (shouldBeBUY) {
    print(`   - Action: ${action} → BUY`);
  }
  print(`   - Current Price: $${currentPrice.toFixed(2)}`);
  print(`   - Profit: ${correctAlertProfit.toFixed(2)}% (actualmente: ${currentAlertProfit.toFixed(2)}%)`);
  print(`\n⚠️  Para aplicar estos cambios, cambia DRY_RUN a false en el script.`);
} else {
  print(`\n🔍 VERIFICANDO RESULTADO FINAL...`);
  const finalLiquidity = db.liquidities.findOne({ _id: liquidity._id });
  const finalDistribution = finalLiquidity.distributions.find((d) => {
    return d.alertId && d.alertId.toString() === alertId.toString();
  });
  const finalAlert = db.alerts.findOne({ _id: alertId });

  if (finalDistribution && finalAlert) {
    print(`\n✅ DISTRIBUCIÓN FINAL:`);
    print(`   Entry Price: $${(finalDistribution.entryPrice || 0).toFixed(2)}`);
    print(`   Current Price: $${(finalDistribution.currentPrice || 0).toFixed(2)}`);
    print(`   Profit Loss %: ${(finalDistribution.profitLossPercentage || 0).toFixed(2)}%`);
    print(`   Profit Loss $: $${(finalDistribution.profitLoss || 0).toFixed(2)}`);
    
    print(`\n✅ ALERTA FINAL:`);
    print(`   Action: ${finalAlert.action || action}`);
    print(`   Current Price: $${(finalAlert.currentPrice || 0).toFixed(2)}`);
    print(`   Profit: ${(finalAlert.profit || 0).toFixed(2)}%`);
    
    const finalPLCorrect = Math.abs((finalDistribution.profitLossPercentage || 0) - correctPLPercentage) < 0.01;
    const finalAlertProfitCorrect = Math.abs((finalAlert.profit || 0) - correctAlertProfit) < 0.01;
    const finalActionCorrect = finalAlert.action === 'BUY';
    
    if (finalPLCorrect && finalAlertProfitCorrect && finalActionCorrect) {
      print(`\n✅ ¡Todo correcto! El P&L ahora muestra:`);
      print(`   - Action: ${finalAlert.action} (debería ser BUY)`);
      print(`   - Distribución: ${(finalDistribution.profitLossPercentage || 0).toFixed(2)}% (debería ser ${correctPLPercentage.toFixed(2)}%)`);
      print(`   - Alerta (UI): ${(finalAlert.profit || 0).toFixed(2)}% (debería ser ${correctAlertProfit.toFixed(2)}%)`);
      print(`   - La interfaz debería mostrar el valor correcto ahora.`);
    } else {
      print(`\n⚠️  Aún hay discrepancias. Revisa manualmente.`);
      if (!finalActionCorrect) {
        print(`   - Action: ${finalAlert.action} vs BUY esperado`);
      }
      if (!finalPLCorrect) {
        print(`   - Distribución: ${(finalDistribution.profitLossPercentage || 0).toFixed(2)}% vs ${correctPLPercentage.toFixed(2)}% esperado`);
      }
      if (!finalAlertProfitCorrect) {
        print(`   - Alerta: ${(finalAlert.profit || 0).toFixed(2)}% vs ${correctAlertProfit.toFixed(2)}% esperado`);
      }
    }
  }
}

print(`\n${'='.repeat(80)}`);
print('✅ Proceso completado');
print('='.repeat(80));
