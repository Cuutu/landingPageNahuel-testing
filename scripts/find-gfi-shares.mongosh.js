/**
 * Script de mongosh para encontrar los shares restantes de GFI en la base de datos
 * 
 * USO:
 * =====
 * 
 * Opción 1: Ejecutar desde línea de comandos
 *   mongosh "mongodb+srv://user:pass@cluster.mongodb.net/database" < scripts/find-gfi-shares.mongosh.js
 * 
 * Opción 2: Copiar y pegar en mongosh
 *   1. Abrir mongosh
 *   2. Conectarse a la base de datos
 *   3. Copiar y pegar todo el contenido de este archivo
 *   4. Presionar Enter
 * 
 * Opción 3: Ejecutar desde mongosh
 *   mongosh> load('scripts/find-gfi-shares.mongosh.js')
 * 
 * CAMBIAR EL SÍMBOLO:
 * ====================
 * Para buscar otro símbolo, cambiar la línea:
 *   const symbol = "GFI";
 * Por ejemplo: const symbol = "AAPL";
 * 
 * EL SCRIPT BUSCA:
 * ================
 * 1. Distribuciones de liquidez (donde están los shares restantes)
 * 2. Alertas relacionadas con el símbolo
 * 3. Operaciones de compra/venta del símbolo
 * 4. Compara y muestra discrepancias entre distribuciones y operaciones
 */

// ============================================
// BUSCAR SHARES RESTANTES DE GFI
// ============================================
print("\n🔍 ============================================");
print("BUSCAR SHARES RESTANTES DE GFI");
print("============================================\n");

const symbol = "GFI";

// ============================================
// 1. BUSCAR EN DISTRIBUCIONES DE LIQUIDEZ
// ============================================
print("\n📊 1. DISTRIBUCIONES DE LIQUIDEZ PARA " + symbol);
print("=".repeat(60));

const distributions = db.liquidities.aggregate([
  { $unwind: "$distributions" },
  {
    $match: {
      "distributions.symbol": symbol.toUpperCase()
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
      percentage: "$distributions.percentage",
      isActive: "$distributions.isActive",
      realizedProfitLoss: "$distributions.realizedProfitLoss",
      profitLoss: "$distributions.profitLoss",
      createdAt: "$distributions.createdAt",
      updatedAt: "$distributions.updatedAt"
    }
  }
]).toArray();

