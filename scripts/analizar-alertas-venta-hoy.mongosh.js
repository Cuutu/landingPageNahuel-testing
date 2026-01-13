/**
 * ANALIZAR - Alertas AEM e INTC de ayer y hoy que se vendieron mal
 * 
 * Este script busca las alertas AEM e INTC creadas ayer y hoy y analiza:
 * - Su participación actual
 * - Las ventas parciales ejecutadas
 * - Si deberían quedar con 25% de participación
 * - Qué está mal y qué necesita corrección
 * 
 * INSTRUCCIONES:
 * 1. Ejecutar en mongosh: mongosh <nombre-de-tu-db> < scripts/analizar-alertas-venta-hoy.mongosh.js
 * 2. O copiar y pegar el contenido en mongosh
 */

print('🔍 ANÁLISIS - Alertas AEM e INTC de ayer y hoy\n');
print('='.repeat(80) + '\n');

// ============================================
// CONFIGURACIÓN
// ============================================
const SYMBOLS = ['AEM', 'INTC']; // Símbolos a analizar
const EXPECTED_PARTICIPATION_AFTER_SALE = 25; // Participación esperada después de la venta (25%)
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0); // Inicio del día de hoy
const YESTERDAY = new Date(TODAY);
YESTERDAY.setDate(YESTERDAY.getDate() - 1); // Inicio del día de ayer
const TOMORROW = new Date(TODAY);
TOMORROW.setDate(TOMORROW.getDate() + 1); // Inicio del día de mañana

print(`📅 Rango de fechas de análisis: ${YESTERDAY.toISOString().split('T')[0]} a ${TODAY.toISOString().split('T')[0]}\n`);
print(`📊 Símbolos a analizar: ${SYMBOLS.join(', ')}\n`);
print(`✅ Participación esperada después de venta: ${EXPECTED_PARTICIPATION_AFTER_SALE}%\n`);
print('='.repeat(80) + '\n');

