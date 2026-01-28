/**
 * Script para corregir BABA: cambiar de SmartMoney a TraderCall
 * - Elimina distribución de SmartMoney (si existe)
 * - Crea distribución en TraderCall
 * 
 * Ejecutar: mongosh "tu-connection-string" --file scripts/corregir-baba-tradercall.mongosh.js
 */

const DRY_RUN = true; // ⚠️ Cambiar a false para ejecutar cambios

// Datos de BABA según Excel
const BABA_DATA = {
  symbol: "BABA",
  shares: 0.2882,
  entryPrice: 173.47,
  currentPrice: 172.72,
  participationPercentage: 100
};

const OLD_POOL = "SmartMoney";
const NEW_POOL = "TraderCall";

print("\n======================================================================");
print("🔧 CORRECCIÓN DE BABA: SmartMoney → TraderCall");
print("======================================================================");
print(`Modo: ${DRY_RUN ? '🔍 DRY RUN (sin cambios)' : '⚠️ EJECUTANDO CAMBIOS'}`);

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.getCollection("liquidities");

// 1. Buscar alerta de BABA
const babaAlert = alertsColl.findOne({ symbol: "BABA", status: "ACTIVE" });

if (!babaAlert) {
  print("❌ No se encontró alerta activa de BABA");
  quit();
}

print(`\n=== 1) ALERTA ACTUAL DE BABA ===`);
print(`   _id: ${babaAlert._id}`);
print(`   tipo actual: ${babaAlert.tipo}`);
print(`   participationPercentage: ${babaAlert.participationPercentage}%`);
print(`   entryPrice: $${babaAlert.entryPrice || 'N/A'}`);
print(`   currentPrice: $${babaAlert.currentPrice || 'N/A'}`);

// 2. Buscar documento de liquidez de SmartMoney (origen)
const smartMoneyDoc = liquidityColl.findOne({ pool: OLD_POOL });
let smartMoneyDist = null;

if (smartMoneyDoc) {
  smartMoneyDist = (smartMoneyDoc.distributions || []).find(d => d.alertId === babaAlert._id.toString());
  
  const smAvailable = smartMoneyDoc.availableLiquidity || 0;
  const smDistributed = smartMoneyDoc.distributedLiquidity || 0;
  
  print(`\n=== 2) DOCUMENTO DE LIQUIDEZ SMARTMONEY (ORIGEN) ===`);
  print(`   _id: ${smartMoneyDoc._id}`);
  print(`   availableLiquidity: $${smAvailable.toFixed(2)}`);
  print(`   distributedLiquidity: $${smDistributed.toFixed(2)}`);
  print(`   distribuciones: ${(smartMoneyDoc.distributions || []).length}`);
  
  if (smartMoneyDist) {
    print(`   ⚠️ BABA tiene distribución en SmartMoney:`);
    print(`      shares: ${smartMoneyDist.shares || 0}`);
    print(`      allocatedAmount: $${smartMoneyDist.allocatedAmount || 0}`);
    print(`      → SE ELIMINARÁ`);
  } else {
    print(`   ✅ BABA no tiene distribución en SmartMoney`);
  }
} else {
  print(`\n=== 2) SmartMoney: No existe documento de liquidez ===`);
}

// 3. Buscar documento de liquidez de TraderCall (destino)
const traderCallDoc = liquidityColl.findOne({ pool: NEW_POOL });

if (!traderCallDoc) {
  print("❌ No se encontró documento de liquidez para TraderCall");
  quit();
}

print(`\n=== 3) DOCUMENTO DE LIQUIDEZ TRADERCALL (DESTINO) ===`);
print(`   _id: ${traderCallDoc._id}`);
print(`   initialLiquidity: $${traderCallDoc.initialLiquidity}`);
print(`   availableLiquidity: $${traderCallDoc.availableLiquidity.toFixed(2)}`);
print(`   distributedLiquidity: $${traderCallDoc.distributedLiquidity.toFixed(2)}`);

// Verificar si BABA ya tiene distribución en TraderCall
const existingDistTC = traderCallDoc.distributions.find(d => d.alertId === babaAlert._id.toString());
if (existingDistTC) {
  print(`   ⚠️ BABA ya tiene distribución en TraderCall:`);
  print(`      shares: ${existingDistTC.shares}`);
  print(`      allocatedAmount: $${existingDistTC.allocatedAmount}`);
  print("\n   No es necesario crear una nueva distribución.");
} else {
  print(`   ✅ BABA no tiene distribución en TraderCall - se creará una nueva`);
}

// 4. Calcular la nueva distribución para TraderCall
const allocatedAmount = BABA_DATA.shares * BABA_DATA.entryPrice;
const marketValue = BABA_DATA.shares * BABA_DATA.currentPrice;
const profitLoss = marketValue - allocatedAmount;
const profitLossPercentage = (profitLoss / allocatedAmount) * 100;

