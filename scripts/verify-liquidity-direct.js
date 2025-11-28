/**
 * Script para verificar el cálculo de liquidez directamente desde MongoDB
 * Uso: node scripts/verify-liquidity-direct.js [pool]
 * Ejemplo: node scripts/verify-liquidity-direct.js TraderCall
 */

const mongoose = require('mongoose');

// URI de MongoDB encontrada en otros scripts
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Tortu:Las40org@landingpagenahuel.pdccomn.mongodb.net/?retryWrites=true&w=majority&appName=landingPageNahuel';

const pool = process.argv[2] || 'TraderCall';

if (pool !== 'TraderCall' && pool !== 'SmartMoney') {
  console.error('❌ Pool inválido. Debe ser "TraderCall" o "SmartMoney"');
  process.exit(1);
}

// Esquemas simplificados para la verificación
const LiquidityDistributionSchema = new mongoose.Schema({}, { strict: false });
const LiquiditySchema = new mongoose.Schema({}, { strict: false });

const Liquidity = mongoose.models.Liquidity || mongoose.model('Liquidity', LiquiditySchema);

async function verifyLiquidity() {
  try {
    console.log(`\n🔍 Verificando cálculo de liquidez para ${pool}...\n`);
    console.log(`🔗 Conectando a MongoDB...\n`);

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Conectado a MongoDB\n');

    // Obtener todos los documentos de liquidez del pool
    const liquidityDocs = await Liquidity.find({ pool }).lean();

    if (liquidityDocs.length === 0) {
      console.log(`❌ No se encontraron documentos de liquidez para el pool ${pool}`);
      process.exit(1);
    }

    console.log(`📊 Documentos encontrados: ${liquidityDocs.length}\n`);

    // Calcular liquidez inicial global
    let liquidezInicialGlobal = 0;
    const docsWithInitialLiquidity = liquidityDocs.filter((doc) => 
      doc.initialLiquidity !== undefined && doc.initialLiquidity !== null && doc.initialLiquidity > 0
    );

    if (docsWithInitialLiquidity.length > 0) {
      const sortedByUpdate = [...docsWithInitialLiquidity].sort((a, b) => 
        new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
      liquidezInicialGlobal = sortedByUpdate[0].initialLiquidity;
    } else if (liquidityDocs.length > 0) {
      const firstDoc = liquidityDocs[0];
      liquidezInicialGlobal = firstDoc.totalLiquidity - (firstDoc.totalProfitLoss || 0);
    }

    // Calcular totales
    let liquidezDistribuidaSum = 0;
    let gananciaTotalSum = 0;

    liquidityDocs.forEach((doc) => {
      liquidezDistribuidaSum += doc.distributedLiquidity || 0;
      gananciaTotalSum += doc.totalProfitLoss || 0;
    });

    const liquidezTotal = liquidezInicialGlobal + gananciaTotalSum;
    const liquidezDisponible = liquidezTotal - liquidezDistribuidaSum;
    const gananciaPorcentaje = liquidezInicialGlobal > 0 
      ? (gananciaTotalSum / liquidezInicialGlobal) * 100 
      : 0;

    // Mostrar resultados
    console.log('='.repeat(80));
    console.log(`📊 RESUMEN PARA ${pool.toUpperCase()}`);
    console.log('='.repeat(80));
    
    console.log('\n💰 TOTALES:');
    console.log(`  Liquidez Inicial:     $${liquidezInicialGlobal.toFixed(2)}`);
    console.log(`  Ganancia Total:        $${gananciaTotalSum.toFixed(2)}`);
    console.log(`  Liquidez Total:        $${liquidezTotal.toFixed(2)}`);
    console.log(`  Liquidez Distribuida:  $${liquidezDistribuidaSum.toFixed(2)}`);
    console.log(`  Liquidez Disponible:   $${liquidezDisponible.toFixed(2)}`);
    console.log(`  Ganancia %:            ${gananciaPorcentaje.toFixed(4)}%`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICACIÓN MANUAL:');
    console.log('='.repeat(80));
    console.log(`\n  Fórmula Liquidez Total:`);
    console.log(`    ${liquidezInicialGlobal} + ${gananciaTotalSum}`);
    console.log(`    = $${liquidezTotal.toFixed(2)}`);
    
    console.log(`\n  Fórmula Liquidez Disponible:`);
    console.log(`    ${liquidezTotal.toFixed(2)} - ${liquidezDistribuidaSum}`);
    console.log(`    = $${liquidezDisponible.toFixed(2)}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 DESGLOSE POR DOCUMENTO:');
    console.log('='.repeat(80));
    
    liquidityDocs.forEach((doc, index) => {
      console.log(`\n📄 Documento ${index + 1} (ID: ${doc._id.toString().substring(0, 8)}...)`);
      console.log(`  Liquidez Inicial:     $${(doc.initialLiquidity || 0).toFixed(2)}`);
      console.log(`  Liquidez Total:       $${(doc.totalLiquidity || 0).toFixed(2)}`);
      console.log(`  Liquidez Distribuida:  $${(doc.distributedLiquidity || 0).toFixed(2)}`);
      console.log(`  Liquidez Disponible:  $${(doc.availableLiquidity || 0).toFixed(2)}`);
      console.log(`  P&L Total:            $${(doc.totalProfitLoss || 0).toFixed(2)}`);
      
      if (doc.distributions && doc.distributions.length > 0) {
        console.log(`\n  📊 Distribuciones (${doc.distributions.length}):`);
        doc.distributions.forEach((dist) => {
          const status = dist.isActive !== false ? '🟢' : '🔴';
          console.log(`\n    ${status} ${dist.symbol || 'N/A'} (Alerta: ${(dist.alertId || '').toString().substring(0, 8)}...)`);
          console.log(`      Monto Asignado:      $${(dist.allocatedAmount || 0).toFixed(2)}`);
          console.log(`      Precio Entrada:      $${(dist.entryPrice || 0).toFixed(2)}`);
          console.log(`      Precio Actual:       $${(dist.currentPrice || 0).toFixed(2)}`);
          console.log(`      Acciones:            ${dist.shares || 0}`);
          console.log(`      P&L:                 $${(dist.profitLoss || 0).toFixed(2)} (${(dist.profitLossPercentage || 0).toFixed(2)}%)`);
          if (dist.realizedProfitLoss > 0) {
            console.log(`      P&L Realizado:       $${dist.realizedProfitLoss.toFixed(2)}`);
          }
          
          // Verificación manual de P&L
          if (dist.entryPrice > 0 && dist.allocatedAmount > 0) {
            const expectedPLPercentage = ((dist.currentPrice - dist.entryPrice) / dist.entryPrice) * 100;
            const expectedPL = (expectedPLPercentage / 100) * dist.allocatedAmount;
            const plMatches = Math.abs(expectedPL - (dist.profitLoss || 0)) < 0.01;
            console.log(`      ✅ P&L Verificado:    $${expectedPL.toFixed(2)} ${plMatches ? '✓' : '✗'}`);
          }
        });
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Verificación completada\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

verifyLiquidity();
