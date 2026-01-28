/**
 * VERIFICAR DISTRIBUCIONES HUÉRFANAS
 * 
 * Busca distribuciones de liquidez que:
 * 1. Apuntan a alertas DESCARTADAS o DESESTIMADAS
 * 2. Apuntan a alertas que no existen
 * 3. Están marcadas como activas pero la alerta no está ACTIVE
 */

const POOL = "TraderCall"; // Cambiar a "SmartMoney" si es necesario

print("=" .repeat(70));
print("🔍 VERIFICACIÓN DE DISTRIBUCIONES HUÉRFANAS");
print("=" .repeat(70));
print(`Pool: ${POOL}\n`);

const alertsColl = db.getCollection("alerts");
const liquidityColl = db.getCollection("liquidities"); // ✅ Colección real (Mongoose pluraliza)
const opsColl = db.getCollection("operations");

// 1. Obtener todas las distribuciones activas del pool
print("\n=== 1) Obteniendo distribuciones activas ===\n");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length === 0) {
  print("⚠️ No se encontraron documentos de liquidez para el pool " + POOL);
} else {
  print(`📊 Encontrados ${liquidityDocs.length} documento(s) de liquidez para ${POOL}\n`);
}

let totalDistributions = 0;
let activeDistributions = 0;
let huerfanas = [];

liquidityDocs.forEach(doc => {
  const distributions = doc.distributions || [];
  totalDistributions += distributions.length;
  
  distributions.forEach(dist => {
    if (dist.isActive) {
      activeDistributions++;
      
      // Buscar la alerta asociada
      let alert = null;
      try {
        alert = alertsColl.findOne({ _id: ObjectId(dist.alertId) });
      } catch (e) {
        // Si el alertId no es un ObjectId válido, intentar como string
        alert = alertsColl.findOne({ _id: dist.alertId });
      }
      
      if (!alert) {
        huerfanas.push({
          tipo: "ALERTA_NO_EXISTE",
          symbol: dist.symbol,
          alertId: dist.alertId,
          allocatedAmount: dist.allocatedAmount,
          shares: dist.shares,
          docId: doc._id
        });
      } else if (alert.status !== "ACTIVE") {
        huerfanas.push({
          tipo: "ALERTA_NO_ACTIVA",
          symbol: dist.symbol,
          alertId: dist.alertId,
          alertStatus: alert.status,
          descartadaAt: alert.descartadaAt || null,
          descartadaMotivo: alert.descartadaMotivo || null,
          allocatedAmount: dist.allocatedAmount,
          shares: dist.shares,
          docId: doc._id
        });
      }
    }
  });
});

print(`📊 Total distribuciones: ${totalDistributions}`);
print(`📊 Distribuciones activas (isActive=true): ${activeDistributions}`);
print(`⚠️  Distribuciones huérfanas encontradas: ${huerfanas.length}\n`);

// 2. Mostrar detalles de distribuciones huérfanas
if (huerfanas.length > 0) {
  print("\n=== 2) DETALLE DE DISTRIBUCIONES HUÉRFANAS ===\n");
  
  huerfanas.forEach((h, idx) => {
    print(`\n--- ${idx + 1}. ${h.symbol} ---`);
    print(`   Tipo: ${h.tipo}`);
    print(`   AlertId: ${h.alertId}`);
    if (h.alertStatus) {
      print(`   Estado de alerta: ${h.alertStatus}`);
    }
    if (h.descartadaAt) {
      print(`   Descartada el: ${h.descartadaAt}`);
    }
    if (h.descartadaMotivo) {
      print(`   Motivo: ${h.descartadaMotivo}`);
    }
    print(`   Monto asignado: $${(h.allocatedAmount || 0).toFixed(2)}`);
    print(`   Shares: ${(h.shares || 0).toFixed(4)}`);
    print(`   Doc Liquidity ID: ${h.docId}`);
  });
  
  // Calcular total de liquidez bloqueada
  const totalBloqueada = huerfanas.reduce((sum, h) => sum + (h.allocatedAmount || 0), 0);
  print(`\n⚠️  TOTAL LIQUIDEZ BLOQUEADA POR HUÉRFANAS: $${totalBloqueada.toFixed(2)}`);
}

// 3. Verificar específicamente AMX y TWLO
print("\n=== 3) ANÁLISIS ESPECÍFICO: AMX y TWLO ===\n");

