/**
 * CONFIRMAR - Confirmar manualmente la operación de venta de AEM
 * 
 * Este script confirma manualmente la operación de venta de AEM que quedó "A confirmar"
 * después de las 16:30. Actualiza el precio con el precio de cierre real y marca como confirmada.
 * 
 * ⚠️ IMPORTANTE: Este script hace cambios REALES en la base de datos
 * 
 * INSTRUCCIONES:
 * 1. Cambiar DRY_RUN = false para ejecutar realmente
 * 2. Verificar el precio de cierre antes de confirmar
 */

print('✅ CONFIRMAR - Operación de venta de AEM\n');
print('='.repeat(80) + '\n');

// ============================================
// CONFIGURACIÓN
// ============================================
const DRY_RUN = true; // ⚠️ Cambiar a false para ejecutar realmente
const AEM_ALERT_ID = '692e2ed0a16956ec58c15181';
const AEM_SYMBOL = 'AEM';

// Precio de cierre (obtener del precio actual de la alerta o especificar manualmente)
// Si no se especifica, se usará el currentPrice de la alerta
const CLOSE_PRICE = null; // ⚠️ Si es null, se usará el precio actual de la alerta

print(`🔧 Modo: ${DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUCIÓN REAL (hacer cambios)'}\n`);
print(`📊 Símbolo: ${AEM_SYMBOL}\n`);
print(`📅 Alert ID: ${AEM_ALERT_ID}\n`);
print('='.repeat(80) + '\n');

// Buscar la alerta
let alert;
try {
  alert = db.alerts.findOne({ _id: ObjectId(AEM_ALERT_ID) });
} catch (e) {
  alert = db.alerts.findOne({ _id: AEM_ALERT_ID });
}

if (!alert) {
  print(`❌ No se encontró la alerta AEM con ID: ${AEM_ALERT_ID}\n`);
  quit(1);
}

print(`✅ Alerta encontrada: ${alert.symbol}\n`);
print(`   Status: ${alert.status}\n`);
print(`   Precio actual: $${(alert.currentPrice || 0).toFixed(2)}\n`);

// Buscar operación de venta pendiente
print(`\n🔍 Buscando operación de venta pendiente...\n`);

const pendingOperation = db.operations.findOne({
  alertId: ObjectId(AEM_ALERT_ID),
  ticker: AEM_SYMBOL.toUpperCase(),
  operationType: 'VENTA',
  $or: [
    { priceRange: { $exists: true, $ne: null } },
    { isPriceConfirmed: { $ne: true } },
    { isPriceConfirmed: { $exists: false } }
  ]
});

if (!pendingOperation) {
  print(`❌ No se encontró operación de venta pendiente para AEM\n`);
  print(`💡 Puede que ya esté confirmada o no existe\n`);
  quit(1);
}

print(`✅ Operación pendiente encontrada:\n`);
print(`   ID: ${pendingOperation._id}\n`);
print(`   Ticker: ${pendingOperation.ticker}\n`);
print(`   Precio actual: $${(pendingOperation.price || 0).toFixed(2)}\n`);
print(`   Cantidad: ${pendingOperation.quantity || 0}\n`);
print(`   Rango de precio: ${pendingOperation.priceRange ? `$${(pendingOperation.priceRange.min || 0).toFixed(2)} - $${(pendingOperation.priceRange.max || 0).toFixed(2)}` : 'N/A'}\n`);
print(`   Precio confirmado: ${pendingOperation.isPriceConfirmed === true ? 'Sí' : 'No'}\n`);
print(`   Fecha: ${pendingOperation.date || pendingOperation.createdAt}\n`);

// Determinar precio de cierre
let closePrice = CLOSE_PRICE;
if (!closePrice || closePrice <= 0) {
  closePrice = alert.currentPrice || 0;
  print(`\n💰 Usando precio actual de la alerta como precio de cierre: $${closePrice.toFixed(2)}\n`);
} else {
  print(`\n💰 Usando precio de cierre especificado: $${closePrice.toFixed(2)}\n`);
}

if (!closePrice || closePrice <= 0) {
  print(`❌ Error: No se pudo determinar el precio de cierre\n`);
  print(`   Por favor, especifica CLOSE_PRICE en el script o verifica que la alerta tenga currentPrice\n`);
  quit(1);
}

// Verificar si el precio está en el rango (si hay rango)
if (pendingOperation.priceRange && pendingOperation.priceRange.min && pendingOperation.priceRange.max) {
  const inRange = closePrice >= pendingOperation.priceRange.min && closePrice <= pendingOperation.priceRange.max;
  print(`\n📊 VERIFICACIÓN DE RANGO:\n`);
  print(`   Rango esperado: $${pendingOperation.priceRange.min.toFixed(2)} - $${pendingOperation.priceRange.max.toFixed(2)}\n`);
  print(`   Precio de cierre: $${closePrice.toFixed(2)}\n`);
  print(`   ¿Está en rango? ${inRange ? '✅ Sí' : '⚠️ No'}\n`);
  
  if (!inRange) {
    print(`\n⚠️  ADVERTENCIA: El precio de cierre NO está en el rango esperado\n`);
    print(`   Esto podría indicar que la venta debería desestimarse\n`);
    print(`   ¿Deseas continuar de todas formas? (revisar el script si es necesario)\n`);
  }
}

