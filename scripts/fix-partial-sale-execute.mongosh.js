/**
 * EJECUTAR - Corregir venta parcial incorrecta
 * 
 * INSTRUCCIONES:
 * 1. PRIMERO ejecuta fix-partial-sale-dryrun.mongosh.js para verificar los cambios
 * 2. Cambia SYMBOL por el símbolo de la alerta (ej: "INTC")
 * 3. Cambia EXPECTED_PERCENTAGE por el porcentaje que se intentó vender (ej: 50)
 * 4. Cambia ACTUAL_PERCENTAGE por el porcentaje que realmente se vendió (ej: 25)
 * 5. Copia y pega este script en mongosh
 * 
 * ⚠️ ADVERTENCIA: Este script MODIFICA la base de datos
 */

print('🔄 EJECUTANDO - Corregir venta parcial incorrecta\n');
print('='.repeat(60) + '\n');

// ============================================
// CONFIGURACIÓN - CAMBIAR ESTOS VALORES 
// ============================================
const SYMBOL = 'INTC'; // ⚠️ CAMBIAR: Símbolo de la alerta
const EXPECTED_PERCENTAGE = 50; // ⚠️ CAMBIAR: Porcentaje que se intentó vender
const ACTUAL_PERCENTAGE = 25; // ⚠️ CAMBIAR: Porcentaje que realmente se vendió
// ============================================

print(`📊 Buscando alerta: ${SYMBOL}\n`);
print(`   Porcentaje esperado: ${EXPECTED_PERCENTAGE}%\n`);
print(`   Porcentaje real: ${ACTUAL_PERCENTAGE}%\n`);
print('='.repeat(60) + '\n');

