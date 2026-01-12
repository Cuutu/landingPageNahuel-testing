/**
 * Investigar de dónde viene el 4.2% del gráfico para INTC
 */

print('🔍 Investigando fuente del 4.2% para INTC...\n');
print('='.repeat(70) + '\n');

const SYMBOL = 'INTC';
const ALERT_ID = '6957f5578bbe1e7b4d23034d'; // ID de la alerta INTC

// 1. Verificar la alerta
print('📊 1. VERIFICANDO ALERTA:\n');
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (alert) {
  print(`   ✅ Alerta encontrada\n`);
  print(`   ID: ${alert._id}\n`);
  print(`   liquidityData.allocatedAmount: $${(alert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  print(`   liquidityData.shares: ${(alert.liquidityData?.shares || 0).toFixed(4)}\n`);
  print(`   participationPercentage: ${alert.participationPercentage || 0}%\n`);
} else {
  print(`   ❌ Alerta no encontrada\n`);
}

// 2. Verificar operaciones de COMPRA
print('\n📊 2. VERIFICANDO OPERACIONES DE COMPRA:\n');
const buyOps = db.operations.find({
  alertId: alert._id,
  operationType: 'COMPRA'
}).sort({ date: -1 }).toArray();

print(`   Total operaciones de COMPRA: ${buyOps.length}\n`);
buyOps.forEach((op, idx) => {
  print(`   ${idx + 1}. ID: ${op._id}\n`);
  print(`      Quantity: ${op.quantity || 0}\n`);
  print(`      Price: $${(op.price || 0).toFixed(2)}\n`);
  print(`      Amount: $${(op.amount || 0).toFixed(2)}\n`);
  print(`      Portfolio Percentage: ${op.portfolioPercentage || 'N/A'}%\n`);
  print(`      Balance: $${(op.balance || 0).toFixed(2)}\n`);
  print(`      Date: ${op.date}\n`);
  
  if (op.portfolioPercentage) {
    // Calcular allocatedAmount desde portfolioPercentage
    const balanceAtBuy = op.balance - (op.amount || 0);
    const allocatedFromPercentage = balanceAtBuy * (op.portfolioPercentage / 100);
    print(`      💡 Allocated calculado desde portfolioPercentage: $${allocatedFromPercentage.toFixed(2)}\n`);
  }
});

// 3. Verificar operaciones de VENTA
print('\n📊 3. VERIFICANDO OPERACIONES DE VENTA:\n');
const sellOps = db.operations.find({
  alertId: alert._id,
  operationType: 'VENTA'
}).sort({ date: -1 }).toArray();

print(`   Total operaciones de VENTA: ${sellOps.length}\n`);
sellOps.forEach((op, idx) => {
  print(`   ${idx + 1}. ID: ${op._id}\n`);
  print(`      Quantity: ${op.quantity || 0}\n`);
  print(`      Price: $${(op.price || 0).toFixed(2)}\n`);
  print(`      Amount: $${(op.amount || 0).toFixed(2)}\n`);
  print(`      Partial Sale Percentage: ${op.partialSalePercentage || 'N/A'}%\n`);
  print(`      Date: ${op.date}\n`);
});

// 4. Buscar TODOS los documentos de liquidez (sin filtro de pool)
print('\n📊 4. BUSCANDO TODOS LOS DOCUMENTOS DE LIQUIDEZ:\n');
const allLiquidity = db.liquidity.find({}).toArray();
print(`   Total documentos de liquidez: ${allLiquidity.length}\n`);

if (allLiquidity.length > 0) {
  allLiquidity.forEach((doc, idx) => {
    print(`   ${idx + 1}. ID: ${doc._id}\n`);
    print(`      Pool: ${doc.pool || 'N/A'}\n`);
    print(`      Total Liquidity: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
    print(`      Distribuciones: ${(doc.distributions || []).length}\n`);
    
    if (doc.distributions && doc.distributions.length > 0) {
      const intcDist = doc.distributions.find(
        d => d.alertId && d.alertId.toString() === alert._id.toString()
      );
      
      if (intcDist) {
        print(`      ✅ DISTRIBUCIÓN ENCONTRADA para INTC:\n`);
        print(`         Allocated Amount: $${(intcDist.allocatedAmount || 0).toFixed(2)}\n`);
        print(`         Shares: ${(intcDist.shares || 0).toFixed(4)}\n`);
      }
    }
  });
} else {
  print(`   ⚠️  NO HAY DOCUMENTOS DE LIQUIDEZ EN ABSOLUTO\n`);
}

