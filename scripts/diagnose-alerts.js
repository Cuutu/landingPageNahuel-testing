/**
 * Script de diagnóstico para verificar el estado de las alertas en la base de datos
 * Este script ayuda a identificar problemas con el modelo de datos
 */
const { MongoClient } = require('mongodb');

async function diagnoseAlerts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/landingPageNahuel';
  const client = new MongoClient(uri);

  try {
    console.log('🔄 Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db();
    const alertsCollection = db.collection('alerts');

    console.log('\n🔍 DIAGNÓSTICO DE ALERTAS\n');

    // Contar total de alertas
    const totalAlerts = await alertsCollection.countDocuments();
    console.log(`📊 Total de alertas: ${totalAlerts}`);

    if (totalAlerts === 0) {
      console.log('❌ No hay alertas en la base de datos');
      return;
    }

    // Contar alertas por estado
    const activeAlerts = await alertsCollection.countDocuments({ status: 'ACTIVE' });
    const closedAlerts = await alertsCollection.countDocuments({ status: 'CLOSED' });
    const stoppedAlerts = await alertsCollection.countDocuments({ status: 'STOPPED' });

    console.log(`📊 Alertas activas: ${activeAlerts}`);
    console.log(`📊 Alertas cerradas: ${closedAlerts}`);
    console.log(`📊 Alertas detenidas: ${stoppedAlerts}`);

    // Contar alertas por tipo
    const traderCallAlerts = await alertsCollection.countDocuments({ tipo: 'TraderCall' });
    const smartMoneyAlerts = await alertsCollection.countDocuments({ tipo: 'SmartMoney' });
    const cashFlowAlerts = await alertsCollection.countDocuments({ tipo: 'CashFlow' });

    console.log(`📊 Alertas TraderCall: ${traderCallAlerts}`);
    console.log(`📊 Alertas SmartMoney: ${smartMoneyAlerts}`);
    console.log(`📊 Alertas CashFlow: ${cashFlowAlerts}`);

    // Verificar estructura de datos
    const alertsWithEntryPriceRange = await alertsCollection.countDocuments({
      entryPriceRange: { $exists: true }
    });

    const alertsWithEntryPrice = await alertsCollection.countDocuments({
      entryPrice: { $exists: true, $ne: null, $ne: 0 }
    });

    const alertsWithCurrentPrice = await alertsCollection.countDocuments({
      currentPrice: { $exists: true, $ne: null, $ne: 0 }
    });

    const alertsWithStopLoss = await alertsCollection.countDocuments({
      stopLoss: { $exists: true, $ne: null, $ne: 0 }
    });

    const alertsWithTakeProfit = await alertsCollection.countDocuments({
      takeProfit: { $exists: true, $ne: null, $ne: 0 }
    });

    console.log('\n🔍 ESTRUCTURA DE DATOS:');
    console.log(`📊 Con entryPriceRange: ${alertsWithEntryPriceRange}`);
    console.log(`📊 Con entryPrice: ${alertsWithEntryPrice}`);
    console.log(`📊 Con currentPrice: ${alertsWithCurrentPrice}`);
    console.log(`📊 Con stopLoss: ${alertsWithStopLoss}`);
    console.log(`📊 Con takeProfit: ${alertsWithTakeProfit}`);

    // Mostrar algunas alertas de ejemplo
    console.log('\n🔍 EJEMPLOS DE ALERTAS:');
    
    const sampleAlerts = await alertsCollection.find({}).limit(3).toArray();
    
    sampleAlerts.forEach((alert, index) => {
      console.log(`\n📋 Alerta ${index + 1}:`);
      console.log(`   ID: ${alert._id}`);
      console.log(`   Symbol: ${alert.symbol}`);
      console.log(`   Status: ${alert.status}`);
      console.log(`   Tipo: ${alert.tipo}`);
      console.log(`   Action: ${alert.action}`);
      console.log(`   entryPrice: ${alert.entryPrice || 'NO DEFINIDO'}`);
      console.log(`   entryPriceRange: ${alert.entryPriceRange ? `${alert.entryPriceRange.min} - ${alert.entryPriceRange.max}` : 'NO DEFINIDO'}`);
      console.log(`   currentPrice: ${alert.currentPrice || 'NO DEFINIDO'}`);
      console.log(`   stopLoss: ${alert.stopLoss || 'NO DEFINIDO'}`);
      console.log(`   takeProfit: ${alert.takeProfit || 'NO DEFINIDO'}`);
      console.log(`   profit: ${alert.profit || 'NO DEFINIDO'}`);
    });

    // Identificar problemas potenciales
    console.log('\n⚠️ PROBLEMAS POTENCIALES IDENTIFICADOS:');

    const alertsWithoutEntryPriceRange = await alertsCollection.countDocuments({
      entryPriceRange: { $exists: false }
    });

    const alertsWithoutEntryPrice = await alertsCollection.countDocuments({
      entryPrice: { $exists: false }
    });

    const alertsWithoutCurrentPrice = await alertsCollection.countDocuments({
      currentPrice: { $exists: false }
    });

    if (alertsWithoutEntryPriceRange > 0) {
      console.log(`❌ ${alertsWithoutEntryPriceRange} alertas sin entryPriceRange (pueden causar errores de validación)`);
    }

    if (alertsWithoutEntryPrice > 0) {
      console.log(`❌ ${alertsWithoutEntryPrice} alertas sin entryPrice (pueden causar errores de cálculo)`);
    }

    if (alertsWithoutCurrentPrice > 0) {
      console.log(`❌ ${alertsWithoutCurrentPrice} alertas sin currentPrice (pueden causar errores de actualización)`);
    }

    // Verificar alertas que podrían tener problemas de validación
    const problematicAlerts = await alertsCollection.find({
      $or: [
        { entryPriceRange: { $exists: false } },
        { entryPrice: { $exists: false } },
        { currentPrice: { $exists: false } }
      ]
    }).limit(5).toArray();

    if (problematicAlerts.length > 0) {
      console.log('\n🚨 ALERTAS PROBLEMÁTICAS (primeras 5):');
      problematicAlerts.forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.symbol} (ID: ${alert._id})`);
        console.log(`      Problemas: ${getProblemDescription(alert)}`);
      });
    }

    console.log('\n✅ Diagnóstico completado');

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión a MongoDB cerrada');
  }
}

function getProblemDescription(alert) {
  const problems = [];
  
  if (!alert.entryPriceRange) problems.push('Sin entryPriceRange');
  if (!alert.entryPrice) problems.push('Sin entryPrice');
  if (!alert.currentPrice) problems.push('Sin currentPrice');
  if (!alert.stopLoss) problems.push('Sin stopLoss');
  if (!alert.takeProfit) problems.push('Sin takeProfit');
  
  return problems.length > 0 ? problems.join(', ') : 'Sin problemas aparentes';
}

// Ejecutar diagnóstico si se llama directamente
if (require.main === module) {
  diagnoseAlerts()
    .then(() => {
      console.log('🏁 Script de diagnóstico finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseAlerts }; 