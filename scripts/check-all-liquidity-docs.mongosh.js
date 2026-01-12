/**
 * Verificar TODOS los documentos de liquidez para TraderCall
 * Puede haber múltiples documentos y la API podría estar usando uno diferente
 */

print('🔍 Verificando TODOS los documentos de liquidez para TraderCall...\n');
print('='.repeat(70) + '\n');

const POOL = 'TraderCall';
const ALERT_ID = '6957f5578bbe1e7b4d23034d';

// Buscar TODOS los documentos de liquidez del pool
const allLiquidityDocs = db.liquidity.find({ pool: POOL }).toArray();

print(`📊 Total documentos encontrados: ${allLiquidityDocs.length}\n`);

if (allLiquidityDocs.length === 0) {
  print(`   ❌ No se encontraron documentos de liquidez\n`);
} else {
  allLiquidityDocs.forEach((doc, idx) => {
    print(`\n📋 DOCUMENTO ${idx + 1}:\n`);
    print(`   ID: ${doc._id}\n`);
    print(`   Pool: ${doc.pool}\n`);
    print(`   Initial Liquidity: $${(doc.initialLiquidity || 0).toFixed(2)}\n`);
    print(`   Total Liquidity: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
    print(`   Available Liquidity: $${(doc.availableLiquidity || 0).toFixed(2)}\n`);
    print(`   Distributed Liquidity: $${(doc.distributedLiquidity || 0).toFixed(2)}\n`);
    print(`   Total Profit Loss: $${(doc.totalProfitLoss || 0).toFixed(2)}\n`);
    print(`   Created At: ${doc.createdAt || 'N/A'}\n`);
    print(`   Updated At: ${doc.updatedAt || 'N/A'}\n`);
    
    // Convertir distributions a array
    let distributions = [];
    if (doc.distributions) {
      if (Array.isArray(doc.distributions)) {
        distributions = doc.distributions;
      } else {
        distributions = [doc.distributions];
      }
    }
    
    print(`   Distributions count: ${distributions.length}\n`);
    
    // Buscar distribución de INTC
    let intcDist = null;
    for (let i = 0; i < distributions.length; i++) {
      const d = distributions[i];
      const distAlertId = d.alertId ? d.alertId.toString() : null;
      if (distAlertId === ALERT_ID) {
        intcDist = d;
        break;
      }
    }
    
    if (intcDist) {
      const intcCurrentValue = (intcDist.allocatedAmount || 0) + (intcDist.profitLoss || 0);
      const intcPercentage = doc.totalLiquidity > 0 
        ? (intcCurrentValue / doc.totalLiquidity) * 100 
        : 0;
      
      print(`   ✅ Tiene distribución de INTC:\n`);
      print(`      Allocated Amount: $${(intcDist.allocatedAmount || 0).toFixed(2)}\n`);
      print(`      Profit Loss: $${(intcDist.profitLoss || 0).toFixed(2)}\n`);
      print(`      Current Value: $${intcCurrentValue.toFixed(2)}\n`);
      print(`      Porcentaje: ${intcPercentage.toFixed(2)}%\n`);
    } else {
      print(`   ❌ NO tiene distribución de INTC\n`);
    }
    
    // Listar todas las distribuciones
    if (distributions.length > 0) {
      print(`   📋 Todas las distribuciones:\n`);
      for (let i = 0; i < distributions.length; i++) {
        const d = distributions[i];
        print(`      ${i + 1}. ${d.symbol || 'N/A'} - Allocated: $${(d.allocatedAmount || 0).toFixed(2)} - Active: ${d.isActive || false}\n`);
      }
    }
  });
  
  // Verificar cuál documento usaría la API (el que tiene distributions)
  print(`\n📊 ANÁLISIS DE QUÉ DOCUMENTO USARÍA LA API:\n`);
  const docsWithDistributions = [];
  for (let i = 0; i < allLiquidityDocs.length; i++) {
    const doc = allLiquidityDocs[i];
    let distributions = [];
    if (doc.distributions) {
      if (Array.isArray(doc.distributions)) {
        distributions = doc.distributions;
      } else {
        distributions = [doc.distributions];
      }
    }
    if (distributions.length > 0) {
      docsWithDistributions.push({ doc, distributions });
    }
  }
  
  if (docsWithDistributions.length > 0) {
    // Ordenar por updatedAt (más reciente primero)
    docsWithDistributions.sort((a, b) => {
      const dateA = a.doc.updatedAt || a.doc.createdAt || 0;
      const dateB = b.doc.updatedAt || b.doc.createdAt || 0;
      return new Date(dateB) - new Date(dateA);
    });
    
    const mainDoc = docsWithDistributions[0].doc;
    print(`   ✅ La API usaría el documento más reciente con distributions:\n`);
    print(`      ID: ${mainDoc._id}\n`);
    print(`      Total Liquidity: $${(mainDoc.totalLiquidity || 0).toFixed(2)}\n`);
    
    // Buscar INTC en este documento
    let intcDist = null;
    for (let i = 0; i < docsWithDistributions[0].distributions.length; i++) {
      const d = docsWithDistributions[0].distributions[i];
      const distAlertId = d.alertId ? d.alertId.toString() : null;
      if (distAlertId === ALERT_ID) {
        intcDist = d;
        break;
      }
    }
    
    if (intcDist) {
      const intcCurrentValue = (intcDist.allocatedAmount || 0) + (intcDist.profitLoss || 0);
      const intcPercentage = mainDoc.totalLiquidity > 0 
        ? (intcCurrentValue / mainDoc.totalLiquidity) * 100 
        : 0;
      
      print(`      INTC Current Value: $${intcCurrentValue.toFixed(2)}\n`);
      print(`      INTC Porcentaje: ${intcPercentage.toFixed(2)}%\n`);
      print(`      Porcentaje en gráfico: 4.2%\n`);
      
      if (Math.abs(intcPercentage - 4.2) < 0.1) {
        print(`      ✅ El porcentaje coincide\n`);
      } else {
        const diff = intcPercentage - 4.2;
        print(`      ⚠️  Diferencia: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%\n`);
      }
    }
  } else {
    print(`   ⚠️  No hay documentos con distributions\n`);
  }
}

print('\n' + '='.repeat(70) + '\n');
print('💡 CONCLUSIÓN:\n');
if (allLiquidityDocs.length > 1) {
  print(`   ⚠️  HAY ${allLiquidityDocs.length} DOCUMENTOS DE LIQUIDEZ\n`);
  print(`   💡 Esto puede causar inconsistencias. Considera consolidarlos.\n`);
} else {
  print(`   ✅ Solo hay 1 documento de liquidez (correcto)\n`);
}
print('='.repeat(70) + '\n');