// Calcular nuevos valores
const quantity = Math.abs(pendingOperation.quantity || 0);
const newAmount = Math.round((quantity * closePrice) * 100) / 100; // Redondear a 2 decimales
const oldPrice = pendingOperation.price || 0;

print(`\n📊 VALORES A ACTUALIZAR:\n`);
print(`   Precio: $${oldPrice.toFixed(2)} → $${closePrice.toFixed(2)}\n`);
print(`   Cantidad: ${quantity.toFixed(4)} acciones\n`);
print(`   Monto: $${(pendingOperation.amount || 0).toFixed(2)} → $${newAmount.toFixed(2)}\n`);
print(`   Precio confirmado: ${pendingOperation.isPriceConfirmed === true ? 'Sí' : 'No'} → Sí\n`);

// Actualizar notas
const originalNotes = pendingOperation.notes || '';
const updateSeparator = '\n\n--- Actualización 16:30 ---\n';
const originalText = originalNotes.includes(updateSeparator) 
  ? originalNotes.split(updateSeparator)[0].trim()
  : originalNotes.trim();

const updateMessage = `✅ Venta parcial (${pendingOperation.partialSalePercentage || 'N/A'}%) confirmada manualmente a precio de cierre $${closePrice.toFixed(2)}`;
const finalNotes = originalText 
  ? `${originalText}${updateSeparator}${updateMessage}`
  : updateMessage;

if (DRY_RUN) {
  print(`\n🔍 DRY-RUN: No se realizarán cambios\n`);
  print(`   Si esto se ejecutara, se haría:\n`);
  print(`   db.operations.updateOne(\n`);
  print(`     { _id: ObjectId("${pendingOperation._id}") },\n`);
  print(`     {\n`);
  print(`       $set: {\n`);
  print(`         price: ${closePrice},\n`);
  print(`         amount: ${newAmount},\n`);
  print(`         isPriceConfirmed: true,\n`);
  print(`         notes: "${finalNotes.replace(/"/g, '\\"')}"\n`);
  print(`       },\n`);
  print(`       $unset: {\n`);
  print(`         priceRange: ""\n`);
  print(`       }\n`);
  print(`     }\n`);
  print(`   );\n`);
} else {
  print(`\n✅ Ejecutando confirmación...\n`);
  
  try {
    // Actualizar la operación
    db.operations.updateOne(
      { _id: pendingOperation._id },
      {
        $set: {
          price: closePrice,
          amount: newAmount,
          isPriceConfirmed: true,
          notes: finalNotes,
          executedBy: 'MANUAL',
          executionMethod: 'MANUAL'
        },
        $unset: {
          priceRange: ""
        }
      }
    );
    
    print(`✅ Operación confirmada exitosamente\n`);
    
    // Verificar
    const updatedOperation = db.operations.findOne({ _id: pendingOperation._id });
    print(`\n✅ VERIFICACIÓN:\n`);
    print(`   Precio: $${(updatedOperation.price || 0).toFixed(2)}\n`);
    print(`   Monto: $${(updatedOperation.amount || 0).toFixed(2)}\n`);
    print(`   Precio confirmado: ${updatedOperation.isPriceConfirmed === true ? 'Sí ✅' : 'No ❌'}\n`);
    print(`   Rango de precio: ${updatedOperation.priceRange ? 'Aún existe ⚠️' : 'Eliminado ✅'}\n`);
    
    // Verificar si también necesita actualizar la venta parcial en la alerta
    const partialSales = alert.liquidityData?.partialSales || [];
    const pendingSale = partialSales.find(s => 
      !s.executed && 
      s.priceRange && 
      s.priceRange.min === pendingOperation.priceRange?.min &&
      s.priceRange.max === pendingOperation.priceRange?.max
    );
    
    if (pendingSale) {
      print(`\n⚠️  Se encontró una venta parcial pendiente en la alerta que también necesita actualizarse\n`);
      print(`   💡 Considera ejecutar el CRON auto-convert-ranges para procesar la venta completa\n`);
      print(`   💡 O actualizar manualmente la venta parcial en liquidityData.partialSales\n`);
    }
    
  } catch (error) {
    print(`❌ Error al confirmar: ${error.message}\n`);
    quit(1);
  }
}

print(`\n${'='.repeat(80)}\n`);
print(`✅ Proceso completado\n`);
print(`${'='.repeat(80)}\n`);
