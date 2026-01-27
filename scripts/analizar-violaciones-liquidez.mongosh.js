/*******************************
 * ANÁLISIS COMPLETO DE VIOLACIONES
 * Regla: liquidez >= 5% y profit < 0 NO puede existir
 *******************************/
const DRY_RUN = true; // solo lectura

const MIN_LIQ_PCT = 5;
const MIN_PORTF_PCT = 5;

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity; // Mongoose pluraliza a "liquiditys" pero en mongosh se accede como db.liquidity

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  minLiquidityPct: MIN_LIQ_PCT,
  minPortfolioPct: MIN_PORTF_PCT
});

/****************************************
 * 1) ALERTS que violan la regla
 ****************************************/
print("\n=== 1) ALERTS con liquidityPercentage >= 5 y profit < 0 ===");

const badAlerts = alertsColl.find(
  {
    liquidityPercentage: { $gte: MIN_LIQ_PCT },
    profit: { $lt: 0 },
    status: "ACTIVE"
  },
  {
    _id: 1,
    symbol: 1,
    liquidityPercentage: 1,
    participationPercentage: 1,
    profit: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1
  }
).sort({ updatedAt: -1 }).toArray();

printjson(badAlerts);
print(`Total alerts que violan la regla: ${badAlerts.length}`);

/****************************************
 * 2) OPERATIONS asociadas
 ****************************************/
print("\n=== 2) OPERATIONS asociadas a esas alerts ===");

const alertIds = badAlerts.map(a => a._id);

if (alertIds.length > 0) {
  const badOps = opsColl.aggregate([
    {
      $match: {
        alertId: { $in: alertIds },
        status: "ACTIVE"
      }
    },
    {
      $project: {
        _id: 1,
        ticker: 1,
        portfolioPercentage: 1,
        amount: 1,
        operationType: 1,
        system: 1,
        isPartialSale: 1,
        alertId: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ]).toArray();

  printjson(badOps);
  print(`Total operations asociadas: ${badOps.length}`);
} else {
  print("No hay alerts que violen la regla.");
}

/****************************************
 * 3) LIQUIDITY distributions afectadas
 ****************************************/
print("\n=== 3) LIQUIDITY distributions afectadas ===");

try {
  const liquidityDocs = liquidityColl.find({}).toArray();
  
  if (liquidityDocs.length > 0) {
    print(`Total documentos de Liquidity encontrados: ${liquidityDocs.length}`);
    
    liquidityDocs.forEach((doc, idx) => {
      const distributions = doc.distributions || [];
      const affectedDistributions = distributions.filter(d => {
        const alertId = d.alertId ? d.alertId.toString() : null;
        return alertIds.some(id => id.toString() === alertId);
      });
      
      if (affectedDistributions.length > 0) {
        print(`\n--- Documento Liquidity ${idx + 1} (${doc.pool || 'N/A'}) ---`);
        print(`Distribuciones afectadas: ${affectedDistributions.length}`);
        printjson(affectedDistributions.map(d => ({
          alertId: d.alertId,
          symbol: d.symbol,
          allocatedAmount: d.allocatedAmount,
          shares: d.shares,
          isActive: d.isActive,
          profitLoss: d.profitLoss,
          profitLossPercentage: d.profitLossPercentage
        })));
      }
    });
  } else {
    print("No se encontraron documentos de Liquidity.");
  }
} catch (e) {
  print(`⚠️ Error al buscar en Liquidity (puede que la colección tenga otro nombre): ${e.message}`);
  print("Colecciones disponibles:");
  printjson(db.getCollectionNames());
}

/****************************************
 * 4) Resumen de violaciones por símbolo
 ****************************************/
print("\n=== 4) Resumen de violaciones por símbolo ===");

const violationsBySymbol = badAlerts.reduce((acc, alert) => {
  const symbol = alert.symbol;
  if (!acc[symbol]) {
    acc[symbol] = {
      symbol,
      alertIds: [],
      liquidityPercentages: [],
      profits: [],
      count: 0
    };
  }
  acc[symbol].alertIds.push(alert._id);
  acc[symbol].liquidityPercentages.push(alert.liquidityPercentage);
  acc[symbol].profits.push(alert.profit);
  acc[symbol].count++;
  return acc;
}, {});

printjson(Object.values(violationsBySymbol));

/****************************************
 * 5) Recomendaciones
 ****************************************/
print("\n=== 5) RECOMENDACIONES ===");
print("Para corregir estas violaciones, tenés dos opciones:");
print("");
print("A) REDUCIR liquidityPercentage a < 5% cuando profit < 0");
print("   Ejemplo: actualizar alerts con liquidityPercentage = 5 y profit < 0");
print("   a liquidityPercentage = 4.9 (o el valor que corresponda)");
print("");
print("B) FORZAR VENTA automática cuando profit < 0 y liquidityPercentage >= 5");
print("   Esto requeriría crear una operación de venta y actualizar el estado");
print("");
print("C) AGREGAR VALIDACIÓN en el código para prevenir futuras violaciones:");
print("   - En el endpoint que crea/actualiza alerts");
print("   - En el proceso que calcula liquidityPercentage");
print("   - En el proceso que actualiza profit");
print("");
print("=== FIN ANÁLISIS (MODO DRY) ===");
