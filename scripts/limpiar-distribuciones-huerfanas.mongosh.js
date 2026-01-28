/**
 * LIMPIAR DISTRIBUCIONES HUÉRFANAS
 * 
 * Elimina distribuciones de liquidez que:
 * 1. Apuntan a alertas que NO EXISTEN en la DB
 * 2. Apuntan a alertas con status CLOSED/DESCARTADA/DESESTIMADA
 * 
 * ⚠️ IMPORTANTE: Revisar el output del modo DRY_RUN antes de ejecutar con DRY_RUN = false
 */

const DRY_RUN = false; // ⚠️ EJECUTANDO CAMBIOS
const POOL = "TraderCall"; // Cambiar a "SmartMoney" si es necesario

print("=".repeat(70));
print("🧹 LIMPIEZA DE DISTRIBUCIONES HUÉRFANAS");
print("=".repeat(70));
print(`Pool: ${POOL}`);
print(`Modo: ${DRY_RUN ? "🔍 DRY RUN (solo lectura)" : "⚠️ EJECUTANDO CAMBIOS"}\n`);

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.getCollection("liquidities");

// 1. Obtener el documento de liquidez del pool
const liquidityDoc = liquidityColl.findOne({ pool: POOL });

if (!liquidityDoc) {
  print("❌ No se encontró documento de liquidez para el pool " + POOL);
  quit();
}

print(`📊 Documento de liquidez encontrado: ${liquidityDoc._id}`);
print(`   Distribuciones totales: ${liquidityDoc.distributions.length}`);
print(`   Distribuciones activas: ${liquidityDoc.distributions.filter(d => d.isActive).length}\n`);

// 2. Identificar distribuciones a eliminar
const distribucionesAEliminar = [];
const distribucionesADesactivar = [];

liquidityDoc.distributions.forEach((dist, index) => {
  if (!dist.isActive) return; // Ignorar las que ya están inactivas
  
  // Buscar la alerta asociada
  let alert = null;
  try {
    alert = alertsColl.findOne({ _id: ObjectId(dist.alertId) });
  } catch (e) {
    // Si el alertId no es un ObjectId válido
    alert = null;
  }
  
  if (!alert) {
    // La alerta NO EXISTE - marcar para eliminar
    distribucionesAEliminar.push({
      index,
      symbol: dist.symbol,
      alertId: dist.alertId,
      allocatedAmount: dist.allocatedAmount,
      shares: dist.shares,
      reason: "ALERTA_NO_EXISTE"
    });
  } else if (alert.status !== "ACTIVE") {
    // La alerta existe pero NO está ACTIVE - marcar para desactivar
    distribucionesADesactivar.push({
      index,
      symbol: dist.symbol,
      alertId: dist.alertId,
      alertStatus: alert.status,
      allocatedAmount: dist.allocatedAmount,
      shares: dist.shares,
      reason: `ALERTA_${alert.status}`
    });
  }
});

// 3. Mostrar lo que se va a hacer
print("=== DISTRIBUCIONES A ELIMINAR (alerta no existe) ===\n");
if (distribucionesAEliminar.length === 0) {
  print("   ✅ No hay distribuciones con alertas inexistentes\n");
} else {
  distribucionesAEliminar.forEach((d, i) => {
    print(`   ${i + 1}. ${d.symbol}`);
    print(`      AlertId: ${d.alertId}`);
    print(`      Monto: $${d.allocatedAmount.toFixed(2)}`);
    print(`      Shares: ${d.shares.toFixed(4)}`);
    print(`      Acción: ELIMINAR de distributions[]\n`);
  });
}

print("=== DISTRIBUCIONES A DESACTIVAR (alerta cerrada/descartada) ===\n");
if (distribucionesADesactivar.length === 0) {
  print("   ✅ No hay distribuciones con alertas cerradas\n");
} else {
  distribucionesADesactivar.forEach((d, i) => {
    print(`   ${i + 1}. ${d.symbol}`);
    print(`      AlertId: ${d.alertId}`);
    print(`      Estado alerta: ${d.alertStatus}`);
    print(`      Monto: $${d.allocatedAmount.toFixed(2)}`);
    print(`      Shares: ${d.shares.toFixed(4)}`);
    print(`      Acción: ELIMINAR de distributions[]\n`);
  });
}

// Calcular totales
const totalEliminar = distribucionesAEliminar.reduce((sum, d) => sum + d.allocatedAmount, 0);
const totalDesactivar = distribucionesADesactivar.reduce((sum, d) => sum + d.allocatedAmount, 0);
const totalLiberar = totalEliminar + totalDesactivar;

