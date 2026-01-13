/**
 * ROLLBACK - Restaurar estado de alertas AEM e INTC desde backup
 * 
 * Este script restaura el estado de las alertas AEM e INTC desde un archivo de backup
 * en caso de que algo salga mal durante la corrección.
 * 
 * ⚠️ IMPORTANTE: Este script hace cambios REALES en la base de datos
 * 
 * INSTRUCCIONES:
 * 1. Tener el archivo de backup (generado por backup-alertas-aem-intc.mongosh.js)
 * 2. Copiar el contenido JSON del backup en la variable BACKUP_DATA abajo
 * 3. Cambiar DRY_RUN = false para ejecutar realmente
 * 4. Ejecutar el script
 */

print('🔄 ROLLBACK - Restaurar estado de alertas AEM e INTC\n');
print('='.repeat(80) + '\n');

// ============================================
// CONFIGURACIÓN
// ============================================
const DRY_RUN = true; // ⚠️ Cambiar a false para ejecutar realmente

// ⚠️ PEGAR AQUÍ EL CONTENIDO DEL BACKUP JSON
// Copiar todo el JSON generado por backup-alertas-aem-intc.mongosh.js
const BACKUP_DATA = {
  // PEGAR AQUÍ EL JSON DEL BACKUP
  // Ejemplo:
  // backupInfo: { ... },
  // alerts: {
  //   AEM: { ... },
  //   INTC: { ... }
  // }
};

print(`🔧 Modo: ${DRY_RUN ? 'DRY-RUN (solo mostrar cambios)' : 'EJECUCIÓN REAL (hacer cambios)'}\n`);
print('='.repeat(80) + '\n');

// Verificar que hay datos de backup
if (!BACKUP_DATA || !BACKUP_DATA.alerts || !BACKUP_DATA.alerts.AEM || !BACKUP_DATA.alerts.INTC) {
  print(`❌ ERROR: No se encontraron datos de backup\n`);
  print(`   Por favor, pega el JSON del backup en la variable BACKUP_DATA\n`);
  print(`   El JSON debe tener la estructura:\n`);
  print(`   {\n`);
  print(`     backupInfo: { ... },\n`);
  print(`     alerts: {\n`);
  print(`       AEM: { ... },\n`);
  print(`       INTC: { ... }\n`);
  print(`     }\n`);
  print(`   }\n`);
  quit(1);
}

