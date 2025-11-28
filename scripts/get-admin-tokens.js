const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

// Configuración - usando variables de entorno o valores por defecto
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Usar un endpoint separado que NO interfiere con NextAuth (fuera de /api/auth/)
// IMPORTANTE: Esta URI debe coincidir EXACTAMENTE con la que está en Google Cloud Console
// FORZAR el uso de lozanonahuel.com (dominio principal) en lugar de vercel.app
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI 
  || 'https://lozanonahuel.com/api/admin/google-callback';

// Asegurarse de que no tenga barra final
const cleanRedirectUri = REDIRECT_URI.replace(/\/$/, '');

// Scopes correctos para Google Calendar API
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  cleanRedirectUri
);

async function getTokens() {
  // Validar que las credenciales estén configuradas
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Error: Las credenciales OAuth no están configuradas');
    console.log('\n📋 Por favor, configura estas variables en tu .env.local:');
    console.log('   GOOGLE_CLIENT_ID=tu_client_id');
    console.log('   GOOGLE_CLIENT_SECRET=tu_client_secret');
    console.log('   GOOGLE_REDIRECT_URI=https://lozanonahuel.com/api/admin/google-callback');
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

  console.log('📋 PASO 1: Verificar configuración');
  console.log('\n' + '='.repeat(80));
  console.log('🔗 URI de redirección que se usará (COPIA ESTA EXACTA):');
  console.log('='.repeat(80));
  console.log('');
  console.log('   ' + cleanRedirectUri);
  console.log('');
  console.log('='.repeat(80));
  console.log('\n⚠️  CRÍTICO: Esta URI EXACTA debe estar en Google Cloud Console');
  console.log('\n📝 Instrucciones DETALLADAS:');
  console.log('\n   1. Abre esta URL en tu navegador:');
  console.log('      https://console.cloud.google.com/apis/credentials');
  console.log('\n   2. Selecciona tu proyecto de Google Cloud');
  console.log('\n   3. En la lista de credenciales, busca "OAuth 2.0 Client IDs"');
  console.log('      Haz clic en el nombre de tu cliente OAuth');
  console.log('\n   4. En la sección "URIs de redirección autorizados":');
  console.log('      - Busca si existe esta URI EXACTA:');
  console.log('        ' + cleanRedirectUri);
  console.log('      - Compara CARÁCTER POR CARÁCTER');
  console.log('      - Verifica que NO tenga espacios al inicio o final');
  console.log('      - Verifica que NO tenga barra final (/)');
  console.log('      - Verifica que use https:// (no http://)');
  console.log('\n   5. Si NO está o es diferente:');
  console.log('      - Haz clic en el botón de editar (lápiz) o "+ Agregar URI"');
  console.log('      - Si existe una similar pero incorrecta, ELIMÍNALA primero');
  console.log('      - Agrega EXACTAMENTE esta URI (copia desde aquí):');
  console.log('        ' + cleanRedirectUri);
  console.log('      - NO agregues espacios, NO agregues barra final');
  console.log('\n   6. Haz clic en GUARDAR (Save)');
  console.log('\n   7. Espera 2-3 minutos para que los cambios se propaguen');
  console.log('      (Google puede tardar unos minutos en actualizar)\n');
  
  const rl2 = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise((resolve) => {
    rl2.question('\n✅ ¿Ya agregaste esta URI EXACTA en Google Cloud Console y guardaste? (s/n): ', (answer) => {
      rl2.close();
      if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('\n⚠️  Por favor, agrega la URI en Google Cloud Console primero:');
        console.log('   URI a agregar: ' + cleanRedirectUri);
        console.log('   Luego espera 2-3 minutos y ejecuta el script nuevamente.\n');
        process.exit(1);
      }
      console.log('\n⏳ Espera 2-3 minutos para que los cambios se propaguen...\n');
      resolve(null);
    });
  });

  console.log('\n📋 PASO 2: Autorizar la aplicación');
  console.log('Ve a esta URL y autoriza la aplicación:');
  console.log('\n' + authUrl + '\n');
  console.log('⚠️  IMPORTANTE:');
  console.log('   - Si ya estás logueado con otra cuenta, CIERRA SESIÓN primero');
  console.log('   - Inicia sesión con la cuenta de Google que quieras usar para el calendario');
  console.log('   - Autoriza los permisos de "Google Calendar API"');
  console.log('   - Después de autorizar, serás redirigido a una página que mostrará los tokens\n');

  console.log('📝 PASO 3: Después de autorizar');
  console.log('   - Serás redirigido a una página que mostrará los tokens');
  console.log('   - Copia los tokens de esa página');
  console.log('   - O si prefieres, copia la URL completa de la página de redirección');
  console.log('   - Y pégalo aquí para obtener los tokens en la terminal\n');

  // Paso 2: Obtener código de autorización (opcional - para modo terminal)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const codeOrUrl = await new Promise((resolve) => {
    rl.question('📝 PASO 4: Si copiaste la URL completa de la página de redirección, pégala aquí. Si no, presiona Enter y copia los tokens de la página web: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  // Si el usuario pegó una URL, extraer el código
  let code = codeOrUrl;
  if (codeOrUrl.includes('code=')) {
    const urlParams = new URL(codeOrUrl).searchParams;
    code = urlParams.get('code');
    if (!code) {
      console.log('\n⚠️  No se pudo extraer el código de la URL. Por favor, copia solo el código o la URL completa.');
      console.log('   Los tokens ya deberían estar visibles en la página web que se abrió.\n');
      process.exit(0);
    }
  }

  // Si no hay código, los tokens ya están en la página web
  if (!code || code.length < 10) {
    console.log('\n✅ Los tokens deberían estar visibles en la página web que se abrió.');
    console.log('   Si no los ves, copia la URL completa de la página y pégala aquí.\n');
    process.exit(0);
  }

  try {
    // Paso 3: Intercambiar código por tokens
    console.log('\n🔄 PASO 3: Intercambiando código por tokens...');
    const { tokens } = await oauth2Client.getToken(code);

    console.log('\n✅ ¡Tokens obtenidos exitosamente!');
    console.log('\n📋 Agrega estas variables a tu .env.local o en Vercel:');
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
    console.log('- Verifica que la URI de redirección esté en Google Cloud Console:');
    console.log('  ' + cleanRedirectUri);
    console.log('- Si recibes error "deleted_client", las credenciales fueron eliminadas - crea nuevas en Google Cloud Console');
    console.log('- Intenta generar un nuevo código\n');
  }
}

console.log('🎯 Generador de Tokens de Google Calendar para Admin');
console.log('📅 Scopes: Google Calendar API');
if (CLIENT_ID) {
  console.log(`🔑 Client ID: ${CLIENT_ID.substring(0, 30)}...`);
} else {
  console.log('⚠️  Client ID: No configurado');
}
console.log(`🔗 Redirect URI: ${REDIRECT_URI}`);
console.log('');

getTokens();
