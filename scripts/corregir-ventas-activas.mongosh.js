/*******************************
 * CORREGIR VENTAS CON ESTADO ACTIVE
 * 
 * Cambia el estado de ventas ACTIVE a COMPLETED
 * cuando están marcadas como ejecutadas en las alerts
 *******************************/
const DRY_RUN = false; // Cambiar a false para aplicar cambios
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF (EJECUTARÁ CAMBIOS)",
  pool: POOL
});

/****************************************
 * 1) Buscar ventas específicas con estado ACTIVE
 ****************************************/
print("\n=== 1) Buscar ventas específicas con estado ACTIVE ===");

const TICKERS_OBJETIVO = ["XP", "AMD", "AVGO"];

const ventasActivas = opsColl
  .find({
    system: POOL,
    operationType: "VENTA",
    status: "ACTIVE",
    ticker: { $in: TICKERS_OBJETIVO }
  })
  .sort({ createdAt: 1 })
  .toArray();

print(`Total ventas específicas con estado ACTIVE: ${ventasActivas.length}`);
print(`Buscando: ${TICKERS_OBJETIVO.join(", ")}`);

if (ventasActivas.length === 0) {
  print("✅ No hay ventas ACTIVE para corregir.");
  quit();
}

/****************************************
 * 2) Verificar cuáles deben cambiarse a COMPLETED
 ****************************************/
print("\n=== 2) Verificando ventas que deben cambiarse a COMPLETED ===");

const ventasParaCompletar = [];

ventasActivas.forEach((venta) => {
  if (!venta.alertId) {
    print(`⚠️ Saltando ${venta.ticker} (${venta._id}): sin alertId`);
    return;
  }
  
  const alert = alertsColl.findOne({ _id: venta.alertId });
  if (!alert) {
    print(`⚠️ Saltando ${venta.ticker} (${venta._id}): alert no encontrada`);
    return;
  }
  
  // Verificar si la venta está en las ventas parciales ejecutadas de la alerta
  let debeCompletar = false;
  let razon = "";
  
  if (alert.liquidityData && alert.liquidityData.partialSales) {
    const partialSales = alert.liquidityData.partialSales || [];
    const ventaEjecutada = partialSales.find((sale) => 
      sale.executed && 
      sale.sellPrice && 
      Math.abs(sale.sellPrice - (venta.price || 0)) < 0.01 // Comparar precios con tolerancia
    );
    
    if (ventaEjecutada) {
      debeCompletar = true;
      razon = `Venta parcial ejecutada en alerta (${ventaEjecutada.percentage || 'N/A'}% a $${ventaEjecutada.sellPrice || ventaEjecutada.precio})`;
    }
  }
  
  // Si la alerta está CLOSED y hay venta ACTIVE, debería estar COMPLETED
  if (!debeCompletar && alert.status === "CLOSED") {
    debeCompletar = true;
    razon = "Alert está CLOSED, venta debería estar COMPLETED";
  }
  
  // Si es venta parcial y la alerta sigue activa con participación reducida
  if (!debeCompletar && venta.isPartialSale && alert.status === "ACTIVE") {
    const participationActual = alert.participationPercentage || 100;
    const participationOriginal = alert.originalParticipationPercentage || 100;
    
    if (participationActual < participationOriginal) {
      debeCompletar = true;
      razon = `Venta parcial ejecutada (participación reducida de ${participationOriginal}% a ${participationActual}%)`;
    }
  }
  
  if (debeCompletar) {
    const amountValue = typeof venta.amount === 'number' ? venta.amount : (venta.amount ? parseFloat(venta.amount) : null);
    ventasParaCompletar.push({
      operationId: venta._id,
      ticker: venta.ticker,
      amount: amountValue,
      razon: razon
    });
    
    print(`\n✅ ${venta.ticker} (${venta._id})`);
    print(`   Razón: ${razon}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
  } else {
    print(`\n⚠️ ${venta.ticker} (${venta._id}) - NO se marcará como COMPLETED (no hay indicios claros de ejecución)`);
  }
});

print(`\nTotal ventas que se cambiarán a COMPLETED: ${ventasParaCompletar.length}`);

if (ventasParaCompletar.length === 0) {
  print("✅ No hay ventas que necesiten corrección.");
  quit();
}

/****************************************
 * 3) Aplicar cambios (si DRY_RUN = false)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 3) Modo DRY RUN - No se cambiarán estados ===");
  print("Si estás conforme, cambiá DRY_RUN = false y volvé a ejecutar.");
  print("\nVentas que se cambiarían a COMPLETED:");
  ventasParaCompletar.forEach((item, idx) => {
    print(`  ${idx + 1}. ${item.ticker} (${item.operationId}) - ${item.razon}`);
  });
} else {
  print("\n=== 3) Aplicando cambios: ACTIVE -> COMPLETED ===");
  
  let actualizadas = 0;
  let errores = 0;
  
  ventasParaCompletar.forEach((item, idx) => {
    try {
      const result = opsColl.updateOne(
        { _id: item.operationId },
        { 
          $set: { 
            status: "COMPLETED",
            updatedAt: new Date()
          } 
        }
      );
      
      if (result.modifiedCount === 1) {
        actualizadas++;
        print(`✅ ${idx + 1}. ${item.ticker} (${item.operationId}) - Cambiado a COMPLETED`);
      } else {
        errores++;
        print(`⚠️ ${idx + 1}. ${item.ticker} (${item.operationId}) - No se pudo actualizar (modifiedCount: ${result.modifiedCount})`);
      }
    } catch (error) {
      errores++;
      print(`❌ ${idx + 1}. ${item.ticker} (${item.operationId}) - Error: ${error.message}`);
    }
  });
  
  print(`\n=== RESUMEN ===`);
  print(`Ventas actualizadas: ${actualizadas}`);
  print(`Errores: ${errores}`);
  print(`Total procesadas: ${ventasParaCompletar.length}`);
}

print("\n=== FIN CORRECCIÓN ===");