// Buscar la alerta
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (!alert) {
  print(`❌ No se encontró la alerta con símbolo: ${SYMBOL}\n`);
  print('💡 Verifica que el símbolo sea correcto\n');
} else {
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   ID: ${alert._id}\n`);
  
  // Obtener valores originales
  const originalShares = alert.liquidityData?.originalShares || alert.liquidityData?.shares || 0;
  const currentShares = alert.liquidityData?.shares || 0;
  const originalParticipation = alert.originalParticipationPercentage || alert.participationPercentage || 100;
  const currentParticipation = alert.participationPercentage || 100;
  const entryPrice = alert.entryPrice || 0;
  
  // Buscar la venta parcial incorrecta
  const partialSales = alert.liquidityData?.partialSales || [];
  const executedSales = partialSales.filter(s => s.executed && !s.discarded);
  
  const incorrectSale = executedSales.find(s => 
    Math.abs(s.percentage - ACTUAL_PERCENTAGE) < 1 || 
    Math.abs(s.percentage - EXPECTED_PERCENTAGE) < 1
  );
  
  if (!incorrectSale) {
    print(`❌ No se encontró la venta parcial a corregir\n`);
  } else {
    // Calcular correcciones
    const expectedSharesToSell = originalShares * (EXPECTED_PERCENTAGE / 100);
    const actualSharesSold = incorrectSale.sharesToSell || 0;
    const sharesDifference = expectedSharesToSell - actualSharesSold;
    const correctParticipation = originalParticipation - EXPECTED_PERCENTAGE;
    
    // ✅ CRÍTICO: Calcular acciones correctas basándose en acciones ORIGINALES
    // Si vendimos 50% de las originales, las acciones restantes = originalShares * (correctParticipation / 100)
    const correctShares = originalShares * (correctParticipation / 100);
    
    print(`\n🔄 PASO 1: Actualizando participación y acciones de la alerta...\n`);
    print(`   Participación: ${currentParticipation}% → ${correctParticipation}%\n`);
    print(`   Acciones: ${currentShares.toFixed(4)} → ${correctShares.toFixed(4)}\n`);
    print(`   (Basado en acciones originales: ${originalShares.toFixed(4)} * ${correctParticipation}% = ${correctShares.toFixed(4)})\n`);
    
    db.alerts.updateOne(
      { _id: alert._id },
      { 
        $set: { 
          participationPercentage: correctParticipation,
          'liquidityData.shares': correctShares,
          'liquidityData.allocatedAmount': correctShares * entryPrice
        } 
      }
    );
    
    print(`✅ Participación y acciones actualizadas\n`);
    
    print(`\n🔄 PASO 2: Actualizando venta parcial en liquidityData...\n`);
    
    // Encontrar el índice de la venta incorrecta
    const saleIndex = partialSales.findIndex(s => 
      s._id && s._id.toString() === incorrectSale._id.toString()
    );
    
    if (saleIndex >= 0) {
      // Actualizar la venta parcial
      partialSales[saleIndex].percentage = EXPECTED_PERCENTAGE;
      partialSales[saleIndex].sharesToSell = expectedSharesToSell;
      
      // Recalcular liquidityReleased y realizedProfit si es necesario
      const sellPrice = incorrectSale.sellPrice || 0;
      const entryPrice = alert.entryPrice || 0;
      
      if (sellPrice > 0 && entryPrice > 0) {
        const newLiquidityReleased = (correctParticipation / 100) * sellPrice * expectedSharesToSell;
        const newMarketValue = expectedSharesToSell * sellPrice;
        const newRealizedProfit = newMarketValue - newLiquidityReleased;
        
        partialSales[saleIndex].liquidityReleased = newLiquidityReleased;
        partialSales[saleIndex].realizedProfit = newRealizedProfit;
      }
      
      db.alerts.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            'liquidityData.partialSales': partialSales
          } 
        }
      );
      
      print(`✅ Venta parcial actualizada:\n`);
      print(`   percentage: ${EXPECTED_PERCENTAGE}%\n`);
      print(`   sharesToSell: ${expectedSharesToSell.toFixed(4)}\n`);
    } else {
      print(`⚠️  No se encontró el índice de la venta parcial\n`);
    }
    
    print(`\n🔄 PASO 3: Actualizando operación de venta...\n`);
    
    // Buscar y actualizar operación de venta
    const operations = db.operations.find({
      alertId: alert._id,
      operationType: 'VENTA',
      partialSalePercentage: { $exists: true }
    }).sort({ date: -1 }).toArray();
    
    const relatedOp = operations.find(op => 
      Math.abs(op.partialSalePercentage - ACTUAL_PERCENTAGE) < 1 || 
      Math.abs(op.partialSalePercentage - EXPECTED_PERCENTAGE) < 1
    );
    
    if (relatedOp) {
      db.operations.updateOne(
        { _id: relatedOp._id },
        {
          $set: {
            partialSalePercentage: EXPECTED_PERCENTAGE,
            quantity: -expectedSharesToSell
          }
        }
      );
      
      print(`✅ Operación actualizada:\n`);
      print(`   ID: ${relatedOp._id}\n`);
      print(`   partialSalePercentage: ${EXPECTED_PERCENTAGE}%\n`);
      print(`   quantity: ${-expectedSharesToSell}\n`);
    } else {
      print(`⚠️  No se encontró operación de venta relacionada\n`);
    }
    
    // Actualizar ventasParciales si existe
    if (alert.ventasParciales && alert.ventasParciales.length > 0) {
      print(`\n🔄 PASO 4: Actualizando ventasParciales...\n`);
      
      const ventaParcial = alert.ventasParciales.find(v => 
        Math.abs(v.porcentajeVendido - ACTUAL_PERCENTAGE) < 1 || 
        Math.abs(v.porcentajeVendido - EXPECTED_PERCENTAGE) < 1
      );
      
      if (ventaParcial) {
        const ventaIndex = alert.ventasParciales.indexOf(ventaParcial);
        alert.ventasParciales[ventaIndex].porcentajeVendido = EXPECTED_PERCENTAGE;
        alert.ventasParciales[ventaIndex].sharesVendidos = expectedSharesToSell;
        
        db.alerts.updateOne(
          { _id: alert._id },
          { 
            $set: { 
              ventasParciales: alert.ventasParciales
            } 
          }
        );
        
        print(`✅ ventasParciales actualizado\n`);
      }
    }
    
    // Actualizar distribución de liquidez si existe
    const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
    print(`\n🔄 PASO 5: Verificando distribución de liquidez (Pool: ${pool})...\n`);
    
    const liquidity = db.liquidity.findOne({
      pool: pool,
      'distributions.alertId': alert._id.toString()
    });
    
    if (liquidity) {
      const distributionIndex = liquidity.distributions.findIndex(
        d => d.alertId && d.alertId.toString() === alert._id.toString()
      );
      
      if (distributionIndex >= 0) {
        const distribution = liquidity.distributions[distributionIndex];
        const entryPriceForLiquidity = distribution.entryPrice || entryPrice;
        
        // Actualizar la distribución
        liquidity.distributions[distributionIndex].shares = correctShares;
        liquidity.distributions[distributionIndex].allocatedAmount = correctShares * entryPriceForLiquidity;
        
        // ✅ CORREGIDO: Actualizar soldShares sumando todas las ventas parciales ejecutadas
        // Usar las ventas parciales DESPUÉS de la corrección (ya actualizadas arriba)
        const totalSoldShares = partialSales
          .filter(s => s.executed && !s.discarded)
          .reduce((sum, s) => sum + (s.sharesToSell || 0), 0);
        liquidity.distributions[distributionIndex].soldShares = totalSoldShares;
        
        // Recalcular si está activa
        liquidity.distributions[distributionIndex].isActive = correctShares > 0.0001;
        
        db.liquidity.updateOne(
          { _id: liquidity._id },
          { 
            $set: { 
              [`distributions.${distributionIndex}`]: liquidity.distributions[distributionIndex]
            } 
          }
        );
        
        print(`✅ Distribución de liquidez actualizada:\n`);
        print(`   Shares: ${correctShares.toFixed(4)}\n`);
        print(`   Allocated Amount: $${(correctShares * entryPriceForLiquidity).toFixed(2)}\n`);
        print(`   Sold Shares: ${totalSoldShares.toFixed(4)}\n`);
      } else {
        print(`⚠️  No se encontró distribución para esta alerta en el documento de liquidez\n`);
      }
    } else {
      print(`⚠️  No se encontró documento de liquidez para el pool ${pool}\n`);
    }
    
    print(`\n` + '='.repeat(60) + '\n');
    print('✅ CORRECCIÓN COMPLETADA\n');
    print('='.repeat(60) + '\n');
    print('📋 RESUMEN DE CAMBIOS:\n');
    print(`   ✅ Participación: ${currentParticipation}% → ${correctParticipation}%\n`);
    print(`   ✅ Acciones: ${currentShares.toFixed(4)} → ${correctShares.toFixed(4)}\n`);
    print(`   ✅ Porcentaje vendido: ${ACTUAL_PERCENTAGE}% → ${EXPECTED_PERCENTAGE}%\n`);
    print(`   ✅ Acciones vendidas: ${actualSharesSold.toFixed(4)} → ${expectedSharesToSell.toFixed(4)}\n`);
    print('='.repeat(60) + '\n');
  }
}