print(`\n=== 4) NUEVA DISTRIBUCIÓN A CREAR EN TRADERCALL ===`);
print(`   alertId: ${babaAlert._id}`);
print(`   symbol: ${BABA_DATA.symbol}`);
print(`   shares: ${BABA_DATA.shares}`);
print(`   entryPrice: $${BABA_DATA.entryPrice}`);
print(`   currentPrice: $${BABA_DATA.currentPrice}`);
print(`   allocatedAmount: $${allocatedAmount.toFixed(2)}`);
print(`   marketValue: $${marketValue.toFixed(2)}`);
print(`   profitLoss: $${profitLoss.toFixed(2)} (${profitLossPercentage.toFixed(2)}%)`);

// 5. Calcular nuevos totales de liquidez en TraderCall
const newDistributedLiquidity = traderCallDoc.distributedLiquidity + allocatedAmount;
const newAvailableLiquidity = traderCallDoc.availableLiquidity - allocatedAmount;

print(`\n=== 5) IMPACTO EN LIQUIDEZ TRADERCALL ===`);
print(`   distributedLiquidity: $${traderCallDoc.distributedLiquidity.toFixed(2)} → $${newDistributedLiquidity.toFixed(2)}`);
print(`   availableLiquidity: $${traderCallDoc.availableLiquidity.toFixed(2)} → $${newAvailableLiquidity.toFixed(2)}`);

if (newAvailableLiquidity < 0) {
  print(`\n⚠️ ADVERTENCIA: availableLiquidity quedaría negativa ($${newAvailableLiquidity.toFixed(2)})`);
  print(`   Esto indica que no hay suficiente liquidez disponible.`);
}

// 6. Ejecutar cambios
if (!DRY_RUN) {
  print(`\n=== 6) EJECUTANDO CAMBIOS ===`);
  
  // 6a. Eliminar distribución de SmartMoney (si existe)
  if (smartMoneyDoc && smartMoneyDist) {
    const smAllocated = smartMoneyDist.allocatedAmount || 0;
    const smUpdate = liquidityColl.updateOne(
      { _id: smartMoneyDoc._id },
      { 
        $pull: { distributions: { alertId: babaAlert._id.toString() } },
        $inc: { 
          distributedLiquidity: -smAllocated,
          availableLiquidity: smAllocated
        }
      }
    );
    print(`   ✅ Distribución eliminada de SmartMoney: ${smUpdate.modifiedCount} documento(s)`);
  }
  
  // 6b. Actualizar tipo de la alerta
  const alertUpdate = alertsColl.updateOne(
    { _id: babaAlert._id },
    { 
      $set: { 
        tipo: NEW_POOL,
        entryPrice: BABA_DATA.entryPrice,
        currentPrice: BABA_DATA.currentPrice,
        participationPercentage: BABA_DATA.participationPercentage,
        liquidityData: {
          allocatedAmount: allocatedAmount,
          shares: BABA_DATA.shares,
          originalAllocatedAmount: allocatedAmount,
          originalShares: BABA_DATA.shares,
          originalParticipationPercentage: 100,
          partialSales: []
        }
      }
    }
  );
  print(`   ✅ Alerta actualizada (tipo → ${NEW_POOL}): ${alertUpdate.modifiedCount} documento(s)`);
  
  // 6c. Crear distribución en TraderCall (si no existe)
  if (!existingDistTC) {
    const newDistribution = {
      alertId: babaAlert._id.toString(),
      symbol: BABA_DATA.symbol,
      percentage: (allocatedAmount / traderCallDoc.initialLiquidity) * 100,
      allocatedAmount: allocatedAmount,
      entryPrice: BABA_DATA.entryPrice,
      currentPrice: BABA_DATA.currentPrice,
      shares: BABA_DATA.shares,
      profitLoss: profitLoss,
      profitLossPercentage: profitLossPercentage,
      realizedProfitLoss: 0,
      soldShares: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const tcUpdate = liquidityColl.updateOne(
      { _id: traderCallDoc._id },
      { 
        $push: { distributions: newDistribution },
        $inc: { 
          distributedLiquidity: allocatedAmount,
          availableLiquidity: -allocatedAmount
        }
      }
    );
    print(`   ✅ Distribución creada en TraderCall: ${tcUpdate.modifiedCount} documento(s)`);
  }
  
  print(`\n✅ CORRECCIÓN COMPLETADA`);
  print(`   - BABA eliminada de SmartMoney`);
  print(`   - BABA agregada a TraderCall`);
} else {
  print(`\n=== 6) CAMBIOS PENDIENTES (DRY RUN) ===`);
  print(`   1. Eliminar distribución de SmartMoney: ${smartMoneyDist ? 'SÍ' : 'NO (no existe)'}`);
  print(`   2. Cambiar tipo de alerta: SmartMoney → TraderCall`);
  print(`   3. Crear distribución en TraderCall: ${existingDistTC ? 'NO (ya existe)' : 'SÍ'}`);
  print(`\n   Para ejecutar, cambia DRY_RUN a false y vuelve a ejecutar.`);
}

print("\n======================================================================");
print("FIN");
print("======================================================================");
