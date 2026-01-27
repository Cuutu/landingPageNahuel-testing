/*******************************
 * ANALIZAR VENTAS CON ESTADO ACTIVE
 * 
 * Analiza las ventas que quedaron con estado ACTIVE
 * para determinar si deberían estar COMPLETED o CANCELLED
 *******************************/
const DRY_RUN = true;
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF",
  pool: POOL
});

/****************************************
 * 1) Buscar ventas específicas con estado ACTIVE
 ****************************************/
print("\n=== 1) Buscar ventas específicas con estado ACTIVE ===");

// IDs conocidos de las ventas del análisis anterior
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
  print("⚠️ No se encontraron ventas ACTIVE para estos tickers.");
  quit();
}

/****************************************
 * 2) Analizar cada venta en detalle
 ****************************************/
print("\n=== 2) Detalle de cada venta ===");

ventasActivas.forEach((venta, idx) => {
  const fecha = new Date(venta.createdAt);
  const fechaStr = fecha.toISOString().split('T')[0];
  const horaStr = fecha.toTimeString().split(' ')[0];
  
  print(`\n--- Venta ${idx + 1}: ${venta.ticker || 'N/A'} (${fechaStr} ${horaStr}) ---`);
  print(`  Operation ID: ${venta._id}`);
  print(`  Ticker: ${venta.ticker}`);
  print(`  Estado: ${venta.status}`);
  const amountValue = typeof venta.amount === 'number' ? venta.amount : (venta.amount ? parseFloat(venta.amount) : null);
  print(`  Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
  print(`  Price: ${venta.price || 'N/A'}`);
  print(`  Quantity: ${venta.quantity || 'N/A'}`);
  print(`  isPartialSale: ${venta.isPartialSale || false}`);
  print(`  Alert ID: ${venta.alertId || 'N/A'}`);
  print(`  Notes: ${venta.notes ? (venta.notes.length > 150 ? venta.notes.substring(0, 150) + "..." : venta.notes) : 'N/A'}`);
  
  // Verificar alert asociada
  if (venta.alertId) {
    const alert = alertsColl.findOne({ _id: venta.alertId });
    if (alert) {
      print(`  ✅ Alert encontrada: ${alert.symbol} (status: ${alert.status})`);
      print(`     participationPercentage: ${alert.participationPercentage || 'N/A'}%`);
      const profitValue = typeof alert.profit === 'number' ? alert.profit : (alert.profit ? parseFloat(alert.profit) : null);
      print(`     profit: ${profitValue !== null && !isNaN(profitValue) ? profitValue.toFixed(2) : 'N/A'}%`);
      
      // Verificar si hay ventas parciales ejecutadas
      if (alert.liquidityData && alert.liquidityData.partialSales) {
        const partialSales = alert.liquidityData.partialSales || [];
        const ejecutadas = partialSales.filter((s) => s.executed);
        print(`     Ventas parciales ejecutadas: ${ejecutadas.length} de ${partialSales.length}`);
        if (ejecutadas.length > 0) {
          ejecutadas.forEach((sale, saleIdx) => {
            print(`       ${saleIdx + 1}. ${sale.percentage || 'N/A'}% ejecutada a $${sale.sellPrice || sale.precio || 'N/A'}`);
          });
        }
      }
    } else {
      print(`  ❌ Alert NO encontrada para alertId: ${venta.alertId}`);
    }
  } else {
    print(`  ⚠️ Venta sin alertId`);
  }
  
  // Verificar si hay otras operations relacionadas (compras o ventas)
  if (venta.alertId) {
    const relatedOps = opsColl
      .find({ alertId: venta.alertId })
      .sort({ createdAt: 1 })
      .toArray();
    
    const compras = relatedOps.filter(op => op.operationType === "COMPRA");
    const ventas = relatedOps.filter(op => op.operationType === "VENTA");
    
    print(`  Operations relacionadas:`);
    print(`    COMPRAS: ${compras.length} (ACTIVE: ${compras.filter(op => op.status === "ACTIVE").length})`);
    print(`    VENTAS: ${ventas.length} (ACTIVE: ${ventas.filter(op => op.status === "ACTIVE").length}, COMPLETED: ${ventas.filter(op => op.status === "COMPLETED").length}, CANCELLED: ${ventas.filter(op => op.status === "CANCELLED").length})`);
    
    // Verificar si hay ventas COMPLETED para la misma alerta
    const ventasCompleted = ventas.filter(op => op.status === "COMPLETED");
    if (ventasCompleted.length > 0) {
      print(`  ⚠️ Hay ${ventasCompleted.length} venta(s) COMPLETED para esta alerta. Esta venta ACTIVE podría ser duplicada.`);
    }
  }
});

/****************************************
 * 3) Análisis de lógica de negocio
 ****************************************/
print("\n=== 3) Análisis de lógica de negocio ===");

const ventasParaCompletar = [];
const ventasParaCancelar = [];
const ventasDuplicadas = [];

ventasActivas.forEach((venta) => {
  if (!venta.alertId) {
    ventasParaCancelar.push({
      operation: venta,
      razon: "Sin alertId asociada"
    });
    return;
  }
  
  const alert = alertsColl.findOne({ _id: venta.alertId });
  if (!alert) {
    ventasParaCancelar.push({
      operation: venta,
      razon: "Alert no encontrada"
    });
    return;
  }
  
  // Verificar si hay ventas COMPLETED para la misma alerta
  const relatedOps = opsColl.find({ alertId: venta.alertId }).toArray();
  const ventasCompleted = relatedOps.filter(op => 
    op.operationType === "VENTA" && op.status === "COMPLETED"
  );
  
  if (ventasCompleted.length > 0) {
    // Si ya hay una venta COMPLETED, esta ACTIVE probablemente es duplicada
    ventasDuplicadas.push({
      operation: venta,
      razon: `Ya existe venta COMPLETED para esta alerta (${ventasCompleted.length} venta(s) completada(s))`,
      ventasCompleted: ventasCompleted.map(v => ({
        id: v._id,
        fecha: v.createdAt,
        amount: v.amount
      }))
    });
    return;
  }
  
  // Verificar si la venta está en las ventas parciales ejecutadas de la alerta
  if (alert.liquidityData && alert.liquidityData.partialSales) {
    const partialSales = alert.liquidityData.partialSales || [];
    const ventaEjecutada = partialSales.find((sale) => 
      sale.executed && 
      sale.sellPrice && 
      Math.abs(sale.sellPrice - (venta.price || 0)) < 0.01 // Comparar precios con tolerancia
    );
    
    if (ventaEjecutada) {
      ventasParaCompletar.push({
        operation: venta,
        razon: `Venta parcial ejecutada en alerta (${ventaEjecutada.percentage || 'N/A'}% a $${ventaEjecutada.sellPrice || ventaEjecutada.precio})`,
        partialSale: ventaEjecutada
      });
      return;
    }
  }
  
  // Si es venta parcial y la alerta sigue activa con participación reducida
  if (venta.isPartialSale && alert.status === "ACTIVE") {
    const participationActual = alert.participationPercentage || 100;
    const participationOriginal = alert.originalParticipationPercentage || 100;
    
    if (participationActual < participationOriginal) {
      ventasParaCompletar.push({
        operation: venta,
        razon: `Venta parcial ejecutada (participación reducida de ${participationOriginal}% a ${participationActual}%)`,
        participationOriginal,
        participationActual
      });
      return;
    }
  }
  
  // Si la alerta está CLOSED y hay venta ACTIVE, probablemente debería estar COMPLETED
  if (alert.status === "CLOSED") {
    ventasParaCompletar.push({
      operation: venta,
      razon: "Alert está CLOSED, venta debería estar COMPLETED"
    });
    return;
  }
  
  // Si no hay indicios claros, marcarla para revisión manual
  ventasParaCancelar.push({
    operation: venta,
    razon: "Revisión manual necesaria - no hay indicios claros de ejecución"
  });
});

/****************************************
 * 4) Resumen y recomendaciones
 ****************************************/
print("\n=== 4) RESUMEN Y RECOMENDACIONES ===");

print(`\nVentas que deberían estar COMPLETED: ${ventasParaCompletar.length}`);
if (ventasParaCompletar.length > 0) {
  ventasParaCompletar.forEach((item, idx) => {
    const amountValue = typeof item.operation.amount === 'number' ? item.operation.amount : (item.operation.amount ? parseFloat(item.operation.amount) : null);
    print(`\n${idx + 1}. ${item.operation.ticker} (Operation: ${item.operation._id})`);
    print(`   Razón: ${item.razon}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`   Acción sugerida: Cambiar status a COMPLETED`);
  });
}

