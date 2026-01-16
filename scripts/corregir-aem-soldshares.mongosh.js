// ============================================
// CORRECCIÓN ESPECÍFICA: AEM - Actualizar soldShares en distribución
// Este script corrige específicamente el problema de soldShares en AEM
// ============================================

print('🔧 CORRECCIÓN ESPECÍFICA - AEM soldShares\n');
print('='.repeat(80));

const symbol = 'AEM';
const pool = 'TraderCall';

// 1. Buscar la alerta
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

print(`✅ Alerta encontrada:`);
print(`   ID: ${alertId}`);
print(`   Symbol: ${alert.symbol}`);
print(`   Entry Price: $${entryPrice}`);

// 2. Obtener datos de ventas parciales
const liquidityData = alert.liquidityData || {};
const originalShares = liquidityData.originalShares || 0;
const partialSales = liquidityData.partialSales || [];

print(`\n📊 DATOS DE VENTAS PARCIALES:`);
print(`   Shares originales: ${originalShares.toFixed(4)}`);

let totalSharesSold = 0;
let totalPercentageSold = 0;

partialSales.forEach((sale, idx) => {
  const executed = sale.executed === true && !sale.discarded;
  if (executed) {
    const shares = sale.sharesToSell || 0;
    const percentage = sale.percentage || 0;
    totalSharesSold += shares;
    totalPercentageSold += percentage;
    print(`   Venta ${idx + 1}: ${percentage}% - ${shares.toFixed(4)} shares`);
  }
});

print(`\n📊 RESUMEN:`);
print(`   Total shares vendidas: ${totalSharesSold.toFixed(4)}`);
print(`   Total % vendido: ${totalPercentageSold.toFixed(2)}%`);

// 3. Calcular valores correctos
const newShares = Math.max(0, originalShares - totalSharesSold);
const newAllocatedAmount = Math.max(0, newShares * entryPrice);

print(`\n📊 VALORES CORRECTOS:`);
print(`   Shares actuales: ${newShares.toFixed(4)}`);
print(`   SoldShares: ${totalSharesSold.toFixed(4)}`);
print(`   AllocatedAmount: $${newAllocatedAmount.toFixed(2)}`);

// 4. Buscar distribución de liquidez
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
print(`   Shares: ${(distribution.shares || 0).toFixed(4)}`);
print(`   SoldShares: ${(distribution.soldShares || 0).toFixed(4)}`);
print(`   AllocatedAmount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);

// 5. Verificar si necesita actualización
const needsUpdate = 
  Math.abs((distribution.shares || 0) - newShares) > 0.0001 ||
  Math.abs((distribution.soldShares || 0) - totalSharesSold) > 0.0001 ||
  Math.abs((distribution.allocatedAmount || 0) - newAllocatedAmount) > 0.01;

if (!needsUpdate) {
  print(`\n✅ La distribución ya está correcta. No se necesita actualización.`);
  quit();
}

print(`\n🔄 ACTUALIZANDO DISTRIBUCIÓN...`);

// 6. Intentar actualización con operador $
const result1 = db.liquidities.updateOne(
  { 
    _id: liquidity._id,
    'distributions.alertId': alertId.toString()
  },
  {
    $set: {
      'distributions.$.shares': newShares,
      'distributions.$.soldShares': totalSharesSold,
      'distributions.$.allocatedAmount': newAllocatedAmount,
      'distributions.$.isActive': newShares > 0.0001,
      'distributions.$.updatedAt': new Date()
    }
  }
);

if (result1.modifiedCount > 0) {
  print(`✅ Distribución actualizada exitosamente (método 1)`);
  print(`   - shares: ${(distribution.shares || 0).toFixed(4)} → ${newShares.toFixed(4)}`);
  print(`   - soldShares: ${(distribution.soldShares || 0).toFixed(4)} → ${totalSharesSold.toFixed(4)}`);
  print(`   - allocatedAmount: $${(distribution.allocatedAmount || 0).toFixed(2)} → $${newAllocatedAmount.toFixed(2)}`);
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
          shares: newShares,
          soldShares: totalSharesSold,
          allocatedAmount: newAllocatedAmount,
          isActive: newShares > 0.0001,
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
      print(`   - shares: ${(distribution.shares || 0).toFixed(4)} → ${newShares.toFixed(4)}`);
      print(`   - soldShares: ${(distribution.soldShares || 0).toFixed(4)} → ${totalSharesSold.toFixed(4)}`);
      print(`   - allocatedAmount: $${(distribution.allocatedAmount || 0).toFixed(2)} → $${newAllocatedAmount.toFixed(2)}`);
    } else {
      print(`❌ Error: No se pudo actualizar con ningún método`);
      print(`\n💡 Intenta ejecutar manualmente:`);
      print(`\ndb.liquidities.updateOne(`);
      print(`  { _id: ObjectId("${liquidity._id}"), 'distributions.alertId': '${alertId.toString()}' },`);
      print(`  {`);
      print(`    $set: {`);
      print(`      'distributions.$.shares': ${newShares},`);
      print(`      'distributions.$.soldShares': ${totalSharesSold},`);
      print(`      'distributions.$.allocatedAmount': ${newAllocatedAmount},`);
      print(`      'distributions.$.isActive': ${newShares > 0.0001},`);
      print(`      'distributions.$.updatedAt': new Date()`);
      print(`    }`);
      print(`  }`);
      print(`);`);
    }
  } else {
    print(`❌ No se encontró el índice de la distribución`);
  }
}

// 7. Verificar resultado
print(`\n🔍 VERIFICANDO RESULTADO...`);
const updatedLiquidity = db.liquidities.findOne({ _id: liquidity._id });
const updatedDistribution = updatedLiquidity.distributions.find((d) => {
  return d.alertId && d.alertId.toString() === alertId.toString();
});

if (updatedDistribution) {
  print(`\n✅ DISTRIBUCIÓN ACTUALIZADA:`);
  print(`   Shares: ${(updatedDistribution.shares || 0).toFixed(4)}`);
  print(`   SoldShares: ${(updatedDistribution.soldShares || 0).toFixed(4)}`);
  print(`   AllocatedAmount: $${(updatedDistribution.allocatedAmount || 0).toFixed(2)}`);
  
  const sharesCorrect = Math.abs((updatedDistribution.shares || 0) - newShares) < 0.0001;
  const soldSharesCorrect = Math.abs((updatedDistribution.soldShares || 0) - totalSharesSold) < 0.0001;
  
  if (sharesCorrect && soldSharesCorrect) {
    print(`\n✅ ¡Todo correcto! La interfaz debería mostrar:`);
    print(`   - Shares actuales: ${(updatedDistribution.shares || 0).toFixed(4)}`);
    print(`   - SoldShares: ${(updatedDistribution.soldShares || 0).toFixed(4)}`);
    print(`   - % vendido: ${((updatedDistribution.soldShares || 0) / originalShares * 100).toFixed(2)}%`);
  } else {
    print(`\n⚠️  Aún hay discrepancias. Revisa manualmente.`);
  }
}

print(`\n${'='.repeat(80)}`);
print('✅ Proceso completado');
print('='.repeat(80));