// 5. Calcular qué debería mostrar el gráfico
print('\n📊 5. CÁLCULO DEL PORCENTAJE DEL GRÁFICO:\n');

// Obtener liquidez total del pool TraderCall desde operaciones
const lastOp = db.operations.find({ system: 'TraderCall' }).sort({ date: -1 }).limit(1).toArray()[0];
const estimatedTotalLiquidity = lastOp?.balance || 1000; // Estimación

print(`   Liquidez total estimada (desde última operación): $${estimatedTotalLiquidity.toFixed(2)}\n`);

// Calcular desde la alerta
const alertAllocated = alert?.liquidityData?.allocatedAmount || 0;
const alertShares = alert?.liquidityData?.shares || 0;
const entryPrice = alert?.entryPrice || 0;
const currentPrice = parseFloat((alert?.currentPrice || '0').toString().replace('$', '')) || 0;

// Calcular valor actual
const currentValue = alertShares * currentPrice || alertAllocated;

print(`   Allocated Amount en alerta: $${alertAllocated.toFixed(2)}\n`);
print(`   Shares en alerta: ${alertShares.toFixed(4)}\n`);
print(`   Entry Price: $${entryPrice.toFixed(2)}\n`);
print(`   Current Price: $${currentPrice.toFixed(2)}\n`);
print(`   Current Value (shares * currentPrice): $${currentValue.toFixed(2)}\n`);

// Calcular porcentaje
const percentage = estimatedTotalLiquidity > 0 
  ? (currentValue / estimatedTotalLiquidity) * 100 
  : 0;

print(`\n   💡 Porcentaje calculado: ${percentage.toFixed(2)}%\n`);
print(`   💡 Si el gráfico muestra 4.2%, entonces:\n`);
print(`      currentValue = ${(estimatedTotalLiquidity * 0.042).toFixed(2)}\n`);
print(`      O liquidez total = ${(currentValue / 0.042).toFixed(2)}\n`);

// 6. Verificar si hay datos en operaciones que puedan estar siendo usados
print('\n📊 6. VERIFICANDO SI HAY DATOS EN OPERACIONES:\n');
const allTraderCallOps = db.operations.find({ system: 'TraderCall' })
  .sort({ date: -1 })
  .limit(10)
  .toArray();

print(`   Últimas 10 operaciones de TraderCall:\n`);
allTraderCallOps.forEach((op, idx) => {
  print(`   ${idx + 1}. ${op.ticker || 'N/A'} - ${op.operationType} - Balance: $${(op.balance || 0).toFixed(2)}\n`);
});

const maxBalance = Math.max(...allTraderCallOps.map(op => op.balance || 0));
print(`\n   Balance máximo encontrado: $${maxBalance.toFixed(2)}\n`);
print(`   Si currentValue = $${(maxBalance * 0.042).toFixed(2)}, entonces el porcentaje sería 4.2%\n`);

print('\n' + '='.repeat(70) + '\n');
print('💡 CONCLUSIÓN:\n');
print('   Si el gráfico muestra 4.2% pero no hay documentos de liquidez,\n');
print('   puede ser que:\n');
print('   1. Los datos están cacheados en el navegador\n');
print('   2. El gráfico está calculando desde operaciones directamente\n');
print('   3. Hay un documento de liquidez en otra base de datos\n');
print('='.repeat(70) + '\n');
