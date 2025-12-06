/**
 * Script para eliminar un informe
 * Uso: node scripts/delete-report.js <reportId>
 * 
 * Ejemplo: node scripts/delete-report.js 69338a54e941b2aa60c53bf8
 */

const reportId = process.argv[2];

if (!reportId) {
  console.error('❌ Error: Debes proporcionar el ID del informe');
  console.log('Uso: node scripts/delete-report.js <reportId>');
  process.exit(1);
}

console.log(`🗑️  Eliminando informe: ${reportId}`);

// Nota: Este script requiere que estés autenticado como admin
// La mejor forma es usar el endpoint desde el navegador o crear una página de admin

console.log('\n📋 Para ejecutar el DELETE, usa una de estas opciones:\n');
console.log('1. Desde la consola del navegador (estando logueado como admin):');
console.log(`
fetch('/api/admin/reports/${reportId}', {
  method: 'DELETE',
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log('✅ Resultado:', data))
.catch(err => console.error('❌ Error:', err));
`);

console.log('\n2. Desde curl (requiere cookie de sesión):');
console.log(`
curl -X DELETE "http://localhost:3000/api/admin/reports/${reportId}" \\
  -H "Cookie: next-auth.session-token=TU_TOKEN_AQUI"
`);

console.log('\n3. Desde Postman o Thunder Client:');
console.log(`   URL: DELETE http://localhost:3000/api/admin/reports/${reportId}`);
console.log('   Headers: Cookie con tu sesión de next-auth');

