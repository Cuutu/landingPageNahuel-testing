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

  try {
    // Configurar cliente OAuth2
    // Usar la misma lógica que el script para construir la URI
    const redirectUri = process.env.GOOGLE_REDIRECT_URI 
      || (process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/api/admin/google-callback` : null)
      || 'https://lozanonahuel.com/api/admin/google-callback';
    
    console.log('🔗 [ADMIN-CALLBACK] URI de redirección esperada:', redirectUri);
    console.log('🔗 [ADMIN-CALLBACK] Host recibido:', req.headers.host);
    console.log('🔗 [ADMIN-CALLBACK] URL completa:', req.url);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);

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
    return res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error al Obtener Tokens</h1>
          <p>Error: ${error.message || 'Error desconocido'}</p>
          <p>Por favor, intenta nuevamente.</p>
        </body>
      </html>
    `);
  }
}