if (distributions.length === 0) {
  print(`❌ No se encontraron distribuciones de liquidez para ${symbol}`);
} else {
  print(`✅ Encontradas ${distributions.length} distribución(es) de liquidez para ${symbol}\n`);
  
  let totalSharesRestantes = 0;
  let totalSharesVendidos = 0;
  let totalSharesOriginales = 0;
  
  distributions.forEach((dist, index) => {
    print(`\n--- Distribución ${index + 1} ---`);
    print(`Pool: ${dist.pool}`);
    print(`Liquidity ID: ${dist.liquidityId}`);
    print(`Alert ID: ${dist.alertId}`);
    print(`Symbol: ${dist.symbol}`);
    
    // Helper para formatear números de forma segura (maneja tipos de MongoDB)
    const formatNum = (val, decimals = 2) => {
      if (val === null || val === undefined) return 'N/A';
      // Convertir tipos de MongoDB (NumberDecimal, NumberLong, etc.) a número
      let num;
      if (typeof val === 'number') {
        num = val;
      } else if (typeof val === 'string') {
        num = parseFloat(val);
      } else if (val && typeof val.toString === 'function') {
        // Para tipos especiales de MongoDB como NumberDecimal
        num = parseFloat(val.toString());
      } else {
        num = parseFloat(val);
      }
      return (!isNaN(num) && num !== null && num !== undefined) ? num.toFixed(decimals) : 'N/A';
    };
    
    print(`Entry Price: $${formatNum(dist.entryPrice, 2)}`);
    print(`Current Price: $${formatNum(dist.currentPrice, 2)}`);
    print(`Percentage: ${formatNum(dist.percentage, 2)}%`);
    print(`Allocated Amount: $${formatNum(dist.allocatedAmount, 2)}`);
    print(`Shares RESTANTES: ${formatNum(dist.shares, 4)}`);
    print(`Shares VENDIDOS: ${formatNum(dist.soldShares, 4)}`);
    print(`Is Active: ${dist.isActive}`);
    print(`Realized Profit/Loss: $${formatNum(dist.realizedProfitLoss, 2)}`);
    print(`Profit/Loss (Paper): $${formatNum(dist.profitLoss, 2)}`);
    print(`Created At: ${dist.createdAt}`);
    print(`Updated At: ${dist.updatedAt}`);
    
    // Calcular shares originales (restantes + vendidos)
    // Función helper para convertir valores a número de forma segura
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      if (val && typeof val.toString === 'function') return parseFloat(val.toString()) || 0;
      return parseFloat(val) || 0;
    };
    
    const sharesNum = toNumber(dist.shares);
    const soldSharesNum = toNumber(dist.soldShares);
    const sharesOriginales = sharesNum + soldSharesNum;
    
    totalSharesOriginales += sharesOriginales;
    totalSharesRestantes += sharesNum;
    totalSharesVendidos += soldSharesNum;
    
    print(`Shares ORIGINALES (calculado): ${sharesOriginales.toFixed(4)}`);
    
    // Calcular valor actual de shares restantes
    const currentPriceNum = toNumber(dist.currentPrice);
    if (currentPriceNum > 0 && sharesNum > 0) {
      const valorActual = currentPriceNum * sharesNum;
      print(`Valor ACTUAL de shares restantes: $${valorActual.toFixed(2)}`);
    }
  });
  
  print(`\n📈 RESUMEN DE DISTRIBUCIONES:`);
  print(`   Total Shares ORIGINALES: ${totalSharesOriginales.toFixed(4)}`);
  print(`   Total Shares VENDIDOS: ${totalSharesVendidos.toFixed(4)}`);
  print(`   Total Shares RESTANTES: ${totalSharesRestantes.toFixed(4)}`);
}

// ============================================
// 2. BUSCAR EN ALERTAS
// ============================================
print("\n\n📊 2. ALERTAS PARA " + symbol);
print("=".repeat(60));

const alerts = db.alerts.find({ symbol: symbol.toUpperCase() }).toArray();

