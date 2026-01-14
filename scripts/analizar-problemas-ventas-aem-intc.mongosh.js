// Script para analizar los problemas específicos con las ventas de AEM e INTC

print('🔍 ANÁLISIS DETALLADO - Problemas con Ventas AEM e INTC');
print('==============================================================================');
print('');

// AEM
print('==============================================================================');
print('📊 AEM - Análisis');
print('==============================================================================');
const aemAlert = db.alerts.findOne({ symbol: 'AEM', status: 'ACTIVE' });

if (aemAlert) {
  const aemLiquidityData = aemAlert.liquidityData || {};
  const aemPartialSales = aemLiquidityData.partialSales || [];
  const originalShares = aemLiquidityData.originalShares || 0;
  const currentShares = aemLiquidityData.shares || 0;
  const originalParticipation = aemLiquidityData.originalParticipationPercentage || 100;
  const currentParticipation = aemAlert.participationPercentage || 0;
  
  print('Acciones ORIGINALES: ' + originalShares.toFixed(4));
  print('Acciones ACTUALES: ' + currentShares.toFixed(4));
  print('Participación ORIGINAL: ' + originalParticipation + '%');
  print('Participación ACTUAL: ' + currentParticipation + '%');
  print('');
  
  print('VENTAS PARCIALES:');
  aemPartialSales.forEach((sale, idx) => {
    const saleDate = sale.date || sale.executedAt || 'N/A';
    print('  Venta #' + (idx + 1) + ':');
    print('    Fecha: ' + saleDate);
    print('    % vendido: ' + (sale.percentage || 0) + '%');
    print('    Shares vendidas: ' + (sale.sharesToSell || 0).toFixed(4));
    print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
    print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
    print('');
  });
  
  // Calcular shares esperadas después de las ventas
  let totalPercentageSold = 0;
  let totalSharesSold = 0;
  aemPartialSales.forEach((sale) => {
    if (sale.executed && !sale.discarded) {
      totalPercentageSold += sale.percentage || 0;
      totalSharesSold += sale.sharesToSell || 0;
    }
  });
  
  const expectedRemainingPercentage = originalParticipation - totalPercentageSold;
  const expectedRemainingShares = originalShares - totalSharesSold;
  
  print('CÁLCULOS:');
  print('Total % vendido (ejecutadas): ' + totalPercentageSold.toFixed(2) + '%');
  print('Total shares vendidas (ejecutadas): ' + totalSharesSold.toFixed(4));
  print('Participación esperada restante: ' + expectedRemainingPercentage.toFixed(2) + '%');
  print('Shares esperadas restantes: ' + expectedRemainingShares.toFixed(4));
  print('Shares ACTUALES en alerta: ' + currentShares.toFixed(4));
  print('Diferencia: ' + (currentShares - expectedRemainingShares).toFixed(4));
  print('');
  
  // Buscar la venta más reciente (hoy)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recentSales = aemPartialSales.filter((sale) => {
    const saleDate = new Date(sale.date || sale.executedAt);
    saleDate.setHours(0, 0, 0, 0);
    return saleDate.getTime() === today.getTime();
  });
  
  if (recentSales.length > 0) {
    print('VENTA DE HOY:');
    recentSales.forEach((sale, idx) => {
      print('  Venta del día:');
      print('    % vendido: ' + (sale.percentage || 0) + '%');
      print('    Shares vendidas: ' + (sale.sharesToSell || 0).toFixed(4));
      print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
      print('');
    });
  }
}

print('==============================================================================');
print('📊 INTC - Análisis');
print('==============================================================================');
const intcAlert = db.alerts.findOne({ symbol: 'INTC', status: 'ACTIVE' });

