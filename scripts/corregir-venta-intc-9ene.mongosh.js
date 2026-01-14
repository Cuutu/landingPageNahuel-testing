// Script para desestimar la venta del 9 de enero de INTC
// Esta venta está marcada como ejecutada pero debería estar desestimada

const DRY_RUN = true; // Cambiar a false para ejecutar realmente

print('🔧 CORRECCIÓN - Desestimar venta del 9 de enero de INTC');
print('==============================================================================');
print('Modo: ' + (DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUTAR (realizar cambios)'));
print('==============================================================================');
print('');

const intcAlert = db.alerts.findOne({ symbol: 'INTC', status: 'ACTIVE' });

if (!intcAlert) {
  print('❌ No se encontró alerta INTC activa');
  quit();
}

const intcLiquidityData = intcAlert.liquidityData || {};
const intcPartialSales = intcLiquidityData.partialSales || [];
const originalShares = intcLiquidityData.originalShares || 0;
const originalParticipation = intcLiquidityData.originalParticipationPercentage || 100;

// Buscar la venta del 9 de enero
let saleToDiscard = null;
let saleIndex = -1;

for (let i = 0; i < intcPartialSales.length; i++) {
  const sale = intcPartialSales[i];
  const saleDate = new Date(sale.date || sale.executedAt);
  if (saleDate.getFullYear() === 2026 && 
      saleDate.getMonth() === 0 && 
      saleDate.getDate() === 9 &&
      sale.executed && 
      !sale.discarded) {
    saleToDiscard = sale;
    saleIndex = i;
    break;
  }
}

if (!saleToDiscard) {
  print('❌ No se encontró venta ejecutada del 9 de enero para desestimar');
  print('Buscando todas las ventas del 9 de enero:');
  intcPartialSales.forEach((sale, idx) => {
    const saleDate = new Date(sale.date || sale.executedAt);
    if (saleDate.getFullYear() === 2026 && saleDate.getMonth() === 0 && saleDate.getDate() === 9) {
      print('  Venta #' + (idx + 1) + ':');
      print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
      print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
      print('    % vendido: ' + (sale.percentage || 0) + '%');
    }
  });
  quit();
}

print('✅ Venta encontrada para desestimar:');
print('Fecha: ' + saleToDiscard.date);
print('% vendido: ' + saleToDiscard.percentage + '%');
print('Shares vendidas: ' + saleToDiscard.sharesToSell);
print('Precio de venta: $' + saleToDiscard.sellPrice);
print('');

// Calcular nuevos valores
const salePercentage = saleToDiscard.percentage || 0;
const saleShares = saleToDiscard.sharesToSell || 0;
const saleLiquidityReleased = saleToDiscard.liquidityReleased || 0;

// Calcular valores actuales después de revertir esta venta
const currentShares = intcLiquidityData.shares || 0;
const currentAllocatedAmount = intcLiquidityData.allocatedAmount || 0;
const currentParticipation = intcAlert.participationPercentage || 0;

const newShares = currentShares + saleShares;
const actualPercentageSold = originalShares > 0 ? (saleShares / originalShares) * 100 : 0;
const newParticipation = currentParticipation + actualPercentageSold;

// Calcular nuevo allocatedAmount (aproximado)
const entryPrice = intcAlert.entryPrice || 0;
const newAllocatedAmount = newShares * entryPrice;

print('📊 VALORES ACTUALES:');
print('Shares actuales: ' + currentShares.toFixed(4));
print('Participación actual: ' + currentParticipation.toFixed(2) + '%');
print('Liquidez asignada actual: $' + currentAllocatedAmount.toFixed(2));
print('');

print('📊 VALORES DESPUÉS DE DESESTIMAR LA VENTA:');
print('Shares nuevos: ' + newShares.toFixed(4) + ' (+' + saleShares.toFixed(4) + ')');
print('Participación nueva: ' + newParticipation.toFixed(2) + '% (+' + actualPercentageSold.toFixed(2) + '%)');
print('Liquidez asignada nueva: $' + newAllocatedAmount.toFixed(2));
print('');

// Actualizar el array de partialSales
const updatedPartialSales = intcPartialSales.map((sale, idx) => {
  if (idx === saleIndex) {
    return {
      ...sale,
      executed: false,
      discarded: true,
      discardedAt: new Date(),
      discardReason: 'Venta desestimada - precio fuera de rango'
    };
  }
  return sale;
});

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios');
  print('');
  print('Si esto se ejecutara, se haría:');
  print('1. Marcar la venta como discarded: true, executed: false');
  print('2. Actualizar shares en liquidityData: ' + currentShares.toFixed(4) + ' → ' + newShares.toFixed(4));
  print('3. Actualizar participación: ' + currentParticipation.toFixed(2) + '% → ' + newParticipation.toFixed(2) + '%');
  print('4. Actualizar allocatedAmount: $' + currentAllocatedAmount.toFixed(2) + ' → $' + newAllocatedAmount.toFixed(2));
} else {
  // Actualizar la alerta
  db.alerts.updateOne(
    { _id: intcAlert._id },
    {
      $set: {
        'liquidityData.partialSales': updatedPartialSales,
        'liquidityData.shares': newShares,
        'liquidityData.allocatedAmount': newAllocatedAmount,
        'participationPercentage': newParticipation
      }
    }
  );
  
  // Buscar y actualizar la operación correspondiente
  const operation = db.operations.findOne({
    alertId: intcAlert._id,
    operationType: 'VENTA',
    date: {
      $gte: new Date('2026-01-09T00:00:00.000Z'),
      $lt: new Date('2026-01-10T00:00:00.000Z')
    }
  });
  
  if (operation) {
    db.operations.updateOne(
      { _id: operation._id },
      {
        $set: {
          status: 'CANCELLED',
          isPriceConfirmed: true,
          notes: '❌ VENTA DESESTIMADA: Precio fuera de rango'
        }
      }
    );
    print('✅ Operación actualizada: ' + operation._id);
  }
  
  print('✅ Corrección aplicada');
}

print('==============================================================================');
print('✅ Proceso completado');
print('==============================================================================');
