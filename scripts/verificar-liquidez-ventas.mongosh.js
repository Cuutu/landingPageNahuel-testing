/*******************************
 * VERIFICAR LIQUIDEZ LIBERADA POR VENTAS
 * 
 * Verifica que la liquidez esté correctamente liberada
 * para las ventas de XP, AMD y AVGO
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  pool: POOL
});

/****************************************
 * 1) Obtener documento principal de Liquidity
 ****************************************/
print("\n=== 1) Buscando documento de Liquidity ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length === 0) {
  print("❌ No se encontró ningún documento de Liquidity para este pool.");
  quit();
}

const mainDoc = liquidityDocs
  .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];

print(`Usando Liquidity._id = ${mainDoc._id} como documento principal.`);
print(`Initial Liquidity: $${(mainDoc.initialLiquidity || 0).toFixed(2)}`);
print(`Available Liquidity: $${(mainDoc.availableLiquidity || 0).toFixed(2)}`);
print(`Distributed Liquidity: $${(mainDoc.distributedLiquidity || 0).toFixed(2)}`);

/****************************************
 * 2) Buscar ventas específicas
 ****************************************/
print("\n=== 2) Buscando ventas específicas ===");

const TICKERS_OBJETIVO = ["XP", "AMD", "AVGO"];

const ventas = opsColl
  .find({
    system: POOL,
    operationType: "VENTA",
    ticker: { $in: TICKERS_OBJETIVO }
  })
  .sort({ createdAt: 1 })
  .toArray();

print(`Total ventas encontradas: ${ventas.length}`);

if (ventas.length === 0) {
  print("⚠️ No se encontraron ventas para estos tickers.");
  quit();
}

/****************************************
 * 3) Analizar cada venta y su distribución
 ****************************************/
print("\n=== 3) Análisis de liquidez por venta ===");

const problemas = [];
const resumen = [];