["AMX", "TWLO"].forEach(symbol => {
  print(`\n--- ${symbol} ---`);
  
  // Buscar todas las alertas de este símbolo
  const allAlerts = alertsColl.find({ symbol }).toArray();
  print(`   Total alertas en DB: ${allAlerts.length}`);
  
  // Agrupar por status
  const byStatus = {};
  allAlerts.forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  });
  Object.entries(byStatus).forEach(([status, count]) => {
    print(`      - ${status}: ${count}`);
  });
  
  // Buscar distribuciones activas para este símbolo
  let distCount = 0;
  let distTotal = 0;
  liquidityDocs.forEach(doc => {
    (doc.distributions || []).forEach(dist => {
      if (dist.symbol === symbol && dist.isActive) {
        distCount++;
        distTotal += dist.allocatedAmount || 0;
        
        // Verificar estado de la alerta
        let alert = null;
        try {
          alert = alertsColl.findOne({ _id: ObjectId(dist.alertId) });
        } catch (e) {
          alert = alertsColl.findOne({ _id: dist.alertId });
        }
        
        const alertStatus = alert ? alert.status : "NO EXISTE";
        const emoji = alertStatus === "ACTIVE" ? "✅" : "❌";
        print(`      ${emoji} Distribución: alertId=${dist.alertId}, status=${alertStatus}, amount=$${(dist.allocatedAmount || 0).toFixed(2)}`);
      }
    });
  });
  
  print(`   Distribuciones activas: ${distCount} (Total: $${distTotal.toFixed(2)})`);
  
  // Buscar operaciones activas para este símbolo
  const activeOps = opsColl.find({ 
    ticker: symbol, 
    system: POOL,
    status: { $in: ["ACTIVE", "PENDING"] }
  }).toArray();
  
  print(`   Operaciones activas/pendientes: ${activeOps.length}`);
  activeOps.forEach(op => {
    print(`      - ${op.operationType}: $${(op.amount || 0).toFixed(2)} (status: ${op.status}, alertId: ${op.alertId})`);
  });
});

// 4. Verificar alertas DESCARTADAS que aún tienen distribución
print("\n=== 4) ALERTAS DESCARTADAS CON DISTRIBUCIÓN ACTIVA ===\n");

const alertasDescartadas = alertsColl.find({ 
  status: { $in: ["DESCARTADA", "DESESTIMADA"] },
  tipo: POOL === "TraderCall" ? "TraderCall" : "SmartMoney"
}).toArray();

print(`Total alertas descartadas/desestimadas en ${POOL}: ${alertasDescartadas.length}`);

let descartadasConDistribucion = [];

alertasDescartadas.forEach(alert => {
  liquidityDocs.forEach(doc => {
    const dist = (doc.distributions || []).find(d => 
      d.alertId === alert._id.toString() && d.isActive
    );
    if (dist) {
      descartadasConDistribucion.push({
        symbol: alert.symbol,
        alertId: alert._id,
        status: alert.status,
        descartadaAt: alert.descartadaAt,
        descartadaMotivo: alert.descartadaMotivo,
        allocatedAmount: dist.allocatedAmount,
        shares: dist.shares
      });
    }
  });
});

if (descartadasConDistribucion.length > 0) {
  print(`\n⚠️  ${descartadasConDistribucion.length} alertas descartadas TODAVÍA tienen distribución activa:\n`);
  
  descartadasConDistribucion.forEach((item, idx) => {
    print(`   ${idx + 1}. ${item.symbol}`);
    print(`      AlertId: ${item.alertId}`);
    print(`      Status: ${item.status}`);
    print(`      Descartada: ${item.descartadaAt || 'N/A'}`);
    print(`      Motivo: ${item.descartadaMotivo || 'N/A'}`);
    print(`      Liquidez bloqueada: $${(item.allocatedAmount || 0).toFixed(2)}`);
    print(`      Shares: ${(item.shares || 0).toFixed(4)}`);
  });
  
  const totalDescartadasBloqueada = descartadasConDistribucion.reduce((sum, item) => sum + (item.allocatedAmount || 0), 0);
  print(`\n⚠️  TOTAL LIQUIDEZ BLOQUEADA POR ALERTAS DESCARTADAS: $${totalDescartadasBloqueada.toFixed(2)}`);
} else {
  print("✅ No hay alertas descartadas con distribución activa.");
}

// 5. Resumen final
print("\n" + "=".repeat(70));
print("📊 RESUMEN FINAL");
print("=".repeat(70));

const totalHuerfanas = huerfanas.reduce((sum, h) => sum + (h.allocatedAmount || 0), 0);
const totalDescartadas = descartadasConDistribucion.reduce((sum, item) => sum + (item.allocatedAmount || 0), 0);

print(`\n   Distribuciones huérfanas: ${huerfanas.length} ($${totalHuerfanas.toFixed(2)})`);
print(`   Alertas descartadas con distribución: ${descartadasConDistribucion.length} ($${totalDescartadas.toFixed(2)})`);
print(`   TOTAL LIQUIDEZ QUE DEBERÍA LIBERARSE: $${(totalHuerfanas + totalDescartadas).toFixed(2)}`);

print("\n" + "=".repeat(70));
print("FIN DEL ANÁLISIS");
print("=".repeat(70));
