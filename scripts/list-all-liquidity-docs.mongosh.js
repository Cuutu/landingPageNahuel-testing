/**
 * Listar TODOS los documentos de liquidez con sus IDs
 */

print('🔍 Listando TODOS los documentos de liquidez...\n');
print('='.repeat(70) + '\n');

const allDocs = db.liquidity.find({}).toArray();

print(`📊 Total documentos en colección 'liquidity': ${allDocs.length}\n\n`);

for (let i = 0; i < allDocs.length; i++) {
  const doc = allDocs[i];
  const distributions = doc.distributions || [];
  
  print(`📋 DOCUMENTO ${i + 1}:\n`);
  print(`   _id: ${doc._id}\n`);
  print(`   pool: ${doc.pool || 'N/A'}\n`);
  print(`   initialLiquidity: $${(doc.initialLiquidity || 0).toFixed(2)}\n`);
  print(`   totalLiquidity: $${(doc.totalLiquidity || 0).toFixed(2)}\n`);
  print(`   distributedLiquidity: $${(doc.distributedLiquidity || 0).toFixed(2)}\n`);
  print(`   distributions.length: ${distributions.length}\n`);
  print(`   createdAt: ${doc.createdAt || 'N/A'}\n`);
  print(`   updatedAt: ${doc.updatedAt || 'N/A'}\n`);
  
  if (distributions.length > 0 && distributions.length <= 5) {
    print(`   📋 Símbolos: ${distributions.map(d => d.symbol).join(', ')}\n`);
  } else if (distributions.length > 5) {
    const first5 = distributions.slice(0, 5).map(d => d.symbol).join(', ');
    print(`   📋 Primeros 5 símbolos: ${first5}...\n`);
  }
  print('\n');
}

// Verificar si existe el documento problemático
const problematicId = '69643cd92bc61ad2f7f33dc4';
print(`\n🔍 Buscando documento problemático (${problematicId})...\n`);
try {
  const problematic = db.liquidity.findOne({ _id: ObjectId(problematicId) });
  if (problematic) {
    print(`   ⚠️  EXISTE! Pool: ${problematic.pool}, Distributions: ${(problematic.distributions || []).length}\n`);
  } else {
    print(`   ✅ No existe (fue eliminado o nunca se creó)\n`);
  }
} catch (e) {
  print(`   ✅ No existe o ID inválido\n`);
}

// Contar documentos por pool
print('\n📊 RESUMEN POR POOL:\n');
const traderCallDocs = allDocs.filter(d => d.pool === 'TraderCall');
const smartMoneyDocs = allDocs.filter(d => d.pool === 'SmartMoney');
const otherDocs = allDocs.filter(d => d.pool !== 'TraderCall' && d.pool !== 'SmartMoney');

print(`   TraderCall: ${traderCallDocs.length} documento(s)\n`);
traderCallDocs.forEach(d => {
  print(`      - ID: ${d._id}, Distributions: ${(d.distributions || []).length}\n`);
});

print(`   SmartMoney: ${smartMoneyDocs.length} documento(s)\n`);
smartMoneyDocs.forEach(d => {
  print(`      - ID: ${d._id}, Distributions: ${(d.distributions || []).length}\n`);
});

if (otherDocs.length > 0) {
  print(`   Otros: ${otherDocs.length} documento(s)\n`);
  otherDocs.forEach(d => {
    print(`      - ID: ${d._id}, Pool: ${d.pool || 'N/A'}, Distributions: ${(d.distributions || []).length}\n`);
  });
}

print('\n' + '='.repeat(70) + '\n');
