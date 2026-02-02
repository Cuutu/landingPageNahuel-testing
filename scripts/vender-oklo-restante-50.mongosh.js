/**
 * Script para vender el 50% restante de OKLO y cerrar la posición.
 * La venta anterior ejecutó 50% por error; este script registra la venta del resto
 * al mismo precio de cierre que se usó (75.18).
 *
 * Ejecutar: mongosh "tu-connection-string" --file scripts/vender-oklo-restante-50.mongosh.js
 * En MongoDB Compass: pegar el contenido del script en la pestaña "Mongosh".
 * Si en Compass ves "exit/quit commands are not supported", es normal: ignoralo; el script ya terminó.
 */

const DRY_RUN = false; // Cambiar a false para ejecutar realmente
const SELL_PRICE = 75.18; // Precio de cierre usado en la venta automática

print('');
print('💰 VENTA RESTANTE OKLO - Cerrar posición (50% restante)');
print('==============================================================================');
print('Modo: ' + (DRY_RUN ? '🔍 DRY-RUN (solo mostrar cambios)' : '⚠️ EJECUTAR (realizar cambios)'));
print('Precio de venta: $' + SELL_PRICE.toFixed(2));
print('==============================================================================');
print('');

const okloAlert = db.alerts.findOne({ symbol: 'OKLO', status: 'ACTIVE' });