// Función para analizar una alerta
function analyzeAlert(alert) {
  const symbol = alert.symbol;
  print(`\n${'='.repeat(80)}\n`);
  print(`📊 ANALIZANDO ALERTA: ${symbol}\n`);
  print(`${'='.repeat(80)}\n`);
  
  // Información básica
  print(`\n📋 INFORMACIÓN BÁSICA:\n`);
  print(`   ID: ${alert._id}\n`);
  print(`   Status: ${alert.status}\n`);
  print(`   Tipo: ${alert.tipo || 'N/A'}\n`);
  print(`   Fecha de creación: ${alert.createdAt || alert.date}\n`);
  print(`   Precio de entrada: $${(alert.entryPrice || alert.entryPriceRange?.min || 0).toFixed(2)}\n`);
  print(`   Precio actual: $${(alert.currentPrice || 0).toFixed(2)}\n`);
  
  // Obtener valores de participación y acciones
  const originalParticipation = alert.originalParticipationPercentage || alert.participationPercentage || 100;
  const currentParticipation = alert.participationPercentage || 100;
  const originalShares = alert.liquidityData?.originalShares || alert.liquidityData?.shares || 0;
  const currentShares = alert.liquidityData?.shares || 0;
  const originalAllocatedAmount = alert.liquidityData?.originalAllocatedAmount || alert.liquidityData?.allocatedAmount || 0;
  const currentAllocatedAmount = alert.liquidityData?.allocatedAmount || 0;
  const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || 0;
  
  print(`\n📊 ESTADO DE PARTICIPACIÓN Y ACCIONES:\n`);
  print(`   Participación original: ${originalParticipation}%\n`);
  print(`   Participación actual: ${currentParticipation}%\n`);
  print(`   Participación vendida: ${(originalParticipation - currentParticipation).toFixed(2)}%\n`);
  print(`\n   Acciones originales: ${originalShares.toFixed(4)}\n`);
  print(`   Acciones actuales: ${currentShares.toFixed(4)}\n`);
  print(`   Acciones vendidas: ${(originalShares - currentShares).toFixed(4)}\n`);
  print(`\n   Liquidez asignada original: $${originalAllocatedAmount.toFixed(2)}\n`);
  print(`   Liquidez asignada actual: $${currentAllocatedAmount.toFixed(2)}\n`);
  print(`   Liquidez liberada: $${(originalAllocatedAmount - currentAllocatedAmount).toFixed(2)}\n`);
  
  // Analizar ventas parciales ejecutadas
  const partialSales = alert.liquidityData?.partialSales || [];
  const executedSales = partialSales.filter(s => s.executed && !s.discarded);
  
  print(`\n📋 VENTAS PARCIALES EJECUTADAS: ${executedSales.length}\n`);
  if (executedSales.length === 0) {
    print(`   ⚠️  No se encontraron ventas parciales ejecutadas\n`);
  } else {
    executedSales.forEach((sale, idx) => {
      print(`   ${idx + 1}. Porcentaje vendido: ${(sale.percentage || 0).toFixed(2)}%\n`);
      print(`      Acciones vendidas: ${(sale.sharesToSell || 0).toFixed(4)}\n`);
      print(`      Precio de venta: $${(sale.sellPrice || 0).toFixed(2)}\n`);
      print(`      Liquidez liberada: $${(sale.liquidityReleased || 0).toFixed(2)}\n`);
      print(`      Ganancia realizada: $${(sale.realizedProfit || 0).toFixed(2)}\n`);
      print(`      Fecha de ejecución: ${sale.executedAt || sale.date}\n`);
      print(`      Venta completa: ${sale.isCompleteSale || false}\n`);
    });
  }
  
  // Calcular totales de ventas
  const totalPercentageSold = executedSales.reduce((sum, s) => sum + (s.percentage || 0), 0);
  const totalSharesSold = executedSales.reduce((sum, s) => sum + (s.sharesToSell || 0), 0);
  
  print(`\n📊 TOTALES DE VENTAS PARCIALES:\n`);
  print(`   Porcentaje total vendido: ${totalPercentageSold.toFixed(2)}%\n`);
  print(`   Acciones totales vendidas: ${totalSharesSold.toFixed(4)}\n`);
  
  // Verificar si la participación actual es correcta (debería ser 25%)
  print(`\n✅ VERIFICACIÓN DE PARTICIPACIÓN:\n`);
  print(`   Participación esperada después de venta: ${EXPECTED_PARTICIPATION_AFTER_SALE}%\n`);
  print(`   Participación actual: ${currentParticipation}%\n`);
  
  const participationDifference = currentParticipation - EXPECTED_PARTICIPATION_AFTER_SALE;
  const isParticipationCorrect = Math.abs(participationDifference) < 0.01;
  
  if (isParticipationCorrect) {
    print(`   ✅ CORRECTO: La participación coincide con lo esperado\n`);
  } else {
    print(`   ⚠️  PROBLEMA DETECTADO: Diferencia de ${participationDifference.toFixed(2)}%\n`);
    print(`   💡 La participación debería ser ${EXPECTED_PARTICIPATION_AFTER_SALE}% pero es ${currentParticipation}%\n`);
  }
  
  // Verificar acciones
  const expectedSharesAfterSale = originalShares * (EXPECTED_PARTICIPATION_AFTER_SALE / 100);
  print(`\n✅ VERIFICACIÓN DE ACCIONES:\n`);
  print(`   Acciones esperadas después de venta (25%): ${expectedSharesAfterSale.toFixed(4)}\n`);
  print(`   Acciones actuales: ${currentShares.toFixed(4)}\n`);
  
  const sharesDifference = currentShares - expectedSharesAfterSale;
  const isSharesCorrect = Math.abs(sharesDifference) < 0.0001;
  
  if (isSharesCorrect) {
    print(`   ✅ CORRECTO: Las acciones coinciden\n`);
  } else {
    print(`   ⚠️  PROBLEMA DETECTADO: Diferencia de ${sharesDifference.toFixed(4)} acciones\n`);
    print(`   💡 Las acciones deberían ser ${expectedSharesAfterSale.toFixed(4)} pero son ${currentShares.toFixed(4)}\n`);
  }
  
  // Verificar liquidez en documento de Liquidity
  const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
  print(`\n💰 VERIFICANDO DOCUMENTO DE LIQUIDEZ (Pool: ${pool})...\n`);
  
  const liquidity = db.liquidity.findOne({
    pool: pool,
    'distributions.alertId': alert._id.toString()
  });
  
  if (!liquidity) {
    print(`   ⚠️  No se encontró documento de liquidez para este pool\n`);
  } else {
    print(`   ✅ Documento de liquidez encontrado\n`);
    print(`   Total Liquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)}\n`);
    print(`   Available Liquidity: $${(liquidity.availableLiquidity || 0).toFixed(2)}\n`);
    
    const distribution = liquidity.distributions.find(
      d => d.alertId && d.alertId.toString() === alert._id.toString()
    );
    
    if (!distribution) {
      print(`   ⚠️  No se encontró distribución para esta alerta\n`);
    } else {
      print(`\n   📊 DISTRIBUCIÓN EN LIQUIDEZ:\n`);
      print(`      Shares: ${(distribution.shares || 0).toFixed(4)}\n`);
      print(`      Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}\n`);
      print(`      Sold Shares: ${(distribution.soldShares || 0).toFixed(4)}\n`);
      
      // Verificar que las acciones en la distribución coincidan
      const distributionSharesDifference = currentShares - (distribution.shares || 0);
      print(`\n   ✅ VERIFICACIÓN DE DISTRIBUCIÓN:\n`);
      print(`      Shares en alerta: ${currentShares.toFixed(4)}\n`);
      print(`      Shares en distribución: ${(distribution.shares || 0).toFixed(4)}\n`);
      
      if (Math.abs(distributionSharesDifference) < 0.0001) {
        print(`      ✅ CORRECTO: Las acciones coinciden\n`);
      } else {
        print(`      ⚠️  DIFERENCIA: ${distributionSharesDifference.toFixed(4)} acciones\n`);
        print(`      💡 Las acciones en la distribución deberían ser ${currentShares.toFixed(4)} pero son ${(distribution.shares || 0).toFixed(4)}\n`);
      }
    }
  }
  
  // Buscar operaciones de venta
  print(`\n📋 OPERACIONES DE VENTA:\n`);
  const operations = db.operations.find({
    alertId: alert._id,
    operationType: 'VENTA'
  }).sort({ date: -1 }).toArray();
  
  print(`   Total operaciones de venta: ${operations.length}\n`);
  operations.forEach((op, idx) => {
    print(`   ${idx + 1}. ID: ${op._id}\n`);
    print(`      Quantity: ${op.quantity || 0}\n`);
    print(`      Price: $${(op.price || 0).toFixed(2)}\n`);
    print(`      Partial Sale: ${op.isPartialSale || false}\n`);
    print(`      Partial Sale Percentage: ${op.partialSalePercentage || 'N/A'}%\n`);
    print(`      Date: ${op.date}\n`);
  });
  
  // Resumen del análisis
  print(`\n${'='.repeat(80)}\n`);
  print(`📊 RESUMEN DEL ANÁLISIS - ${symbol}:\n`);
  print(`${'='.repeat(80)}\n`);
  
  const issues = [];
  
  if (!isParticipationCorrect) {
    issues.push(`Participación incorrecta: ${currentParticipation}% (debería ser ${EXPECTED_PARTICIPATION_AFTER_SALE}%)`);
  }
  
  if (!isSharesCorrect) {
    issues.push(`Acciones incorrectas: ${currentShares.toFixed(4)} (deberían ser ${expectedSharesAfterSale.toFixed(4)})`);
  }
  
  if (issues.length === 0) {
    print(`✅ TODO CORRECTO: La alerta ${symbol} está bien configurada\n`);
  } else {
    print(`⚠️  PROBLEMAS DETECTADOS:\n`);
    issues.forEach((issue, idx) => {
      print(`   ${idx + 1}. ${issue}\n`);
    });
    
    // Calcular correcciones necesarias
    print(`\n💡 CORRECCIONES NECESARIAS:\n`);
    print(`   Participación actual: ${currentParticipation}%\n`);
    print(`   Participación correcta: ${EXPECTED_PARTICIPATION_AFTER_SALE}%\n`);
    print(`   Diferencia: ${participationDifference.toFixed(2)}%\n`);
    print(`\n   Acciones actuales: ${currentShares.toFixed(4)}\n`);
    print(`   Acciones correctas: ${expectedSharesAfterSale.toFixed(4)}\n`);
    print(`   Diferencia: ${sharesDifference.toFixed(4)} acciones\n`);
    
    if (sharesDifference > 0) {
      print(`\n   💰 Liquidez asignada actual: $${currentAllocatedAmount.toFixed(2)}\n`);
      const correctAllocatedAmount = expectedSharesAfterSale * entryPrice;
      print(`   💰 Liquidez asignada correcta: $${correctAllocatedAmount.toFixed(2)}\n`);
      print(`   💰 Diferencia: $${(currentAllocatedAmount - correctAllocatedAmount).toFixed(2)}\n`);
    }
  }
  
  return {
    symbol,
    alertId: alert._id,
    isCorrect: issues.length === 0,
    issues,
    currentParticipation,
    expectedParticipation: EXPECTED_PARTICIPATION_AFTER_SALE,
    participationDifference,
    currentShares,
    expectedShares: expectedSharesAfterSale,
    sharesDifference,
    currentAllocatedAmount,
    expectedAllocatedAmount: expectedSharesAfterSale * entryPrice,
    hasLiquidityDistribution: !!liquidity && !!(liquidity.distributions && liquidity.distributions.find(d => d.alertId && d.alertId.toString() === alert._id.toString()))
  };
}