print(`\nVentas que podrían ser DUPLICADAS: ${ventasDuplicadas.length}`);
if (ventasDuplicadas.length > 0) {
  ventasDuplicadas.forEach((item, idx) => {
    const amountValue = typeof item.operation.amount === 'number' ? item.operation.amount : (item.operation.amount ? parseFloat(item.operation.amount) : null);
    print(`\n${idx + 1}. ${item.operation.ticker} (Operation: ${item.operation._id})`);
    print(`   Razón: ${item.razon}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`   Ventas COMPLETED existentes:`);
    item.ventasCompleted.forEach((v, vIdx) => {
      const vAmountValue = typeof v.amount === 'number' ? v.amount : (v.amount ? parseFloat(v.amount) : null);
      print(`     ${vIdx + 1}. ${v.id} - $${vAmountValue !== null && !isNaN(vAmountValue) ? vAmountValue.toFixed(2) : 'N/A'} - ${new Date(v.fecha).toISOString()}`);
    });
    print(`   Acción sugerida: Cambiar status a CANCELLED (duplicada)`);
  });
}

print(`\nVentas que deberían estar CANCELLED: ${ventasParaCancelar.length}`);
if (ventasParaCancelar.length > 0) {
  ventasParaCancelar.forEach((item, idx) => {
    const amountValue = typeof item.operation.amount === 'number' ? item.operation.amount : (item.operation.amount ? parseFloat(item.operation.amount) : null);
    print(`\n${idx + 1}. ${item.operation.ticker} (Operation: ${item.operation._id})`);
    print(`   Razón: ${item.razon}`);
    print(`   Amount: $${amountValue !== null && !isNaN(amountValue) ? amountValue.toFixed(2) : 'N/A'}`);
    print(`   Acción sugerida: Cambiar status a CANCELLED`);
  });
}

if (ventasParaCompletar.length === 0 && ventasDuplicadas.length === 0 && ventasParaCancelar.length === 0) {
  print("\n✅ No se encontraron problemas evidentes con las ventas ACTIVE.");
}

print("\n=== FIN ANÁLISIS ===");
