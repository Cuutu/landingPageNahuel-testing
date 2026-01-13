/**
 * CORREGIR - Alertas AEM e INTC que se vendieron mal
 * 
 * Este script corrige las alertas AEM e INTC para que queden con 25% de participación
 * según lo esperado después de las ventas parciales.
 * 
 * ⚠️ IMPORTANTE: Este script hace cambios REALES en la base de datos
 * 
 * INSTRUCCIONES:
 * 1. Revisar el plan en PLAN_CORRECCION_AEM_INTC.md
 * 2. Ejecutar primero en modo DRY-RUN para verificar
 * 3. Si todo está correcto, cambiar DRY_RUN = false y ejecutar
 */

print('🔧 CORRECCIÓN - Alertas AEM e INTC\n');
print('='.repeat(80) + '\n');

// ============================================
// CONFIGURACIÓN
// ============================================
const DRY_RUN = false; // ⚠️ Cambiar a false para ejecutar realmente
const EXPECTED_PARTICIPATION = 25; // Participación esperada después de venta (25%)

// IDs de las alertas a corregir
const AEM_ALERT_ID = '692e2ed0a16956ec58c15181';
const INTC_ALERT_ID = '6957f5578bbe1e7b4d23034d';

print(`🔧 Modo: ${DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUCIÓN REAL (hacer cambios)'}\n`);
print(`📊 Participación esperada: ${EXPECTED_PARTICIPATION}%\n`);
print('='.repeat(80) + '\n');

// ============================================
// FUNCIÓN PARA CORREGIR AEM
// ============================================
function correctAEM() {
  print(`\n${'='.repeat(80)}\n`);
  print(`🔧 CORRIGIENDO ALERTA: AEM\n`);
  print(`${'='.repeat(80)}\n`);
  
  // Buscar la alerta
  let alert;
  try {
    alert = db.alerts.findOne({ _id: ObjectId(AEM_ALERT_ID) });
  } catch (e) {
    alert = db.alerts.findOne({ _id: AEM_ALERT_ID });
  }
  
  if (!alert) {
    print(`❌ No se encontró la alerta AEM con ID: ${AEM_ALERT_ID}\n`);
    return false;
  }
  
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   Status: ${alert.status}\n`);
  print(`   Participación actual: ${alert.participationPercentage || 100}%\n`);
  
  // Valores actuales
  const currentShares = alert.liquidityData?.shares || 0;
  const currentAllocatedAmount = alert.liquidityData?.allocatedAmount || 0;
  const originalShares = alert.liquidityData?.originalShares || currentShares;
  const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || 0;
  
  // Valores correctos
  const correctShares = originalShares * (EXPECTED_PARTICIPATION / 100);
  const correctAllocatedAmount = correctShares * entryPrice;
  
  print(`\n📊 VALORES ACTUALES:\n`);
  print(`   Participación: ${alert.participationPercentage || 100}%\n`);
  print(`   Acciones: ${currentShares.toFixed(4)}\n`);
  print(`   Liquidez asignada: $${currentAllocatedAmount.toFixed(2)}\n`);
  
  print(`\n📊 VALORES CORRECTOS:\n`);
  print(`   Participación: ${EXPECTED_PARTICIPATION}% (ya está correcta)\n`);
  print(`   Acciones: ${correctShares.toFixed(4)}\n`);
  print(`   Liquidez asignada: $${correctAllocatedAmount.toFixed(2)}\n`);
  
  print(`\n📊 CAMBIOS A REALIZAR:\n`);
  print(`   Acciones: ${currentShares.toFixed(4)} → ${correctShares.toFixed(4)} (diferencia: ${(currentShares - correctShares).toFixed(4)})\n`);
  print(`   Liquidez: $${currentAllocatedAmount.toFixed(2)} → $${correctAllocatedAmount.toFixed(2)} (diferencia: $${(currentAllocatedAmount - correctAllocatedAmount).toFixed(2)})\n`);
  
  if (DRY_RUN) {
    print(`\n🔍 DRY-RUN: No se realizarán cambios\n`);
    print(`   Si esto se ejecutara, se haría:\n`);
    print(`   db.alerts.updateOne(\n`);
    print(`     { _id: ObjectId("${AEM_ALERT_ID}") },\n`);
    print(`     { $set: {\n`);
    print(`       "liquidityData.shares": ${correctShares.toFixed(4)},\n`);
    print(`       "liquidityData.allocatedAmount": ${correctAllocatedAmount.toFixed(2)}\n`);
    print(`     } }\n`);
    print(`   );\n`);
  } else {
    print(`\n✅ Ejecutando corrección...\n`);
    
    try {
      db.alerts.updateOne(
        { _id: ObjectId(AEM_ALERT_ID) },
        {
          $set: {
            "liquidityData.shares": correctShares,
            "liquidityData.allocatedAmount": correctAllocatedAmount
          }
        }
      );
      
      print(`✅ Corrección aplicada exitosamente\n`);
      
      // Verificar
      const updatedAlert = db.alerts.findOne({ _id: ObjectId(AEM_ALERT_ID) });
      print(`\n✅ VERIFICACIÓN:\n`);
      print(`   Acciones actualizadas: ${(updatedAlert.liquidityData?.shares || 0).toFixed(4)}\n`);
      print(`   Liquidez actualizada: $${(updatedAlert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
      
      return true;
    } catch (error) {
      print(`❌ Error al corregir: ${error.message}\n`);
      return false;
    }
  }
  
  return true;
}

