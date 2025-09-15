/**
 * Script para probar el endpoint de auto-convert-ranges
 * Ejecutar con: node test-auto-convert-cron.js
 */

const https = require('https');
const http = require('http');

// Configuración
const DOMAIN = 'lozanonahuel.vercel.app';
const CRON_SECRET_TOKEN = null; // Probar sin token

async function testCronEndpoint() {
  console.log('🧪 Probando endpoint de auto-convert-ranges...');
  console.log(`📍 Dominio: ${DOMAIN}`);
  console.log(`🔑 Token: ${CRON_SECRET_TOKEN ? 'Configurado' : 'No configurado'}`);
  
  const postData = JSON.stringify({
    test: true,
    timestamp: new Date().toISOString()
  });

  const options = {
    hostname: DOMAIN,
    port: 443,
    path: '/api/cron/auto-convert-ranges',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': CRON_SECRET_TOKEN ? `Bearer ${CRON_SECRET_TOKEN}` : undefined
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`📊 Status: ${res.statusCode}`);
      console.log(`📋 Headers:`, res.headers);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ Respuesta del servidor:');
          console.log(JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.log('📄 Respuesta (texto):', data);
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error en la petición:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Ejecutar prueba
testCronEndpoint()
  .then((result) => {
    console.log('\n🎉 Prueba completada exitosamente');
    if (result.success) {
      console.log('✅ El cron job está funcionando correctamente');
    } else {
      console.log('⚠️ El cron job respondió pero con errores');
    }
  })
  .catch((error) => {
    console.error('\n❌ Error en la prueba:', error.message);
    console.log('\n💡 Posibles soluciones:');
    console.log('1. Verificar que el dominio sea correcto');
    console.log('2. Verificar que CRON_SECRET_TOKEN esté configurado');
    console.log('3. Verificar que el endpoint esté desplegado en Vercel');
  });
