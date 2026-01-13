/**
 * BACKUP - Guardar estado actual de alertas AEM e INTC antes de corrección
 * 
 * Este script guarda el estado actual de las alertas AEM e INTC en un archivo JSON
 * para poder hacer rollback si algo sale mal durante la corrección.
 * 
 * INSTRUCCIONES:
 * 1. Ejecutar ANTES de corregir las alertas
 * 2. El backup se guardará en: scripts/backup-alertas-aem-intc-[timestamp].json
 * 3. Guardar este archivo en un lugar seguro
 */

print('💾 BACKUP - Estado actual de alertas AEM e INTC\n');
print('='.repeat(80) + '\n');

// ============================================
// CONFIGURACIÓN
// ============================================
const AEM_ALERT_ID = '692e2ed0a16956ec58c15181';
const INTC_ALERT_ID = '6957f5578bbe1e7b4d23034d';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                  new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
const backupFileName = `scripts/backup-alertas-aem-intc-${timestamp}.json`;

print(`📅 Fecha del backup: ${new Date().toISOString()}\n`);
print(`📁 Archivo de backup: ${backupFileName}\n`);
print('='.repeat(80) + '\n');

// ============================================
// FUNCIÓN PARA HACER BACKUP DE UNA ALERTA
// ============================================
function backupAlert(alertId, symbol) {
  print(`\n💾 Haciendo backup de alerta: ${symbol}\n`);
  
  // Buscar la alerta
  let alert;
  try {
    alert = db.alerts.findOne({ _id: ObjectId(alertId) });
  } catch (e) {
    alert = db.alerts.findOne({ _id: alertId });
  }
  
  if (!alert) {
    print(`❌ No se encontró la alerta ${symbol} con ID: ${alertId}\n`);
    return null;
  }
  
  print(`✅ Alerta encontrada: ${alert.symbol}\n`);
  
  // Crear objeto de backup con todos los campos relevantes
  const backup = {
    alertId: alertId,
    symbol: alert.symbol,
    timestamp: new Date().toISOString(),
    alert: {
      _id: alert._id.toString(),
      symbol: alert.symbol,
      status: alert.status,
      tipo: alert.tipo,
      participationPercentage: alert.participationPercentage,
      originalParticipationPercentage: alert.originalParticipationPercentage,
      entryPrice: alert.entryPrice,
      entryPriceRange: alert.entryPriceRange,
      currentPrice: alert.currentPrice,
      exitPrice: alert.exitPrice,
      exitDate: alert.exitDate,
      exitReason: alert.exitReason,
      createdAt: alert.createdAt,
      date: alert.date,
      liquidityData: alert.liquidityData ? {
        allocatedAmount: alert.liquidityData.allocatedAmount,
        shares: alert.liquidityData.shares,
        originalAllocatedAmount: alert.liquidityData.originalAllocatedAmount,
        originalShares: alert.liquidityData.originalShares,
        originalParticipationPercentage: alert.liquidityData.originalParticipationPercentage,
        partialSales: alert.liquidityData.partialSales ? alert.liquidityData.partialSales.map(sale => ({
          date: sale.date,
          percentage: sale.percentage,
          sharesToSell: sale.sharesToSell,
          sellPrice: sale.sellPrice,
          liquidityReleased: sale.liquidityReleased,
          realizedProfit: sale.realizedProfit,
          executedBy: sale.executedBy,
          priceRange: sale.priceRange,
          emailMessage: sale.emailMessage,
          emailImageUrl: sale.emailImageUrl,
          isCompleteSale: sale.isCompleteSale,
          executed: sale.executed,
          scheduledAt: sale.scheduledAt,
          executedAt: sale.executedAt,
          discarded: sale.discarded,
          discardedAt: sale.discardedAt,
          discardReason: sale.discardReason
        })) : []
      } : null,
      ventasParciales: alert.ventasParciales || []
    },
    liquidityDistribution: null
  };
  
  // Buscar distribución en Liquidity si existe
  const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
  print(`   🔍 Buscando distribución en Liquidity (Pool: ${pool})...\n`);
  
  const liquidity = db.liquidity.findOne({
    pool: pool,
    'distributions.alertId': ObjectId(alertId)
  });
  
  if (liquidity) {
    const distribution = liquidity.distributions.find(
      d => d.alertId && d.alertId.toString() === alertId
    );
    
    if (distribution) {
      backup.liquidityDistribution = {
        pool: pool,
        liquidityId: liquidity._id.toString(),
        distribution: {
          alertId: distribution.alertId ? distribution.alertId.toString() : null,
          symbol: distribution.symbol,
          percentage: distribution.percentage,
          allocatedAmount: distribution.allocatedAmount,
          entryPrice: distribution.entryPrice,
          currentPrice: distribution.currentPrice,
          shares: distribution.shares,
          soldShares: distribution.soldShares,
          profitLoss: distribution.profitLoss,
          profitLossPercentage: distribution.profitLossPercentage,
          realizedProfitLoss: distribution.realizedProfitLoss,
          isActive: distribution.isActive,
          createdAt: distribution.createdAt
        }
      };
      print(`   ✅ Distribución encontrada en Liquidity\n`);
    } else {
      print(`   ⚠️  No se encontró distribución para esta alerta\n`);
    }
  } else {
    print(`   ⚠️  No se encontró documento de Liquidity\n`);
  }
  
  // Buscar operaciones relacionadas
  print(`   🔍 Buscando operaciones relacionadas...\n`);
  const operations = db.operations.find({
    alertId: ObjectId(alertId)
  }).sort({ date: -1 }).toArray();
  
  backup.operations = operations.map(op => ({
    _id: op._id.toString(),
    ticker: op.ticker,
    operationType: op.operationType,
    quantity: op.quantity,
    price: op.price,
    amount: op.amount,
    date: op.date,
    balance: op.balance,
    isPartialSale: op.isPartialSale,
    partialSalePercentage: op.partialSalePercentage,
    status: op.status,
    isPriceConfirmed: op.isPriceConfirmed,
    priceRange: op.priceRange,
    notes: op.notes
  }));
  
  print(`   ✅ ${operations.length} operación(es) encontrada(s)\n`);
  
  return backup;
}

