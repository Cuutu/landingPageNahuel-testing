/**
 * Script para analizar la liquidez disponible y compararla con el gráfico
 * 
 * Este script calcula la liquidez disponible usando la misma fórmula que el endpoint
 * /api/liquidity/summary.ts y compara con los valores almacenados en la base de datos.
 * 
 * INSTRUCCIONES:
 * 1. Conectar a MongoDB: mongosh "tu_connection_string"
 * 2. Usar la base de datos correcta: use nombreDeTuDB
 * 3. Copiar y pegar este script
 * 
 * O ejecutar con: mongosh <connection_string> < scripts/analizar-liquidez-disponible.mongosh.js
 */

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
print("📊 ANÁLISIS DE LIQUIDEZ DISPONIBLE");
print("=".repeat(80));
print("");

// Analizar ambos pools
["TraderCall", "SmartMoney"].forEach(pool => {
  print("\n" + "=".repeat(80));
  print(`🔍 ANÁLISIS DEL POOL: ${pool}`);
  print("=".repeat(80));
  print("");

  // Obtener TODOS los documentos de liquidez del pool
  const liquidityDocs = db.liquidities.find({ pool: pool }).toArray();
  
  if (liquidityDocs.length === 0) {
    print(`❌ No se encontraron documentos de liquidez para el pool ${pool}`);
    print("");
    return;
  }

  print(`📋 Documentos encontrados: ${liquidityDocs.length}`);
  print("");

  // Encontrar el documento principal (el que tiene distributions o el más reciente)
  const docsWithDistributions = liquidityDocs.filter(doc => 
    doc.distributions && doc.distributions.length > 0
  );
  
  const mainDoc = docsWithDistributions.length > 0 
    ? docsWithDistributions.sort((a, b) => 
        new Date(b.updatedAt || b.createdAt || 0).getTime() - 
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      )[0]
    : liquidityDocs.sort((a, b) => 
        new Date(b.updatedAt || b.createdAt || 0).getTime() - 
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      )[0];

  print(`📄 Documento principal seleccionado: ${mainDoc._id}`);
  print(`   Creado: ${mainDoc.createdAt}`);
  print(`   Actualizado: ${mainDoc.updatedAt || 'N/A'}`);
  print("");

  // ============================================
  // VALORES ALMACENADOS EN EL DOCUMENTO
  // ============================================
  print("─".repeat(80));
  print("📊 VALORES ALMACENADOS EN EL DOCUMENTO");
  print("─".repeat(80));
  print("");
  
  const storedInitial = toNumber(mainDoc.initialLiquidity);
  const storedTotal = toNumber(mainDoc.totalLiquidity);
  const storedAvailable = toNumber(mainDoc.availableLiquidity);
  const storedDistributed = toNumber(mainDoc.distributedLiquidity);
  const storedProfitLoss = toNumber(mainDoc.totalProfitLoss);
  
  print(`💰 Liquidez Inicial: $${formatNum(storedInitial)}`);
  print(`💰 Liquidez Total: $${formatNum(storedTotal)}`);
  print(`💰 Liquidez Disponible: $${formatNum(storedAvailable)}`);
  print(`💰 Liquidez Distribuida: $${formatNum(storedDistributed)}`);
  print(`💰 Ganancia/Pérdida Total: $${formatNum(storedProfitLoss)}`);
  print("");

  // ============================================
  // CÁLCULO MANUAL (igual que el endpoint)
  // ============================================
  print("─".repeat(80));
  print("🧮 CÁLCULO MANUAL (fórmula del endpoint /api/liquidity/summary)");
  print("─".repeat(80));
  print("");

  const allDocDistributions = mainDoc.distributions || [];
  print(`📋 Total de distribuciones: ${allDocDistributions.length}`);
  print("");

  // 1. Calcular liquidez inicial global
  let liquidezInicialGlobal = storedInitial;
  print(`1️⃣  Liquidez Inicial Global: $${formatNum(liquidezInicialGlobal)}`);
  print("");

  // 2. Calcular montos distribuidos (solo activas con shares > 0)
  print("2️⃣  Montos Distribuidos (solo distribuciones activas con shares > 0):");
  print("");
  
  let montosDistribuidos = 0;
  const activeDistributions = allDocDistributions.filter(d => 
    d.isActive && toNumber(d.shares) > 0
  );
  
  print(`   Total distribuciones activas: ${activeDistributions.length}`);
  print("");
  
  activeDistributions.forEach((dist, index) => {
    const allocated = toNumber(dist.allocatedAmount);
    const shares = toNumber(dist.shares);
    const entryPrice = toNumber(dist.entryPrice);
    montosDistribuidos += allocated;
    
    print(`   ${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
    print(`      - Allocated Amount: $${formatNum(allocated)}`);
    print(`      - Shares: ${formatNum(shares, 4)}`);
    print(`      - Entry Price: $${formatNum(entryPrice)}`);
    print(`      - Is Active: ${dist.isActive}`);
    print("");
  });
  
  print(`   💰 TOTAL MONTOS DISTRIBUIDOS: $${formatNum(montosDistribuidos)}`);
  print("");

  // 3. Calcular ganancias REALIZADAS
  print("3️⃣  Ganancias REALIZADAS (de ventas completadas):");
  print("");
  
  let gananciasRealizadas = 0;
  const distributionsWithRealized = allDocDistributions.filter(d => 
    toNumber(d.realizedProfitLoss) !== 0
  );
  
  if (distributionsWithRealized.length > 0) {
    distributionsWithRealized.forEach((dist, index) => {
      const realized = toNumber(dist.realizedProfitLoss);
      gananciasRealizadas += realized;
      
      print(`   ${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
      print(`      - Realized Profit/Loss: $${formatNum(realized)}`);
      print(`      - Sold Shares: ${formatNum(toNumber(dist.soldShares), 4)}`);
      print("");
    });
  } else {
    print(`   ℹ️  No hay ganancias realizadas registradas`);
    print("");
  }
  
  print(`   💰 TOTAL GANANCIAS REALIZADAS: $${formatNum(gananciasRealizadas)}`);
  print("");

  // 4. Calcular ganancias NO realizadas (paper gains/losses)
  print("4️⃣  Ganancias NO Realizadas (paper gains/losses de posiciones activas):");
  print("");
  
  let gananciasNoRealizadas = 0;
  const distributionsWithUnrealized = activeDistributions.filter(d => 
    toNumber(d.profitLoss) !== 0
  );
  
  if (distributionsWithUnrealized.length > 0) {
    distributionsWithUnrealized.forEach((dist, index) => {
      const unrealized = toNumber(dist.profitLoss);
      gananciasNoRealizadas += unrealized;
      
      print(`   ${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
      print(`      - Current Price: $${formatNum(toNumber(dist.currentPrice))}`);
      print(`      - Entry Price: $${formatNum(toNumber(dist.entryPrice))}`);
      print(`      - Profit/Loss: $${formatNum(unrealized)}`);
      print(`      - Profit/Loss %: ${formatNum(toNumber(dist.profitLossPercentage))}%`);
      print("");
    });
  } else {
    print(`   ℹ️  No hay ganancias no realizadas (todas las posiciones están en break-even)`);
    print("");
  }
  
  print(`   💰 TOTAL GANANCIAS NO REALIZADAS: $${formatNum(gananciasNoRealizadas)}`);
  print("");

  // 5. Calcular ganancia total
  const gananciaTotalSum = gananciasRealizadas + gananciasNoRealizadas;
  print(`5️⃣  Ganancia Total (Realizadas + No Realizadas): $${formatNum(gananciaTotalSum)}`);
  print("");

  // 6. Calcular liquidez total
  const liquidezTotalSum = liquidezInicialGlobal + gananciaTotalSum;
  print(`6️⃣  Liquidez Total (Inicial + Ganancia Total): $${formatNum(liquidezTotalSum)}`);
  print("");

  // 7. Calcular liquidez disponible (FÓRMULA CORRECTA)
  // Disponible = Inicial - Distribuida + Ganancias Realizadas
  const liquidezDisponibleSum = liquidezInicialGlobal - montosDistribuidos + gananciasRealizadas;
  print(`7️⃣  Liquidez Disponible (Inicial - Distribuida + Ganancias Realizadas):`);
  print(`    $${formatNum(liquidezInicialGlobal)} - $${formatNum(montosDistribuidos)} + $${formatNum(gananciasRealizadas)} = $${formatNum(liquidezDisponibleSum)}`);
  print("");

  // ============================================
  // COMPARACIÓN
  // ============================================
  print("─".repeat(80));
  print("⚖️  COMPARACIÓN: Valores Almacenados vs Cálculo Manual");
  print("─".repeat(80));
  print("");

  const diffTotal = Math.abs(storedTotal - liquidezTotalSum);
  const diffAvailable = Math.abs(storedAvailable - liquidezDisponibleSum);
  const diffDistributed = Math.abs(storedDistributed - montosDistribuidos);
  const diffProfitLoss = Math.abs(storedProfitLoss - gananciaTotalSum);

  print(`💰 Liquidez Total:`);
  print(`   Almacenado: $${formatNum(storedTotal)}`);
  print(`   Calculado:  $${formatNum(liquidezTotalSum)}`);
  print(`   Diferencia: $${formatNum(diffTotal)} ${diffTotal > 0.01 ? '⚠️  DESFASE' : '✅ OK'}`);
  print("");

  print(`💰 Liquidez Disponible:`);
  print(`   Almacenado: $${formatNum(storedAvailable)}`);
  print(`   Calculado:  $${formatNum(liquidezDisponibleSum)}`);
  print(`   Diferencia: $${formatNum(diffAvailable)} ${diffAvailable > 0.01 ? '⚠️  DESFASE' : '✅ OK'}`);
  print("");

  print(`💰 Liquidez Distribuida:`);
  print(`   Almacenado: $${formatNum(storedDistributed)}`);
  print(`   Calculado:  $${formatNum(montosDistribuidos)}`);
  print(`   Diferencia: $${formatNum(diffDistributed)} ${diffDistributed > 0.01 ? '⚠️  DESFASE' : '✅ OK'}`);
  print("");

  print(`💰 Ganancia/Pérdida Total:`);
  print(`   Almacenado: $${formatNum(storedProfitLoss)}`);
  print(`   Calculado:  $${formatNum(gananciaTotalSum)}`);
  print(`   Diferencia: $${formatNum(diffProfitLoss)} ${diffProfitLoss > 0.01 ? '⚠️  DESFASE' : '✅ OK'}`);
  print("");

  // ============================================
  // RESUMEN PARA EL GRÁFICO
  // ============================================
  print("─".repeat(80));
  print("📊 RESUMEN PARA EL GRÁFICO DE ALERTAS");
  print("─".repeat(80));
  print("");

  print(`El gráfico debería mostrar:`);
  print(`   • Liquidez Total: $${formatNum(liquidezTotalSum)}`);
  print(`   • Liquidez Disponible: $${formatNum(liquidezDisponibleSum)}`);
  print(`   • Liquidez Distribuida: $${formatNum(montosDistribuidos)}`);
  print(`   • Ganancia Total: $${formatNum(gananciaTotalSum)}`);
  print("");

  if (diffAvailable > 0.01) {
    print(`⚠️  ADVERTENCIA: Hay un desfase de $${formatNum(diffAvailable)} en la liquidez disponible.`);
    print(`   Esto significa que el gráfico podría mostrar un valor incorrecto.`);
    print(`   Se recomienda ejecutar recalculateDistributions() en el documento de liquidez.`);
    print("");
  } else {
    print(`✅ La liquidez disponible está correcta y coincide con el cálculo.`);
    print("");
  }

  // ============================================
  // DISTRIBUCIONES INACTIVAS O CON SHARES = 0
  // ============================================
  const inactiveDistributions = allDocDistributions.filter(d => 
    !d.isActive || toNumber(d.shares) === 0
  );
  
  if (inactiveDistributions.length > 0) {
    print("─".repeat(80));
    print(`📋 DISTRIBUCIONES INACTIVAS O CON SHARES = 0 (${inactiveDistributions.length})`);
    print("─".repeat(80));
    print("");
    
    inactiveDistributions.forEach((dist, index) => {
      print(`   ${index + 1}. ${dist.symbol} (AlertId: ${dist.alertId})`);
      print(`      - Is Active: ${dist.isActive}`);
      print(`      - Shares: ${formatNum(toNumber(dist.shares), 4)}`);
      print(`      - Allocated Amount: $${formatNum(toNumber(dist.allocatedAmount))}`);
      print(`      - Realized Profit/Loss: $${formatNum(toNumber(dist.realizedProfitLoss))}`);
      print("");
    });
  }
});

print("\n" + "=".repeat(80));
print("✅ ANÁLISIS COMPLETADO");
print("=".repeat(80));
print("");
print("💡 NOTAS:");
print("   • La liquidez disponible se calcula como: Inicial - Distribuida + Ganancias Realizadas");
print("   • Solo las ganancias REALIZADAS vuelven al disponible (no las ganancias en papel)");
print("   • Si hay desfases, ejecutar recalculateDistributions() en el documento de liquidez");
print("");



