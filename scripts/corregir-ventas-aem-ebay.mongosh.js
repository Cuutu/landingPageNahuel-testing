// ============================================
// CORRECCIÓN: Sincronizar ventas de AEM y EBAY
// Este script corrige discrepancias entre:
// - participationPercentage
// - liquidityData.shares
// - liquidityData.allocatedAmount
// - Operaciones registradas
// ============================================
//
// ⚠️ IMPORTANTE: Ejecutar primero verificar-ventas-aem-ebay.mongosh.js
// para identificar las discrepancias antes de corregir
//
// ============================================

print('🔧 CORRECCIÓN DE VENTAS - AEM y EBAY\n');
print('='.repeat(80));
print('⚠️  ADVERTENCIA: Este script modificará datos en la base de datos');
print('⚠️  Se recomienda hacer un backup antes de continuar');
print('='.repeat(80));

// Función para formatear fechas
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toISOString().split('T')[0] + ' ' + new Date(date).toISOString().split('T')[1].substring(0, 5);
}

// Función para corregir una alerta
function correctAlert(symbol, dryRun = true) {
  print(`\n${'='.repeat(80)}`);
  print(`🔧 ${dryRun ? '[DRY RUN] ' : ''}CORRIGIENDO: ${symbol}`);
  print('='.repeat(80));
  
  // 1. Buscar la alerta
  const alert = db.alerts.findOne({ 
    symbol: symbol,
    status: { $in: ['ACTIVE', 'CLOSED'] }
  });
  
  if (!alert) {
    print(`❌ No se encontró alerta para ${symbol}`);
    return null;
  }
  
  const alertId = alert._id;
  const pool = alert.tipo || 'TraderCall';
  const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || 0;
  
  print(`\n✅ Alerta encontrada:`);
  print(`   ID: ${alertId}`);
  print(`   Status: ${alert.status}`);
  print(`   Pool: ${pool}`);
  print(`   Entry Price: $${entryPrice}`);
  
  // 2. Obtener datos originales
  const liquidityData = alert.liquidityData || {};
  const originalShares = liquidityData.originalShares || 0;
  const originalAllocatedAmount = liquidityData.originalAllocatedAmount || 0;
  const originalParticipation = alert.originalParticipationPercentage || 100;
  const partialSales = liquidityData.partialSales || [];
  
  print(`\n📊 DATOS ORIGINALES:`);
  print(`   Shares originales: ${originalShares.toFixed(4)}`);
  print(`   Monto original: $${originalAllocatedAmount.toFixed(2)}`);
  print(`   Participación original: ${originalParticipation}%`);
  
  // 3. Calcular desde ventas parciales ejecutadas
  let totalSharesSold = 0;
  let totalPercentageSold = 0;
  let totalLiquidityReleased = 0;
  let totalRealizedProfit = 0;
  let executedSalesCount = 0;
  
  print(`\n📋 ANALIZANDO VENTAS PARCIALES:`);
  partialSales.forEach((sale, idx) => {
    const executed = sale.executed === true && !sale.discarded;
    
    if (executed) {
      executedSalesCount++;
      totalSharesSold += sale.sharesToSell || 0;
      totalPercentageSold += sale.percentage || 0;
      totalLiquidityReleased += sale.liquidityReleased || 0;
      totalRealizedProfit += sale.realizedProfit || 0;
      
      print(`   ✅ Venta ${idx + 1}: ${sale.percentage || 0}% - ${(sale.sharesToSell || 0).toFixed(4)} shares - $${(sale.liquidityReleased || 0).toFixed(2)}`);
    } else {
      print(`   ⏳ Venta ${idx + 1}: ${sale.discarded ? 'DESCARTADA' : 'PENDIENTE'} - ${sale.percentage || 0}%`);
    }
  });
  
  print(`\n📊 RESUMEN DE VENTAS EJECUTADAS:`);
  print(`   Total ventas ejecutadas: ${executedSalesCount}`);
  print(`   Total % vendido: ${totalPercentageSold.toFixed(2)}%`);
  print(`   Total shares vendidas: ${totalSharesSold.toFixed(4)}`);
  print(`   Total liquidez liberada: $${totalLiquidityReleased.toFixed(2)}`);
  
  // 4. Calcular valores correctos
  const newShares = Math.max(0, originalShares - totalSharesSold);
  const newAllocatedAmount = Math.max(0, newShares * entryPrice);
  const newParticipation = Math.max(0, originalParticipation - totalPercentageSold);
  
  // 5. Obtener valores actuales
  const currentShares = liquidityData.shares || 0;
  const currentAllocatedAmount = liquidityData.allocatedAmount || 0;
  const currentParticipation = alert.participationPercentage || 0;
  
  print(`\n📊 VALORES ACTUALES vs CORRECTOS:`);
  print(`   Participation:`);
  print(`     Actual: ${currentParticipation}%`);
  print(`     Correcto: ${newParticipation.toFixed(2)}%`);
  print(`     Diferencia: ${(newParticipation - currentParticipation).toFixed(2)}%`);
  
  print(`   Shares:`);
  print(`     Actual: ${currentShares.toFixed(4)}`);
  print(`     Correcto: ${newShares.toFixed(4)}`);
  print(`     Diferencia: ${(newShares - currentShares).toFixed(4)}`);
  
  print(`   Allocated Amount:`);
  print(`     Actual: $${currentAllocatedAmount.toFixed(2)}`);
  print(`     Correcto: $${newAllocatedAmount.toFixed(2)}`);
  print(`     Diferencia: $${(newAllocatedAmount - currentAllocatedAmount).toFixed(2)}`);
  
  // 6. Verificar si hay diferencias
  const hasDifferences = 
    Math.abs(newParticipation - currentParticipation) > 0.01 ||
    Math.abs(newShares - currentShares) > 0.0001 ||
    Math.abs(newAllocatedAmount - currentAllocatedAmount) > 0.01;
  
  if (!hasDifferences) {
    print(`\n✅ No hay discrepancias. Los valores ya están correctos.`);
    return {
      symbol,
      corrected: false,
      reason: 'No hay discrepancias'
    };
  }
  
  // 7. Verificar operaciones
  const saleOperations = db.operations.find({
    ticker: symbol,
    operationType: 'VENTA',
    system: pool
  }).sort({ date: 1 }).toArray();
  
  let totalSharesInOperations = 0;
  saleOperations.forEach(op => {
    totalSharesInOperations += Math.abs(op.quantity || 0);
  });
  
  print(`\n📋 OPERACIONES DE VENTA:`);
  print(`   Total operaciones: ${saleOperations.length}`);
  print(`   Total shares en operaciones: ${totalSharesInOperations.toFixed(4)}`);
  print(`   Total shares en ventas parciales: ${totalSharesSold.toFixed(4)}`);
  
  if (Math.abs(totalSharesInOperations - totalSharesSold) > 0.0001) {
    print(`   ⚠️  DISCREPANCIA: Las operaciones no coinciden con las ventas parciales`);
    print(`      Diferencia: ${(totalSharesInOperations - totalSharesSold).toFixed(4)} shares`);
  } else {
    print(`   ✅ Las operaciones coinciden con las ventas parciales`);
  }
  
  // 8. Verificar y corregir distribución de liquidez
  const liquidity = db.liquidities.findOne({ 
    pool: pool,
    'distributions.alertId': alertId.toString()
  });
  
  let liquidityDistributionNeedsUpdate = false;
  let liquidityChanges = null;
  
  if (liquidity) {
    const distribution = liquidity.distributions.find((d) => {
      return d.alertId && d.alertId.toString() === alertId.toString();
    });
    
    if (distribution) {
      const distCurrentShares = distribution.shares || 0;
      const distSoldShares = distribution.soldShares || 0;
      const distTotalShares = distCurrentShares + distSoldShares;
      
      print(`\n💰 DISTRIBUCIÓN DE LIQUIDEZ ACTUAL:`);
      print(`   Shares actuales: ${distCurrentShares.toFixed(4)}`);
      print(`   Shares vendidas (soldShares): ${distSoldShares.toFixed(4)}`);
      print(`   Shares totales (actuales + vendidas): ${distTotalShares.toFixed(4)}`);
      print(`   Shares originales en alerta: ${originalShares.toFixed(4)}`);
      print(`   Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
      
      // Verificar si la distribución necesita actualización
      // Comparar con los valores correctos calculados desde las ventas parciales
      const sharesNeedUpdate = Math.abs(distCurrentShares - newShares) > 0.0001;
      const soldSharesNeedUpdate = Math.abs(distSoldShares - totalSharesSold) > 0.0001;
      const allocatedNeedUpdate = Math.abs((distribution.allocatedAmount || 0) - newAllocatedAmount) > 0.01;
      
      if (sharesNeedUpdate || soldSharesNeedUpdate || allocatedNeedUpdate) {
        liquidityDistributionNeedsUpdate = true;
        liquidityChanges = {
          shares: { from: distCurrentShares, to: newShares },
          soldShares: { from: distSoldShares, to: totalSharesSold },
          allocatedAmount: { 
            from: distribution.allocatedAmount || 0, 
            to: newAllocatedAmount 
          }
        };
        
        print(`\n   ⚠️  DISCREPANCIAS ENCONTRADAS:`);
        if (sharesNeedUpdate) {
          print(`      - Shares: ${distCurrentShares.toFixed(4)} → ${newShares.toFixed(4)} (diferencia: ${(newShares - distCurrentShares).toFixed(4)})`);
        }
        if (soldSharesNeedUpdate) {
          print(`      - SoldShares: ${distSoldShares.toFixed(4)} → ${totalSharesSold.toFixed(4)} (diferencia: ${(totalSharesSold - distSoldShares).toFixed(4)})`);
        }
        if (allocatedNeedUpdate) {
          print(`      - AllocatedAmount: $${(distribution.allocatedAmount || 0).toFixed(2)} → $${newAllocatedAmount.toFixed(2)} (diferencia: $${(newAllocatedAmount - (distribution.allocatedAmount || 0)).toFixed(2)})`);
        }
      } else {
        print(`\n   ✅ La distribución de liquidez está correcta`);
      }
    } else {
      print(`\n   ⚠️  No se encontró distribución para esta alerta en el documento de liquidez`);
    }
  } else {
    print(`\n   ⚠️  No se encontró documento de liquidez para el pool ${pool}`);
  }
  
  // 9. Aplicar corrección
  if (dryRun) {
    print(`\n🔍 [DRY RUN] Se aplicarían los siguientes cambios:`);
    print(`\n   📊 ALERTA:`);
    print(`   - participationPercentage: ${currentParticipation}% → ${newParticipation.toFixed(2)}%`);
    print(`   - liquidityData.shares: ${currentShares.toFixed(4)} → ${newShares.toFixed(4)}`);
    print(`   - liquidityData.allocatedAmount: $${currentAllocatedAmount.toFixed(2)} → $${newAllocatedAmount.toFixed(2)}`);
    
    if (newParticipation <= 0 && alert.status !== 'CLOSED') {
      print(`   - status: ${alert.status} → CLOSED`);
    }
    
    if (liquidityDistributionNeedsUpdate && liquidityChanges) {
      print(`\n   💰 DISTRIBUCIÓN DE LIQUIDEZ:`);
      print(`   - shares: ${liquidityChanges.shares.from.toFixed(4)} → ${liquidityChanges.shares.to.toFixed(4)}`);
      print(`   - soldShares: ${liquidityChanges.soldShares.from.toFixed(4)} → ${liquidityChanges.soldShares.to.toFixed(4)}`);
      print(`   - allocatedAmount: $${liquidityChanges.allocatedAmount.from.toFixed(2)} → $${liquidityChanges.allocatedAmount.to.toFixed(2)}`);
    } else if (liquidity) {
      print(`\n   💰 DISTRIBUCIÓN DE LIQUIDEZ: ✅ Ya está correcta`);
    }
    
    return {
      symbol,
      corrected: false,
      dryRun: true,
      changes: {
        participationPercentage: { from: currentParticipation, to: newParticipation },
        shares: { from: currentShares, to: newShares },
        allocatedAmount: { from: currentAllocatedAmount, to: newAllocatedAmount }
      },
      liquidityChanges: liquidityChanges
    };
  } else {
    print(`\n🔄 Aplicando correcciones...`);
    
    const updateData = {
      participationPercentage: newParticipation,
      'liquidityData.shares': newShares,
      'liquidityData.allocatedAmount': newAllocatedAmount
    };
    
    // Si la participación es 0 o negativa, cerrar la alerta
    if (newParticipation <= 0 && alert.status !== 'CLOSED') {
      updateData.status = 'CLOSED';
      updateData.exitPrice = alert.currentPrice || entryPrice;
      updateData.exitDate = new Date();
      updateData.exitReason = 'MANUAL';
      print(`   - Cerrando alerta (participación = 0%)`);
    }
    
    const result = db.alerts.updateOne(
      { _id: alertId },
      { $set: updateData }
    );
    
    if (result.modifiedCount > 0) {
      print(`✅ Corrección aplicada exitosamente en la alerta`);
      print(`   - participationPercentage actualizado`);
      print(`   - liquidityData.shares actualizado`);
      print(`   - liquidityData.allocatedAmount actualizado`);
    } else {
      print(`⚠️  No se pudo actualizar la alerta (puede que ya esté actualizada)`);
    }
    
    // Actualizar distribución de liquidez si es necesario
    if (liquidityDistributionNeedsUpdate && liquidity) {
      const distributionIndex = liquidity.distributions.findIndex((d) => {
        return d.alertId && d.alertId.toString() === alertId.toString();
      });
      
      if (distributionIndex >= 0) {
        const distEntryPrice = liquidity.distributions[distributionIndex].entryPrice || entryPrice;
        
        // ✅ MEJORADO: Usar $ para actualizar el elemento del array que coincida con alertId
        const distUpdateResult = db.liquidities.updateOne(
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
        
        if (distUpdateResult.modifiedCount > 0) {
          print(`✅ Distribución de liquidez actualizada`);
          print(`   - shares: ${liquidityChanges.shares.from.toFixed(4)} → ${liquidityChanges.shares.to.toFixed(4)}`);
          print(`   - soldShares: ${liquidityChanges.soldShares.from.toFixed(4)} → ${liquidityChanges.soldShares.to.toFixed(4)}`);
          print(`   - allocatedAmount: $${liquidityChanges.allocatedAmount.from.toFixed(2)} → $${liquidityChanges.allocatedAmount.to.toFixed(2)}`);
        } else {
          print(`⚠️  No se pudo actualizar la distribución de liquidez`);
          print(`   Intentando método alternativo...`);
          
          // Método alternativo: actualizar el array completo
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
          
          const altUpdateResult = db.liquidities.updateOne(
            { _id: liquidity._id },
            {
              $set: {
                distributions: updatedDistributions
              }
            }
          );
          
          if (altUpdateResult.modifiedCount > 0) {
            print(`✅ Distribución de liquidez actualizada (método alternativo)`);
            print(`   - shares: ${liquidityChanges.shares.from.toFixed(4)} → ${liquidityChanges.shares.to.toFixed(4)}`);
            print(`   - soldShares: ${liquidityChanges.soldShares.from.toFixed(4)} → ${liquidityChanges.soldShares.to.toFixed(4)}`);
            print(`   - allocatedAmount: $${liquidityChanges.allocatedAmount.from.toFixed(2)} → $${liquidityChanges.allocatedAmount.to.toFixed(2)}`);
          } else {
            print(`❌ Error: No se pudo actualizar la distribución de liquidez con ningún método`);
          }
        }
      } else {
        print(`⚠️  No se encontró la distribución en el documento de liquidez`);
      }
    }
    
    return {
      symbol,
      corrected: result.modifiedCount > 0,
      changes: updateData,
      liquidityUpdated: liquidityDistributionNeedsUpdate
    };
  }
}

// ============================================
// CONFIGURACIÓN
// ============================================
// Cambiar a false para aplicar los cambios realmente
const DRY_RUN = false;

// ============================================
// EJECUCIÓN
// ============================================

if (DRY_RUN) {
  print('\n⚠️  MODO DRY RUN: No se aplicarán cambios reales');
  print('⚠️  Para aplicar cambios, cambiar DRY_RUN a false\n');
} else {
  print('\n🔴 MODO REAL: Se aplicarán cambios en la base de datos\n');
  print('¿Estás seguro? Revisa los cambios antes de continuar.\n');
}

// Corregir AEM
const aemResult = correctAlert('AEM', DRY_RUN);

// Corregir EBAY
const ebayResult = correctAlert('EBAY', DRY_RUN);

// Resumen
print(`\n${'='.repeat(80)}`);
print(`📊 RESUMEN DE CORRECCIÓN`);
print('='.repeat(80));

if (aemResult) {
  print(`\nAEM:`);
  if (aemResult.corrected) {
    print(`   ✅ Corregido exitosamente`);
  } else if (aemResult.dryRun) {
    print(`   🔍 [DRY RUN] Cambios propuestos:`);
    print(`      - participationPercentage: ${aemResult.changes.participationPercentage.from}% → ${aemResult.changes.participationPercentage.to.toFixed(2)}%`);
    print(`      - shares: ${aemResult.changes.shares.from.toFixed(4)} → ${aemResult.changes.shares.to.toFixed(4)}`);
    print(`      - allocatedAmount: $${aemResult.changes.allocatedAmount.from.toFixed(2)} → $${aemResult.changes.allocatedAmount.to.toFixed(2)}`);
  } else {
    print(`   ℹ️  ${aemResult.reason || 'No se aplicaron cambios'}`);
  }
}

if (ebayResult) {
  print(`\nEBAY:`);
  if (ebayResult.corrected) {
    print(`   ✅ Corregido exitosamente`);
  } else if (ebayResult.dryRun) {
    print(`   🔍 [DRY RUN] Cambios propuestos:`);
    print(`      - participationPercentage: ${ebayResult.changes.participationPercentage.from}% → ${ebayResult.changes.participationPercentage.to.toFixed(2)}%`);
    print(`      - shares: ${ebayResult.changes.shares.from.toFixed(4)} → ${ebayResult.changes.shares.to.toFixed(4)}`);
    print(`      - allocatedAmount: $${ebayResult.changes.allocatedAmount.from.toFixed(2)} → $${ebayResult.changes.allocatedAmount.to.toFixed(2)}`);
  } else {
    print(`   ℹ️  ${ebayResult.reason || 'No se aplicaron cambios'}`);
  }
}

if (DRY_RUN) {
  print(`\n⚠️  RECORDATORIO: Este fue un DRY RUN. No se aplicaron cambios reales.`);
  print(`⚠️  Para aplicar los cambios, editar el script y cambiar DRY_RUN a false.`);
}

print(`\n${'='.repeat(80)}`);
print('✅ Proceso completado');
print('='.repeat(80));
