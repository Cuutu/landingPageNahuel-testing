/*******************************
 * CORRECCIÓN DE VIOLACIONES
 * Regla: liquidez >= 5% y profit < 0 NO puede existir
 * 
 * Este script reduce liquidityPercentage a 4.9% cuando profit < 0
 * para cumplir con la regla de negocio.
 *******************************/
const DRY_RUN = true; // Cambiar a false para ejecutar las correcciones
const MIN_LIQ_PCT = 5;
const NEW_LIQ_PCT = 4.9; // Nuevo valor cuando hay violación

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura - no hará cambios)" : "OFF (EJECUTARÁ CAMBIOS)",
  minLiquidityPct: MIN_LIQ_PCT,
  newLiquidityPct: NEW_LIQ_PCT
});

if (!DRY_RUN) {
  print("\n⚠️⚠️⚠️ ATENCIÓN: DRY_RUN está en FALSE ⚠️⚠️⚠️");
  print("Este script MODIFICARÁ los datos en la base.");
  print("Asegurate de haber revisado bien antes de continuar.");
  print("");
}

/****************************************
 * 1) Encontrar todas las violaciones
 ****************************************/
print("\n=== 1) Buscando violaciones ===");

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
    profit: 1,
    status: 1
  }
).sort({ updatedAt: -1 }).toArray();

print(`Total alerts que violan la regla: ${badAlerts.length}`);

if (badAlerts.length === 0) {
  print("✅ No hay violaciones que corregir.");
  print("=== FIN SCRIPT ===");
  // Exit early
} else {
  printjson(badAlerts.map(a => ({
    _id: a._id,
    symbol: a.symbol,
    liquidityPercentage: a.liquidityPercentage,
    profit: a.profit
  })));

  /****************************************
   * 2) Mostrar qué se va a cambiar
   ****************************************/
  print("\n=== 2) Cambios propuestos ===");
  print(`Se actualizarán ${badAlerts.length} alerts:`);
  
  badAlerts.forEach(alert => {
    print(`  - ${alert.symbol}: liquidityPercentage ${alert.liquidityPercentage}% → ${NEW_LIQ_PCT}%`);
  });

  /****************************************
   * 3) Ejecutar correcciones (si DRY_RUN = false)
   ****************************************/
  if (!DRY_RUN) {
    print("\n=== 3) Ejecutando correcciones ===");
    
    const alertIds = badAlerts.map(a => a._id);
    let updatedCount = 0;
    
    alertIds.forEach(alertId => {
      const result = alertsColl.updateOne(
        { _id: alertId },
        { 
          $set: { 
            liquidityPercentage: NEW_LIQ_PCT,
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        updatedCount++;
        const alert = badAlerts.find(a => a._id.toString() === alertId.toString());
        print(`✅ Actualizado: ${alert.symbol} (${alertId})`);
      } else {
        print(`⚠️ No se pudo actualizar: ${alertId}`);
      }
    });
    
    print(`\nTotal alerts actualizadas: ${updatedCount} de ${badAlerts.length}`);
    
    /****************************************
     * 4) Verificar que las correcciones funcionaron
     ****************************************/
    print("\n=== 4) Verificación post-corrección ===");
    
    const remainingViolations = alertsColl.countDocuments({
      liquidityPercentage: { $gte: MIN_LIQ_PCT },
      profit: { $lt: 0 },
      status: "ACTIVE"
    });
    
    if (remainingViolations === 0) {
      print("✅ Todas las violaciones fueron corregidas.");
    } else {
      print(`⚠️ Aún quedan ${remainingViolations} violaciones.`);
    }
    
  } else {
    print("\n=== 3) Modo DRY RUN - No se ejecutaron cambios ===");
    print("Para ejecutar las correcciones, cambiá DRY_RUN a false.");
  }
}

print("\n=== FIN SCRIPT ===");