ventas.forEach((venta, idx) => {
  const fecha = new Date(venta.createdAt);
  const fechaStr = fecha.toISOString().split('T')[0];
  
  print(`\n--- Venta ${idx + 1}: ${venta.ticker} (${fechaStr}) ---`);
  print(`  Operation ID: ${venta._id}`);
  print(`  Status: ${venta.status}`);
  const amountValue = typeof venta.amount === 'number' ? venta.amount : (venta.amount ? parseFloat(venta.amount) : null);
  print(`  Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
  print(`  Price: ${venta.price || 'N/A'}`);
  print(`  Quantity: ${venta.quantity || 'N/A'}`);
  print(`  isPartialSale: ${venta.isPartialSale || false}`);
  
  if (!venta.alertId) {
    print(`  ⚠️ Sin alertId - no se puede verificar distribución`);
    return;
  }
  
  const alert = alertsColl.findOne({ _id: venta.alertId });
  if (!alert) {
    print(`  ⚠️ Alert no encontrada`);
    return;
  }
  
  print(`  Alert: ${alert.symbol} (status: ${alert.status})`);
  
  // Buscar distribución en Liquidity
  const distribution = (mainDoc.distributions || []).find((dist) => 
    dist.alertId && dist.alertId.toString() === venta.alertId.toString()
  );
  
  if (!distribution) {
    print(`  ❌ NO se encontró distribution para esta alerta`);
    problemas.push({
      ticker: venta.ticker,
      operationId: venta._id,
      problema: "No hay distribution en Liquidity"
    });
    return;
  }
  
  print(`  ✅ Distribution encontrada:`);
  print(`     Symbol: ${distribution.symbol}`);
  print(`     Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}`);
  print(`     Shares originales: ${(distribution.shares || 0).toFixed(6)}`);
  print(`     Sold Shares: ${(distribution.soldShares || 0).toFixed(6)}`);
  print(`     Shares restantes: ${((distribution.shares || 0) - (distribution.soldShares || 0)).toFixed(6)}`);
  print(`     Realized Profit/Loss: $${(distribution.realizedProfitLoss || 0).toFixed(2)}`);
  print(`     isActive: ${distribution.isActive}`);
  
  // Verificar ventas parciales en la alerta
  if (alert.liquidityData && alert.liquidityData.partialSales) {
    const partialSales = alert.liquidityData.partialSales || [];
    const ejecutadas = partialSales.filter((s) => s.executed);
    
    print(`  Ventas parciales en alerta: ${ejecutadas.length} ejecutadas de ${partialSales.length} totales`);
    
    if (ejecutadas.length > 0) {
      let totalSharesVendidosEnAlerta = 0;
      ejecutadas.forEach((sale, saleIdx) => {
        const sharesVendidos = sale.sharesVendidos || (sale.percentage ? (distribution.shares * sale.percentage / 100) : 0);
        totalSharesVendidosEnAlerta += sharesVendidos;
        print(`     ${saleIdx + 1}. ${sale.percentage || 'N/A'}% ejecutada a $${sale.sellPrice || sale.precio || 'N/A'} - Shares: ${sharesVendidos.toFixed(6)}`);
      });
      
      print(`  Total shares vendidos según alerta: ${totalSharesVendidosEnAlerta.toFixed(6)}`);
      print(`  Total shares vendidos según distribution: ${(distribution.soldShares || 0).toFixed(6)}`);
      
      // Comparar shares vendidos
      const diferencia = Math.abs(totalSharesVendidosEnAlerta - (distribution.soldShares || 0));
      if (diferencia > 0.0001) {
        print(`  ⚠️ DISCREPANCIA: Diferencia de ${diferencia.toFixed(6)} shares`);
        problemas.push({
          ticker: venta.ticker,
          operationId: venta._id,
          problema: `Discrepancia en soldShares: alerta tiene ${totalSharesVendidosEnAlerta.toFixed(6)}, distribution tiene ${(distribution.soldShares || 0).toFixed(6)}`
        });
      } else {
        print(`  ✅ Shares vendidos coinciden`);
      }
    }
  }
  
  // Calcular liquidez que debería estar liberada
  const sharesVendidos = Math.abs(venta.quantity || 0);
  const montoLiberado = sharesVendidos * (distribution.entryPrice || 0);
  
  print(`  Liquidez que debería estar liberada:`);
  print(`     Shares vendidos en esta venta: ${sharesVendidos.toFixed(6)}`);
  print(`     Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}`);
  print(`     Monto liberado (cost basis): $${montoLiberado.toFixed(2)}`);
  
  resumen.push({
    ticker: venta.ticker,
    operationId: venta._id,
    status: venta.status,
    sharesVendidos: sharesVendidos,
    montoLiberado: montoLiberado,
    distribution: {
      allocatedAmount: distribution.allocatedAmount,
      soldShares: distribution.soldShares,
      shares: distribution.shares,
      realizedProfitLoss: distribution.realizedProfitLoss
    }
  });
});

/****************************************
 * 4) Verificar liquidez disponible total
 ****************************************/
print("\n=== 4) Verificación de liquidez disponible ===");

// Calcular liquidez que debería estar disponible
let totalDistribuido = 0;
let totalVendido = 0;
let totalRealizedPL = 0;

(mainDoc.distributions || []).forEach((dist) => {
  if (dist.isActive) {
    totalDistribuido += dist.allocatedAmount || 0;
    totalVendido += (dist.soldShares || 0) * (dist.entryPrice || 0);
    totalRealizedPL += dist.realizedProfitLoss || 0;
  }
});

const liquidezEsperada = (mainDoc.initialLiquidity || 0) - totalDistribuido + totalVendido + totalRealizedPL;
const liquidezActual = mainDoc.availableLiquidity || 0;
const diferenciaLiquidez = Math.abs(liquidezEsperada - liquidezActual);

print(`Liquidez inicial: $${(mainDoc.initialLiquidity || 0).toFixed(2)}`);
print(`Total distribuido (activo): $${totalDistribuido.toFixed(2)}`);
print(`Total vendido (cost basis): $${totalVendido.toFixed(2)}`);
print(`Total realized P&L: $${totalRealizedPL.toFixed(2)}`);
print(`Liquidez esperada: $${liquidezEsperada.toFixed(2)}`);
print(`Liquidez actual: $${liquidezActual.toFixed(2)}`);
print(`Diferencia: $${diferenciaLiquidez.toFixed(2)}`);

if (diferenciaLiquidez > 0.01) {
  print(`⚠️ DISCREPANCIA en liquidez disponible`);
  problemas.push({
    tipo: "LIQUIDEZ_DISPONIBLE",
    problema: `Diferencia de $${diferenciaLiquidez.toFixed(2)} entre liquidez esperada y actual`
  });
} else {
  print(`✅ Liquidez disponible correcta`);
}

/****************************************
 * 5) Resumen de problemas
 ****************************************/
print("\n=== 5) RESUMEN DE PROBLEMAS ===");

if (problemas.length === 0) {
  print("✅ No se encontraron problemas con la liquidez.");
} else {
  print(`Total problemas encontrados: ${problemas.length}`);
  problemas.forEach((prob, idx) => {
    print(`\n${idx + 1}. ${prob.ticker || prob.tipo || 'N/A'}`);
    if (prob.operationId) {
      print(`   Operation ID: ${prob.operationId}`);
    }
    print(`   Problema: ${prob.problema}`);
  });
}

print("\n=== FIN VERIFICACIÓN ===");
