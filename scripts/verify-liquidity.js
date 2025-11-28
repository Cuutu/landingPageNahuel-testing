/**
 * Script para verificar el cálculo de liquidez
 * Uso: node scripts/verify-liquidity.js [pool]
 * Ejemplo: node scripts/verify-liquidity.js TraderCall
 * 
 * Nota: Este script llama al endpoint de la API, que necesita MONGODB_URI configurada.
 * Si no está configurada, el servidor debe tenerla en .env.local o variables de entorno.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // También intenta .env

const pool = process.argv[2] || 'TraderCall';

if (pool !== 'TraderCall' && pool !== 'SmartMoney') {
  console.error('❌ Pool inválido. Debe ser "TraderCall" o "SmartMoney"');
  process.exit(1);
}

const http = require('http');
const https = require('https');

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const urlPath = `/api/liquidity/verify-calculation?pool=${pool}`;
const fullUrl = `${baseUrl}${urlPath}`;

console.log(`\n🔍 Verificando cálculo de liquidez para ${pool}...\n`);
console.log(`📡 URL: ${fullUrl}\n`);

const url = new URL(fullUrl);
const client = url.protocol === 'https:' ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname + url.search,
  method: 'GET'
};

const request = client.get(options, (response) => {
  let data = '';

  response.on('data', (chunk) => {
    data += chunk;
  });

  response.on('end', () => {
    if (response.statusCode !== 200) {
      try {
        const errorData = JSON.parse(data);
        console.error('\n❌ Error:', errorData.error || `HTTP ${response.statusCode}`);
      } catch (e) {
        console.error('\n❌ Error:', data);
      }
      process.exit(1);
      return;
    }

    try {
      const parsedData = JSON.parse(data);
      processData(parsedData);
    } catch (error) {
      console.error('\n❌ Error parseando respuesta:', error.message);
      process.exit(1);
    }
  });
});

request.on('error', (error) => {
  console.error('\n❌ Error de conexión:', error.message);
  console.error('\n💡 Asegúrate de que:');
  console.error('   1. El servidor esté corriendo (npm run dev)');
  console.error('   2. El pool sea "TraderCall" o "SmartMoney"');
  console.error('   3. Haya documentos de liquidez en la base de datos\n');
  process.exit(1);
});

function processData(data) {
    console.log('='.repeat(80));
    console.log(`📊 RESUMEN PARA ${data.pool.toUpperCase()}`);
    console.log('='.repeat(80));
    
    console.log('\n💰 TOTALES:');
    console.log(`  Liquidez Inicial:     $${data.totals.liquidezInicial.toFixed(2)}`);
    console.log(`  Ganancia Total:        $${data.totals.gananciaTotal.toFixed(2)}`);
    console.log(`  Liquidez Total:        $${data.totals.liquidezTotal.toFixed(2)}`);
    console.log(`  Liquidez Distribuida:   $${data.totals.liquidezDistribuida.toFixed(2)}`);
    console.log(`  Liquidez Disponible:   $${data.totals.liquidezDisponible.toFixed(2)}`);
    console.log(`  Ganancia %:            ${data.totals.gananciaPorcentaje.toFixed(4)}%`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICACIÓN MANUAL:');
    console.log('='.repeat(80));
    console.log(`\n  Fórmula Liquidez Total:`);
    console.log(`    ${data.manualVerification.formulaLiquidezTotal}`);
    console.log(`    = $${data.manualVerification.calculatedLiquidezTotal.toFixed(2)}`);
    console.log(`    ${data.manualVerification.matches ? '✅' : '❌'} Coincide: ${data.totals.liquidezTotal.toFixed(2)}`);
    
    console.log(`\n  Fórmula Liquidez Disponible:`);
    console.log(`    ${data.manualVerification.formulaLiquidezDisponible}`);
    console.log(`    = $${data.manualVerification.calculatedLiquidezDisponible.toFixed(2)}`);
    console.log(`    ${data.manualVerification.matches ? '✅' : '❌'} Coincide: ${data.totals.liquidezDisponible.toFixed(2)}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 DESGLOSE POR DOCUMENTO:');
    console.log('='.repeat(80));
    
    data.documents.forEach((doc, index) => {
      console.log(`\n📄 Documento ${index + 1} (ID: ${doc.documentId.substring(0, 8)}...)`);
      console.log(`  Liquidez Inicial:     $${doc.initialLiquidity.toFixed(2)}`);
      console.log(`  Liquidez Total:       $${doc.totalLiquidity.toFixed(2)}`);
      console.log(`  Liquidez Distribuida:  $${doc.distributedLiquidity.toFixed(2)}`);
      console.log(`  Liquidez Disponible:   $${doc.availableLiquidity.toFixed(2)}`);
      console.log(`  P&L Total:             $${doc.totalProfitLoss.toFixed(2)}`);
      
      if (doc.distributions.length > 0) {
        console.log(`\n  📊 Distribuciones (${doc.distributions.length}):`);
        doc.distributions.forEach((dist, distIndex) => {
          const status = dist.isActive ? '🟢' : '🔴';
          console.log(`\n    ${status} ${dist.symbol} (Alerta: ${dist.alertId.substring(0, 8)}...)`);
          console.log(`      Monto Asignado:      $${dist.allocatedAmount.toFixed(2)}`);
          console.log(`      Precio Entrada:      $${dist.entryPrice.toFixed(2)}`);
          console.log(`      Precio Actual:      $${dist.currentPrice.toFixed(2)}`);
          console.log(`      Acciones:            ${dist.shares}`);
          console.log(`      P&L:                 $${dist.profitLoss.toFixed(2)} (${dist.profitLossPercentage.toFixed(2)}%)`);
          if (dist.realizedProfitLoss > 0) {
            console.log(`      P&L Realizado:       $${dist.realizedProfitLoss.toFixed(2)}`);
          }
          
          // Verificación manual de P&L
          const expectedPLPercentage = dist.entryPrice > 0 
            ? ((dist.currentPrice - dist.entryPrice) / dist.entryPrice) * 100 
            : 0;
          const expectedPL = (expectedPLPercentage / 100) * dist.allocatedAmount;
          const plMatches = Math.abs(expectedPL - dist.profitLoss) < 0.01;
          console.log(`      ✅ P&L Verificado:    $${expectedPL.toFixed(2)} ${plMatches ? '✓' : '✗'}`);
        });
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Verificación completada\n');
}
