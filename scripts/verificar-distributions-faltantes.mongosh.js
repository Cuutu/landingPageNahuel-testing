/*******************************
 * VERIFICAR DISTRIBUTIONS FALTANTES
 * 
 * Analiza si las distributions de TWLO y AMX fueron eliminadas
 * o nunca se crearon
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall";

// Alert IDs de las compras activas sin distribution
const ALERT_IDS = [
  "69778f3e4b846b470e89d2d9", // TWLO
  "6978ea8a006b6bdd598df20f"  // AMX
];

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  pool: POOL,
  alertIds: ALERT_IDS
});

/****************************************
 * 1) Verificar alerts
 ****************************************/
print("\n=== 1) Verificar alerts ===");

ALERT_IDS.forEach((alertIdStr, idx) => {
  const alertId = ObjectId(alertIdStr);
  const alert = alertsColl.findOne({ _id: alertId });
  
  if (!alert) {
    print(`\n❌ Alert ${idx + 1} (${alertIdStr}) NO encontrada`);
    return;
  }
  
  print(`\n--- Alert ${idx + 1}: ${alert.symbol} ---`);
  print(`  ID: ${alert._id}`);
  print(`  Status: ${alert.status}`);
  print(`  liquidityPercentage: ${alert.liquidityPercentage || 'N/A'}%`);
  print(`  Creada: ${alert.createdAt}`);
  print(`  Actualizada: ${alert.updatedAt}`);
});

/****************************************
 * 2) Buscar distributions en Liquidity
 ****************************************/
print("\n=== 2) Buscar distributions en Liquidity ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();
print(`Total documentos de Liquidity encontrados: ${liquidityDocs.length}`);

if (liquidityDocs.length === 0) {
  print("⚠️ No se encontraron documentos de Liquidity para este pool.");
  quit();
}

// Buscar en todos los documentos
ALERT_IDS.forEach((alertIdStr, idx) => {
  const alertId = ObjectId(alertIdStr);
  const alert = alertsColl.findOne({ _id: alertId });
  
  if (!alert) return;
  
  print(`\n--- Buscando distribution para ${alert.symbol} (${alertIdStr}) ---`);
  
  let foundInAnyDoc = false;
  
  liquidityDocs.forEach((doc, docIdx) => {
    const distributions = doc.distributions || [];
    const matchingDist = distributions.find(d => 
      d.alertId && d.alertId.toString() === alertIdStr
    );
    
    if (matchingDist) {
      foundInAnyDoc = true;
      print(`  ✅ Encontrada en documento ${docIdx + 1} (${doc._id}):`);
      print(`     Symbol: ${matchingDist.symbol}`);
      print(`     isActive: ${matchingDist.isActive}`);
      print(`     allocatedAmount: $${matchingDist.allocatedAmount || 0}`);
      print(`     percentage: ${matchingDist.percentage || 0}%`);
      print(`     createdAt: ${matchingDist.createdAt || 'N/A'}`);
      print(`     updatedAt: ${matchingDist.updatedAt || 'N/A'}`);
    }
  });
  
  if (!foundInAnyDoc) {
    print(`  ❌ NO se encontró distribution para esta alert en ningún documento`);
  }
});

/****************************************
 * 3) Verificar si hay distributions inactivas
 ****************************************/
print("\n=== 3) Distributions inactivas o eliminadas ===");

ALERT_IDS.forEach((alertIdStr, idx) => {
  const alertId = ObjectId(alertIdStr);
  const alert = alertsColl.findOne({ _id: alertId });
  
  if (!alert) return;
  
  print(`\n--- ${alert.symbol} (${alertIdStr}) ---`);
  
  liquidityDocs.forEach((doc, docIdx) => {
    const distributions = doc.distributions || [];
    const matchingDist = distributions.find(d => 
      d.alertId && d.alertId.toString() === alertIdStr
    );
    
    if (matchingDist) {
      if (!matchingDist.isActive) {
        print(`  ⚠️ Distribution encontrada pero INACTIVA en documento ${docIdx + 1}:`);
        print(`     isActive: ${matchingDist.isActive}`);
        print(`     allocatedAmount: $${matchingDist.allocatedAmount || 0}`);
      }
    }
  });
});

/****************************************
 * 4) Resumen y recomendaciones
 ****************************************/
print("\n=== 4) RESUMEN ===");

const problemas = [];

ALERT_IDS.forEach((alertIdStr, idx) => {
  const alertId = ObjectId(alertIdStr);
  const alert = alertsColl.findOne({ _id: alertId });
  
  if (!alert) {
    problemas.push({
      alertId: alertIdStr,
      problema: "Alert no encontrada"
    });
    return;
  }
  
  let foundDistribution = false;
  let isActive = false;
  
  liquidityDocs.forEach((doc) => {
    const distributions = doc.distributions || [];
    const matchingDist = distributions.find(d => 
      d.alertId && d.alertId.toString() === alertIdStr
    );
    
    if (matchingDist) {
      foundDistribution = true;
      if (matchingDist.isActive) {
        isActive = true;
      }
    }
  });
  
  if (!foundDistribution) {
    problemas.push({
      symbol: alert.symbol,
      alertId: alertIdStr,
      problema: "Distribution nunca creada"
    });
  } else if (!isActive) {
    problemas.push({
      symbol: alert.symbol,
      alertId: alertIdStr,
      problema: "Distribution existe pero está inactiva"
    });
  }
});

if (problemas.length > 0) {
  print(`\nTotal problemas encontrados: ${problemas.length}`);
  problemas.forEach((prob, idx) => {
    print(`\n${idx + 1}. ${prob.symbol || 'N/A'} (${prob.alertId})`);
    print(`   Problema: ${prob.problema}`);
  });
  
  print("\n=== RECOMENDACIONES ===");
  print("Para corregir estos problemas, ejecutá el script:");
  print("  scripts/backfill-liquidity-from-operations.mongosh.js");
  print("\nEste script creará las distributions faltantes basándose en las operations activas.");
} else {
  print("✅ Todas las alerts tienen distributions activas.");
}

print("\n=== FIN VERIFICACIÓN ===");
