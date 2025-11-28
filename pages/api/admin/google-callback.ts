import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

/**
 * Endpoint específico para obtener tokens de Google Calendar del admin
 * Este endpoint NO interfiere con NextAuth (está fuera de /api/auth/)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir método GET (redirección de OAuth)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { code, error } = req.query;

  // Si hay un error de OAuth, mostrarlo
  if (error) {
    console.error('❌ Error en admin google-callback:', error);
    return res.status(400).send(`
      <html>
        <head><title>Error de Autorización</title></head>
        <body>
          <h1>Error de Autorización</h1>
          <p>Error: ${error}</p>
          <p>Por favor, intenta nuevamente.</p>
          <script>
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `);
  }

  // Si no hay código, mostrar instrucciones
  if (!code || typeof code !== 'string') {
    return res.status(400).send(`
      <html>
        <head><title>Token de Autorización</title></head>
        <body>
          <h1>Token de Autorización</h1>
          <p>No se recibió el código de autorización.</p>
          <p>Por favor, copia la URL completa de esta página y úsala en el script.</p>
          <script>
            // Mostrar la URL completa en la página
            document.body.innerHTML += '<p><strong>URL completa:</strong></p>';
            document.body.innerHTML += '<textarea style="width:100%;height:100px;">' + window.location.href + '</textarea>';
          </script>
        </body>
      </html>
    `);
  }

  // Construir la URI de redirección exactamente como el script
  // IMPORTANTE: Debe coincidir EXACTAMENTE con la que está en Google Cloud Console
  // FORZAR el uso de lozanonahuel.com (dominio principal) en lugar de vercel.app
  const redirectUri = process.env.GOOGLE_REDIRECT_URI 
    || 'https://lozanonahuel.com/api/admin/google-callback';
  
  // Asegurarse de que no tenga barra final
  const cleanRedirectUri = redirectUri.replace(/\/$/, '');
  
  console.log('🔗 [ADMIN-CALLBACK] URI de redirección que se usará:', cleanRedirectUri);
  console.log('🔗 [ADMIN-CALLBACK] Host recibido:', req.headers.host);
  console.log('🔗 [ADMIN-CALLBACK] URL completa:', req.url);
  console.log('🔗 [ADMIN-CALLBACK] NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
  console.log('🔗 [ADMIN-CALLBACK] GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      cleanRedirectUri
    );

    // Intercambiar código por tokens
    console.log('🔄 [ADMIN-CALLBACK] Intercambiando código por tokens...');
    console.log('🔄 [ADMIN-CALLBACK] Código recibido:', code.substring(0, 20) + '...');
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('✅ [ADMIN-CALLBACK] Tokens obtenidos exitosamente');

    // Mostrar los tokens en la página
    return res.status(200).send(`
      <html>
        <head>
          <title>Tokens Obtenidos Exitosamente</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .tokens { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 5px; margin: 20px 0; }
            code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
            textarea { width: 100%; height: 60px; font-family: monospace; padding: 10px; border: 1px solid #ccc; border-radius: 5px; }
            .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
            .button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ ¡Tokens Obtenidos Exitosamente!</h1>
            <p>Los tokens se han generado correctamente. Copia las siguientes variables y agrégalas a tu <code>.env.local</code> o en Vercel:</p>
          </div>
          
          <div class="tokens">
            <h2>Variables de Entorno:</h2>
            <p><strong>ADMIN_GOOGLE_ACCESS_TOKEN:</strong></p>
            <textarea readonly>${tokens.access_token}</textarea>
            
            <p><strong>ADMIN_GOOGLE_REFRESH_TOKEN:</strong></p>
            <textarea readonly>${tokens.refresh_token}</textarea>
          </div>
          
          <div>
            <h2>Próximos Pasos:</h2>
            <ol>
              <li>Copia ambas variables de entorno</li>
              <li>Agrégalas en Vercel Dashboard > Settings > Environment Variables</li>
              <li>O en tu archivo <code>.env.local</code> para desarrollo</li>
              <li>Haz un redeploy de tu aplicación</li>
            </ol>
          </div>
          
          <div>
            <p><strong>Notas importantes:</strong></p>
            <ul>
              <li>El <code>access_token</code> expira en 1 hora</li>
              <li>El <code>refresh_token</code> se usa para obtener nuevos access_tokens automáticamente</li>
              <li>No compartas estos tokens públicamente</li>
            </ul>
          </div>
          
          <script>
            // Cerrar ventana automáticamente después de 30 segundos
            setTimeout(() => {
              if (window.opener) {
                window.close();
              }
            }, 30000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('❌ Error al obtener tokens:', error);
    console.error('❌ [ADMIN-CALLBACK] Detalles del error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    
    // Si es redirect_uri_mismatch, dar instrucciones específicas
    if (error.message?.includes('redirect_uri_mismatch') || error.response?.data?.error === 'redirect_uri_mismatch') {
      return res.status(500).send(`
        <html>
          <head>
            <title>Error: redirect_uri_mismatch</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
              .error { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .solution { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
              code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>❌ Error: redirect_uri_mismatch</h1>
              <p>La URI de redirección no coincide con la configurada en Google Cloud Console.</p>
            </div>
            
            <div class="solution">
              <h2>🔧 Solución:</h2>
              <p><strong>URI que se está usando:</strong></p>
              <code>${cleanRedirectUri}</code>
              
              <ol>
                <li>Ve a <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console - Credenciales</a></li>
                <li>Selecciona tu proyecto</li>
                <li>Haz clic en tu OAuth 2.0 Client ID</li>
                <li>En "URIs de redirección autorizados", verifica que esté EXACTAMENTE:</li>
                <li><code>${cleanRedirectUri}</code></li>
                <li>Si NO está, agrégala y GUARDA</li>
                <li>Espera 2-3 minutos y vuelve a intentar</li>
              </ol>
            </div>
            
            <div>
              <h2>💡 Método Alternativo (Más Simple):</h2>
              <p>Si sigues teniendo problemas, puedes usar <strong>OAuth 2.0 Playground</strong>:</p>
              <ol>
                <li>Ve a <a href="https://developers.google.com/oauthplayground/" target="_blank">OAuth 2.0 Playground</a></li>
                <li>Configura tus credenciales OAuth</li>
                <li>Selecciona los scopes de Calendar</li>
                <li>Autoriza y obtén los tokens directamente</li>
              </ol>
              <p>Ver instrucciones completas en: <code>scripts/get-admin-tokens-alternative.md</code></p>
            </div>
          </body>
        </html>
      `);
    }
    
    return res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error al Obtener Tokens</h1>
          <p>Error: ${error.message || 'Error desconocido'}</p>
          <p>Por favor, intenta nuevamente.</p>
          <p><strong>URI usada:</strong> ${cleanRedirectUri}</p>
        </body>
      </html>
    `);
  }
}

