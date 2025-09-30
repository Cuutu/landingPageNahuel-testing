// Script de prueba para el endpoint público de cron job
// Ejecutar con: node test-public-cron.js

const https = require('https');

// Configuración
const DOMAIN = 'lozanonahuel.vercel.app';
const ENDPOINT = '/api/cron/training-reminders-public';

// Función para hacer la petición GET
function testPublicCronEndpoint() {
  const options = {
    hostname: DOMAIN,
    port: 443,
    path: ENDPOINT,
    method: 'GET',
    headers: {
      'User-Agent': 'curl/7.68.0', // Simular curl
      'Content-Type': 'application/json'
    }
  };

  console.log('🔄 Probando endpoint público de cron job...');
  console.log(`📍 URL: https://${DOMAIN}${ENDPOINT}`);
  console.log('⏳ Enviando petición...\n');

  const req = https.request(options, (res) => {
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n📄 Respuesta:');
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response, null, 2));
        
        if (res.statusCode === 200) {
          console.log('\n✅ ¡Éxito! El endpoint público está funcionando correctamente.');
        } else {
          console.log('\n❌ Error: El endpoint devolvió un status code diferente a 200.');
        }
      } catch (e) {
        console.log('📄 Respuesta (texto):', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error en la petición:', e.message);
  });

  req.end();
}

// Función para probar con parámetro test
function testWithTestParam() {
  const options = {
    hostname: DOMAIN,
    port: 443,
    path: ENDPOINT + '?test=true',
    method: 'GET',
    headers: {
      'User-Agent': 'curl/7.68.0',
      'Content-Type': 'application/json'
    }
  };

  console.log('\n🧪 Probando con parámetro test=true...\n');

  const req = https.request(options, (res) => {
    console.log(`📊 Status: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('\n📄 Respuesta:');
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response, null, 2));
        
        if (res.statusCode === 200) {
          console.log('\n✅ ¡Éxito! El endpoint con test=true funciona correctamente.');
        } else {
          console.log('\n❌ Error: El endpoint con test=true devolvió un status code diferente a 200.');
        }
      } catch (e) {
        console.log('📄 Respuesta (texto):', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error en la petición:', e.message);
  });

  req.end();
}

// Ejecutar pruebas
console.log('🧪 TESTING PUBLIC CRON JOB ENDPOINT');
console.log('=====================================\n');

testPublicCronEndpoint();

// Esperar 3 segundos y probar con test=true
setTimeout(() => {
  testWithTestParam();
}, 3000);

console.log('\n💡 Instrucciones:');
console.log('1. Este endpoint es público y no requiere token');
console.log('2. Solo acepta User-Agents de CRON jobs conocidos');
console.log('3. Puedes usar ?test=true para pruebas manuales');
console.log('4. Para CRON jobs externos, usa este endpoint en lugar del privado');
console.log('5. URL para CRON jobs: https://' + DOMAIN + ENDPOINT);
