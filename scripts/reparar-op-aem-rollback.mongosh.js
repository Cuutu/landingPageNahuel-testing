// Reparar estado/mensaje de la operacion de AEM marcada como rollback
// Deja la venta confirmada sin tocar liquidez ni alertas.
const DRY_RUN = false; // Cambiar a false para ejecutar realmente

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : (fallback || 0);
}

function main() {
  print('🔧 REPARAR OPERACION AEM (rollback visual)');
  print('==============================================================================');
  print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
  print('==============================================================================');
  print('');

  const alert = db.alerts.findOne({ symbol: 'AEM', status: 'ACTIVE' });
  if (!alert) {
    print('❌ No se encontró alerta AEM activa');
    return;
  }

  const alertId = alert._id;

  // Buscar la operacion con mensaje/nota de rollback
  const operation = db.operations.findOne({
    alertId: alertId,
    operationType: 'VENTA',
    $or: [
      { notes: /ROLLBACK/i },
      { message: /ROLLBACK/i }
    ]
  });

  if (!operation) {
    print('⚠️ No se encontró operación con rollback para AEM');
    return;
  }

  const currentStatus = operation.status || 'N/A';
  const currentNotes = operation.notes || '';
  const currentMessage = operation.message || '';

  print('📌 Operación encontrada:');
  print('   - _id: ' + operation._id);
  print('   - Status actual: ' + currentStatus);
  if (currentNotes) print('   - Notes actual: ' + currentNotes);
  if (currentMessage) print('   - Message actual: ' + currentMessage);
  print('');

  const newNotes = '✅ Venta parcial confirmada (AEM)';

  if (DRY_RUN) {
    print('🔍 DRY-RUN: No se realizarán cambios');
    print('Se actualizaría:');
    print(' - status: ACTIVE');
    print(' - isPriceConfirmed: true');
    print(' - notes: ' + newNotes);
    print(' - remover message/notes de rollback si existen');
    return;
  }

  db.operations.updateOne(
    { _id: operation._id },
    {
      $set: {
        status: 'ACTIVE',
        isPriceConfirmed: true,
        notes: newNotes
      },
      $unset: {
        message: '',
        rollbackMessage: ''
      }
    }
  );

  print('✅ Operación actualizada');
}

main();
