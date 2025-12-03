/**
 * Script de test rápido para verificar Brevo
 * Ejecutar: node scripts/test-email-brevo.js
 */

const https = require('https');

// ⚠️ IMPORTANTE: Necesitás estar logueado como admin en el navegador
// y copiar tu cookie de sesión aquí, o mejor aún, usar el navegador directamente

console.log('🧪 Test de Email Brevo');
console.log('⚠️  Este script requiere autenticación de admin');
console.log('📝 Mejor opción: Usar el navegador (ver instrucciones abajo)\n');

// Alternativa: Usar desde el navegador
console.log('🌐 INSTRUCCIONES PARA USAR DESDE EL NAVEGADOR:');
console.log('1. Abrí https://lozanonahuel.com y logueate como admin');
console.log('2. Abrí la consola del navegador (F12)');
console.log('3. Pegá este código:\n');
console.log(`
fetch('/api/admin/email/test-send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    testType: 'simple',
    email: 'franco.l.varela99@gmail.com'
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Respuesta:', data);
  if (data.provider) {
    console.log('📧 Proveedor usado:', data.provider);
  }
})
.catch(err => console.error('❌ Error:', err));
`);
