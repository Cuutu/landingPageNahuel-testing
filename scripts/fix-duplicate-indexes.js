/**
 * Script para eliminar índices duplicados en MongoDB
 * Este script elimina índices manuales que están duplicados con índices automáticos de unique: true
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixDuplicateIndexes() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    
    // Lista de colecciones a revisar
    const collectionsToCheck = [
      'emaillists',
      'users',
      'usersubscriptions',
      'notificationtemplates',
      'billings',
      'payments',
      'modules',
      'trainings',
      'roadmaps',
      'advisorydates',
      'advisoryschedules',
      'availableslots'
    ];

    console.log('\n📋 Revisando índices en cada colección...\n');

    for (const collectionName of collectionsToCheck) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        
        console.log(`\n🔍 Colección: ${collectionName}`);
        console.log(`   Índices encontrados: ${indexes.length}`);
        
        // Buscar índices duplicados
        const indexKeys = {};
        const duplicates = [];
        
        for (const index of indexes) {
          const keyString = JSON.stringify(index.key);
          
          if (indexKeys[keyString]) {
            // Encontramos un duplicado
            console.log(`   ⚠️  Índice duplicado encontrado: ${keyString}`);
            console.log(`      - Nombre 1: ${indexKeys[keyString]}`);
            console.log(`      - Nombre 2: ${index.name}`);
            
            // Si uno de los índices es el índice manual, lo marcamos para eliminar
            if (index.name !== '_id_' && !index.name.endsWith('_unique')) {
              duplicates.push(index.name);
            }
          } else {
            indexKeys[keyString] = index.name;
          }
        }
        
        // Eliminar índices duplicados
        for (const indexName of duplicates) {
          try {
            console.log(`   🗑️  Eliminando índice duplicado: ${indexName}`);
            await collection.dropIndex(indexName);
            console.log(`   ✅ Índice eliminado exitosamente`);
          } catch (error) {
            console.log(`   ❌ Error eliminando índice: ${error.message}`);
          }
        }
        
        if (duplicates.length === 0) {
          console.log(`   ✅ No se encontraron índices duplicados`);
        }
        
      } catch (error) {
        if (error.message.includes('ns not found')) {
          console.log(`   ℹ️  Colección no existe aún: ${collectionName}`);
        } else {
          console.log(`   ❌ Error revisando colección: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Proceso completado');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

fixDuplicateIndexes();