// ============================================
// FUNCIÓN PARA RESTAURAR UNA ALERTA
// ============================================
function restoreAlert(backupData, symbol) {
  print(`\n${'='.repeat(80)}\n`);
  print(`🔄 RESTAURANDO ALERTA: ${symbol}\n`);
  print(`${'='.repeat(80)}\n`);
  
  if (!backupData || !backupData.alert) {
    print(`❌ No hay datos de backup para ${symbol}\n`);
    return false;
  }
  
  const alertBackup = backupData.alert;
  const alertId = backupData.alertId;
  
  print(`📋 Información del backup:\n`);
  print(`   Timestamp: ${backupData.timestamp}\n`);
  print(`   Status: ${alertBackup.status}\n`);
  print(`   Participación: ${alertBackup.participationPercentage || 100}%\n`);
  print(`   Acciones: ${(alertBackup.liquidityData?.shares || 0).toFixed(4)}\n`);
  print(`   Liquidez: $${(alertBackup.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  
  // Buscar la alerta actual
  let currentAlert;
  try {
    currentAlert = db.alerts.findOne({ _id: ObjectId(alertId) });
  } catch (e) {
    currentAlert = db.alerts.findOne({ _id: alertId });
  }
  
  if (!currentAlert) {
    print(`❌ No se encontró la alerta ${symbol} con ID: ${alertId}\n`);
    return false;
  }
  
  print(`\n📊 Estado actual de la alerta:\n`);
  print(`   Status: ${currentAlert.status}\n`);
  print(`   Participación: ${currentAlert.participationPercentage || 100}%\n`);
  print(`   Acciones: ${(currentAlert.liquidityData?.shares || 0).toFixed(4)}\n`);
  print(`   Liquidez: $${(currentAlert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  
  print(`\n📊 Cambios a realizar (restaurar desde backup):\n`);
  print(`   Status: ${currentAlert.status} → ${alertBackup.status}\n`);
  print(`   Participación: ${currentAlert.participationPercentage || 100}% → ${alertBackup.participationPercentage || 100}%\n`);
  print(`   Acciones: ${(currentAlert.liquidityData?.shares || 0).toFixed(4)} → ${(alertBackup.liquidityData?.shares || 0).toFixed(4)}\n`);
  print(`   Liquidez: $${(currentAlert.liquidityData?.allocatedAmount || 0).toFixed(2)} → $${(alertBackup.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  
  if (DRY_RUN) {
    print(`\n🔍 DRY-RUN: No se realizarán cambios\n`);
    print(`   Si esto se ejecutara, se restaurarían todos los campos del backup\n`);
  } else {
    print(`\n✅ Ejecutando restauración...\n`);
    
    try {
      // Restaurar alerta
      const updateFields = {
        status: alertBackup.status,
        participationPercentage: alertBackup.participationPercentage,
        originalParticipationPercentage: alertBackup.originalParticipationPercentage,
        entryPrice: alertBackup.entryPrice,
        entryPriceRange: alertBackup.entryPriceRange,
        currentPrice: alertBackup.currentPrice,
        exitPrice: alertBackup.exitPrice,
        exitDate: alertBackup.exitDate,
        exitReason: alertBackup.exitReason
      };
      
      // Restaurar liquidityData si existe
      if (alertBackup.liquidityData) {
        updateFields['liquidityData'] = alertBackup.liquidityData;
      }
      
      // Restaurar ventasParciales si existe
      if (alertBackup.ventasParciales && alertBackup.ventasParciales.length > 0) {
        updateFields['ventasParciales'] = alertBackup.ventasParciales;
      }
      
      db.alerts.updateOne(
        { _id: ObjectId(alertId) },
        { $set: updateFields }
      );
      
      print(`✅ Alerta restaurada exitosamente\n`);
      
      // Restaurar distribución en Liquidity si existe
      if (backupData.liquidityDistribution && backupData.liquidityDistribution.distribution) {
        print(`\n🔄 Restaurando distribución en Liquidity...\n`);
        
        const liquidity = db.liquidity.findOne({
          _id: ObjectId(backupData.liquidityDistribution.liquidityId)
        });
        
        if (liquidity) {
          const distIndex = liquidity.distributions.findIndex(
            d => d.alertId && d.alertId.toString() === alertId
          );
          
          if (distIndex >= 0) {
            const distBackup = backupData.liquidityDistribution.distribution;
            liquidity.distributions[distIndex] = {
              ...liquidity.distributions[distIndex],
              ...distBackup,
              alertId: ObjectId(alertId)
            };
            
            db.liquidity.save(liquidity);
            print(`✅ Distribución en Liquidity restaurada\n`);
          } else {
            print(`⚠️  No se encontró la distribución en Liquidity para restaurar\n`);
          }
        } else {
          print(`⚠️  No se encontró documento de Liquidity para restaurar\n`);
        }
      }
      
      // Verificar
      const restoredAlert = db.alerts.findOne({ _id: ObjectId(alertId) });
      print(`\n✅ VERIFICACIÓN:\n`);
      print(`   Status: ${restoredAlert.status}\n`);
      print(`   Participación: ${restoredAlert.participationPercentage}%\n`);
      print(`   Acciones: ${(restoredAlert.liquidityData?.shares || 0).toFixed(4)}\n`);
      print(`   Liquidez: $${(restoredAlert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
      
      return true;
    } catch (error) {
      print(`❌ Error al restaurar: ${error.message}\n`);
      return false;
    }
  }
  
  return true;
}

// ============================================
// EJECUTAR ROLLBACK
// ============================================
print(`\n🚀 Iniciando rollback...\n`);

const aemResult = restoreAlert(BACKUP_DATA.alerts.AEM, 'AEM');
const intcResult = restoreAlert(BACKUP_DATA.alerts.INTC, 'INTC');

// Resumen final
print(`\n${'='.repeat(80)}\n`);
print(`📊 RESUMEN DE ROLLBACK\n`);
print(`${'='.repeat(80)}\n`);

print(`AEM: ${aemResult ? '✅ Procesada' : '❌ Error'}\n`);
print(`INTC: ${intcResult ? '✅ Procesada' : '❌ Error'}\n`);

if (DRY_RUN) {
  print(`\n⚠️  MODO DRY-RUN: No se realizaron cambios reales\n`);
  print(`   Para ejecutar realmente, cambia DRY_RUN = false en el script\n`);
} else {
  print(`\n✅ Rollback completado exitosamente\n`);
  print(`   Las alertas han sido restauradas al estado del backup\n`);
}

print(`${'='.repeat(80)}\n`);