// ============================================
// HACER BACKUP DE AMBAS ALERTAS
// ============================================
print(`\n🚀 Iniciando backup...\n`);

const aemBackup = backupAlert(AEM_ALERT_ID, 'AEM');
const intcBackup = backupAlert(INTC_ALERT_ID, 'INTC');

// Crear objeto completo de backup
const fullBackup = {
  backupInfo: {
    timestamp: new Date().toISOString(),
    createdBy: 'backup-alertas-aem-intc.mongosh.js',
    description: 'Backup completo de alertas AEM e INTC antes de corrección',
    alerts: ['AEM', 'INTC']
  },
  alerts: {
    AEM: aemBackup,
    INTC: intcBackup
  }
};

// Guardar backup en archivo
// Nota: En mongosh no podemos escribir archivos directamente, así que imprimimos el JSON
// El usuario deberá copiarlo manualmente o usar mongoexport

print(`\n${'='.repeat(80)}\n`);
print(`📋 BACKUP COMPLETADO\n`);
print(`${'='.repeat(80)}\n`);

if (aemBackup && intcBackup) {
  print(`✅ Backup de AEM: Completado\n`);
  print(`✅ Backup de INTC: Completado\n`);
  
  print(`\n📝 INFORMACIÓN DEL BACKUP:\n`);
  print(`   AEM - Status: ${aemBackup.alert.status}\n`);
  print(`   AEM - Participación: ${aemBackup.alert.participationPercentage || 100}%\n`);
  print(`   AEM - Acciones: ${(aemBackup.alert.liquidityData?.shares || 0).toFixed(4)}\n`);
  print(`   AEM - Liquidez: $${(aemBackup.alert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  print(`\n   INTC - Status: ${intcBackup.alert.status}\n`);
  print(`   INTC - Participación: ${intcBackup.alert.participationPercentage || 100}%\n`);
  print(`   INTC - Acciones: ${(intcBackup.alert.liquidityData?.shares || 0).toFixed(4)}\n`);
  print(`   INTC - Liquidez: $${(intcBackup.alert.liquidityData?.allocatedAmount || 0).toFixed(2)}\n`);
  
  print(`\n💾 Para guardar el backup, ejecuta:\n`);
  print(`   mongoexport --db=<tu-db> --collection=alerts --query='{"_id":{"$in":[ObjectId("${AEM_ALERT_ID}"),ObjectId("${INTC_ALERT_ID}")]}}' --out=${backupFileName}\n`);
  print(`\n   O copia el siguiente JSON manualmente:\n`);
  print(`\n${JSON.stringify(fullBackup, null, 2)}\n`);
  
} else {
  print(`⚠️  Backup incompleto:\n`);
  if (!aemBackup) print(`   ❌ AEM: No se pudo hacer backup\n`);
  if (!intcBackup) print(`   ❌ INTC: No se pudo hacer backup\n`);
}

print(`${'='.repeat(80)}\n`);
print(`✅ Proceso de backup finalizado\n`);
print(`${'='.repeat(80)}\n`);
