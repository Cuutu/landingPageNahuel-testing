/**
 * Script para migrar alertas existentes al nuevo sistema de entryPriceRange
 * Este script convierte alertas que solo tienen entryPrice al nuevo formato
 */
const { MongoClient } = require('mongodb');

async function migrateAlerts() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/landingPageNahuel';
  const client = new MongoClient(uri);

  try {
    console.log('🔄 Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db();
    const alertsCollection = db.collection('alerts');

    // Buscar alertas que no tienen entryPriceRange pero sí tienen entryPrice
    const alertsToMigrate = await alertsCollection.find({
      entryPriceRange: { $exists: false },
      entryPrice: { $exists: true, $ne: null }
    }).toArray();

    console.log(`🔍 Encontradas ${alertsToMigrate.length} alertas para migrar`);

    if (alertsToMigrate.length === 0) {
      console.log('✅ No hay alertas que migrar');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const alert of alertsToMigrate) {
      try {
        const entryPrice = alert.entryPrice;
        
        // Crear entryPriceRange basado en el entryPrice existente
        // Usar un rango pequeño (±1%) para mantener compatibilidad
        const range = entryPrice * 0.01; // 1% del precio
        
        const updateResult = await alertsCollection.updateOne(
          { _id: alert._id },
          {
            $set: {
              entryPriceRange: {
                min: Math.max(0, entryPrice - range),
                max: entryPrice + range
              }
            }
          }
        );

        if (updateResult.modifiedCount > 0) {
          console.log(`✅ Migrada alerta ${alert.symbol}: entryPrice $${entryPrice} → entryPriceRange $${Math.max(0, entryPrice - range).toFixed(2)} - $${(entryPrice + range).toFixed(2)}`);
          migratedCount++;
        } else {
          console.log(`⚠️ No se pudo migrar alerta ${alert.symbol}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrando alerta ${alert.symbol}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Resumen de migración:');
    console.log(`✅ Alertas migradas exitosamente: ${migratedCount}`);
    console.log(`❌ Errores durante la migración: ${errorCount}`);
    console.log(`📝 Total procesadas: ${alertsToMigrate.length}`);

    if (errorCount === 0) {
      console.log('🎉 ¡Migración completada exitosamente!');
    } else {
      console.log('⚠️ La migración se completó con algunos errores');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await client.close();
    console.log('🔌 Conexión a MongoDB cerrada');
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrateAlerts()
    .then(() => {
      console.log('🏁 Script de migración finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { migrateAlerts }; 