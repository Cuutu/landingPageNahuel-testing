/**
 * Script para identificar alertas activas SIN distribución de liquidez
 * 
 * Ejecutar: mongosh "tu-connection-string" --file scripts/verificar-alertas-sin-distribucion.mongosh.js
 */

const POOL = "TraderCall";

print("\n======================================================================");
print("🔍 ALERTAS ACTIVAS SIN DISTRIBUCIÓN DE LIQUIDEZ");
print("======================================================================");
print(`Pool: ${POOL}`);

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.getCollection("liquidities");
const opsColl = db.getCollection("operations");

// 1. Obtener documento de liquidez y sus alertIds
const liquidityDoc = liquidityColl.findOne({ pool: POOL });

if (!liquidityDoc) {
  print("❌ No se encontró documento de liquidez para este pool");
  quit();
}

const alertIdsConDistribucion = (liquidityDoc.distributions || [])
  .filter(d => d.isActive !== false)
  .map(d => d.alertId);

print(`\n📊 Distribuciones activas en liquidez: ${alertIdsConDistribucion.length}`);

// 2. Obtener alertas activas del pool
const alertasActivas = alertsColl.find({ 
  status: "ACTIVE",
  $or: [
    { tipo: POOL },
    { pool: POOL }
  ]
}).toArray();

print(`📊 Alertas activas en ${POOL}: ${alertasActivas.length}`);

// 3. Identificar alertas sin distribución
print("\n=== ALERTAS ACTIVAS SIN DISTRIBUCIÓN ===\n");

let totalSinDistribucion = 0;
let totalMarketValueFaltante = 0;

alertasActivas.forEach(alert => {
  const alertIdStr = alert._id.toString();
  const tieneDistribucion = alertIdsConDistribucion.includes(alertIdStr);
  
  if (!tieneDistribucion) {
    totalSinDistribucion++;
    
    // Buscar operación de compra para esta alerta
    const buyOp = opsColl.findOne({ 
      alertId: alert._id,
      operationType: 'COMPRA',
      system: POOL
    });
    
    const shares = alert.liquidityData?.shares || buyOp?.quantity || 0;
    const entryPrice = alert.entryPrice || buyOp?.price || 0;
    const currentPrice = alert.currentPrice || entryPrice;
    const marketValue = shares * currentPrice;
    const participacion = alert.participationPercentage || 100;
    
    totalMarketValueFaltante += marketValue;
    
    print(`❌ ${alert.symbol}`);
    print(`   AlertId: ${alertIdStr}`);
    print(`   Shares: ${shares.toFixed(4)}`);
    print(`   Entry Price: $${entryPrice.toFixed(2)}`);
    print(`   Current Price: $${currentPrice.toFixed(2)}`);
    print(`   Market Value: $${marketValue.toFixed(2)}`);
    print(`   Participación: ${participacion}%`);
    print(`   liquidityData: ${JSON.stringify(alert.liquidityData || 'NO TIENE')}`);
    
    if (buyOp) {
      print(`   Operación COMPRA encontrada:`);
      print(`      - quantity: ${buyOp.quantity}`);
      print(`      - price: $${buyOp.price}`);
      print(`      - amount: $${buyOp.amount}`);
      print(`      - date: ${buyOp.date}`);
    } else {
      print(`   ⚠️ NO tiene operación de COMPRA`);
    }
    print("");
  }
});

if (totalSinDistribucion === 0) {
  print("✅ Todas las alertas activas tienen distribución");
} else {
  print("----------------------------------------------------------------------");
  print(`\n⚠️  TOTAL ALERTAS SIN DISTRIBUCIÓN: ${totalSinDistribucion}`);
  print(`⚠️  MARKET VALUE FALTANTE: $${totalMarketValueFaltante.toFixed(2)}`);
}

// 4. También verificar lo inverso: distribuciones sin alerta activa
print("\n=== DISTRIBUCIONES SIN ALERTA ACTIVA ===\n");

let distSinAlerta = 0;
let distConAlertaCerrada = 0;

(liquidityDoc.distributions || []).filter(d => d.isActive !== false).forEach(dist => {
  const alert = alertsColl.findOne({ _id: new ObjectId(dist.alertId) });
  
  if (!alert) {
    distSinAlerta++;
    print(`❌ ${dist.symbol} - ALERTA NO EXISTE`);
    print(`   AlertId: ${dist.alertId}`);
    print(`   Allocated: $${dist.allocatedAmount.toFixed(2)}`);
    print(`   Shares: ${dist.shares.toFixed(4)}`);
    print("");
  } else if (alert.status !== 'ACTIVE') {
    distConAlertaCerrada++;
    print(`⚠️ ${dist.symbol} - Alerta ${alert.status}`);
    print(`   AlertId: ${dist.alertId}`);
    print(`   Allocated: $${dist.allocatedAmount.toFixed(2)}`);
    print(`   Shares: ${dist.shares.toFixed(4)}`);
    print("");
  }
});

if (distSinAlerta === 0 && distConAlertaCerrada === 0) {
  print("✅ Todas las distribuciones tienen alerta activa");
}

// 5. Comparar shares entre distribución y tenencia esperada
print("\n=== COMPARACIÓN DE SHARES: DISTRIBUCIÓN VS LIQUIDITYDATA ===\n");

let discrepanciasShares = 0;

alertasActivas.forEach(alert => {
  const alertIdStr = alert._id.toString();
  const dist = (liquidityDoc.distributions || []).find(d => d.alertId === alertIdStr);
  
  if (dist && alert.liquidityData) {
    const distShares = dist.shares || 0;
    const alertShares = alert.liquidityData.shares || 0;
    const diff = Math.abs(distShares - alertShares);
    
    if (diff > 0.001) {
      discrepanciasShares++;
      const currentPrice = alert.currentPrice || dist.currentPrice || 0;
      const diffMV = diff * currentPrice;
      
      print(`⚠️ ${alert.symbol}`);
      print(`   Distribución shares: ${distShares.toFixed(4)}`);
      print(`   Alerta liquidityData shares: ${alertShares.toFixed(4)}`);
      print(`   Diferencia: ${diff.toFixed(4)} shares ($${diffMV.toFixed(2)})`);
      print("");
    }
  }
});

if (discrepanciasShares === 0) {
  print("✅ No hay discrepancias significativas en shares");
}

print("\n======================================================================");
print("📊 RESUMEN");
print("======================================================================");
print(`   Alertas activas sin distribución: ${totalSinDistribucion}`);
print(`   Market Value faltante: $${totalMarketValueFaltante.toFixed(2)}`);
print(`   Distribuciones sin alerta: ${distSinAlerta}`);
print(`   Distribuciones con alerta cerrada: ${distConAlertaCerrada}`);
print(`   Discrepancias en shares: ${discrepanciasShares}`);
print("======================================================================");