// Buscar operaciones de venta de ayer y hoy para obtener los alertId
const results = [];
const alertIdsToAnalyze = new Set();

print(`\n🔍 Buscando operaciones de VENTA de ayer y hoy para ${SYMBOLS.join(', ')}...\n`);

SYMBOLS.forEach(symbol => {
  print(`\n   📋 Buscando operaciones de venta para ${symbol}...\n`);
  
  const operations = db.operations.find({
    ticker: symbol.toUpperCase(),
    operationType: 'VENTA',
    $or: [
      { date: { $gte: YESTERDAY, $lt: TOMORROW } },
      { createdAt: { $gte: YESTERDAY, $lt: TOMORROW } }
    ]
  }).toArray();
  
  if (operations.length === 0) {
    print(`   ⚠️  No se encontraron operaciones de venta para ${symbol} de ayer o hoy\n`);
  } else {
    print(`   ✅ Se encontraron ${operations.length} operación(es) de venta para ${symbol}\n`);
    
    operations.forEach((op, idx) => {
      print(`      ${idx + 1}. ID Operación: ${op._id}\n`);
      print(`         Ticker: ${op.ticker}\n`);
      print(`         Fecha: ${op.date || op.createdAt}\n`);
      print(`         Partial Sale: ${op.isPartialSale || false}\n`);
      print(`         Partial Sale %: ${op.partialSalePercentage || 'N/A'}%\n`);
      
      if (op.alertId) {
        alertIdsToAnalyze.add(op.alertId.toString());
        print(`         Alert ID: ${op.alertId}\n`);
      } else {
        print(`         ⚠️  No tiene alertId asociado\n`);
      }
    });
  }
});

