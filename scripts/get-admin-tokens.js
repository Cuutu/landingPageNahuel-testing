const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

// Configuración - usando variables de entorno o valores por defecto
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Prioridad: GOOGLE_REDIRECT_URI > NEXTAUTH_URL + callback > dominio por defecto
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI 
  || (process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google` : null)
  || 'https://lozanonahuel.com/api/auth/callback/google';

// Scopes correctos para Google Calendar API
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

async function getTokens() {
  // Validar que las credenciales estén configuradas
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Error: Las credenciales OAuth no están configuradas');
    console.log('\n📋 Por favor, configura estas variables en tu .env.local:');
    console.log('   GOOGLE_CLIENT_ID=tu_client_id');
    console.log('   GOOGLE_CLIENT_SECRET=tu_client_secret');
    console.log('   GOOGLE_REDIRECT_URI=https://lozanonahuel.com/api/auth/callback/google');
    console.log('   # O si tienes NEXTAUTH_URL configurado, se usará automáticamente');
    console.log('\n💡 O edita este script y agrega las credenciales directamente en las líneas 6-8\n');
    process.exit(1);
  }

  console.log('🔧 Script para obtener tokens de Google Calendar del Admin');
  console.log('📧 Inicia sesión con la cuenta de Google que quieras usar para el calendario\n');

  // Paso 1: Generar URL de autorización
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Fuerza a mostrar la pantalla de consentimiento
  });

  console.log('📋 PASO 1: Autorizar la aplicación');
  console.log('Ve a esta URL y autoriza la aplicación:');
  console.log('\n' + authUrl + '\n');
  console.log('⚠️  IMPORTANTE:');
  console.log('   - Si ya estás logueado con otra cuenta, CIERRA SESIÓN primero');
  console.log('   - Inicia sesión con la cuenta de Google que quieras usar para el calendario');
  console.log('   - Autoriza los permisos de "Google Calendar API"');
  console.log('   - Después de autorizar, serás redirigido a una URL con un código');
  console.log('\n🔗 URI de redirección configurada:');
  console.log('   ' + REDIRECT_URI);
  console.log('\n⚠️  Si recibes error "redirect_uri_mismatch":');
  console.log('   1. Ve a Google Cloud Console > APIs y servicios > Credenciales');
  console.log('   2. Edita tu OAuth 2.0 Client ID');
  console.log('   3. Asegúrate de que esta URI esté en "URIs de redirección autorizados":');
  console.log('      ' + REDIRECT_URI);
  console.log('   4. Guarda los cambios y espera 1-2 minutos antes de intentar nuevamente\n');

  // Paso 2: Obtener código de autorización
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('📝 PASO 2: Pega el código de autorización aquí: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });

  try {
    // Paso 3: Intercambiar código por tokens
    console.log('\n🔄 PASO 3: Intercambiando código por tokens...');
    const { tokens } = await oauth2Client.getToken(code);

    console.log('\n✅ ¡Tokens obtenidos exitosamente!');
    console.log('\n📋 Agrega estas variables a tu .env.local en Vercel:');
    console.log('=====================================');
    console.log(`ADMIN_GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
    console.log(`ADMIN_GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('=====================================\n');

    console.log('💡 Notas importantes:');
    console.log('- El access_token expira en 1 hora');
    console.log('- El refresh_token se usa para obtener nuevos access_tokens');
    console.log('- Agrega estas variables en Vercel Dashboard > Settings > Environment Variables');
    console.log('- O en tu archivo .env.local para desarrollo\n');

    console.log('🚀 Próximos pasos:');
    console.log('1. Agrega las variables en Vercel');
    console.log('2. Redeploya tu aplicación');
    console.log('3. Prueba hacer una reserva para verificar que funciona\n');

  } catch (error) {
    console.error('❌ Error al obtener tokens:', error.message);
    console.log('\n🔧 Posibles soluciones:');
    console.log('- Verifica que el código esté completo');
    console.log('- Asegúrate de haber autorizado con la cuenta correcta');
    console.log('- Verifica que Google Calendar API esté habilitada en tu proyecto');
    console.log('- Verifica que las credenciales OAuth (CLIENT_ID y CLIENT_SECRET) sean válidas');
    console.log('- Si recibes error "deleted_client", las credenciales fueron eliminadas - crea nuevas en Google Cloud Console');
    console.log('- Intenta generar un nuevo código\n');
  }
}

console.log('🎯 Generador de Tokens de Google Calendar');
console.log('📅 Scopes: Google Calendar API');
if (CLIENT_ID) {
  console.log(`🔑 Client ID: ${CLIENT_ID.substring(0, 30)}...`);
} else {
  console.log('⚠️  Client ID: No configurado');
}
console.log('');

getTokens(); 