if (alerts.length === 0) {
  print(`❌ No se encontraron alertas para ${symbol}`);
} else {
  print(`✅ Encontradas ${alerts.length} alerta(s) para ${symbol}\n`);
  
  alerts.forEach((alert, index) => {
    print(`\n--- Alerta ${index + 1} ---`);
    print(`Alert ID: ${alert._id}`);
    print(`Symbol: ${alert.symbol}`);
    print(`Status: ${alert.status}`);
    print(`Tipo: ${alert.tipo}`);
    print(`Action: ${alert.action}`);
    // Helper para formatear números de forma segura (maneja tipos de MongoDB)
    const formatNum = (val, decimals = 2) => {
      if (val === null || val === undefined) return 'N/A';
      // Convertir tipos de MongoDB (NumberDecimal, NumberLong, etc.) a número
      let num;
      if (typeof val === 'number') {
        num = val;
      } else if (typeof val === 'string') {
        num = parseFloat(val);
      } else if (val && typeof val.toString === 'function') {
        // Para tipos especiales de MongoDB como NumberDecimal
        num = parseFloat(val.toString());
      } else {
        num = parseFloat(val);
      }
      return (!isNaN(num) && num !== null && num !== undefined) ? num.toFixed(decimals) : 'N/A';
    };
    
    // Formatear entry price
    let entryPriceStr = 'N/A';
    if (alert.entryPrice) {
      entryPriceStr = '$' + formatNum(alert.entryPrice, 2);
    } else if (alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max) {
      entryPriceStr = `$${formatNum(alert.entryPriceRange.min, 2)}-$${formatNum(alert.entryPriceRange.max, 2)}`;
    }
    print(`Entry Price: ${entryPriceStr}`);
    print(`Current Price: $${formatNum(alert.currentPrice, 2)}`);
    print(`Participation Percentage: ${formatNum(alert.participationPercentage, 2)}%`);
    print(`Liquidity Percentage: ${formatNum(alert.liquidityPercentage, 2)}%`);
    
    // LiquidityData en la alerta
    if (alert.liquidityData) {
      print(`\n📊 Liquidity Data en Alerta:`);
      print(`   Allocated Amount: $${formatNum(alert.liquidityData.allocatedAmount, 2)}`);
      print(`   Shares: ${formatNum(alert.liquidityData.shares, 4)}`);
      print(`   Original Allocated Amount: $${formatNum(alert.liquidityData.originalAllocatedAmount, 2)}`);
      print(`   Original Shares: ${formatNum(alert.liquidityData.originalShares, 4)}`);
      
      if (alert.liquidityData.partialSales && alert.liquidityData.partialSales.length > 0) {
        print(`   Ventas Parciales: ${alert.liquidityData.partialSales.length}`);
        alert.liquidityData.partialSales.forEach((sale, saleIndex) => {
          print(`      Venta ${saleIndex + 1}: ${formatNum(sale.percentage, 2)}% - ${formatNum(sale.sharesToSell, 4)} shares - $${formatNum(sale.sellPrice, 2)} - ${sale.executed ? 'EJECUTADA' : 'PENDIENTE'}`);
        });
      }
    } else {
      print(`\n⚠️  No hay liquidityData en esta alerta`);
    }
    
    print(`Created At: ${alert.createdAt}`);
    print(`Updated At: ${alert.updatedAt}`);
  });
}

// ============================================
// 3. BUSCAR EN OPERACIONES
// ============================================
print("\n\n📊 3. OPERACIONES PARA " + symbol);
print("=".repeat(60));

const operations = db.operations.find({ 
  $or: [
    { ticker: symbol.toUpperCase() },
    { alertSymbol: symbol.toUpperCase() }
  ]
}).sort({ date: 1 }).toArray();