print(`\n📊 Total de alertIds únicos encontrados: ${alertIdsToAnalyze.size}\n`);

// Buscar las alertas usando los alertId encontrados
if (alertIdsToAnalyze.size === 0) {
  print(`⚠️  No se encontraron alertIds en las operaciones. Buscando alertas directamente por símbolo...\n`);
  
  // Fallback: buscar alertas directamente por símbolo (sin restricción de fecha)
  SYMBOLS.forEach(symbol => {
    print(`\n🔍 Buscando alertas ${symbol} (sin restricción de fecha)...\n`);
    
    const alerts = db.alerts.find({
      symbol: symbol.toUpperCase(),
      status: { $in: ['ACTIVE', 'CLOSED'] }
    }).sort({ createdAt: -1, date: -1 }).limit(5).toArray();
    
    if (alerts.length === 0) {
      print(`   ⚠️  No se encontraron alertas ${symbol}\n`);
    } else {
      print(`   ✅ Se encontraron ${alerts.length} alerta(s) ${symbol} (mostrando las 5 más recientes)\n`);
      
      alerts.forEach(alert => {
        const analysis = analyzeAlert(alert);
        results.push(analysis);
      });
    }
  });
} else {
  print(`\n🔍 Buscando alertas usando los alertIds encontrados en operaciones...\n`);
  
  const alertIdArray = Array.from(alertIdsToAnalyze);
  
  alertIdArray.forEach((alertIdStr, idx) => {
    print(`\n   ${idx + 1}. Buscando alerta con ID: ${alertIdStr}...\n`);
    
    // Intentar buscar con ObjectId primero, si falla usar el string directamente
    let alert = null;
    try {
      alert = db.alerts.findOne({ _id: ObjectId(alertIdStr) });
    } catch (e) {
      // Si ObjectId falla, intentar con el string directamente
      alert = db.alerts.findOne({ _id: alertIdStr });
    }
    
    if (!alert) {
      print(`   ⚠️  No se encontró alerta con ID: ${alertIdStr}\n`);
    } else {
      print(`   ✅ Alerta encontrada: ${alert.symbol}\n`);
      const analysis = analyzeAlert(alert);
      results.push(analysis);
    }
  });
}

