/*******************************
 * LIMPIEZA DE ALERTS DUPLICADAS
 * 
 * Cierra alerts antiguas que deberían estar cerradas:
 * - Alerts sin liquidityPercentage (sistema viejo)
 * - Alerts más antiguas cuando hay una más nueva del mismo símbolo
 * - Solo si no tienen operations activas asociadas
 *******************************/
const DRY_RUN = false; // Cambiar a false para ejecutar las correcciones
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura - no hará cambios)" : "OFF (EJECUTARÁ CAMBIOS)",
  pool: POOL
});

if (!DRY_RUN) {
  print("\n⚠️⚠️⚠️ ATENCIÓN: DRY_RUN está en FALSE ⚠️⚠️⚠️");
  print("Este script MODIFICARÁ los datos en la base.");
  print("Asegurate de haber revisado bien antes de continuar.");
  print("");
}

/****************************************
 * 1) Encontrar símbolos con múltiples alerts activas
 ****************************************/
print("\n=== 1) Buscando símbolos con múltiples alerts activas ===");

const alertsBySymbol = alertsColl.aggregate([
  {
    $match: {
      status: "ACTIVE"
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
          createdAt: "$createdAt",
          updatedAt: "$updatedAt",
          finalPriceSetAt: "$finalPriceSetAt"
        }
      }
    }
  },
  {
    $match: {
      count: { $gt: 1 }
    }
  },
  { $sort: { count: -1 } }
]).toArray();

print(`Símbolos con múltiples alerts activas: ${alertsBySymbol.length}`);

if (alertsBySymbol.length === 0) {
  print("✅ No hay símbolos con múltiples alerts activas.");
  print("=== FIN SCRIPT ===");
} else {
  /****************************************
   * 2) Identificar qué alerts cerrar
   ****************************************/
  print("\n=== 2) Identificando alerts a cerrar ===");
  
  const alertsToClose = [];
  
  alertsBySymbol.forEach(item => {
    const symbol = item._id;
    const alerts = item.alerts;
    
    // Ordenar por fecha de creación (más nueva primero)
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // La más nueva es la que queremos mantener
    const newestAlert = alerts[0];
    const olderAlerts = alerts.slice(1);
    
    print(`\n--- ${symbol} ---`);
    print(`Alerta más nueva (MANTENER):`);
    print(`  ID: ${newestAlert._id}`);
    print(`  liquidityPercentage: ${newestAlert.liquidityPercentage || 'N/A'}%`);
    print(`  creada: ${newestAlert.createdAt}`);
    
    olderAlerts.forEach((alert, idx) => {
      // Verificar si tiene operations activas
      const hasActiveOps = opsColl.countDocuments({
        alertId: alert._id,
        status: "ACTIVE"
      }) > 0;
      
      // Criterios para cerrar:
      // 1. No tiene liquidityPercentage (sistema viejo)
      // 2. O es más antigua que otra alert del mismo símbolo
      // 3. Y no tiene operations activas asociadas
      const shouldClose = !hasActiveOps && (
        !alert.liquidityPercentage || 
        alert.createdAt < newestAlert.createdAt
      );
      
      print(`\nAlerta antigua ${idx + 1} (${shouldClose ? 'CERRAR' : 'MANTENER'}):`);
      print(`  ID: ${alert._id}`);
      print(`  liquidityPercentage: ${alert.liquidityPercentage || 'N/A'}%`);
      print(`  creada: ${alert.createdAt}`);
      print(`  tiene operations activas: ${hasActiveOps ? 'SÍ' : 'NO'}`);
      
      if (shouldClose) {
        alertsToClose.push({
          alertId: alert._id,
          symbol: alert.symbol,
          reason: !alert.liquidityPercentage 
            ? "Sin liquidityPercentage (sistema viejo)" 
            : "Más antigua que otra alert del mismo símbolo",
          hasActiveOps
        });
      }
    });
  });
  
  print("\n=== RESUMEN ===");
  print(`Total alerts a cerrar: ${alertsToClose.length}`);
  
  if (alertsToClose.length > 0) {
    alertsToClose.forEach(item => {
      print(`  - ${item.symbol} (${item.alertId}): ${item.reason}`);
    });
    
    /****************************************
     * 3) Ejecutar cierre (si DRY_RUN = false)
     ****************************************/
    if (!DRY_RUN) {
      print("\n=== 3) Cerrando alerts ===");
      
      let closedCount = 0;
      
      alertsToClose.forEach(item => {
        const result = alertsColl.updateOne(
          { _id: item.alertId },
          {
            $set: {
              status: "CLOSED",
              updatedAt: new Date()
            }
          }
        );
        
        if (result.modifiedCount > 0) {
          closedCount++;
          print(`✅ Cerrada: ${item.symbol} (${item.alertId})`);
        } else {
          print(`⚠️ No se pudo cerrar: ${item.alertId}`);
        }
      });
      
      print(`\nTotal alerts cerradas: ${closedCount} de ${alertsToClose.length}`);
      
      /****************************************
       * 4) Verificación post-cierre
       ****************************************/
      print("\n=== 4) Verificación post-cierre ===");
      
      const remainingDuplicates = alertsColl.aggregate([
        {
          $match: {
            status: "ACTIVE"
          }
        },
        {
          $group: {
            _id: "$symbol",
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        }
      ]).toArray();
      
      if (remainingDuplicates.length === 0) {
        print("✅ Todas las alerts duplicadas fueron cerradas.");
      } else {
        print(`⚠️ Aún quedan ${remainingDuplicates.length} símbolos con múltiples alerts activas:`);
        remainingDuplicates.forEach(item => {
          print(`  - ${item._id}: ${item.count} alerts`);
        });
      }
    } else {
      print("\n=== 3) Modo DRY RUN - No se ejecutaron cambios ===");
      print("Para ejecutar las correcciones, cambiá DRY_RUN a false.");
    }
  } else {
    print("✅ No hay alerts que necesiten ser cerradas.");
  }
}

print("\n=== FIN SCRIPT ===");