if (operations.length === 0) {
  print(`❌ No se encontraron operaciones para ${symbol}`);
} else {
  print(`✅ Encontradas ${operations.length} operación(es) para ${symbol}\n`);
  
  let totalCompras = 0;
  let totalVentas = 0;
  let comprasCount = 0;
  let ventasCount = 0;
  
  operations.forEach((op, index) => {
    print(`\n--- Operación ${index + 1} ---`);
    print(`Operation ID: ${op._id}`);
    print(`Ticker: ${op.ticker}`);
    print(`Type: ${op.operationType}`);
    
    // Helper para formatear números de forma segura (maneja tipos de MongoDB)
    const formatNum = (val, decimals = 2) => {
      if (val === null || val === undefined) return 'N/A';
      // Convertir tipos de MongoDB (NumberDecimal, NumberLong, etc.) a número
      let num;
      if (typeof val === 'number') {
        num = val;
      } else if (typeof val === 'string') {
        num = parseFloat(val);
      } else if (val && typeof val.toString === 'function') {
        // Para tipos especiales de MongoDB como NumberDecimal
        num = parseFloat(val.toString());
      } else {
        num = parseFloat(val);
      }
      return (!isNaN(num) && num !== null && num !== undefined) ? num.toFixed(decimals) : 'N/A';
    };
    
    print(`Quantity: ${formatNum(op.quantity, 4)}`);
    print(`Price: $${formatNum(op.price, 2)}`);
    print(`Amount: $${formatNum(op.amount, 2)}`);
    print(`Date: ${op.date}`);
    print(`System: ${op.system}`);
    print(`Status: ${op.status || 'N/A'}`);
    
    if (op.isPartialSale) {
      print(`Is Partial Sale: Sí`);
      print(`Partial Sale Percentage: ${formatNum(op.partialSalePercentage, 2)}%`);
    }
    
    if (op.liquidityData) {
      print(`Liquidity Data:`);
      print(`   Shares: ${formatNum(op.liquidityData.shares, 4)}`);
      print(`   Allocated Amount: $${formatNum(op.liquidityData.allocatedAmount, 2)}`);
    }
    
    // Acumular compras y ventas
    // Función helper para convertir valores a número de forma segura
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      if (val && typeof val.toString === 'function') return parseFloat(val.toString()) || 0;
      return parseFloat(val) || 0;
    };
    
    if (op.operationType === 'COMPRA') {
      const qty = toNumber(op.quantity);
      totalCompras += Math.abs(qty);
      comprasCount++;
    } else if (op.operationType === 'VENTA') {
      const qty = toNumber(op.quantity);
      totalVentas += Math.abs(qty);
      ventasCount++;
    }
  });
  
  print(`\n📈 RESUMEN DE OPERACIONES:`);
  print(`   Total COMPRAS: ${totalCompras.toFixed(4)} shares (${comprasCount} operación(es))`);
  print(`   Total VENTAS: ${totalVentas.toFixed(4)} shares (${ventasCount} operación(es))`);
  print(`   Diferencia (Compras - Ventas): ${(totalCompras - totalVentas).toFixed(4)} shares`);
}

// ============================================
// 4. RESUMEN FINAL
// ============================================
print("\n\n📊 ============================================");
print("RESUMEN FINAL PARA " + symbol);
print("============================================\n");

if (distributions.length > 0) {
  // Función helper para convertir valores a número de forma segura
  const toNumber = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (val && typeof val.toString === 'function') return parseFloat(val.toString()) || 0;
    return parseFloat(val) || 0;
  };
  
  const distSummary = distributions.reduce((acc, dist) => {
    const sharesNum = toNumber(dist.shares);
    const soldSharesNum = toNumber(dist.soldShares);
    acc.totalSharesRestantes += sharesNum;
    acc.totalSharesVendidos += soldSharesNum;
    return acc;
  }, { totalSharesRestantes: 0, totalSharesVendidos: 0 });
  
  const totalSharesOriginales = distSummary.totalSharesRestantes + distSummary.totalSharesVendidos;
  
  print(`✅ SHARES RESTANTES EN DISTRIBUCIONES: ${distSummary.totalSharesRestantes.toFixed(4)}`);
  print(`✅ SHARES VENDIDOS EN DISTRIBUCIONES: ${distSummary.totalSharesVendidos.toFixed(4)}`);
  print(`✅ SHARES ORIGINALES (calculado): ${totalSharesOriginales.toFixed(4)}`);
  
  if (operations.length > 0) {
    // Función helper para convertir valores a número de forma segura
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      if (val && typeof val.toString === 'function') return parseFloat(val.toString()) || 0;
      return parseFloat(val) || 0;
    };
    
    const opSummary = operations.reduce((acc, op) => {
      const qty = toNumber(op.quantity);
      if (op.operationType === 'COMPRA') {
        acc.totalCompras += Math.abs(qty);
      } else if (op.operationType === 'VENTA') {
        acc.totalVentas += Math.abs(qty);
      }
      return acc;
    }, { totalCompras: 0, totalVentas: 0 });
    
    const diffOperaciones = opSummary.totalCompras - opSummary.totalVentas;
    print(`\n📊 DIFERENCIA DE OPERACIONES (Compras - Ventas): ${diffOperaciones.toFixed(4)}`);
    
    // Comparar
    const diferencia = Math.abs(distSummary.totalSharesRestantes - diffOperaciones);
    print(`\n⚠️  COMPARACIÓN:`);
    print(`   Shares Restantes (Distribuciones): ${distSummary.totalSharesRestantes.toFixed(4)}`);
    print(`   Diferencia (Operaciones): ${diffOperaciones.toFixed(4)}`);
    print(`   Diferencia entre ambos: ${diferencia.toFixed(4)}`);
    
    if (diferencia > 0.01) {
      print(`   ⚠️  HAY UNA DISCREPANCIA DE ${diferencia.toFixed(4)} shares`);
    } else {
      print(`   ✅ Los valores coinciden (diferencia < 0.01)`);
    }
  }
} else {
  print(`❌ No se encontraron distribuciones para ${symbol}`);
  print(`   Esto significa que no hay shares restantes en la base de datos`);
}