// Resumen final
print(`\n${'='.repeat(80)}\n`);
print(`📊 RESUMEN FINAL DEL ANÁLISIS\n`);
print(`${'='.repeat(80)}\n`);

if (results.length === 0) {
  print(`⚠️  No se encontraron alertas para analizar\n`);
} else {
  print(`Total de alertas analizadas: ${results.length}\n`);
  
  const correctAlerts = results.filter(r => r.isCorrect);
  const incorrectAlerts = results.filter(r => !r.isCorrect);
  
  print(`✅ Alertas correctas: ${correctAlerts.length}\n`);
  print(`⚠️  Alertas con problemas: ${incorrectAlerts.length}\n`);
  
  if (incorrectAlerts.length > 0) {
    print(`\n📋 ALERTAS QUE NECESITAN CORRECCIÓN:\n`);
    incorrectAlerts.forEach((result, idx) => {
      print(`\n${idx + 1}. ${result.symbol} (ID: ${result.alertId})\n`);
      print(`   Participación: ${result.currentParticipation}% → ${result.expectedParticipation}%\n`);
      print(`   Acciones: ${result.currentShares.toFixed(4)} → ${result.expectedShares.toFixed(4)}\n`);
      print(`   Liquidez: $${result.currentAllocatedAmount.toFixed(2)} → $${result.expectedAllocatedAmount.toFixed(2)}\n`);
    });
    
    print(`\n💡 PRÓXIMOS PASOS:\n`);
    print(`   1. Revisar el análisis detallado arriba para cada alerta\n`);
    print(`   2. Crear un script de corrección basado en estos resultados\n`);
    print(`   3. Ejecutar el script de corrección para ajustar las alertas\n`);
  } else {
    print(`\n✅ Todas las alertas están correctas\n`);
  }
}

print(`\n${'='.repeat(80)}\n`);
print(`✅ Análisis completado\n`);
print(`${'='.repeat(80)}\n`);
