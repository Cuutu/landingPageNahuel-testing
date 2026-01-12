/**
 * Verificar TODAS las alertas activas del pool TraderCall y sus datos de liquidez
 * Para entender por qué el gráfico muestra 4.2% en vez de 2.85%
 */

print('🔍 Verificando TODAS las alertas activas de TraderCall...\n');
print('='.repeat(70) + '\n');

const POOL = 'TraderCall';

// Buscar todas las alertas activas del pool
const activeAlerts = db.alerts.find({ 
  tipo: POOL,
  status: 'ACTIVE'
}).toArray();

print(`📊 Total alertas activas en ${POOL}: ${activeAlerts.length}\n`);

if (activeAlerts.length === 0) {
  print(`   ❌ No se encontraron alertas activas\n`);
} else {
  // Mostrar todas las alertas y sus datos de liquidez
  print(`\n📋 DETALLE DE CADA ALERTA:\n`);
  
  let totalAllocated = 0;
  let alertsWithLiquidity = 0;
  
  activeAlerts.forEach((alert, idx) => {
    const alertId = alert._id.toString();
    const symbol = alert.symbol || 'N/A';
    const allocatedAmount = alert.liquidityData?.allocatedAmount || 0;
    const shares = alert.liquidityData?.shares || 0;
    const hasLiquidity = allocatedAmount > 0;
    
    if (hasLiquidity) {
      alertsWithLiquidity++;
      totalAllocated += allocatedAmount;
    }
    
    print(`   ${idx + 1}. ${symbol}\n`);
    print(`      ID: ${alertId}\n`);
    print(`      Status: ${alert.status}\n`);
    print(`      Entry Price: $${(alert.entryPrice || 0).toFixed(2)}\n`);
    print(`      Current Price: ${alert.currentPrice || 'N/A'}\n`);
    print(`      liquidityData.allocatedAmount: $${allocatedAmount.toFixed(2)}\n`);
    print(`      liquidityData.shares: ${shares.toFixed(4)}\n`);
    print(`      Has Liquidity: ${hasLiquidity ? '✅ SÍ' : '❌ NO'}\n`);
    print(`\n`);
  });
  
  print(`\n📊 RESUMEN:\n`);
  print(`   Total alertas activas: ${activeAlerts.length}\n`);
  print(`   Alertas CON liquidez: ${alertsWithLiquidity}\n`);
  print(`   Alertas SIN liquidez: ${activeAlerts.length - alertsWithLiquidity}\n`);
  print(`   Total allocated desde alerts: $${totalAllocated.toFixed(2)}\n`);
}

// Ahora verificar el documento de liquidez
print(`\n📊 COMPARANDO CON DOCUMENTO DE LIQUIDEZ:\n`);
const liquidity = db.liquidity.findOne({ pool: POOL });

if (!liquidity) {
  print(`   ❌ No existe documento de liquidez para ${POOL}\n`);
} else {
  const distributions = liquidity.distributions || [];
  print(`   Total distribuciones en documento de liquidez: ${distributions.length}\n`);
  
  // Comparar alertIds
  print(`\n   📋 DISTRIBUCIONES EN DOCUMENTO DE LIQUIDEZ:\n`);
  for (let i = 0; i < distributions.length; i++) {
    const d = distributions[i];
    print(`      ${i + 1}. ${d.symbol || 'N/A'} - AlertId: ${d.alertId}\n`);
    print(`         Allocated: $${(d.allocatedAmount || 0).toFixed(2)}\n`);
    print(`         Active: ${d.isActive || false}\n`);
  }
  
  // Verificar cuáles alertas activas NO están en el documento de liquidez
  print(`\n   ⚠️  ALERTAS ACTIVAS NO EN DOCUMENTO DE LIQUIDEZ:\n`);
  let missingCount = 0;
  
  for (let i = 0; i < activeAlerts.length; i++) {
    const alert = activeAlerts[i];
    const alertId = alert._id.toString();
    const allocatedAmount = alert.liquidityData?.allocatedAmount || 0;
    
    if (allocatedAmount > 0) {
      // Buscar si está en el documento de liquidez
      let found = false;
      for (let j = 0; j < distributions.length; j++) {
        const d = distributions[j];
        const distAlertId = d.alertId ? d.alertId.toString() : null;
        if (distAlertId === alertId) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        missingCount++;
        print(`      ${missingCount}. ${alert.symbol} (ID: ${alertId})\n`);
        print(`         Tiene liquidityData.allocatedAmount: $${allocatedAmount.toFixed(2)}\n`);
        print(`         PERO NO está en el documento de liquidez!\n`);
      }
    }
  }
  
  if (missingCount === 0) {
    print(`      ✅ Todas las alertas con liquidez están en el documento\n`);
  } else {
    print(`\n   ⚠️  HAY ${missingCount} ALERTAS CON LIQUIDEZ QUE NO ESTÁN EN EL DOCUMENTO!\n`);
    print(`   💡 Esto explica por qué el gráfico muestra datos diferentes\n`);
    print(`   💡 El frontend usa liquidityMapByAlertId que viene del documento de liquidez\n`);
    print(`   💡 Pero las alertas tienen sus propios datos en alert.liquidityData\n`);
  }
}

print('\n' + '='.repeat(70) + '\n');
