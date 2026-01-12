/**
 * Buscar documento de liquidez para un pool específico
 */

print('🔍 Buscando documentos de liquidez...\n');
print('='.repeat(60) + '\n');

const SYMBOL = 'INTC'; // ⚠️ CAMBIAR si es necesario
const POOL = 'TraderCall'; // ⚠️ CAMBIAR si es necesario

// Buscar la alerta primero
const alert = db.alerts.findOne({ symbol: SYMBOL.toUpperCase() });

if (!alert) {
  print(`❌ No se encontró la alerta con símbolo: ${SYMBOL}\n`);
} else {
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  print(`   ID: ${alert._id}\n`);
  print(`   Tipo: ${alert.tipo || 'N/A'}\n`);
  
  const alertId = alert._id.toString();
  
  // Buscar TODOS los documentos de liquidez del pool
  print(`\n🔍 Buscando documentos de liquidez para pool: ${POOL}...\n`);
  const allLiquidityDocs = db.liquidity.find({ pool: POOL }).toArray();
  
  print(`   Total documentos encontrados: ${allLiquidityDocs.length}\n`);
  
  if (allLiquidityDocs.length === 0) {
    print(`   ⚠️  No se encontraron documentos de liquidez para ${POOL}\n`);
    print(`   💡 Verificando otros pools...\n`);
    
    const smartMoneyDocs = db.liquidity.find({ pool: 'SmartMoney' }).toArray();
    print(`   SmartMoney: ${smartMoneyDocs.length} documentos\n`);
    
    const traderCallDocs = db.liquidity.find({ pool: 'TraderCall' }).toArray();
    print(`   TraderCall: ${traderCallDocs.length} documentos\n`);
    
    // Buscar en todos los pools
    const allPools = db.liquidity.distinct('pool');
    print(`\n   Pools disponibles: ${allPools.join(', ')}\n`);
  } else {
    allLiquidityDocs.forEach((doc, idx) => {
      print(`\n   📄 Documento ${idx + 1}:\n`);
      print(`      ID: ${doc._id}\n`);
      print(`      Pool: ${doc.pool}\n`);
      print(`      Total Liquidity: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
      print(`      Available: $${(doc.availableLiquidity || 0).toFixed(2)}\n`);
      print(`      Distributed: $${(doc.distributedLiquidity || 0).toFixed(2)}\n`);
      print(`      Initial: $${(doc.initialLiquidity || 0).toFixed(2)}\n`);
      print(`      Distribuciones: ${(doc.distributions || []).length}\n`);
      
      // Buscar si tiene la distribución de esta alerta
      if (doc.distributions && doc.distributions.length > 0) {
        const distribution = doc.distributions.find(
          d => d.alertId && d.alertId.toString() === alertId
        );
        
        if (distribution) {
          print(`      ✅ DISTRIBUCIÓN ENCONTRADA para ${SYMBOL}:\n`);
          print(`         Symbol: ${distribution.symbol || 'N/A'}\n`);
          print(`         Shares: ${(distribution.shares || 0).toFixed(4)}\n`);
          print(`         Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}\n`);
          print(`         Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}\n`);
          print(`         Sold Shares: ${(distribution.soldShares || 0).toFixed(4)}\n`);
          print(`         Is Active: ${distribution.isActive || false}\n`);
        } else {
          print(`      ⚠️  No tiene distribución para ${SYMBOL}\n`);
        }
        
        // Mostrar todas las distribuciones
        print(`\n      📋 Todas las distribuciones:\n`);
        doc.distributions.forEach((d, dIdx) => {
          const isTarget = d.alertId && d.alertId.toString() === alertId;
          const marker = isTarget ? '👉' : '  ';
          print(`      ${marker} ${dIdx + 1}. ${d.symbol || 'N/A'} (alertId: ${d.alertId || 'N/A'})\n`);
          print(`         Shares: ${(d.shares || 0).toFixed(4)}, Allocated: $${(d.allocatedAmount || 0).toFixed(2)}\n`);
        });
      }
    });
  }
  
  // También buscar por alertId directamente
  print(`\n🔍 Buscando distribución por alertId directamente...\n`);
  const liquidityByAlertId = db.liquidity.findOne({
    'distributions.alertId': alertId
  });
  
  if (liquidityByAlertId) {
    print(`   ✅ Encontrado documento de liquidez que contiene esta alerta:\n`);
    print(`      ID: ${liquidityByAlertId._id}\n`);
    print(`      Pool: ${liquidityByAlertId.pool}\n`);
    
    const distribution = liquidityByAlertId.distributions.find(
      d => d.alertId && d.alertId.toString() === alertId
    );
    
    if (distribution) {
      print(`      Distribución:\n`);
      print(`         Symbol: ${distribution.symbol || 'N/A'}\n`);
      print(`         Shares: ${(distribution.shares || 0).toFixed(4)}\n`);
      print(`         Allocated Amount: $${(distribution.allocatedAmount || 0).toFixed(2)}\n`);
      print(`         Entry Price: $${(distribution.entryPrice || 0).toFixed(2)}\n`);
      print(`         Sold Shares: ${(distribution.soldShares || 0).toFixed(4)}\n`);
    }
  } else {
    print(`   ⚠️  No se encontró ningún documento de liquidez con esta alerta\n`);
    print(`   💡 Esto significa que la distribución no existe o fue eliminada\n`);
  }
  
  print('\n' + '='.repeat(60) + '\n');
}