if (!okloAlert) {
  print('❌ No se encontró alerta OKLO activa. ¿Ya está cerrada?');
  const closed = db.alerts.findOne({ symbol: 'OKLO', status: 'CLOSED' });
  if (closed) {
    print('   La alerta OKLO ya está en estado CLOSED. No hay nada que ejecutar.');
  }
  // Sin quit() para compatibilidad con MongoDB Compass
} else {

const okloAlertId = okloAlert._id;
const liquidityData = okloAlert.liquidityData || {};
const partialSales = liquidityData.partialSales || [];

const currentShares = liquidityData.shares ?? 0;
const originalShares = liquidityData.originalShares ?? liquidityData.shares ?? 0;
const currentParticipation = okloAlert.participationPercentage ?? 50;
const currentAllocatedAmount = liquidityData.allocatedAmount ?? 0;
const entryPrice = okloAlert.entryPrice || okloAlert.entryPriceRange?.min || 97.87;

print('📊 ESTADO ACTUAL OKLO:');
print('   Participación: ' + currentParticipation + '%');
print('   Shares actuales: ' + currentShares.toFixed(4));
print('   Shares originales: ' + originalShares.toFixed(4));
print('   AllocatedAmount: $' + (currentAllocatedAmount || 0).toFixed(2));
print('   Precio entrada: $' + entryPrice.toFixed(2));
print('   Ventas parciales ya registradas: ' + partialSales.length);
print('');

// Vender el 100% de lo que queda = currentParticipation % del total original
const percentageToSell = currentParticipation; // 50%
const sharesToSell = currentShares; // Todo lo que queda
const sharesRemaining = 0;
const newParticipation = 0;
const isCompleteSale = true;

const liquidityReleased = sharesToSell * SELL_PRICE;
const marketValue = sharesToSell * SELL_PRICE;
const costBasis = sharesToSell * entryPrice;
const realizedProfit = marketValue - costBasis;
const newAllocatedAmount = 0;

// Porcentaje vendido respecto al total original (para el registro)
const actualPercentageSold = originalShares > 0 ? (sharesToSell / originalShares) * 100 : percentageToSell;

print('📊 CÁLCULO DE LA VENTA (restante):');
print('   Porcentaje a vender: ' + percentageToSell + '% (todo lo que queda)');
print('   Shares a vender: ' + sharesToSell.toFixed(4));
print('   Participación después: ' + newParticipation + '%');
print('   Ganancia realizada: $' + realizedProfit.toFixed(2));
print('   Liquidez liberada: $' + liquidityReleased.toFixed(2));
print('');

if (DRY_RUN) {
  print('🔍 DRY-RUN: No se realizarán cambios.');
  print('');
  print('Si ejecutaras con DRY_RUN = false, se haría:');
  print('   1. Alerta: agregar venta a partialSales, participationPercentage → 0, shares → 0');
  print('   2. Alerta: status → CLOSED, exitPrice → ' + SELL_PRICE + ', exitDate, exitReason → MANUAL');
  print('   3. Liquidity (TraderCall): actualizar distribución de OKLO (shares → 0, soldShares += ' + sharesToSell.toFixed(4) + ')');
  print('');
  print('Para ejecutar de verdad, editá el script y poné DRY_RUN = false.');
  print('==============================================================================');
} else {

print('🔧 EJECUTANDO VENTA DEL RESTANTE...');
print('');

const newPartialSale = {
  date: new Date(),
  percentage: actualPercentageSold,
  sharesToSell: sharesToSell,
  sellPrice: SELL_PRICE,
  liquidityReleased: liquidityReleased,
  realizedProfit: realizedProfit,
  executedBy: 'MANUAL_SCRIPT_OKLO_RESTANTE',
  priceRange: null,
  emailMessage: null,
  emailImageUrl: null,
  isCompleteSale: true,
  executed: true,
  executedAt: new Date()
};

const updatedPartialSales = [...partialSales, newPartialSale];

const updateAlert = {
  'liquidityData.partialSales': updatedPartialSales,
  'liquidityData.shares': 0,
  'liquidityData.allocatedAmount': 0,
  participationPercentage: 0,
  status: 'CLOSED',
  exitPrice: SELL_PRICE,
  exitDate: new Date(),
  exitReason: 'MANUAL'
};

db.alerts.updateOne(
  { _id: okloAlertId },
  { $set: updateAlert }
);

print('✅ Alerta OKLO actualizada');
print('   - Participación: ' + currentParticipation + '% → 0%');
print('   - Status: ACTIVE → CLOSED');
print('   - Exit price: $' + SELL_PRICE.toFixed(2));
print('');

// Actualizar Liquidity (pool TraderCall)
const liquidity = db.liquidities.findOne({
  pool: 'TraderCall',
  'distributions.alertId': okloAlertId.toString()
});

if (liquidity) {
  const distributions = liquidity.distributions || [];
  const idx = distributions.findIndex((d) => d.alertId && d.alertId.toString() === okloAlertId.toString());

  if (idx >= 0) {
    const dist = distributions[idx];
    const prevShares = dist.shares || 0;
    const prevSold = dist.soldShares || 0;
    const prevAlloc = dist.allocatedAmount || 0;

    distributions[idx] = {
      ...dist,
      shares: 0,
      allocatedAmount: 0,
      soldShares: prevSold + sharesToSell,
      realizedProfitLoss: (dist.realizedProfitLoss || 0) + realizedProfit
    };

    const currentDistributed = liquidity.distributedLiquidity || 0;
    const currentTotal = liquidity.totalLiquidity || 0;
    const newDistributed = Math.max(0, currentDistributed - costBasis);
    const newTotal = currentTotal + marketValue;
    const newAvailable = newTotal - newDistributed;

    db.liquidities.updateOne(
      { _id: liquidity._id },
      {
        $set: {
          distributions: distributions,
          distributedLiquidity: newDistributed,
          totalLiquidity: newTotal,
          availableLiquidity: newAvailable
        }
      }
    );
    print('✅ Liquidity (TraderCall) actualizado');
    print('   - Shares distribución: ' + prevShares.toFixed(4) + ' → 0');
    print('   - SoldShares: ' + prevSold.toFixed(4) + ' → ' + (prevSold + sharesToSell).toFixed(4));
  } else {
    print('⚠️ No se encontró distribución de OKLO en Liquidity');
  }
} else {
  print('⚠️ No se encontró documento Liquidity para TraderCall');
}

print('');
print('==============================================================================');
print('✅ Venta del restante OKLO ejecutada. Posición cerrada.');
print('==============================================================================');

} // fin else ejecución real
  print('');
  print('Script finalizado. (En Compass, el error exit/quit se puede ignorar.)');
} // fin else alerta encontrada
