/*******************************
 * CORREGIR LIQUIDEZ LIBERADA POR VENTAS
 * 
 * Actualiza las distributions con soldShares y realizedProfitLoss
 * basándose en las ventas ejecutadas en las alerts
 *******************************/
const DRY_RUN = false; // Cambiar a false para aplicar cambios
const POOL = "TraderCall";

const alertsColl = db.getCollection("alerts");
const opsColl = db.getCollection("operations");
const liquidityColl = db.liquidity;

print("=== 0) Parámetros ===");
printjson({
  dryRun: DRY_RUN ? "ON (solo lectura)" : "OFF (EJECUTARÁ CAMBIOS)",
  pool: POOL
});

/****************************************
 * 1) Obtener documento principal de Liquidity
 ****************************************/
print("\n=== 1) Buscando documento de Liquidity ===");

const liquidityDocs = liquidityColl.find({ pool: POOL }).toArray();

if (liquidityDocs.length === 0) {
  print("❌ No se encontró ningún documento de Liquidity para este pool.");
  quit();
}

const mainDoc = liquidityDocs
  .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0];

print(`Usando Liquidity._id = ${mainDoc._id} como documento principal.`);

/****************************************
 * 2) Buscar alerts con ventas ejecutadas
 ****************************************/
print("\n=== 2) Buscando alerts con ventas ejecutadas ===");

const TICKERS_OBJETIVO = ["XP", "AMD", "AVGO"];

const alerts = alertsColl.find({
  symbol: { $in: TICKERS_OBJETIVO },
  status: { $in: ["ACTIVE", "CLOSED"] }
}).toArray();

print(`Total alerts encontradas: ${alerts.length}`);

const distribucionesParaActualizar = [];

alerts.forEach((alert) => {
  const distribution = (mainDoc.distributions || []).find((dist) => 
    dist.alertId && dist.alertId.toString() === alert._id.toString()
  );
  
  if (!distribution) {
    print(`\n⚠️ ${alert.symbol}: No tiene distribution`);
    return;
  }
  
  // Verificar ventas parciales ejecutadas
  if (alert.liquidityData && alert.liquidityData.partialSales) {
    const partialSales = alert.liquidityData.partialSales || [];
    const ejecutadas = partialSales.filter((s) => s.executed);
    
    if (ejecutadas.length === 0) {
      return; // No hay ventas ejecutadas
    }
    
    // Calcular total de shares vendidos y realized P&L
    let totalSoldShares = 0;
    let totalRealizedPL = 0;
    
    ejecutadas.forEach((sale) => {
      const sharesVendidos = sale.sharesVendidos || (sale.percentage ? (distribution.shares * sale.percentage / 100) : 0);
      totalSoldShares += sharesVendidos;
      
      // Calcular P&L realizado: (precioVenta - precioEntrada) * sharesVendidos
      const entryPrice = distribution.entryPrice || 0;
      const sellPrice = sale.sellPrice || sale.precio || 0;
      const realizedPL = (sellPrice - entryPrice) * sharesVendidos;
      totalRealizedPL += realizedPL;
    });
    
    // Comparar con valores actuales en distribution
    const soldSharesActual = distribution.soldShares || 0;
    const realizedPLActual = distribution.realizedProfitLoss || 0;
    
    const diferenciaShares = Math.abs(totalSoldShares - soldSharesActual);
    const diferenciaPL = Math.abs(totalRealizedPL - realizedPLActual);
    
    if (diferenciaShares > 0.0001 || diferenciaPL > 0.01) {
      distribucionesParaActualizar.push({
        alertId: alert._id,
        symbol: alert.symbol,
        distributionIndex: (mainDoc.distributions || []).findIndex((d) => 
          d.alertId && d.alertId.toString() === alert._id.toString()
        ),
        valoresActuales: {
          soldShares: soldSharesActual,
          realizedProfitLoss: realizedPLActual
        },
        valoresNuevos: {
          soldShares: totalSoldShares,
          realizedProfitLoss: totalRealizedPL
        },
        diferenciaShares: diferenciaShares,
        diferenciaPL: diferenciaPL
      });
      
      print(`\n✅ ${alert.symbol}: Necesita actualización`);
      print(`   Sold Shares: ${soldSharesActual.toFixed(6)} -> ${totalSoldShares.toFixed(6)} (diff: ${diferenciaShares.toFixed(6)})`);
      print(`   Realized P&L: $${realizedPLActual.toFixed(2)} -> $${totalRealizedPL.toFixed(2)} (diff: $${diferenciaPL.toFixed(2)})`);
    } else {
      print(`\n✅ ${alert.symbol}: Ya está actualizado`);
    }
  }
});