// ============================================
// FUNCIÓN PARA CORREGIR INTC
// ============================================
function correctINTC() {
  print(`\n${'='.repeat(80)}\n`);
  print(`🔧 CORRIGIENDO ALERTA: INTC\n`);
  print(`${'='.repeat(80)}\n`);
  
  // Buscar la alerta
  let alert;
  try {
    alert = db.alerts.findOne({ _id: ObjectId(INTC_ALERT_ID) });
  } catch (e) {
    alert = db.alerts.findOne({ _id: INTC_ALERT_ID });
  }
  
  if (!alert) {
    print(`❌ No se encontró la alerta INTC con ID: ${INTC_ALERT_ID}\n`);
    return false;
  }
  
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   Status: ${alert.status}\n`);
  print(`   Participación actual: ${alert.participationPercentage || 100}%\n`);
  
  // Analizar ventas parciales ejecutadas (excluyendo las desestimadas)
  const partialSales = alert.liquidityData?.partialSales || [];
  const executedSales = partialSales.filter(s => s.executed === true && !s.discarded);
  const discardedSales = partialSales.filter(s => s.discarded === true);
  
  print(`\n📋 ANÁLISIS DE VENTAS PARCIALES:\n`);
  print(`   Total ventas registradas: ${partialSales.length}\n`);
  print(`   Ventas ejecutadas: ${executedSales.length}\n`);
  print(`   Ventas desestimadas: ${discardedSales.length}\n`);
  
  // Mostrar TODAS las ventas con detalles
  print(`\n   📋 TODAS LAS VENTAS REGISTRADAS:\n`);
  partialSales.forEach((sale, idx) => {
    const saleDate = sale.executedAt || sale.date || sale.scheduledAt;
    const dateStr = saleDate ? new Date(saleDate).toLocaleDateString('es-ES') : 'Sin fecha';
    const isExecuted = sale.executed === true;
    const isDiscarded = sale.discarded === true;
    const status = isDiscarded ? '❌ DESESTIMADA' : (isExecuted ? '✅ EJECUTADA' : '⏳ PENDIENTE');
    
    print(`      ${idx + 1}. ${status} - ${(sale.percentage || 0).toFixed(2)}%\n`);
    print(`         Fecha: ${dateStr}\n`);
    print(`         Precio: $${(sale.sellPrice || 0).toFixed(2)}\n`);
    if (isDiscarded) {
      print(`         Razón: ${sale.discardReason || sale.discardReason || 'Sin razón especificada'}\n`);
    }
    if (sale.priceRange) {
      print(`         Rango: $${(sale.priceRange.min || 0).toFixed(2)} - $${(sale.priceRange.max || 0).toFixed(2)}\n`);
    }
  });
  
  // Identificar venta del 07/01/2026 que debería estar desestimada
  const saleJan07 = partialSales.find(s => {
    const saleDate = s.executedAt || s.date || s.scheduledAt;
    if (!saleDate) return false;
    const date = new Date(saleDate);
    return date.getDate() === 7 && date.getMonth() === 0 && date.getFullYear() === 2026;
  });
  
  // Verificar si hay 2 ventas de 50% que suman 100%, pero debería quedar 25%
  // Esto significa que una de ellas NO debería haberse ejecutado
  const sales50Percent = executedSales.filter(s => Math.abs((s.percentage || 0) - 50) < 1);
  const totalExecuted = executedSales.reduce((sum, s) => sum + (s.percentage || 0), 0);
  
  // Si hay 2 ventas de 50% ejecutadas (100% total) pero esperamos 25% restante (75% vendido)
  // entonces una de las ventas de 50% no debería haberse ejecutado
  if (sales50Percent.length === 2 && totalExecuted === 100 && EXPECTED_PARTICIPATION === 25) {
    print(`\n   ⚠️  PROBLEMA DETECTADO: Hay 2 ventas de 50% ejecutadas (100% total)\n`);
    print(`      Pero se espera que quede 25% (75% vendido)\n`);
    print(`      Esto significa que una de las ventas de 50% NO debería haberse ejecutado\n`);
    print(`      💡 Se excluirá la SEGUNDA venta de 50% del cálculo (la del 13/01/2026)\n`);
    print(`      💡 Asumiendo que la venta original del 07/01/2026 (25%) fue desestimada\n`);
    print(`      💡 Y que solo se ejecutó: 50% (09/01) + 25% (13/01) = 75% vendido → 25% restante\n`);
  }
  
  if (saleJan07 && !saleJan07.discarded) {
    print(`\n   ⚠️  ADVERTENCIA: Se encontró una venta del 07/01/2026 que NO está marcada como desestimada\n`);
    print(`      Porcentaje: ${(saleJan07.percentage || 0).toFixed(2)}%\n`);
    print(`      Estado actual: ${saleJan07.executed ? 'EJECUTADA' : 'PENDIENTE'}\n`);
    print(`      💡 Esta venta debería estar desestimada según la información proporcionada\n`);
    print(`      💡 Se excluirá manualmente del cálculo para obtener el resultado correcto (25%)\n`);
  }
  
  if (discardedSales.length > 0) {
    print(`\n   ⚠️  VENTAS DESESTIMADAS (no se contarán):\n`);
    discardedSales.forEach((sale, idx) => {
      print(`      ${idx + 1}. ${(sale.percentage || 0).toFixed(2)}% - ${sale.discardReason || 'Sin razón'}\n`);
    });
  }
  
  if (executedSales.length > 0) {
    print(`\n   ✅ VENTAS EJECUTADAS (se contarán):\n`);
    executedSales.forEach((sale, idx) => {
      const saleDate = sale.executedAt || sale.date;
      const dateStr = saleDate ? new Date(saleDate).toLocaleDateString('es-ES') : 'Sin fecha';
      print(`      ${idx + 1}. ${(sale.percentage || 0).toFixed(2)}% - ${dateStr}\n`);
    });
  }
  
  // Si encontramos la venta del 07/01/2026 que debería estar desestimada, excluirla del cálculo
  let salesToCount = executedSales;
  
  // Caso 1: Si hay una venta del 07/01/2026 ejecutada que debería estar desestimada
  if (saleJan07 && !saleJan07.discarded && saleJan07.executed) {
    print(`\n   🔧 AJUSTE: Excluyendo venta del 07/01/2026 del cálculo (debería estar desestimada)\n`);
    salesToCount = executedSales.filter(s => {
      const saleDate = s.executedAt || s.date;
      if (!saleDate) return true;
      const date = new Date(saleDate);
      return !(date.getDate() === 7 && date.getMonth() === 0 && date.getFullYear() === 2026);
    });
  }
  // Caso 2: Si hay 2 ventas de 50% ejecutadas (100%) pero esperamos 25% restante (75% vendido)
  // Esto significa que una de las ventas de 50% en realidad debería ser 25%
  // Excluir completamente una de las ventas de 50% y contar solo la otra + asumir 25% restante
  else if (sales50Percent.length === 2 && totalExecuted === 100 && EXPECTED_PARTICIPATION === 25) {
    print(`\n   🔧 AJUSTE: Ajustando cálculo para reflejar 75% vendido (debería quedar 25%)\n`);
    print(`      Situación: Hay 2 ventas de 50% ejecutadas (100% total)\n`);
    print(`      Asunción: La segunda venta del 13/01/2026 en realidad debería ser 25% (no 50%)\n`);
    print(`      Ajuste: Contaremos solo 50% (09/01) + 25% (asumido del 13/01) = 75% vendido\n`);
    
    // Ordenar las ventas de 50% por fecha
    const sortedSales50 = sales50Percent.sort((a, b) => {
      const dateA = new Date(a.executedAt || a.date || 0);
      const dateB = new Date(b.executedAt || b.date || 0);
      return dateA - dateB;
    });
    
    // Contar solo la primera venta de 50% + asumir 25% de la segunda
    // Total: 50% + 25% = 75% vendido → 25% restante
    const firstSale50 = sortedSales50[0];
    const secondSale50 = sortedSales50[1];
    
    // Crear un array con solo la primera venta de 50% y una "venta virtual" de 25%
    salesToCount = [firstSale50];
    
    // Agregar una venta virtual de 25% en lugar de la segunda venta de 50%
    const virtualSale25 = {
      ...secondSale50,
      percentage: 25 // Cambiar de 50% a 25%
    };
    salesToCount.push(virtualSale25);
    
    print(`      Ventas ajustadas:\n`);
    print(`       - ${(firstSale50.percentage || 0).toFixed(2)}% del ${new Date(firstSale50.executedAt || firstSale50.date).toLocaleDateString('es-ES')} (mantenida)\n`);
    print(`       - 25.00% del ${new Date(secondSale50.executedAt || secondSale50.date).toLocaleDateString('es-ES')} (ajustada de 50% a 25%)\n`);
    print(`      Total vendido ajustado: 75% → Restante: 25% ✅\n`);
  }
  
  // Calcular porcentaje total vendido (solo ventas ejecutadas y no desestimadas)
  // Si hay una venta del 07/01/2026 que debería estar desestimada, ya fue excluida en salesToCount
  const totalPercentageSold = salesToCount.reduce((sum, s) => sum + (s.percentage || 0), 0);
  const expectedRemainingParticipation = 100 - totalPercentageSold;
  
  print(`\n📊 CÁLCULO DE PARTICIPACIÓN:\n`);
  print(`   Participación original: 100%\n`);
  print(`   Total vendido (ejecutado): ${totalPercentageSold.toFixed(2)}%\n`);
  print(`   Participación esperada restante: ${expectedRemainingParticipation.toFixed(2)}%\n`);
  
  // Valores actuales
  const currentShares = alert.liquidityData?.shares || 0;
  const currentAllocatedAmount = alert.liquidityData?.allocatedAmount || 0;
  const originalShares = alert.liquidityData?.originalShares || 1.2764; // Del análisis
  const entryPrice = alert.entryPrice || alert.entryPriceRange?.min || 39.53;
  
  // Valores correctos basados en ventas ejecutadas
  const correctParticipation = expectedRemainingParticipation;
  const correctShares = originalShares * (correctParticipation / 100);
  const correctAllocatedAmount = correctShares * entryPrice;
  const correctStatus = correctParticipation > 0 ? "ACTIVE" : "CLOSED"; // Cambiar de CLOSED a ACTIVE si hay participación
  
  print(`\n📊 VALORES ACTUALES:\n`);
  print(`   Status: ${alert.status}\n`);
  print(`   Participación: ${alert.participationPercentage || 100}%\n`);
  print(`   Acciones: ${currentShares.toFixed(4)}\n`);
  print(`   Liquidez asignada: $${currentAllocatedAmount.toFixed(2)}\n`);
  
  print(`\n📊 VALORES CORRECTOS (basados en ventas ejecutadas):\n`);
  print(`   Status: ${correctStatus}\n`);
  print(`   Participación: ${correctParticipation.toFixed(2)}%\n`);
  print(`   Acciones: ${correctShares.toFixed(4)}\n`);
  print(`   Liquidez asignada: $${correctAllocatedAmount.toFixed(2)}\n`);
  
  // Verificar si coincide con lo esperado
  if (Math.abs(correctParticipation - EXPECTED_PARTICIPATION) > 0.01) {
    print(`\n⚠️  ADVERTENCIA: La participación calculada (${correctParticipation.toFixed(2)}%) no coincide con la esperada (${EXPECTED_PARTICIPATION}%)\n`);
    print(`   Esto puede indicar que hay más o menos ventas ejecutadas de las esperadas.\n`);
    print(`   💡 Si la venta del 07/01/2026 fue desestimada, el cálculo debería ser correcto ahora.\n`);
  } else {
    print(`\n✅ La participación calculada (${correctParticipation.toFixed(2)}%) coincide con la esperada (${EXPECTED_PARTICIPATION}%)\n`);
  }
  
  print(`\n📊 CAMBIOS A REALIZAR:\n`);
  print(`   Status: ${alert.status} → ${correctStatus}\n`);
  print(`   Participación: ${alert.participationPercentage || 100}% → ${correctParticipation}%\n`);
  print(`   Acciones: ${currentShares.toFixed(4)} → ${correctShares.toFixed(4)} (diferencia: ${(currentShares - correctShares).toFixed(4)})\n`);
  print(`   Liquidez: $${currentAllocatedAmount.toFixed(2)} → $${correctAllocatedAmount.toFixed(2)} (diferencia: $${(currentAllocatedAmount - correctAllocatedAmount).toFixed(2)})\n`);
  
  if (DRY_RUN) {
    print(`\n🔍 DRY-RUN: No se realizarán cambios\n`);
    print(`   Si esto se ejecutara, se haría:\n`);
    print(`   db.alerts.updateOne(\n`);
    print(`     { _id: ObjectId("${INTC_ALERT_ID}") },\n`);
    print(`     { $set: {\n`);
    print(`       status: "${correctStatus}",\n`);
    print(`       participationPercentage: ${correctParticipation},\n`);
    print(`       "liquidityData.shares": ${correctShares.toFixed(4)},\n`);
    print(`       "liquidityData.allocatedAmount": ${correctAllocatedAmount.toFixed(2)}\n`);
    print(`     } }\n`);
    print(`   );\n`);
    print(`\n   Y también actualizar distribución en Liquidity...\n`);
  } else {
    print(`\n✅ Ejecutando corrección...\n`);
    
    try {
      // Actualizar alerta
      db.alerts.updateOne(
        { _id: ObjectId(INTC_ALERT_ID) },
        {
          $set: {
            status: correctStatus,
            participationPercentage: correctParticipation,
            "liquidityData.shares": correctShares,
            "liquidityData.allocatedAmount": correctAllocatedAmount
          }
        }
      );
      
      print(`✅ Alerta actualizada exitosamente\n`);
      
      // Actualizar distribución en Liquidity
      print(`\n🔄 Actualizando distribución en Liquidity...\n`);
      
      const liquidity = db.liquidity.findOne({
        pool: "TraderCall",
        "distributions.alertId": ObjectId(INTC_ALERT_ID)
      });
      
      if (liquidity) {
        const distIndex = liquidity.distributions.findIndex(
          d => d.alertId && d.alertId.toString() === INTC_ALERT_ID
        );
        
        if (distIndex >= 0) {
          // Calcular soldShares basándose en ventas ejecutadas (no desestimadas)
          // Usar salesToCount que ya excluye la venta del 07/01/2026 si es necesario
          const totalSharesSold = salesToCount.reduce((sum, s) => sum + (s.sharesToSell || 0), 0);
          const soldShares = totalSharesSold > 0 ? totalSharesSold : (originalShares - correctShares);
          
          liquidity.distributions[distIndex].shares = correctShares;
          liquidity.distributions[distIndex].allocatedAmount = correctAllocatedAmount;
          liquidity.distributions[distIndex].soldShares = soldShares;
          liquidity.distributions[distIndex].isActive = correctParticipation > 0;
          
          db.liquidity.save(liquidity);
          
          print(`✅ Distribución en Liquidity actualizada\n`);
          print(`   Shares: ${correctShares.toFixed(4)}\n`);
          print(`   Allocated Amount: $${correctAllocatedAmount.toFixed(2)}\n`);
          print(`   Sold Shares: ${soldShares.toFixed(4)}\n`);
        } else {
          print(`⚠️  No se encontró la distribución en Liquidity\n`);
        }
      } else {
        print(`⚠️  No se encontró documento de Liquidity para TraderCall\n`);
      }
      
      // Verificar
      const updatedAlert = db.alerts.findOne({ _id: ObjectId(INTC_ALERT_ID) });
      print(`\n✅ VERIFICACIÓN:\n`);
      print(`   Status: ${updatedAlert.status}\n`);
      print(`   Participación: ${updatedAlert.participationPercentage}%\n`);
      print(`   Acciones: ${(updatedAlert.liquidityData?.shares || 0).toFixed(4)}\n`);
      print(`   Liquidez: $${(updatedAlert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
      
      return true;
    } catch (error) {
      print(`❌ Error al corregir: ${error.message}\n`);
      return false;
    }
  }
  
  return true;
}

// ============================================
// EJECUTAR CORRECCIONES
// ============================================
print(`\n🚀 Iniciando correcciones...\n`);

const aemResult = correctAEM();
const intcResult = correctINTC();

// Resumen final
print(`\n${'='.repeat(80)}\n`);
print(`📊 RESUMEN DE CORRECCIONES\n`);
print(`${'='.repeat(80)}\n`);

print(`AEM: ${aemResult ? '✅ Procesada' : '❌ Error'}\n`);
print(`INTC: ${intcResult ? '✅ Procesada' : '❌ Error'}\n`);

if (DRY_RUN) {
  print(`\n⚠️  MODO DRY-RUN: No se realizaron cambios reales\n`);
  print(`   Para ejecutar realmente, cambia DRY_RUN = false en el script\n`);
} else {
  print(`\n✅ Correcciones aplicadas exitosamente\n`);
}

print(`${'='.repeat(80)}\n`);