if (intcAlert) {
  const intcLiquidityData = intcAlert.liquidityData || {};
  const intcPartialSales = intcLiquidityData.partialSales || [];
  const originalShares = intcLiquidityData.originalShares || 0;
  const currentShares = intcLiquidityData.shares || 0;
  const originalParticipation = intcLiquidityData.originalParticipationPercentage || 100;
  const currentParticipation = intcAlert.participationPercentage || 0;
  
  print('Acciones ORIGINALES: ' + originalShares.toFixed(4));
  print('Acciones ACTUALES: ' + currentShares.toFixed(4));
  print('Participación ORIGINAL: ' + originalParticipation + '%');
  print('Participación ACTUAL: ' + currentParticipation + '%');
  print('');
  
  print('VENTAS PARCIALES:');
  intcPartialSales.forEach((sale, idx) => {
    const saleDate = sale.date || sale.executedAt || 'N/A';
    print('  Venta #' + (idx + 1) + ':');
    print('    Fecha: ' + saleDate);
    print('    % vendido: ' + (sale.percentage || 0) + '%');
    print('    Shares vendidas: ' + (sale.sharesToSell || 0).toFixed(4));
    print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
    print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
    print('    Cancelada: ' + (sale.cancelled ? 'Sí' : 'No'));
    if (sale.priceRange) {
      print('    Rango: $' + sale.priceRange.min.toFixed(2) + ' - $' + sale.priceRange.max.toFixed(2));
    }
    print('');
  });
  
  // Buscar venta del 9 de enero (debería estar desestimada)
  const jan9Sales = intcPartialSales.filter((sale) => {
    const saleDate = new Date(sale.date || sale.executedAt);
    return saleDate.getFullYear() === 2026 && 
           saleDate.getMonth() === 0 && 
           saleDate.getDate() === 9;
  });
  
  if (jan9Sales.length > 0) {
    print('VENTA DEL 9 DE ENERO:');
    jan9Sales.forEach((sale, idx) => {
      print('  Venta encontrada:');
      print('    % vendido: ' + (sale.percentage || 0) + '%');
      print('    Shares vendidas: ' + (sale.sharesToSell || 0).toFixed(4));
      print('    Ejecutada: ' + (sale.executed ? 'Sí' : 'No'));
      print('    Descartada: ' + (sale.discarded ? 'Sí' : 'No'));
      print('    Cancelada: ' + (sale.cancelled ? 'Sí' : 'No'));
      print('    ⚠️ PROBLEMA: Esta venta debería estar desestimada');
      print('');
    });
  }
  
  // Buscar venta pendiente del 25%
  const pendingSales = intcPartialSales.filter((sale) => {
    return !sale.executed && !sale.discarded && !sale.cancelled;
  });
  
  if (pendingSales.length > 0) {
    print('VENTAS PENDIENTES:');
    pendingSales.forEach((sale, idx) => {
      const saleDate = sale.date || sale.executedAt || 'N/A';
      print('  Venta pendiente #' + (idx + 1) + ':');
      print('    Fecha: ' + saleDate);
      print('    % vendido: ' + (sale.percentage || 0) + '%');
      print('    Shares a vender: ' + (sale.sharesToSell || 0).toFixed(4));
      if (sale.priceRange) {
        print('    Rango: $' + sale.priceRange.min.toFixed(2) + ' - $' + sale.priceRange.max.toFixed(2));
      }
      print('    ⚠️ Esta venta necesita ser confirmada');
      print('');
    });
  }
  
  // Buscar operaciones relacionadas
  const intcOperations = db.operations.find({
    alertId: intcAlert._id,
    operationType: 'VENTA'
  }).toArray();
  
  print('OPERACIONES EN DB:');
  intcOperations.forEach((op, idx) => {
    print('  Operación #' + (idx + 1) + ':');
    print('    ID: ' + op._id);
    print('    Fecha: ' + op.date);
    print('    Cantidad: ' + op.quantity);
    print('    Precio: $' + (op.price || 0).toFixed(2));
    print('    Status: ' + (op.status || 'N/A'));
    print('    isPriceConfirmed: ' + (op.isPriceConfirmed ? 'Sí' : 'No'));
    print('    Partial Sale %: ' + (op.partialSalePercentage || 0) + '%');
    if (op.priceRange) {
      print('    Rango: $' + op.priceRange.min.toFixed(2) + ' - $' + op.priceRange.max.toFixed(2));
    }
    print('');
  });
}

print('==============================================================================');
print('✅ Análisis completado');
print('==============================================================================');
