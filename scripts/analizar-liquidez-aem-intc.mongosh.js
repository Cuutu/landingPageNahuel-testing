// Script para analizar la liquidez y ventas de AEM e INTC
// Muestra el % de liquidez actual, a cuánto corresponde, y las ventas realizadas

const symbols = ['AEM', 'INTC'];

print('🔍 ANÁLISIS - Liquidez y Ventas de AEM e INTC');
print('==============================================================================');
print('');

// Buscar el documento de Liquidity para obtener la liquidez total
const liquidityTraderCall = db.liquidities.findOne({ pool: 'TraderCall' });
const liquiditySmartMoney = db.liquidities.findOne({ pool: 'SmartMoney' });

let totalLiquidity = 0;
let availableLiquidity = 0;

if (liquidityTraderCall) {
  totalLiquidity += liquidityTraderCall.totalLiquidity || 0;
  availableLiquidity += liquidityTraderCall.availableLiquidity || 0;
}

if (liquiditySmartMoney) {
  totalLiquidity += liquiditySmartMoney.totalLiquidity || 0;
  availableLiquidity += liquiditySmartMoney.availableLiquidity || 0;
}

print('📊 LIQUIDEZ TOTAL DEL POOL:');
print('Liquidez Total: $' + totalLiquidity.toFixed(2));
print('Liquidez Disponible: $' + availableLiquidity.toFixed(2));
print('Liquidez Distribuida: $' + (totalLiquidity - availableLiquidity).toFixed(2));
print('');