// ============================================
// 5. DETECCIÓN DE DISCREPANCIAS ENTRE DISTRIBUCIONES Y ALERTAS
// ============================================
print("\n\n🔍 ============================================");
print("5. DETECCIÓN DE DISCREPANCIAS");
print("============================================\n");

if (distributions.length > 0 && alerts.length > 0) {
  print("🔍 Comparando distribuciones de liquidez vs liquidityData de alertas...\n");
  
  // Función helper para convertir valores a número de forma segura
  const toNumber = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (val && typeof val.toString === 'function') return parseFloat(val.toString()) || 0;
    return parseFloat(val) || 0;
  };
  
  let discrepanciasEncontradas = 0;
  
  distributions.forEach((dist, distIndex) => {
    // Buscar la alerta correspondiente
    const alertaCorrespondiente = alerts.find(a => a._id.toString() === dist.alertId.toString());
    
    if (!alertaCorrespondiente) {
      print(`⚠️  Distribución ${distIndex + 1}: No se encontró alerta correspondiente (Alert ID: ${dist.alertId})`);
      discrepanciasEncontradas++;
      return;
    }
    
    if (!alertaCorrespondiente.liquidityData) {
      print(`⚠️  Distribución ${distIndex + 1} (${dist.symbol}): La alerta no tiene liquidityData`);
      discrepanciasEncontradas++;
      return;
    }
    
    const distShares = toNumber(dist.shares);
    const distSoldShares = toNumber(dist.soldShares);
    const distAllocatedAmount = toNumber(dist.allocatedAmount);
    const distEntryPrice = toNumber(dist.entryPrice);
    
    const alertShares = toNumber(alertaCorrespondiente.liquidityData.shares);
    const alertOriginalShares = toNumber(alertaCorrespondiente.liquidityData.originalShares);
    const alertAllocatedAmount = toNumber(alertaCorrespondiente.liquidityData.allocatedAmount);
    const alertOriginalAllocatedAmount = toNumber(alertaCorrespondiente.liquidityData.originalAllocatedAmount);
    
    // Calcular shares originales de la distribución
    const distOriginalShares = distShares + distSoldShares;
    
    print(`\n--- Comparación Distribución ${distIndex + 1} vs Alerta ---`);
    print(`Symbol: ${dist.symbol}`);
    print(`Pool: ${dist.pool}`);
    print(`Alert ID: ${dist.alertId}`);
    
    let tieneDiscrepancias = false;
    
    // Comparar shares originales
    const diffOriginalShares = Math.abs(distOriginalShares - alertOriginalShares);
    if (diffOriginalShares > 0.01) {
      print(`❌ DISCREPANCIA en Shares ORIGINALES:`);
      print(`   Distribución: ${distOriginalShares.toFixed(4)}`);
      print(`   Alerta (originalShares): ${alertOriginalShares.toFixed(4)}`);
      print(`   Diferencia: ${diffOriginalShares.toFixed(4)} shares`);
      tieneDiscrepancias = true;
    } else {
      print(`✅ Shares ORIGINALES coinciden: ${distOriginalShares.toFixed(4)}`);
    }
    
    // Comparar shares restantes
    const diffShares = Math.abs(distShares - alertShares);
    if (diffShares > 0.01) {
      print(`❌ DISCREPANCIA en Shares RESTANTES:`);
      print(`   Distribución: ${distShares.toFixed(4)}`);
      print(`   Alerta (shares): ${alertShares.toFixed(4)}`);
      print(`   Diferencia: ${diffShares.toFixed(4)} shares`);
      tieneDiscrepancias = true;
    } else {
      print(`✅ Shares RESTANTES coinciden: ${distShares.toFixed(4)}`);
    }
    
    // Comparar allocated amount
    const diffAllocatedAmount = Math.abs(distAllocatedAmount - alertAllocatedAmount);
    if (diffAllocatedAmount > 0.01) {
      print(`❌ DISCREPANCIA en Allocated Amount:`);
      print(`   Distribución: $${distAllocatedAmount.toFixed(2)}`);
      print(`   Alerta (allocatedAmount): $${alertAllocatedAmount.toFixed(2)}`);
      print(`   Diferencia: $${diffAllocatedAmount.toFixed(2)}`);
      tieneDiscrepancias = true;
    } else {
      print(`✅ Allocated Amount coincide: $${distAllocatedAmount.toFixed(2)}`);
    }
    
    // Comparar allocated amount original si existe
    if (alertOriginalAllocatedAmount > 0) {
      // No hay un campo "originalAllocatedAmount" en distribuciones, pero podemos comparar con el allocatedAmount actual
      // si es muy diferente, puede ser una discrepancia
      const diffOriginalAllocated = Math.abs(distAllocatedAmount - alertOriginalAllocatedAmount);
      if (diffOriginalAllocated > 1.00) {
        print(`⚠️  Diferencia en Allocated Amount vs Original:`);
        print(`   Distribución (actual): $${distAllocatedAmount.toFixed(2)}`);
        print(`   Alerta (originalAllocatedAmount): $${alertOriginalAllocatedAmount.toFixed(2)}`);
        print(`   Diferencia: $${diffOriginalAllocated.toFixed(2)}`);
        print(`   (Nota: Esto puede ser normal si hubo ventas parciales)`);
      }
    }
    
    // Verificar participación percentage en alerta vs distribución
    const alertParticipation = toNumber(alertaCorrespondiente.participationPercentage);
    if (alertParticipation > 0 && distShares > 0) {
      print(`⚠️  Alerta tiene Participation Percentage: ${alertParticipation.toFixed(2)}%`);
      print(`   Pero la distribución tiene ${distShares.toFixed(4)} shares restantes`);
      print(`   (Si la alerta está CLOSED, participationPercentage debería ser 0%)`);
      if (alertaCorrespondiente.status === 'CLOSED' && alertParticipation > 0) {
        print(`   ❌ La alerta está CLOSED pero tiene participationPercentage > 0`);
        tieneDiscrepancias = true;
      }
    }
    
    if (tieneDiscrepancias) {
      discrepanciasEncontradas++;
      print(`\n💡 RECOMENDACIÓN: Revisar y sincronizar los datos entre distribución y alerta`);
    }
  });
  
  print(`\n📊 RESUMEN DE DISCREPANCIAS:`);
  if (discrepanciasEncontradas === 0) {
    print(`✅ No se encontraron discrepancias significativas`);
  } else {
    print(`⚠️  Se encontraron ${discrepanciasEncontradas} distribución(es) con discrepancias`);
    print(`   Se recomienda revisar y sincronizar estos datos`);
  }
} else {
  if (distributions.length === 0) {
    print(`ℹ️  No hay distribuciones para comparar`);
  }
  if (alerts.length === 0) {
    print(`ℹ️  No hay alertas para comparar`);
  }
}

print("\n✅ Análisis completado.\n");

