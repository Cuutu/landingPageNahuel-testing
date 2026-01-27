/*******************************
 * ANÁLISIS DE DUPLICADOS Y TRIPLICADOS
 * 
 * Detecta símbolos con múltiples alerts/operations/distributions activas
 * que pueden estar causando problemas de liquidez
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall"; // ajustar si es SmartMoney

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  pool: POOL
});

/****************************************
 * 1) Alerts activas agrupadas por símbolo
 ****************************************/
print("\n=== 1) ALERTS activas por símbolo ===");

const alertsBySymbol = alertsColl.aggregate([
  {
    $match: {
      status: "ACTIVE"
      // Nota: Removido filtro de tipo porque puede no existir o tener otro nombre
      // Si necesitás filtrar por tipo, ajustá el campo correcto (puede ser "tipoAlerta", "system", etc.)
    }
  },
  {
    $group: {
      _id: "$symbol",
      count: { $sum: 1 },
      alerts: {
        $push: {
          _id: "$_id",
          symbol: "$symbol",
          liquidityPercentage: "$liquidityPercentage",
          profit: "$profit",
          createdAt: "$createdAt",
          updatedAt: "$updatedAt",
          finalPriceSetAt: "$finalPriceSetAt"
        }
      }
    }
  },
  {
    $match: {
      count: { $gt: 1 } // Solo símbolos con más de una alert activa
    }
  },
  { $sort: { count: -1 } }
]).toArray();

print(`Símbolos con múltiples alerts activas: ${alertsBySymbol.length}`);

if (alertsBySymbol.length > 0) {
  alertsBySymbol.forEach(item => {
    print(`\n--- ${item._id}: ${item.count} alerts activas ---`);
    item.alerts.forEach((alert, idx) => {
      print(`  ${idx + 1}. Alert ID: ${alert._id}`);
      print(`     liquidityPercentage: ${alert.liquidityPercentage || 'N/A'}%`);
      const profitValue = typeof alert.profit === 'number' ? alert.profit : (alert.profit ? parseFloat(alert.profit) : null);
      print(`     profit: ${profitValue !== null && !isNaN(profitValue) ? profitValue.toFixed(2) : 'N/A'}%`);
      print(`     creada: ${alert.createdAt}`);
      print(`     actualizada: ${alert.updatedAt}`);
      if (alert.finalPriceSetAt) {
        print(`     finalPriceSetAt: ${alert.finalPriceSetAt}`);
      }
    });
  });
} else {
  print("✅ No hay símbolos con múltiples alerts activas.");
}

/****************************************
 * 2) Operations activas agrupadas por ticker
 ****************************************/
print("\n=== 2) OPERATIONS activas por ticker ===");

const opsByTicker = opsColl.aggregate([
  {
    $match: {
      status: "ACTIVE",
      system: POOL,
      operationType: "COMPRA" // Solo compras activas
    }
  },
  {
    $group: {
      _id: "$ticker",
      count: { $sum: 1 },
      operations: {
        $push: {
          _id: "$_id",
          ticker: "$ticker",
          amount: "$amount",
          portfolioPercentage: "$portfolioPercentage",
          alertId: "$alertId",
          createdAt: "$createdAt",
          updatedAt: "$updatedAt"
        }
      }
    }
  },
  {
    $match: {
      count: { $gt: 1 } // Solo tickers con más de una operation activa
    }
  },
  { $sort: { count: -1 } }
]).toArray();

print(`Tickers con múltiples operations activas (COMPRA): ${opsByTicker.length}`);