// Analizar cada símbolo
symbols.forEach((symbol, symbolIndex) => {
  print('==============================================================================');
  print('📊 ANÁLISIS: ' + symbol);
  print('==============================================================================');
  print('');
  
  // Buscar la alerta
  let alert = db.alerts.findOne({ symbol: symbol, status: 'ACTIVE' });
  
  if (!alert) {
    alert = db.alerts.findOne({ symbol: symbol, status: 'CLOSED' });
    if (alert) {
      print('⚠️ Alerta encontrada con status: ' + alert.status);
    }
  }
  
  if (!alert) {
    print('❌ No se encontró alerta para ' + symbol);
    print('');
    return;
  }
  
  const alertId = alert._id;
  const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
  const liquidity = pool === 'SmartMoney' ? liquiditySmartMoney : liquidityTraderCall;
  
  // Información básica
  print('📋 INFORMACIÓN BÁSICA:');
  print('ID: ' + alertId);
  print('Status: ' + alert.status);
  print('Tipo: ' + alert.tipo);
  print('Pool: ' + pool);
  print('Fecha de creación: ' + alert.createdAt);
  print('Precio de entrada: $' + (alert.entryPrice || 0).toFixed(2));
  print('Precio actual: $' + (alert.currentPrice || 0).toFixed(2));
  print('');
  
  // Información de liquidez de la alerta
  const liquidityData = alert.liquidityData || {};
  const allocatedAmount = liquidityData.allocatedAmount || 0;
  const shares = liquidityData.shares || 0;
  const originalAllocatedAmount = liquidityData.originalAllocatedAmount || allocatedAmount;
  const originalShares = liquidityData.originalShares || shares;
  const originalParticipation = liquidityData.originalParticipationPercentage || alert.participationPercentage || 100;
  const currentParticipation = alert.participationPercentage || 0;
  
  print('💰 LIQUIDEZ DE LA ALERTA:');
  print('Liquidez asignada ORIGINAL: $' + originalAllocatedAmount.toFixed(2));
  print('Liquidez asignada ACTUAL: $' + allocatedAmount.toFixed(2));
  print('Liquidez liberada (vendida): $' + (originalAllocatedAmount - allocatedAmount).toFixed(2));
  print('');
  
  print('📊 ACCIONES:');
  print('Acciones ORIGINALES: ' + originalShares.toFixed(4));
  print('Acciones ACTUALES: ' + shares.toFixed(4));
  print('Acciones VENDIDAS: ' + (originalShares - shares).toFixed(4));
  print('');
  
  print('📈 PARTICIPACIÓN:');
  print('Participación ORIGINAL: ' + originalParticipation + '%');
  print('Participación ACTUAL: ' + currentParticipation + '%');
  print('Participación VENDIDA: ' + (originalParticipation - currentParticipation).toFixed(2) + '%');
  print('');
  
  // Calcular % de liquidez respecto al pool total
  let poolLiquidity = 0;
  if (pool === 'SmartMoney') {
    poolLiquidity = (liquiditySmartMoney && liquiditySmartMoney.totalLiquidity) ? liquiditySmartMoney.totalLiquidity : 0;
  } else {
    poolLiquidity = (liquidityTraderCall && liquidityTraderCall.totalLiquidity) ? liquidityTraderCall.totalLiquidity : 0;
  }
  
  const percentageOfPool = poolLiquidity > 0 
    ? (allocatedAmount / poolLiquidity) * 100 
    : 0;
  
  const originalPercentageOfPool = poolLiquidity > 0
    ? (originalAllocatedAmount / poolLiquidity) * 100
    : 0;
  
  print('💼 % DE LIQUIDEZ DEL POOL:');
  print('Liquidez total del pool (' + pool + '): $' + poolLiquidity.toFixed(2));
  print('% de liquidez ACTUAL: ' + percentageOfPool.toFixed(2) + '%');
  print('% de liquidez ORIGINAL: ' + originalPercentageOfPool.toFixed(2) + '%');
  print('Diferencia: ' + (originalPercentageOfPool - percentageOfPool).toFixed(2) + '%');
  print('');
  
  // Buscar distribución en Liquidity
  let distribution = null;
  if (liquidity && liquidity.distributions) {
    if (Array.isArray(liquidity.distributions)) {
      for (let i = 0; i < liquidity.distributions.length; i++) {
        const d = liquidity.distributions[i];
        if (d && d.alertId && d.alertId.toString() === alertId.toString()) {
          distribution = d;
          break;
        }
      }
    }
  }
  
  if (distribution) {
    print('📋 DISTRIBUCIÓN EN LIQUIDITY:');
    print('Shares en distribución: ' + (distribution.shares || 0).toFixed(4));
    print('Allocated Amount: $' + (distribution.allocatedAmount || 0).toFixed(2));
    print('Sold Shares: ' + (distribution.soldShares || 0).toFixed(4));
    print('');
  } else {
    print('⚠️ No se encontró distribución en Liquidity para esta alerta');
    print('');
  }
  
  // Analizar ventas parciales
  const partialSales = liquidityData.partialSales || [];
  
  if (partialSales.length === 0) {
    print('📋 VENTAS PARCIALES:');
    print('No se registraron ventas parciales');
    print('');
  } else {
    print('📋 HISTORIAL DE VENTAS PARCIALES (' + partialSales.length + '):');
    print('');
    
    let totalPercentageSold = 0;
    let totalSharesSold = 0;
    let totalLiquidityReleased = 0;
    let totalRealizedProfit = 0;
    
    partialSales.forEach((sale, idx) => {
      const saleDate = sale.date || sale.executedAt || 'N/A';
      const salePercentage = sale.percentage || 0;
      const saleShares = sale.sharesToSell || 0;
      const salePrice = sale.sellPrice || 0;
      const liquidityReleased = sale.liquidityReleased || 0;
      const realizedProfit = sale.realizedProfit || 0;
      const executed = sale.executed || false;
      const discarded = sale.discarded || false;
      const executedBy = sale.executedBy || 'N/A';
      
      // Calcular % de cartera que representa esta venta
      // Usar la liquidez del pool en el momento de la venta (aproximado)
      const salePercentageOfPool = poolLiquidity > 0
        ? (liquidityReleased / poolLiquidity) * 100
        : 0;
      
      print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      print('VENTA #' + (idx + 1) + ':');
      print('  Fecha: ' + saleDate);
      print('  Estado: ' + (discarded ? '❌ DESCARTADA' : (executed ? '✅ EJECUTADA' : '⏳ PENDIENTE')));
      print('  Ejecutada por: ' + executedBy);
      print('');
      print('  📊 PORCENTAJES:');
      print('  - % vendido (de posición original): ' + salePercentage.toFixed(2) + '%');
      print('  - % de cartera (del pool): ' + salePercentageOfPool.toFixed(2) + '%');
      print('');
      print('  💰 VALORES:');
      print('  - Shares vendidas: ' + saleShares.toFixed(4));
      print('  - Precio de venta: $' + salePrice.toFixed(2));
      print('  - Liquidez liberada: $' + liquidityReleased.toFixed(2));
      print('  - Ganancia realizada: $' + realizedProfit.toFixed(2));
      print('');
      
      if (sale.priceRange) {
        print('  📈 Rango de precio: $' + sale.priceRange.min.toFixed(2) + ' - $' + sale.priceRange.max.toFixed(2));
        print('');
      }
      
      if (!discarded && executed) {
        totalPercentageSold += salePercentage;
        totalSharesSold += saleShares;
        totalLiquidityReleased += liquidityReleased;
        totalRealizedProfit += realizedProfit;
      }
    });
    
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    print('📊 RESUMEN DE VENTAS EJECUTADAS:');
    print('Total % vendido (de posición original): ' + totalPercentageSold.toFixed(2) + '%');
    print('Total shares vendidas: ' + totalSharesSold.toFixed(4));
    print('Total liquidez liberada: $' + totalLiquidityReleased.toFixed(2));
    print('Total ganancia realizada: $' + totalRealizedProfit.toFixed(2));
    print('Total % de cartera vendido: ' + (poolLiquidity > 0 ? (totalLiquidityReleased / poolLiquidity * 100).toFixed(2) : 0) + '%');
    print('');
  }
  
  // Verificar operaciones relacionadas
  const operations = db.operations.find({
    alertId: alertId,
    operationType: 'VENTA'
  }).toArray();
  
  if (operations.length > 0) {
    print('📋 OPERACIONES DE VENTA EN DB (' + operations.length + '):');
    operations.forEach((op, idx) => {
      print('  ' + (idx + 1) + '. ID: ' + op._id);
      print('     Fecha: ' + op.date);
      print('     Cantidad: ' + op.quantity);
      print('     Precio: $' + (op.price || 0).toFixed(2));
      print('     Monto: $' + (op.amount || 0).toFixed(2));
      print('     Partial Sale: ' + (op.isPartialSale ? 'Sí' : 'No'));
      if (op.isPartialSale) {
        print('     Partial Sale %: ' + (op.partialSalePercentage || 0) + '%');
      }
      print('     Status: ' + (op.status || 'N/A'));
      print('');
    });
  }
  
  print('');
});

print('==============================================================================');
print('✅ Análisis completado');
print('==============================================================================');