print("=== RESUMEN ===\n");
print(`   Distribuciones a eliminar: ${distribucionesAEliminar.length} ($${totalEliminar.toFixed(2)})`);
print(`   Distribuciones a desactivar: ${distribucionesADesactivar.length} ($${totalDesactivar.toFixed(2)})`);
print(`   TOTAL LIQUIDEZ A LIBERAR: $${totalLiberar.toFixed(2)}\n`);

// 4. Ejecutar cambios si no es DRY_RUN
if (!DRY_RUN && (distribucionesAEliminar.length > 0 || distribucionesADesactivar.length > 0)) {
  print("=== EJECUTANDO CAMBIOS ===\n");
  
  // Obtener todos los alertIds a eliminar
  const alertIdsAEliminar = [
    ...distribucionesAEliminar.map(d => d.alertId),
    ...distribucionesADesactivar.map(d => d.alertId)
  ];
  
  // Filtrar las distribuciones, eliminando las huérfanas
  const distribucionesLimpias = liquidityDoc.distributions.filter(dist => {
    return !alertIdsAEliminar.includes(dist.alertId);
  });
  
  print(`   Distribuciones antes: ${liquidityDoc.distributions.length}`);
  print(`   Distribuciones después: ${distribucionesLimpias.length}`);
  print(`   Eliminadas: ${liquidityDoc.distributions.length - distribucionesLimpias.length}\n`);
  
  // Recalcular totales
  const activeDistributions = distribucionesLimpias.filter(d => d.isActive);
  const newDistributedLiquidity = activeDistributions.reduce((sum, d) => sum + (d.allocatedAmount || 0), 0);
  const newTotalProfitLoss = activeDistributions.reduce((sum, d) => sum + (d.profitLoss || 0) + (d.realizedProfitLoss || 0), 0);
  
  // Calcular nueva liquidez disponible
  // Disponible = Inicial - Distribuida + Ganancias Realizadas
  const realizedProfitLoss = distribucionesLimpias.reduce((sum, d) => sum + (d.realizedProfitLoss || 0), 0);
  const newAvailableLiquidity = (liquidityDoc.initialLiquidity || 0) - newDistributedLiquidity + realizedProfitLoss;
  const newTotalLiquidity = (liquidityDoc.initialLiquidity || 0) + newTotalProfitLoss;
  
  print(`   Valores anteriores:`);
  print(`      distributedLiquidity: $${(liquidityDoc.distributedLiquidity || 0).toFixed(2)}`);
  print(`      availableLiquidity: $${(liquidityDoc.availableLiquidity || 0).toFixed(2)}`);
  print(`      totalLiquidity: $${(liquidityDoc.totalLiquidity || 0).toFixed(2)}\n`);
  
  print(`   Valores nuevos:`);
  print(`      distributedLiquidity: $${newDistributedLiquidity.toFixed(2)}`);
  print(`      availableLiquidity: $${newAvailableLiquidity.toFixed(2)}`);
  print(`      totalLiquidity: $${newTotalLiquidity.toFixed(2)}\n`);
  
  // Actualizar el documento
  const updateResult = liquidityColl.updateOne(
    { _id: liquidityDoc._id },
    {
      $set: {
        distributions: distribucionesLimpias,
        distributedLiquidity: newDistributedLiquidity,
        availableLiquidity: newAvailableLiquidity,
        totalLiquidity: newTotalLiquidity,
        totalProfitLoss: newTotalProfitLoss,
        updatedAt: new Date()
      }
    }
  );
  
  if (updateResult.modifiedCount > 0) {
    print("   ✅ Documento actualizado exitosamente\n");
  } else {
    print("   ❌ No se pudo actualizar el documento\n");
  }
  
  // Verificación final
  print("=== VERIFICACIÓN FINAL ===\n");
  const updatedDoc = liquidityColl.findOne({ _id: liquidityDoc._id });
  print(`   Distribuciones activas: ${updatedDoc.distributions.filter(d => d.isActive).length}`);
  print(`   distributedLiquidity: $${updatedDoc.distributedLiquidity.toFixed(2)}`);
  print(`   availableLiquidity: $${updatedDoc.availableLiquidity.toFixed(2)}`);
  print(`   totalLiquidity: $${updatedDoc.totalLiquidity.toFixed(2)}\n`);
  
} else if (DRY_RUN) {
  print("=== MODO DRY RUN ===\n");
  print("   ⚠️ No se ejecutaron cambios.");
  print("   Para ejecutar los cambios, cambiá DRY_RUN a false y volvé a correr el script.\n");
}

print("=".repeat(70));
print("FIN DEL SCRIPT");
print("=".repeat(70));
