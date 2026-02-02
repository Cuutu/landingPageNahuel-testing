/**
 * Script para copiar todas las colecciones de producción a la base de datos de testing
 * 
 * Ejecutar: mongosh "tu-connection-string" --file scripts/copiar-db-a-testing.mongosh.js
 * 
 * IMPORTANTE: Conectate a la base de datos de PRODUCCIÓN (la original)
 */

const SOURCE_DB = "test"; // Nombre de tu DB de producción (verificar cuál es)
const TARGET_DB = "webtesteo"; // Nombre de tu DB de testing

const DRY_RUN = false; // ⚠️ Cambiar a false para ejecutar la copia

print("\n======================================================================");
print("📦 COPIA DE BASE DE DATOS: PRODUCCIÓN → TESTING");
print("======================================================================");
print(`Modo: ${DRY_RUN ? '🔍 DRY RUN (sin cambios)' : '⚠️ EJECUTANDO COPIA'}`);
print(`\nOrigen: ${SOURCE_DB}`);
print(`Destino: ${TARGET_DB}`);

// Obtener referencia a ambas bases de datos
const sourceDb = db.getSiblingDB(SOURCE_DB);
const targetDb = db.getSiblingDB(TARGET_DB);

// Listar todas las colecciones de la base de datos origen
const collections = sourceDb.getCollectionNames();

print(`\n📊 Colecciones encontradas en ${SOURCE_DB}: ${collections.length}`);
print("----------------------------------------------------------------------");

let totalDocuments = 0;
const collectionStats = [];

// Analizar cada colección
collections.forEach(collName => {
  const count = sourceDb.getCollection(collName).countDocuments();
  totalDocuments += count;
  collectionStats.push({ name: collName, count: count });
  print(`   ${collName}: ${count} documentos`);
});

print("----------------------------------------------------------------------");
print(`📊 TOTAL: ${totalDocuments} documentos en ${collections.length} colecciones`);

if (!DRY_RUN) {
  print("\n=== EJECUTANDO COPIA ===\n");
  
  let copiedCollections = 0;
  let copiedDocuments = 0;
  let errors = [];
  
  collections.forEach(collName => {
    try {
      print(`📥 Copiando ${collName}...`);
      
      // Obtener todos los documentos de la colección origen
      const documents = sourceDb.getCollection(collName).find().toArray();
      
      if (documents.length > 0) {
        // Eliminar colección destino si existe (para evitar duplicados)
        targetDb.getCollection(collName).drop();
        
        // Insertar documentos en la colección destino
        targetDb.getCollection(collName).insertMany(documents);
        
        copiedDocuments += documents.length;
        print(`   ✅ ${collName}: ${documents.length} documentos copiados`);
      } else {
        print(`   ⚪ ${collName}: vacía, saltando...`);
      }
      
      copiedCollections++;
    } catch (error) {
      print(`   ❌ Error copiando ${collName}: ${error.message}`);
      errors.push({ collection: collName, error: error.message });
    }
  });
  
  // Copiar índices
  print("\n=== COPIANDO ÍNDICES ===\n");
  
  collections.forEach(collName => {
    try {
      const indexes = sourceDb.getCollection(collName).getIndexes();
      
      // Filtrar el índice _id (se crea automáticamente)
      const customIndexes = indexes.filter(idx => idx.name !== '_id_');
      
      if (customIndexes.length > 0) {
        customIndexes.forEach(idx => {
          try {
            // Eliminar el campo 'v' y 'ns' que no son necesarios para crear el índice
            const { v, ns, ...indexSpec } = idx;
            const { key, ...options } = indexSpec;
            
            targetDb.getCollection(collName).createIndex(key, options);
            print(`   ✅ ${collName}: índice '${idx.name}' creado`);
          } catch (idxError) {
            // Ignorar errores de índices duplicados
            if (!idxError.message.includes('already exists')) {
              print(`   ⚠️ ${collName}: error creando índice '${idx.name}': ${idxError.message}`);
            }
          }
        });
      }
    } catch (error) {
      print(`   ⚠️ Error obteniendo índices de ${collName}: ${error.message}`);
    }
  });
  
  print("\n======================================================================");
  print("📊 RESUMEN DE COPIA");
  print("======================================================================");
  print(`   Colecciones copiadas: ${copiedCollections}/${collections.length}`);
  print(`   Documentos copiados: ${copiedDocuments}`);
  
  if (errors.length > 0) {
    print(`   ❌ Errores: ${errors.length}`);
    errors.forEach(e => print(`      - ${e.collection}: ${e.error}`));
  } else {
    print(`   ✅ Sin errores`);
  }
  
  print("\n✅ COPIA COMPLETADA");
  print(`\nAhora podés usar la base de datos '${TARGET_DB}' para testing.`);
  print(`Connection string: mongodb+srv://.../${TARGET_DB}`);
  
} else {
  print("\n=== CAMBIOS PENDIENTES (DRY RUN) ===");
  print(`   Se copiarían ${collections.length} colecciones`);
  print(`   Se copiarían ${totalDocuments} documentos`);
  print(`\n   Para ejecutar, cambia DRY_RUN a false y vuelve a ejecutar.`);
}

print("\n======================================================================");
print("FIN");
print("======================================================================");