if (opsByTicker.length > 0) {
  opsByTicker.forEach(item => {
    const totalAmount = item.operations.reduce((sum, op) => sum + (op.amount || 0), 0);
    print(`\n--- ${item._id}: ${item.count} operations activas (Total: $${totalAmount.toFixed(2)}) ---`);
    item.operations.forEach((op, idx) => {
      print(`  ${idx + 1}. Operation ID: ${op._id}`);
      const amountValue = typeof op.amount === 'number' ? op.amount : (op.amount ? parseFloat(op.amount) : null);
      print(`     amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
      print(`     portfolioPercentage: ${op.portfolioPercentage || 'N/A'}%`);
      print(`     alertId: ${op.alertId}`);
      print(`     creada: ${op.createdAt}`);
    });
  });
} else {
  print("✅ No hay tickers con múltiples operations activas.");
}

/****************************************
 * 3) Liquidity distributions agrupadas por símbolo
 ****************************************/
print("\n=== 3) LIQUIDITY distributions activas por símbolo ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length > 0) {
  const distributionsBySymbol = {};
  
  liquidityDocs.forEach(doc => {
    (doc.distributions || []).forEach(dist => {
      if (dist.isActive) {
        const symbol = dist.symbol;
        if (!distributionsBySymbol[symbol]) {
          distributionsBySymbol[symbol] = [];
        }
        distributionsBySymbol[symbol].push({
          alertId: dist.alertId,
          symbol: dist.symbol,
          allocatedAmount: dist.allocatedAmount,
          shares: dist.shares,
          entryPrice: dist.entryPrice,
          currentPrice: dist.currentPrice,
          profitLoss: dist.profitLoss,
          profitLossPercentage: dist.profitLossPercentage,
          docId: doc._id
        });
      }
    });
  });
  
  const duplicates = Object.entries(distributionsBySymbol)
    .filter(([symbol, dists]) => dists.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  print(`Símbolos con múltiples distributions activas: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    duplicates.forEach(([symbol, dists]) => {
      const totalAllocated = dists.reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
      print(`\n--- ${symbol}: ${dists.length} distributions activas (Total: $${totalAllocated.toFixed(2)}) ---`);
      dists.forEach((dist, idx) => {
        print(`  ${idx + 1}. alertId: ${dist.alertId}`);
        print(`     allocatedAmount: $${dist.allocatedAmount?.toFixed(2) || 'N/A'}`);
        print(`     shares: ${dist.shares?.toFixed(4) || 'N/A'}`);
        print(`     entryPrice: $${dist.entryPrice?.toFixed(2) || 'N/A'}`);
        print(`     profitLoss: $${dist.profitLoss?.toFixed(2) || 'N/A'} (${dist.profitLossPercentage?.toFixed(2) || 'N/A'}%)`);
        print(`     docId: ${dist.docId}`);
      });
    });
  } else {
    print("✅ No hay símbolos con múltiples distributions activas.");
  }
} else {
  print("⚠️ No se encontraron documentos de Liquidity.");
}

/****************************************
 * 4) Análisis cruzado: alerts vs operations vs distributions
 ****************************************/
print("\n=== 4) Análisis cruzado: símbolos problemáticos ===");

// Obtener todos los símbolos únicos de alerts activas
const allActiveSymbols = [...new Set(
  alertsColl.find({ status: "ACTIVE" }).toArray().map(a => a.symbol)
)];

const problematicSymbols = [];

allActiveSymbols.forEach(symbol => {
  const alertCount = alertsColl.countDocuments({ symbol, status: "ACTIVE" });
  const opCount = opsColl.countDocuments({ ticker: symbol, status: "ACTIVE", operationType: "COMPRA" });
  
  let distCount = 0;
  liquidityDocs.forEach(doc => {
    distCount += (doc.distributions || []).filter(
      d => d.symbol === symbol && d.isActive
    ).length;
  });
  
  if (alertCount > 1 || opCount > 1 || distCount > 1) {
    problematicSymbols.push({
      symbol,
      alerts: alertCount,
      operations: opCount,
      distributions: distCount,
      totalAllocated: 0 // Se calculará después
    });
  }
});

if (problematicSymbols.length > 0) {
  print(`\nSímbolos con duplicados/triplicados encontrados: ${problematicSymbols.length}`);
  
  problematicSymbols.forEach(item => {
    // Calcular total allocated desde operations
    const ops = opsColl.find({ ticker: item.symbol, status: "ACTIVE", operationType: "COMPRA" }).toArray();
    const totalFromOps = ops.reduce((sum, op) => sum + Math.abs(op.amount || 0), 0);
    
    // Calcular total desde distributions
    let totalFromDist = 0;
    liquidityDocs.forEach(doc => {
      (doc.distributions || []).forEach(dist => {
        if (dist.symbol === item.symbol && dist.isActive) {
          totalFromDist += dist.allocatedAmount || 0;
        }
      });
    });
    
    print(`\n--- ${item.symbol} ---`);
    print(`  Alerts activas: ${item.alerts}`);
    print(`  Operations activas (COMPRA): ${item.operations}`);
    print(`  Distributions activas: ${item.distributions}`);
    print(`  Total desde operations: $${totalFromOps.toFixed(2)}`);
    print(`  Total desde distributions: $${totalFromDist.toFixed(2)}`);
    
    if (Math.abs(totalFromOps - totalFromDist) > 0.01) {
      print(`  ⚠️ DISCREPANCIA: $${Math.abs(totalFromOps - totalFromDist).toFixed(2)}`);
    }
  });
} else {
  print("✅ No se encontraron símbolos con duplicados/triplicados.");
}

/****************************************
 * 5) Casos específicos: AMX y TWLO
 ****************************************/
print("\n=== 5) Análisis específico: AMX y TWLO ===");

["AMX", "TWLO"].forEach(symbol => {
  print(`\n--- ${symbol} ---`);
  
  const alerts = alertsColl.find({ symbol, status: "ACTIVE" }).toArray();
  print(`Alerts activas: ${alerts.length}`);
  alerts.forEach((alert, idx) => {
    print(`  ${idx + 1}. ID: ${alert._id}`);
    print(`     liquidityPercentage: ${alert.liquidityPercentage || 'N/A'}%`);
    const profitValue = typeof alert.profit === 'number' ? alert.profit : (alert.profit ? parseFloat(alert.profit) : null);
    print(`     profit: ${profitValue !== null && !isNaN(profitValue) ? profitValue.toFixed(2) : 'N/A'}%`);
    print(`     creada: ${alert.createdAt}`);
    print(`     finalPriceSetAt: ${alert.finalPriceSetAt || 'NO'}`);
  });
  
  const ops = opsColl.find({ ticker: symbol, status: "ACTIVE" }).toArray();
  print(`\nOperations activas: ${ops.length}`);
  ops.forEach((op, idx) => {
    print(`  ${idx + 1}. ID: ${op._id}`);
    print(`     tipo: ${op.operationType}`);
    const amountValue = typeof op.amount === 'number' ? op.amount : (op.amount ? parseFloat(op.amount) : null);
    print(`     amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`     portfolioPercentage: ${op.portfolioPercentage || 'N/A'}%`);
    print(`     alertId: ${op.alertId}`);
    print(`     creada: ${op.createdAt}`);
  });
  
  let distCount = 0;
  liquidityDocs.forEach(doc => {
    const dists = (doc.distributions || []).filter(
      d => d.symbol === symbol && d.isActive
    );
    distCount += dists.length;
    if (dists.length > 0) {
      print(`\nDistributions en doc ${doc._id}: ${dists.length}`);
      dists.forEach((dist, idx) => {
        print(`  ${idx + 1}. alertId: ${dist.alertId}`);
        print(`     allocatedAmount: $${dist.allocatedAmount?.toFixed(2)}`);
        print(`     shares: ${dist.shares?.toFixed(4)}`);
      });
    }
  });
  print(`Total distributions activas: ${distCount}`);
});

print("\n=== FIN ANÁLISIS DE DUPLICADOS ===");
