# Método Alternativo: Obtener Tokens usando OAuth 2.0 Playground

Si el script `get-admin-tokens.js` sigue dando errores de `redirect_uri_mismatch`, puedes usar este método alternativo que es más simple y no requiere configurar redirect URIs adicionales.

## Método: Usar Google OAuth 2.0 Playground

### Paso 1: Configurar OAuth 2.0 Playground en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Selecciona tu proyecto
3. Edita tu OAuth 2.0 Client ID
4. En "URIs de redirección autorizados", verifica que esté:
   ```
   https://developers.google.com/oauthplayground
   ```
   Si no está, agrégala y guarda.

### Paso 2: Usar OAuth 2.0 Playground

1. Ve a [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. En el panel derecho, haz clic en el ícono de configuración (⚙️)
3. Marca "Use your own OAuth credentials"
4. Ingresa:
   - **OAuth Client ID**: Tu `GOOGLE_CLIENT_ID`
   - **OAuth Client secret**: Tu `GOOGLE_CLIENT_SECRET`
5. Haz clic en **Close**

### Paso 3: Autorizar los Scopes

1. En el panel izquierdo, busca y selecciona:
   - ✅ `https://www.googleapis.com/auth/calendar`
   - ✅ `https://www.googleapis.com/auth/calendar.events`
2. Haz clic en **Authorize APIs**
3. Inicia sesión con la cuenta de Google que quieras usar para el calendario
4. Autoriza los permisos

### Paso 4: Intercambiar código por tokens

1. Después de autorizar, verás un código de autorización
2. Haz clic en **Exchange authorization code for tokens**
3. Obtendrás los tokens:
   - **Access token**: Este es tu `ADMIN_GOOGLE_ACCESS_TOKEN`
   - **Refresh token**: Este es tu `ADMIN_GOOGLE_REFRESH_TOKEN`

### Paso 5: Copiar los tokens

Copia ambos tokens y agrégalos a tus variables de entorno:

```env
ADMIN_GOOGLE_ACCESS_TOKEN=ya29.xxxxx...
ADMIN_GOOGLE_REFRESH_TOKEN=1//xxxxx...
```

## Ventajas de este método

- ✅ No requiere configurar redirect URIs adicionales
- ✅ Más simple y visual
- ✅ Funciona inmediatamente
- ✅ No interfiere con NextAuth

## Desventajas

- ⚠️ Requiere usar OAuth 2.0 Playground (herramienta de Google)
- ⚠️ Los tokens se muestran en la página web (asegúrate de estar en un lugar seguro)

