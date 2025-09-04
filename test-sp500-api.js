/**
 * Script de prueba para verificar la API del S&P 500
 * Ejecutar con: node test-sp500-api.js
 */

async function testSP500API() {
  console.log('🧪 Probando API del S&P 500...\n');
  
  const baseUrl = 'https://lozanonahuel.vercel.app'; // Cambiar por tu URL de Vercel en producción
  const periods = ['7d', '15d', '30d', '6m', '1y'];
  
  for (const period of periods) {
    try {
      console.log(`📊 Probando período: ${period}`);
      
      const response = await fetch(`${baseUrl}/api/market-data/spy500-performance?period=${period}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log(`✅ ${period}:`);
      console.log(`   Precio actual: $${data.currentPrice}`);
      console.log(`   Rendimiento del período: ${data.periodChangePercent || data.changePercent}%`);
      console.log(`   Proveedor de datos: ${data.dataProvider}`);
      console.log(`   Última actualización: ${new Date(data.lastUpdate).toLocaleString()}`);
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error en período ${period}:`, error.message);
      console.log('');
    }
  }
  
  console.log('🎯 Prueba completada!');
}

// Ejecutar la prueba
testSP500API().catch(console.error);