print(`\nTotal distribuciones que necesitan actualización: ${distribucionesParaActualizar.length}`);

if (distribucionesParaActualizar.length === 0) {
  print("✅ No hay distribuciones que necesiten corrección.");
  quit();
}

/****************************************
 * 3) Aplicar cambios (si DRY_RUN = false)
 ****************************************/
if (DRY_RUN) {
  print("\n=== 3) Modo DRY RUN - No se actualizarán distribuciones ===");
  print("Si estás conforme, cambiá DRY_RUN = false y volvé a ejecutar.");
} else {
  print("\n=== 3) Actualizando distribuciones ===");
  
  let actualizadas = 0;
  let errores = 0;
  
  distribucionesParaActualizar.forEach((item, idx) => {
    try {
      // Actualizar la distribution específica usando el índice
      const updatePath = `distributions.${item.distributionIndex}`;
      
      const result = liquidityColl.updateOne(
        { _id: mainDoc._id },
        {
          $set: {
            [`${updatePath}.soldShares`]: item.valoresNuevos.soldShares,
            [`${updatePath}.realizedProfitLoss`]: item.valoresNuevos.realizedProfitLoss,
            [`${updatePath}.updatedAt`]: new Date()
          }
        }
      );
      
      if (result.modifiedCount === 1) {
        actualizadas++;
        print(`✅ ${idx + 1}. ${item.symbol} - Actualizado`);
      } else {
        errores++;
        print(`⚠️ ${idx + 1}. ${item.symbol} - No se pudo actualizar`);
      }
    } catch (error) {
      errores++;
      print(`❌ ${idx + 1}. ${item.symbol} - Error: ${error.message}`);
    }
  });
  
  print(`\n=== RESUMEN ACTUALIZACIÓN ===`);
  print(`Distribuciones actualizadas: ${actualizadas}`);
  print(`Errores: ${errores}`);
  print(`Total procesadas: ${distribucionesParaActualizar.length}`);
  
  // Recalcular liquidez disponible
  if (actualizadas > 0) {
    print("\n=== 4) Recalculando liquidez disponible ===");
    
    // Recargar el documento actualizado
    const updatedDoc = liquidityColl.findOne({ _id: mainDoc._id });
    
    let totalDistribuido = 0;
    let totalVendido = 0;
    let totalRealizedPL = 0;
    
    (updatedDoc.distributions || []).forEach((dist) => {
      if (dist.isActive) {
        totalDistribuido += dist.allocatedAmount || 0;
        totalVendido += (dist.soldShares || 0) * (dist.entryPrice || 0);
        totalRealizedPL += dist.realizedProfitLoss || 0;
      }
    });
    
    const liquidezEsperada = (updatedDoc.initialLiquidity || 0) - totalDistribuido + totalVendido + totalRealizedPL;
    
    const result = liquidityColl.updateOne(
      { _id: mainDoc._id },
      {
        $set: {
          distributedLiquidity: totalDistribuido,
          availableLiquidity: liquidezEsperada,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount === 1) {
      print(`✅ Liquidez disponible recalculada: $${liquidezEsperada.toFixed(2)}`);
      print(`   Total distribuido: $${totalDistribuido.toFixed(2)}`);
      print(`   Total vendido (cost basis): $${totalVendido.toFixed(2)}`);
      print(`   Total realized P&L: $${totalRealizedPL.toFixed(2)}`);
    } else {
      print(`⚠️ No se pudo actualizar la liquidez disponible`);
    }
  }
}

print("\n=== FIN CORRECCIÓN ===");
