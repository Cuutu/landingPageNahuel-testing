# 📧 Guía Completa: Migración de Notificaciones y Configuración de Google Calendar

## 🎯 Resumen

Esta guía te explica paso a paso cómo:
1. Migrar **todas las notificaciones** (tanto las que se envían como las que recibe el administrador) a otro correo electrónico
2. Obtener y configurar todas las credenciales necesarias para **Google Calendar** y **autenticación OAuth**

---

## 📑 Tabla de Contenidos

1. [Variables de Entorno a Configurar](#-variables-de-entorno-a-configurar)
2. [Guía Completa: Cómo Obtener Todas las Credenciales](#-guía-completa-cómo-obtener-todas-las-credenciales)
   - [Parte 1: Obtener SMTP Password (Gmail)](#parte-1-obtener-smtp-password-gmail)
   - [Parte 2: Obtener Google Client ID y Client Secret](#parte-2-obtener-google-client-id-y-client-secret)
   - [Parte 3: Obtener Tokens de Google Calendar para el Admin](#parte-3-obtener-tokens-de-google-calendar-para-el-admin)
   - [Parte 4: Configurar Zona Horaria del Calendario](#parte-4-configurar-zona-horaria-del-calendario-opcional)
3. [Configuración en Vercel](#-paso-a-paso-configuración-en-vercel)
4. [Tipos de Notificaciones y Sus Destinatarios](#-tipos-de-notificaciones-y-sus-destinatarios)
5. [Escenarios de Migración](#-escenarios-de-migración)
6. [Verificación Post-Migración](#-verificación-post-migración)
7. [Solución de Problemas](#-solución-de-problemas)
8. [Cómo Encontrar al Administrador de tu Organización](#-cómo-encontrar-al-administrador-de-tu-organización)
9. [Checklist Final](#-checklist-final)
10. [Enlaces Útiles](#-enlaces-útiles)

---

## 📋 Variables de Entorno a Configurar

### Variables Principales

---

## 🔑 Guía Completa: Cómo Obtener Todas las Credenciales

### Parte 1: Obtener SMTP Password

#### ⚠️ ¿Tienes una Cuenta Profesional (Google Workspace)?

Si estás usando una cuenta de Google Workspace (empresarial) y ves el mensaje **"La opción de configuración que buscas no está disponible para tu cuenta"**, tienes varias alternativas:

**Opción A: Usar una Cuenta Gmail Personal (Más Simple)**
- Crea o usa una cuenta Gmail personal (ej: `tu-email@gmail.com`)
- Sigue las instrucciones de "Paso 1: Para Cuentas Gmail Personales" más abajo
- Usa esta cuenta solo para enviar emails (`SMTP_USER`)

**Opción B: Solicitar al Administrador (Si es cuenta corporativa)**
- Contacta al administrador de Google Workspace de tu organización
- Solicita que habilite "Contraseñas de aplicaciones" para tu cuenta
- El administrador debe ir a: Admin Console > Seguridad > Acceso a datos > Contraseñas de aplicaciones
- **¿No sabes quién es el administrador?** Ve a la sección ["Cómo encontrar al administrador de tu organización"](#-cómo-encontrar-al-administrador-de-tu-organización) más abajo

**Opción C: Usar SendGrid u Otro Proveedor (Recomendado para Producción)**
- Ve a la sección "Opción C: Usar SendGrid u Otro Proveedor SMTP" más abajo
- Esta es la mejor opción para producción y no requiere contraseñas de aplicación

**Opción D: Usar OAuth2 con Google Workspace (Avanzado)**
- Requiere configuración más compleja con tokens OAuth2
- Solo recomendado si tienes experiencia técnica avanzada

---

#### Paso 1: Para Cuentas Gmail Personales

Si tienes una cuenta Gmail personal (no Google Workspace), sigue estos pasos:

##### 1.1: Activar Autenticación en 2 Pasos

1. Ve a tu cuenta de Google: [myaccount.google.com](https://myaccount.google.com)
2. Haz clic en **Seguridad** (Security) en el menú lateral
3. Busca **Verificación en 2 pasos** (2-Step Verification)
   - Si está desactivada, verás "Se desactivó la Verificación en 2 pasos"
   - **Debes activarla primero** para poder crear contraseñas de aplicación
4. Haz clic en **Verificación en 2 pasos** para activarla
5. Sigue las instrucciones para configurarla (puede requerir un teléfono)
6. Una vez activada, podrás crear contraseñas de aplicación

##### 1.2: Crear Contraseña de Aplicación

1. En la misma página de **Seguridad**, busca **Contraseñas de aplicaciones** (App passwords)
2. Si no aparece, haz clic en **Verificación en 2 pasos** y luego en **Contraseñas de aplicaciones**
3. Selecciona **Correo** como aplicación
4. Selecciona **Otro (nombre personalizado)** como dispositivo
5. Escribe un nombre descriptivo, por ejemplo: "Trading Landing Page SMTP"
6. Haz clic en **Generar**
7. **Copia la contraseña de 16 caracteres** que aparece (ejemplo: `abcd efgh ijkl mnop`)

**⚠️ IMPORTANTE**: 
- Esta contraseña solo se muestra una vez
- No incluyas espacios al copiarla a las variables de entorno (ej: `abcdefghijklmnop`)
- Esta será tu `SMTP_PASS`

##### 1.3: Configurar Variables

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=abcdefghijklmnop  # Sin espacios
```

---

#### Opción C: Usar SendGrid u Otro Proveedor SMTP

Esta es la **mejor opción para producción** y funciona con cualquier tipo de cuenta:

##### ¿Por qué usar SendGrid?

- ✅ No requiere contraseñas de aplicación
- ✅ Más confiable para envío masivo
- ✅ Mejor deliverability (llegada a inbox)
- ✅ Dashboard con estadísticas de envío
- ✅ Plan gratuito generoso (100 emails/día)

##### Pasos para configurar SendGrid:

1. **Crear cuenta en SendGrid**:
   - Ve a [sendgrid.com](https://sendgrid.com/)
   - Crea una cuenta gratuita
   - Verifica tu email

2. **Crear API Key**:
   - Ve a **Settings** > **API Keys**
   - Haz clic en **Create API Key**
   - Nombre: "Trading Landing Page"
   - Permisos: **Full Access** o solo **Mail Send**
   - Copia la API Key (solo se muestra una vez)

3. **Configurar Variables de Entorno**:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxx  # Tu API Key de SendGrid
   EMAIL_FROM_ADDRESS=noreply@tudominio.com  # El email verificado en SendGrid
   ```

4. **Verificar dominio (opcional pero recomendado)**:
   - En SendGrid, ve a **Settings** > **Sender Authentication**
   - Verifica tu dominio para mejorar la deliverability

**Otros proveedores SMTP similares**:
- **Mailgun**: Similar a SendGrid, plan gratuito con 100 emails/día
- **Amazon SES**: Muy económico, pero requiere configuración AWS
- **Postmark**: Excelente deliverability, pero más caro

##### Configuración para Mailgun:

```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@tudominio.com
SMTP_PASS=tu_api_key_de_mailgun
```

---

### Parte 2: Obtener Google Client ID y Client Secret

Estas credenciales se usan para autenticación OAuth de usuarios y para Google Calendar.

#### Paso 1: Acceder a Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con tu cuenta de Google (preferiblemente la del admin)
3. Si no tienes un proyecto, crea uno nuevo:
   - Haz clic en el selector de proyectos (arriba)
   - Haz clic en **NUEVO PROYECTO**
   - Nombra el proyecto (ej: "Trading Landing Page")
   - Haz clic en **Crear**

#### Paso 2: Habilitar APIs Necesarias

1. En el menú lateral, ve a **APIs y servicios** > **Biblioteca**
2. Busca y habilita las siguientes APIs:
   - **Google Calendar API** (imprescindible para el calendario)
   - **Google+ API** o **People API** (para autenticación OAuth)

**Para habilitar cada API:**
- Haz clic en el nombre de la API
- Haz clic en **HABILITAR** (Enable)
- Espera a que se habilite (puede tardar unos segundos)

#### Paso 3: Verificar Credenciales Existentes (Si ya tienes APIs configuradas)

Si ya tienes las APIs configuradas y funcionando, primero verifica si ya tienes credenciales OAuth creadas:

1. Ve a **APIs y servicios** > **Credenciales**
2. Busca en la lista si ya existe un **ID de cliente de OAuth 2.0**
3. Si encuentras uno existente:
   - Haz clic en el nombre del cliente OAuth
   - Verifica que tenga configuradas las **URIs de redirección** correctas:
     ```
     http://localhost:3000/api/auth/callback/google
     https://tu-dominio.vercel.app/api/auth/callback/google
     ```
   - Si faltan URIs, edítalo y agrégalas
   - Si necesitas el **Client Secret** y no lo tienes guardado:
     - Haz clic en el ícono de "ojo" o "mostrar" para ver el secreto
     - Si no puedes verlo, tendrás que crear nuevas credenciales (el secreto solo se muestra una vez)

**Si ya tienes credenciales existentes y funcionan, puedes usarlas directamente. No necesitas crear nuevas.**

#### Paso 3b: Crear Credenciales OAuth 2.0 (Solo si no tienes existentes)

Si no tienes credenciales OAuth o necesitas crear nuevas:

1. Ve a **APIs y servicios** > **Credenciales**
2. Haz clic en **+ CREAR CREDENCIALES** (Create Credentials)
3. Selecciona **ID de cliente de OAuth 2.0** (OAuth client ID)

#### Paso 4: Configurar Pantalla de Consentimiento

Si es la primera vez que creas credenciales OAuth:

1. Google te pedirá configurar la **Pantalla de consentimiento de OAuth**
2. Selecciona **Externo** (External) y haz clic en **CREAR**
3. Completa el formulario:
   - **Nombre de la aplicación**: "Trading Landing Page" (o el nombre que prefieras)
   - **Email de soporte del usuario**: Tu email
   - **Email del desarrollador**: Tu email
   - Haz clic en **GUARDAR Y CONTINUAR**
4. En **Scopes** (Alcances), haz clic en **GUARDAR Y CONTINUAR** (puedes agregar scopes después)
5. En **Usuarios de prueba**, agrega tu email de admin y haz clic en **GUARDAR Y CONTINUAR**
6. Revisa el resumen y haz clic en **VOLVER AL PANEL**

#### Paso 5: Crear el ID de Cliente OAuth

1. En **APIs y servicios** > **Credenciales**, haz clic en **+ CREAR CREDENCIALES**
2. Selecciona **ID de cliente de OAuth 2.0**
3. Configura el tipo de aplicación:
   - **Tipo de aplicación**: Selecciona **Aplicación web** (Web application)
   - **Nombre**: "Trading Landing Page OAuth" (o el que prefieras)
4. **URIs de redirección autorizados**:
   
   Agrega estas URLs (una por línea):
   ```
   http://localhost:3000/api/auth/callback/google
   https://tu-dominio.vercel.app/api/auth/callback/google
   https://lozanonahuel.vercel.app/api/auth/callback/google
   ```
   
   **Nota**: Reemplaza `tu-dominio.vercel.app` con tu dominio real de producción.

5. Haz clic en **CREAR**

#### Paso 6: Copiar las Credenciales

1. Se mostrará un diálogo con tus credenciales:
   - **ID de cliente**: Algo como `543877130645-xxxxx.apps.googleusercontent.com`
   - **Secreto del cliente**: Algo como `GOCSPX-xxxxx`
2. **Copia ambas credenciales inmediatamente** (el secreto solo se muestra una vez)
3. Si perdiste el secreto, puedes crear otro haciendo clic en **+ CREAR CREDENCIALES** nuevamente

**Estas serán tus variables:**
```
GOOGLE_CLIENT_ID=543877130645-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

---

#### ⚠️ Solución de Problemas: Error "The request has been classified as abusive"

Si recibes el error **"The request has been classified as abusive and was not allowed to proceed"** al intentar crear las credenciales OAuth, sigue estos pasos:

**Solución 1: Esperar y Reintentar**
1. **Espera 15-30 minutos** antes de intentar nuevamente
2. Google puede bloquear temporalmente por demasiados intentos
3. Cierra completamente el navegador y vuelve a abrirlo
4. Intenta nuevamente desde una sesión limpia

**Solución 2: Verificar la Cuenta de Google**
1. Asegúrate de estar usando una **cuenta de Google verificada** (no una cuenta nueva)
2. Si es una cuenta nueva, espera 24-48 horas antes de crear credenciales OAuth
3. Verifica tu número de teléfono en tu cuenta de Google (ayuda a la verificación)

**Solución 3: Completar la Pantalla de Consentimiento Primero**
1. Ve a **APIs y servicios** > **Pantalla de consentimiento de OAuth**
2. Completa **TODOS** los pasos de configuración:
   - Información de la app
   - Scopes (puedes usar los predeterminados)
   - Usuarios de prueba (agrega tu email)
   - Revisar y publicar
3. Espera 5-10 minutos después de completar la pantalla de consentimiento
4. Luego intenta crear las credenciales OAuth nuevamente

**Solución 4: Usar un Proyecto Existente**
1. Si tienes otro proyecto de Google Cloud, intenta crear las credenciales ahí
2. O crea un proyecto nuevo con un nombre diferente
3. Asegúrate de que el proyecto tenga facturación habilitada (aunque sea gratuita)

**Solución 5: Verificar Facturación del Proyecto**
1. Ve a **Facturación** en Google Cloud Console
2. Aunque no uses servicios de pago, algunos proyectos requieren facturación habilitada
3. Si no tienes facturación, puedes habilitar una cuenta gratuita (no se te cobrará si no excedes los límites)

**Solución 6: Contactar Soporte de Google (Último Recurso)**
1. Si el problema persiste después de 24 horas, puedes contactar soporte:
   - Ve a [Google Cloud Support](https://cloud.google.com/support)
   - Explica que estás intentando crear credenciales OAuth para una aplicación web legítima
   - Proporciona el ID de tu proyecto de Google Cloud

**Solución 7: Usar Modo Incógnito o Diferente Navegador**
1. Intenta desde una ventana de incógnito
2. O prueba con un navegador diferente (Chrome, Firefox, Edge)
3. A veces los bloqueos están relacionados con cookies o caché del navegador

**Solución 8: Reutilizar Credenciales Existentes (Si ya tienes APIs configuradas)**
Si ya tienes las APIs configuradas y funcionando, es posible que ya tengas credenciales OAuth creadas:

1. Ve a **APIs y servicios** > **Credenciales**
2. Busca en la lista si existe algún **ID de cliente de OAuth 2.0**
3. Si encuentras uno:
   - Haz clic en él para ver los detalles
   - Verifica que tenga las URIs de redirección correctas
   - Si puedes ver el Client Secret, úsalo
   - Si no puedes ver el Client Secret, tendrás que crear nuevas credenciales
4. **Alternativa**: Si tienes otro proyecto de Google Cloud con credenciales OAuth, puedes reutilizarlas (solo asegúrate de agregar las URIs de redirección correctas)

**Consejos Adicionales:**
- No intentes crear múltiples credenciales en poco tiempo
- Asegúrate de que tu cuenta de Google no tenga restricciones de seguridad
- Si usas VPN, intenta desactivarla temporalmente
- Verifica que no tengas extensiones del navegador que bloqueen requests
- **Si ya tienes APIs funcionando, es muy probable que ya tengas credenciales OAuth creadas anteriormente - búscalas primero antes de crear nuevas**

---

### Parte 3: Configurar Google Calendar para una Nueva Cuenta

Esta sección explica cómo configurar Google Calendar para usar una **nueva cuenta de Google** (diferente a la que ya tienes configurada).

#### 📋 ¿Qué se necesita para configurar Google Calendar con una nueva cuenta?

Para configurar Google Calendar con una nueva cuenta de Google, necesitas:

1. **Credenciales OAuth 2.0** (Client ID y Client Secret)
   - Ya deberías tenerlas de la Parte 2
   - Si no las tienes, vuelve a la Parte 2 para crearlas

2. **Tokens de acceso para la nueva cuenta** (Access Token y Refresh Token)
   - Estos tokens son específicos para cada cuenta de Google
   - Se obtienen autorizando la aplicación con la nueva cuenta
   - **IMPORTANTE**: Los tokens son únicos por cuenta, así que necesitas obtener nuevos tokens para la nueva cuenta

3. **ID del calendario** (email de la nueva cuenta o `primary`)

4. **Variables de entorno a configurar**:
   ```
   GOOGLE_CLIENT_ID=tu_client_id (ya lo tienes)
   GOOGLE_CLIENT_SECRET=tu_client_secret (ya lo tienes)
   GOOGLE_REDIRECT_URI=https://tu-dominio.vercel.app/api/auth/callback/google
   ADMIN_GOOGLE_ACCESS_TOKEN=nuevo_access_token (obtener para la nueva cuenta)
   ADMIN_GOOGLE_REFRESH_TOKEN=nuevo_refresh_token (obtener para la nueva cuenta)
   GOOGLE_CALENDAR_ID=nueva-cuenta@gmail.com (o "primary")
   GOOGLE_CALENDAR_TIMEZONE=America/Montevideo (opcional)
   ```

#### 🔄 Proceso General

1. **Usar las mismas credenciales OAuth** (Client ID y Client Secret) - no necesitas crear nuevas
2. **Obtener nuevos tokens** autorizando la aplicación con la nueva cuenta de Google
3. **Configurar el email de la nueva cuenta** como `GOOGLE_CALENDAR_ID`
4. **Actualizar las variables de entorno** con los nuevos tokens

---

#### Obtener Tokens de Google Calendar para la Nueva Cuenta

Los tokens `ADMIN_GOOGLE_ACCESS_TOKEN` y `ADMIN_GOOGLE_REFRESH_TOKEN` permiten que tu aplicación cree eventos en el calendario de la nueva cuenta de administrador.

#### Opción A: Usar el Script Automatizado (Recomendado)

El proyecto incluye un script que automatiza este proceso. **Este script funciona para cualquier cuenta de Google**, solo necesitas iniciar sesión con la cuenta que quieras usar.

1. **Configurar el script**:
   - Abre `scripts/get-admin-tokens.js`
   - Reemplaza las credenciales en las líneas 5-7 con tus credenciales OAuth (las mismas que ya tienes):
   ```javascript
   const CLIENT_ID = 'tu_GOOGLE_CLIENT_ID';  // Usa las mismas credenciales OAuth
   const CLIENT_SECRET = 'tu_GOOGLE_CLIENT_SECRET';  // Usa las mismas credenciales OAuth
   const REDIRECT_URI = 'https://tu-dominio.vercel.app/api/auth/callback/google';
   ```
   - **Nota**: Si quieres cambiar el mensaje del script, puedes editar la línea 23 para mostrar el email de la nueva cuenta

2. **Ejecutar el script**:
   ```bash
   cd scripts
   node get-admin-tokens.js
   ```

3. **Seguir las instrucciones**:
   - El script generará una URL de autorización
   - Abre esa URL en tu navegador
   - **IMPORTANTE**: 
     - Si ya estás logueado con otra cuenta, cierra sesión primero
     - Inicia sesión con la **nueva cuenta de Google** que quieres usar para el calendario
     - Autoriza todos los permisos solicitados (Google Calendar API)
   - Después de autorizar, serás redirigido a una URL con un código
   - Copia el código completo de la URL (el parámetro `code=`)
   - Pégalo en la terminal donde está ejecutándose el script

4. **Obtener los tokens**:
   - El script mostrará los tokens en la terminal
   - **Estos tokens son específicos para la cuenta con la que autorizaste**
   - Cópialos y agrégalos a tus variables de entorno:
   ```
   ADMIN_GOOGLE_ACCESS_TOKEN=ya29.xxxxx...
   ADMIN_GOOGLE_REFRESH_TOKEN=1//xxxxx...
   ```

5. **Configurar el Calendar ID**:
   - Usa el email de la nueva cuenta como `GOOGLE_CALENDAR_ID`:
   ```
   GOOGLE_CALENDAR_ID=nueva-cuenta@gmail.com
   # O simplemente:
   GOOGLE_CALENDAR_ID=primary
   ```

#### Opción B: Obtener Tokens Manualmente

Si prefieres hacerlo manualmente:

1. **Generar URL de autorización**:
   
   Usa esta URL reemplazando los valores:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?
   client_id=TU_CLIENT_ID&
   redirect_uri=https://tu-dominio.vercel.app/api/auth/callback/google&
   response_type=code&
   scope=https://www.googleapis.com/auth/calendar%20https://www.googleapis.com/auth/calendar.events&
   access_type=offline&
   prompt=consent
   ```

2. **Autorizar la aplicación**:
   - Abre la URL en tu navegador
   - Inicia sesión con la cuenta del administrador
   - Autoriza todos los permisos

3. **Obtener el código de autorización**:
   - Después de autorizar, serás redirigido a una URL con un código
   - La URL será algo como: `https://tu-dominio.vercel.app/api/auth/callback/google?code=4/xxxxx...`
   - Copia el valor del parámetro `code`

4. **Intercambiar código por tokens**:
   
   Usa cURL o Postman para hacer esta petición:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -d "code=EL_CODIGO_QUE_OBTUVISTE" \
     -d "client_id=TU_CLIENT_ID" \
     -d "client_secret=TU_CLIENT_SECRET" \
     -d "redirect_uri=https://tu-dominio.vercel.app/api/auth/callback/google" \
     -d "grant_type=authorization_code"
   ```

5. **Extraer los tokens**:
   - La respuesta será un JSON con `access_token` y `refresh_token`
   - Cópialos a tus variables de entorno

#### Configurar el Calendario ID para la Nueva Cuenta

1. **Obtener el ID del calendario**:
   - El ID generalmente es el **email de la nueva cuenta**: `nueva-cuenta@gmail.com`
   - O puedes usar `primary` para usar el calendario principal de esa cuenta
   - Si tienes múltiples calendarios en esa cuenta, puedes verlos en [Google Calendar](https://calendar.google.com/)
   - Para ver el ID de un calendario específico:
     - Ve a Google Calendar
     - Configuración > Configuración de calendarios
     - Haz clic en el calendario que quieras usar
     - Busca "ID del calendario" (será el email o un ID personalizado)

2. **Configurar la variable**:
   ```
   GOOGLE_CALENDAR_ID=nueva-cuenta@gmail.com
   # O simplemente:
   GOOGLE_CALENDAR_ID=primary
   ```
   
   **Nota**: Si usas `primary`, se usará el calendario principal de la cuenta con la que obtuviste los tokens.

#### Configurar el Redirect URI

Ya que usaste una URI de redirección en los pasos anteriores, configura esta variable:

```
GOOGLE_REDIRECT_URI=https://tu-dominio.vercel.app/api/auth/callback/google
```

**Nota**: Esta URI debe coincidir exactamente con una de las URIs que agregaste en Google Cloud Console.

#### ⚠️ Solución de Problemas: Error "redirect_uri_mismatch"

Si recibes el error **"redirect_uri_mismatch"** al ejecutar el script, significa que la URI de redirección no coincide con las configuradas en Google Cloud Console.

**Pasos para solucionarlo:**

1. **Verificar qué URI está usando el script**:
   - El script mostrará la URI de redirección que está usando
   - Anótala exactamente como aparece (con http/https, con o sin barra final, etc.)

2. **Ir a Google Cloud Console**:
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Selecciona tu proyecto
   - Ve a **APIs y servicios** > **Credenciales**
   - Haz clic en tu **ID de cliente de OAuth 2.0**

3. **Verificar/Agregar la URI**:
   - En la sección **"URIs de redirección autorizados"**, verifica que esté la URI exacta
   - La URI debe coincidir **exactamente** (mayúsculas/minúsculas, http vs https, con o sin barra final)
   - Ejemplos de URIs comunes:
     ```
     http://localhost:3000/api/auth/callback/google
     https://lozanonahuel.com/api/auth/callback/google
     https://lozanonahuel.vercel.app/api/auth/callback/google
     ```

4. **Agregar la URI si falta**:
   - Haz clic en **"AGREGAR URI"** o el botón de editar
   - Agrega la URI exacta que muestra el script
   - Haz clic en **GUARDAR**

5. **Esperar y reintentar**:
   - Los cambios pueden tardar 1-2 minutos en aplicarse
   - Espera un momento y ejecuta el script nuevamente

**URIs comunes que debes tener configuradas:**
- `http://localhost:3000/api/auth/callback/google` (para desarrollo local)
- `https://tu-dominio.com/api/auth/callback/google` (tu dominio de producción)
- `https://tu-dominio.vercel.app/api/auth/callback/google` (si usas Vercel)

**Nota importante**: 
- Las URIs son **case-sensitive** (sensibles a mayúsculas/minúsculas)
- `http://` y `https://` son diferentes
- No agregues barras finales innecesarias (`/api/auth/callback/google` vs `/api/auth/callback/google/`)

#### ⚠️ Solución de Problemas: Error "OAuthCallback" y Redirección Infinita

Si recibes el error **"OAuthCallback"** o un mensaje de redirección infinita al intentar iniciar sesión, sigue estos pasos:

**Causa común**: La URI de redirección no coincide entre Google Cloud Console y la configuración de NextAuth.

**Solución paso a paso:**

1. **Verificar NEXTAUTH_URL en Vercel**:
   - Ve a tu proyecto en Vercel Dashboard
   - Settings > Environment Variables
   - Verifica que `NEXTAUTH_URL` esté configurado correctamente:
     ```
     NEXTAUTH_URL=https://lozanonahuel.com
     ```
     O si usas el dominio de Vercel:
     ```
     NEXTAUTH_URL=https://lozanonahuel.vercel.app
     ```
   - **IMPORTANTE**: No incluyas la barra final (`/`) al final de la URL

2. **Verificar URIs en Google Cloud Console**:
   - Ve a Google Cloud Console > APIs y servicios > Credenciales
   - Edita tu OAuth 2.0 Client ID
   - En "URIs de redirección autorizados", asegúrate de tener **ambas** URIs:
     ```
     https://lozanonahuel.com/api/auth/callback/google
     https://lozanonahuel.vercel.app/api/auth/callback/google
     ```
   - También agrega la de desarrollo local:
     ```
     http://localhost:3000/api/auth/callback/google
     ```

3. **Verificar que coincidan exactamente**:
   - La URI debe ser exactamente: `https://lozanonahuel.com/api/auth/callback/google`
   - No debe tener barra final: ❌ `https://lozanonahuel.com/api/auth/callback/google/`
   - Debe usar `https://` (no `http://`) en producción

4. **Limpiar cookies y caché**:
   - En el navegador, borra las cookies del sitio
   - Especialmente las cookies que empiezan con `next-auth` o `__Secure-next-auth`
   - También borra el caché del navegador

5. **Redeploy en Vercel**:
   - Después de cambiar las variables de entorno en Vercel
   - Haz un redeploy de la aplicación
   - Los cambios pueden tardar unos minutos en aplicarse

6. **Verificar logs en Vercel**:
   - Ve a Vercel Dashboard > Tu proyecto > Functions Logs
   - Busca errores relacionados con OAuth o NextAuth
   - Esto te ayudará a identificar el problema exacto

**Checklist de verificación:**
- [ ] `NEXTAUTH_URL` configurado correctamente en Vercel (sin barra final)
- [ ] URIs de redirección agregadas en Google Cloud Console (ambos dominios)
- [ ] Cookies del navegador limpiadas
- [ ] Aplicación redeployada en Vercel después de cambios
- [ ] Esperado 2-3 minutos después de los cambios

**Si el problema persiste:**
- Verifica los logs de Vercel para ver el error exacto
- Asegúrate de que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` sean correctos
- Verifica que `NEXTAUTH_SECRET` esté configurado (mínimo 32 caracteres)

---

#### 📝 Resumen: Variables de Entorno Necesarias para la Nueva Cuenta

Una vez que hayas completado todos los pasos, estas son las variables que necesitas configurar en tu `.env.local` o en Vercel:

```env
# Credenciales OAuth (las mismas que ya tienes - NO cambian)
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu_secret

# Redirect URI (debe coincidir con Google Cloud Console)
GOOGLE_REDIRECT_URI=https://tu-dominio.vercel.app/api/auth/callback/google

# Tokens de la NUEVA cuenta (obtenidos con el script)
ADMIN_GOOGLE_ACCESS_TOKEN=ya29.nuevo_access_token_para_nueva_cuenta...
ADMIN_GOOGLE_REFRESH_TOKEN=1//nuevo_refresh_token_para_nueva_cuenta...

# ID del calendario de la nueva cuenta
GOOGLE_CALENDAR_ID=nueva-cuenta@gmail.com
# O simplemente:
# GOOGLE_CALENDAR_ID=primary

# Zona horaria (opcional)
GOOGLE_CALENDAR_TIMEZONE=America/Montevideo
```

**Checklist de configuración:**
- [ ] Credenciales OAuth configuradas (Client ID y Client Secret)
- [ ] Tokens obtenidos para la nueva cuenta (Access Token y Refresh Token)
- [ ] Calendar ID configurado (email de la nueva cuenta o `primary`)
- [ ] Redirect URI configurado y coincide con Google Cloud Console
- [ ] Zona horaria configurada (opcional pero recomendado)
- [ ] Variables agregadas en Vercel (si usas Vercel)
- [ ] Aplicación redeployada después de agregar las variables

**⚠️ Importante:**
- Los tokens son específicos por cuenta. Si cambias de cuenta, necesitas obtener nuevos tokens.
- El Access Token expira en 1 hora, pero el Refresh Token se usa para renovarlo automáticamente.
- Si los tokens dejan de funcionar, simplemente ejecuta el script nuevamente con la nueva cuenta.

---

### Parte 4: Configurar Zona Horaria del Calendario (Opcional)

Para asegurar que los eventos se creen en la zona horaria correcta:

```
GOOGLE_CALENDAR_TIMEZONE=America/Montevideo
# O para Argentina:
# GOOGLE_CALENDAR_TIMEZONE=America/Argentina/Buenos_Aires
```

---

## ✅ Resumen de Todas las Variables Necesarias

### Variables para Email/Notificaciones

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu_contraseña_de_aplicación_16_caracteres
ADMIN_EMAIL=admin@ejemplo.com
EMAIL_FROM_NAME=Nahuel Lozano Trading (opcional)
EMAIL_FROM_ADDRESS=noreply@ejemplo.com (opcional)
ADMIN_EMAILS=admin2@ejemplo.com,admin3@ejemplo.com (opcional)
```

### Variables para Google OAuth y Calendar

```
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu_secret
GOOGLE_REDIRECT_URI=https://tu-dominio.vercel.app/api/auth/callback/google
ADMIN_GOOGLE_ACCESS_TOKEN=ya29.xxxxx...
ADMIN_GOOGLE_REFRESH_TOKEN=1//xxxxx...
GOOGLE_CALENDAR_ID=admin@gmail.com (o "primary")
GOOGLE_CALENDAR_TIMEZONE=America/Montevideo (opcional)
```

---

### Variables Principales

#### 1. **ADMIN_EMAIL** (Requerida)
- **Propósito**: Email donde se reciben **todas las notificaciones del administrador**
- **Ejemplo**: `nuevo-admin@ejemplo.com`
- **Usos**:
  - Notificaciones de nuevas reservas (entrenamientos/asesorías)
  - Notificaciones de nuevos mensajes de contacto
  - Notificaciones de nuevos suscriptores
  - Notificaciones de indicadores de TradingView
  - Invitaciones a eventos de Google Calendar

#### 2. **SMTP_USER** (Requerida)
- **Propósito**: Email desde el cual se **envían todos los correos** (remitente)
- **Ejemplo**: `noreply@ejemplo.com` o `soporte@ejemplo.com`
- **Usos**:
  - Como remitente de todos los emails enviados a usuarios
  - Como fallback si `ADMIN_EMAIL` no está configurado
  - Como dirección de contacto en los footers de los emails

#### 3. **SMTP_PASS** (Requerida)
- **Propósito**: Contraseña de aplicación para autenticación SMTP
- **Ejemplo**: `abcd efgh ijkl mnop` (16 caracteres para Gmail)
- **Nota**: Debe ser la contraseña de aplicación del email configurado en `SMTP_USER`

#### 4. **SMTP_HOST** (Requerida)
- **Propósito**: Servidor SMTP para enviar emails
- **Ejemplos**:
  - Gmail: `smtp.gmail.com`
  - SendGrid: `smtp.sendgrid.net`
  - Mailgun: `smtp.mailgun.org`

#### 5. **SMTP_PORT** (Requerida)
- **Propósito**: Puerto del servidor SMTP
- **Valores comunes**:
  - `587` (TLS/STARTTLS - Recomendado)
  - `465` (SSL)
  - `25` (No recomendado)

#### 6. **EMAIL_FROM_NAME** (Opcional)
- **Propósito**: Nombre que aparece como remitente en los emails
- **Ejemplo**: `Nahuel Lozano Trading`
- **Por defecto**: `Nahuel Lozano`

#### 7. **EMAIL_FROM_ADDRESS** (Opcional)
- **Propósito**: Dirección de email que aparece como remitente (puede ser diferente de SMTP_USER)
- **Ejemplo**: `noreply@lozanonahuel.com`
- **Por defecto**: Usa `SMTP_USER` si no está configurado

#### 8. **ADMIN_EMAILS** (Opcional - Múltiples destinatarios)
- **Propósito**: Lista de emails adicionales para recibir notificaciones (separados por comas)
- **Ejemplo**: `admin1@ejemplo.com,admin2@ejemplo.com`
- **Nota**: Se usa junto con `ADMIN_EMAIL` para enviar a múltiples destinatarios

---

## 🔧 Paso a Paso: Configuración en Vercel

### Paso 1: Acceder a las Variables de Entorno

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** (Configuración)
4. Haz clic en **Environment Variables** (Variables de Entorno)

### Paso 2: Configurar Variables para Envío de Emails

Estas variables controlan **desde dónde se envían** los emails:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=nuevo-email-envio@ejemplo.com
SMTP_PASS=tu_contraseña_de_aplicacion
```

**Para Gmail (Cuentas Personales):**
1. Activa la autenticación en 2 pasos en tu cuenta Google
2. Ve a **Gestión de la cuenta Google** > **Seguridad** > **Contraseñas de aplicaciones**
3. Crea una contraseña de aplicación específica para "Mail"
4. Usa esa contraseña (16 caracteres) en `SMTP_PASS`
5. ⚠️ **Nota**: Las cuentas de Google Workspace (empresariales) pueden no tener acceso a contraseñas de aplicación. En ese caso, usa SendGrid.

**Para SendGrid (Recomendado para Cuentas Profesionales):**
1. Crea una cuenta gratuita en [sendgrid.com](https://sendgrid.com/)
2. Ve a **Settings** > **API Keys** y crea una nueva API Key
3. Configura las variables:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=tu_sendgrid_api_key  # La API Key que creaste
   EMAIL_FROM_ADDRESS=noreply@tudominio.com  # Email verificado en SendGrid
   ```
4. ✅ **Ventajas**: No requiere contraseñas de aplicación, funciona con cualquier cuenta, mejor para producción

**Para Mailgun (Alternativa a SendGrid):**
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@tudominio.com
SMTP_PASS=tu_api_key_de_mailgun
```

### Paso 3: Configurar Email del Administrador

Esta variable controla **dónde se reciben** las notificaciones del admin:

```
ADMIN_EMAIL=nuevo-admin@ejemplo.com
```

**Importante**: Este email recibirá:
- ✅ Notificaciones de nuevas reservas
- ✅ Notificaciones de nuevos mensajes de contacto
- ✅ Notificaciones de nuevos suscriptores
- ✅ Notificaciones de indicadores de TradingView
- ✅ Invitaciones a eventos de Google Calendar

### Paso 4: Configurar Variables Opcionales (Recomendadas)

```
EMAIL_FROM_NAME=Nahuel Lozano Trading
EMAIL_FROM_ADDRESS=noreply@lozanonahuel.com
```

**Nota**: Si no configuras `EMAIL_FROM_ADDRESS`, se usará `SMTP_USER` como remitente.

### Paso 5: Configurar Múltiples Destinatarios (Opcional)

Si quieres que múltiples emails reciban las notificaciones del admin:

```
ADMIN_EMAIL=nuevo-admin@ejemplo.com
ADMIN_EMAILS=admin2@ejemplo.com,admin3@ejemplo.com
```

**Comportamiento**: Se enviará a `ADMIN_EMAIL` + todos los emails en `ADMIN_EMAILS`.

### Paso 6: Seleccionar Ambientes

Para cada variable, selecciona en qué ambientes aplica:
- ✅ **Production** (Producción)
- ✅ **Preview** (Previsualización)
- ✅ **Development** (Desarrollo)

**Recomendación**: Configura todas las variables en los 3 ambientes para consistencia.

### Paso 7: Guardar y Redesplegar

1. Haz clic en **Save** (Guardar) para cada variable
2. Ve a la pestaña **Deployments**
3. Haz clic en los 3 puntos (⋯) del último deployment
4. Selecciona **Redeploy** (Redesplegar)

**Importante**: Los cambios en variables de entorno requieren un redespliegue para tomar efecto.

---

## 📊 Tipos de Notificaciones y Sus Destinatarios

### Notificaciones que RECIBE el Administrador

Todas estas notificaciones se envían a `ADMIN_EMAIL` (y `ADMIN_EMAILS` si está configurado):

| Tipo de Notificación | Destinatario | Variable Usada |
|---------------------|--------------|----------------|
| Nueva reserva de entrenamiento | Admin | `ADMIN_EMAIL` |
| Nueva reserva de asesoría | Admin | `ADMIN_EMAIL` |
| Nuevo mensaje de contacto | Admin | `ADMIN_EMAIL` |
| Nuevo suscriptor de alertas | Admin | `ADMIN_EMAIL` |
| Indicador de TradingView | Admin | `ADMIN_EMAIL` |
| Invitación a Google Calendar | Admin | `ADMIN_EMAIL` |

### Notificaciones que SE ENVÍAN a Usuarios

Todas estas notificaciones se envían **desde** `SMTP_USER` (o `EMAIL_FROM_ADDRESS` si está configurado):

| Tipo de Notificación | Destinatario | Remitente |
|---------------------|--------------|-----------|
| Confirmación de entrenamiento | Usuario | `SMTP_USER` |
| Confirmación de asesoría | Usuario | `SMTP_USER` |
| Confirmación de suscripción | Usuario | `SMTP_USER` |
| Notificaciones de alertas | Usuario | `SMTP_USER` |
| Recordatorios de reservas | Usuario | `SMTP_USER` |
| Confirmación de pago | Usuario | `SMTP_USER` |
| Confirmación de contacto | Usuario | `SMTP_USER` |

---

## 🔄 Escenarios de Migración

### Escenario 1: Cambiar Solo el Email del Admin (Mantener el Mismo Remitente)

**Objetivo**: Cambiar dónde se reciben las notificaciones del admin, pero mantener el mismo remitente.

**Pasos**:
1. Cambia solo `ADMIN_EMAIL` en Vercel
2. No modifiques `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`
3. Redesplega la aplicación

**Ejemplo**:
```
# Antes
ADMIN_EMAIL=admin-viejo@ejemplo.com
SMTP_USER=noreply@ejemplo.com

# Después
ADMIN_EMAIL=admin-nuevo@ejemplo.com
SMTP_USER=noreply@ejemplo.com  # Sin cambios
```

### Escenario 2: Cambiar Todo a un Nuevo Proveedor de Email

**Objetivo**: Migrar completamente a un nuevo proveedor de email (ej: de Gmail a SendGrid).

**Pasos**:
1. Configura las credenciales del nuevo proveedor en todas las variables SMTP
2. Cambia `ADMIN_EMAIL` al nuevo email
3. Actualiza `EMAIL_FROM_ADDRESS` si es necesario
4. Redesplega la aplicación

**Ejemplo**:
```
# Antes (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=viejo@gmail.com
SMTP_PASS=contraseña_gmail
ADMIN_EMAIL=admin@gmail.com

# Después (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
ADMIN_EMAIL=admin@nuevo-dominio.com
EMAIL_FROM_ADDRESS=noreply@nuevo-dominio.com
```

### Escenario 3: Separar Remitente y Destinatario

**Objetivo**: Usar un email para enviar y otro completamente diferente para recibir.

**Pasos**:
1. Configura `SMTP_USER` con el email que enviará (ej: `noreply@ejemplo.com`)
2. Configura `ADMIN_EMAIL` con el email que recibirá (ej: `admin@ejemplo.com`)
3. Configura `EMAIL_FROM_ADDRESS` si quieres que aparezca un remitente diferente
4. Redesplega la aplicación

**Ejemplo**:
```
SMTP_USER=noreply@ejemplo.com          # Email que envía
SMTP_PASS=contraseña_de_noreply
ADMIN_EMAIL=admin@ejemplo.com          # Email que recibe
EMAIL_FROM_ADDRESS=soporte@ejemplo.com # Aparece como remitente
```

---

## ✅ Verificación Post-Migración

### 1. Verificar Envío de Emails

Realiza estas acciones para verificar que los emails se envían correctamente:

- [ ] Envía un mensaje de contacto desde el formulario
- [ ] Crea una reserva de entrenamiento
- [ ] Crea una reserva de asesoría
- [ ] Suscríbete a una alerta (TraderCall/SmartMoney)

**Verifica**:
- ✅ El email del admin recibe las notificaciones
- ✅ Los usuarios reciben las confirmaciones
- ✅ El remitente es correcto en todos los emails

### 2. Verificar Recepción de Notificaciones del Admin

Confirma que recibes estas notificaciones en `ADMIN_EMAIL`:

- [ ] Nueva reserva de entrenamiento
- [ ] Nueva reserva de asesoría
- [ ] Nuevo mensaje de contacto
- [ ] Nuevo suscriptor de alertas
- [ ] Indicador de TradingView enviado

### 3. Verificar Google Calendar

Para verificar que Google Calendar funciona correctamente:

- [ ] Crea una reserva de entrenamiento desde el sitio
- [ ] Verifica que aparece un evento en Google Calendar del admin
- [ ] Verifica que el evento tiene un link de Google Meet
- [ ] Verifica que recibiste una invitación en tu email
- [ ] Verifica que el evento tiene la fecha y hora correctas

**Cómo verificar**:
1. Ve a [Google Calendar](https://calendar.google.com/)
2. Asegúrate de estar viendo el calendario correcto (el del admin)
3. Busca eventos recientes creados por la aplicación

### 4. Verificar Logs en Vercel

1. Ve a **Deployments** en Vercel
2. Selecciona el último deployment
3. Ve a **Functions Logs**
4. Busca mensajes que contengan `📧`, `EMAIL`, `CALENDAR` o `GOOGLE`
5. Verifica que no hay errores relacionados con SMTP o Google Calendar

**Logs esperados para emails**:
```
📧 [EMAIL SERVICE] Enviando email a: admin@ejemplo.com
✅ [EMAIL SERVICE] Email enviado exitosamente
```

**Logs esperados para Calendar**:
```
🔑 Configurando cliente de Google Calendar...
✅ Tokens configurados correctamente
📅 Creando evento de entrenamiento en calendario del admin
✅ Evento de entrenamiento creado con Google Meet: https://meet.google.com/...
```

**Errores a revisar**:
```
❌ [EMAIL SERVICE] Error enviando email
❌ No se encontró email válido para el administrador
❌ Error al obtener cliente de Calendar del admin
❌ Error al crear evento de entrenamiento
```

---

## 🐛 Solución de Problemas

### Problema 1: "No está disponible para tu cuenta" - Cuenta Profesional (Google Workspace)

**Síntoma**: Ves el mensaje "La opción de configuración que buscas no está disponible para tu cuenta" al intentar crear contraseñas de aplicación.

**Causa**: Estás usando una cuenta de Google Workspace y el administrador ha deshabilitado las contraseñas de aplicación.

**Soluciones**:

**Opción 1: Usar cuenta Gmail personal (Más rápida)**
1. Crea o usa una cuenta Gmail personal (`@gmail.com`)
2. Activa la verificación en 2 pasos en esa cuenta
3. Crea una contraseña de aplicación
4. Usa esa cuenta solo para `SMTP_USER`

**Opción 2: Solicitar al administrador**
1. Contacta al administrador de Google Workspace
2. Solicita que habilite "Contraseñas de aplicaciones"
3. Ruta en Admin Console: Seguridad > Acceso a datos > Contraseñas de aplicaciones

**Opción 3: Usar SendGrid (Recomendado)**
1. Crea cuenta gratuita en [sendgrid.com](https://sendgrid.com/)
2. Genera una API Key
3. Configura las variables:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=tu_api_key_sendgrid
   ```

**Opción 4: Usar OAuth2 (Avanzado)**
- Requiere configuración de OAuth2 para SMTP
- Solo recomendado si tienes experiencia técnica

### Problema 2: No se reciben notificaciones del admin

**Causas posibles**:
- `ADMIN_EMAIL` no está configurado correctamente
- El email está en spam
- Error en la configuración SMTP

**Solución**:
1. Verifica que `ADMIN_EMAIL` está configurado en Vercel
2. Revisa la carpeta de spam del email
3. Verifica los logs en Vercel para ver errores
4. Prueba enviando un email de prueba desde el admin panel

### Problema 3: Los emails no se envían

**Causas posibles**:
- Credenciales SMTP incorrectas
- Puerto SMTP bloqueado
- Contraseña de aplicación incorrecta (Gmail)

**Solución**:
1. Verifica `SMTP_USER` y `SMTP_PASS`
2. Para Gmail, asegúrate de usar una contraseña de aplicación (no la contraseña normal)
3. Verifica que el puerto `SMTP_PORT` es correcto
4. Prueba con otro proveedor SMTP (SendGrid, Mailgun)

### Problema 4: El remitente aparece incorrecto

**Causa**: `EMAIL_FROM_ADDRESS` no está configurado o es incorrecto

**Solución**:
1. Configura `EMAIL_FROM_ADDRESS` en Vercel
2. Asegúrate de que el dominio esté verificado en tu proveedor SMTP
3. Redesplega la aplicación

### Problema 5: Múltiples destinatarios no funcionan

**Causa**: `ADMIN_EMAILS` no está configurado correctamente

**Solución**:
1. Verifica que los emails están separados por comas
2. No dejes espacios después de las comas
3. Ejemplo correcto: `admin1@ejemplo.com,admin2@ejemplo.com`
4. Ejemplo incorrecto: `admin1@ejemplo.com, admin2@ejemplo.com` (con espacio)

### Problema 6: Error al crear eventos en Google Calendar

**Causas posibles**:
- Tokens de Google Calendar expirados o inválidos
- Google Calendar API no habilitada
- Permisos insuficientes en los scopes

**Solución**:
1. Verifica que `ADMIN_GOOGLE_ACCESS_TOKEN` y `ADMIN_GOOGLE_REFRESH_TOKEN` están configurados
2. Verifica que Google Calendar API está habilitada en Google Cloud Console
3. Regenera los tokens usando el script `get-admin-tokens.js`
4. Verifica los logs en Vercel para ver el error específico
5. Asegúrate de que los scopes incluyen:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

### Problema 7: Los eventos no tienen link de Google Meet

**Causas posibles**:
- La API de Google Meet no está habilitada
- El calendario no tiene permisos para crear reuniones

**Solución**:
1. Verifica que Google Calendar API está habilitada (Google Meet se maneja automáticamente)
2. Asegúrate de estar usando un calendario de Google Workspace o un calendario personal con Meet habilitado
3. Verifica en Google Calendar que la opción de "Añadir videollamada de Google Meet" está disponible
4. Revisa los logs para ver si hay errores específicos sobre la creación de Meet

### Problema 8: Error de autenticación OAuth (invalid_grant)

**Causa**: El refresh token expiró o fue revocado

**Solución**:
1. Ve a [Google Account Security](https://myaccount.google.com/security)
2. Ve a **Accesos de terceros a tu cuenta**
3. Revoca el acceso de tu aplicación si está listada
4. Regenera los tokens usando el script `get-admin-tokens.js`
5. Actualiza `ADMIN_GOOGLE_REFRESH_TOKEN` en Vercel

### Problema 9: "redirect_uri_mismatch" al obtener tokens

**Causa**: La URI de redirección no coincide con la configurada en Google Cloud Console

**Solución**:
1. Ve a Google Cloud Console > APIs y servicios > Credenciales
2. Haz clic en tu ID de cliente OAuth 2.0
3. Verifica que la URI de redirección en el código/script coincide exactamente con una de las URIs autorizadas
4. Asegúrate de que no hay espacios o caracteres diferentes
5. La URI debe coincidir exactamente, incluyendo `http://` vs `https://`

---

## 📝 Resumen de Variables por Función

### Variables para ENVIAR emails
```
SMTP_HOST          → Servidor SMTP
SMTP_PORT          → Puerto SMTP
SMTP_USER          → Usuario/email que envía
SMTP_PASS          → Contraseña de autenticación
EMAIL_FROM_NAME    → Nombre del remitente (opcional)
EMAIL_FROM_ADDRESS → Email del remitente (opcional)
```

### Variables para RECIBIR notificaciones
```
ADMIN_EMAIL        → Email principal del admin
ADMIN_EMAILS       → Emails adicionales (opcional, separados por comas)
```

---

## 👤 Cómo Encontrar al Administrador de tu Organización

Si estás usando una cuenta de Google Workspace y necesitas contactar al administrador para solicitar permisos, aquí te explicamos cómo identificarlo:

### Método 1: Verificar en tu Perfil de Cuenta

1. Ve a [myaccount.google.com](https://myaccount.google.com)
2. En la página principal, busca información sobre tu organización
3. A veces aparece un enlace como **"Administrado por [nombre de organización]"** o **"Cuenta administrada"**
4. Haz clic en ese enlace para ver información del administrador

### Método 2: Revisar el Dominio de tu Email

1. Mira el dominio de tu email (la parte después de la `@`)
   - Ejemplo: Si tu email es `usuario@empresa.com`, el dominio es `empresa.com`
2. El administrador generalmente tiene un email como:
   - `admin@empresa.com`
   - `administrador@empresa.com`
   - `it@empresa.com` o `soporte@empresa.com`
   - `tu-nombre@empresa.com` (si eres parte de un equipo pequeño)

### Método 3: Preguntar a un Compañero

- Pregunta a colegas de tu organización:
  - "¿Quién maneja las cuentas de Google?"
  - "¿Quién es el administrador de IT?"
  - "¿A quién le pido permisos para aplicaciones de Google?"

### Método 4: Revisar Emails de Configuración

1. Busca en tu bandeja de entrada emails antiguos que mencionen:
   - "Configuración de Google Workspace"
   - "Bienvenido a Google Workspace"
   - "Administrador de cuenta"
2. El remitente suele ser el administrador o el equipo de IT

### Método 5: Intentar Acceder al Admin Console (Solo para Ver)

1. Intenta acceder a: [admin.google.com](https://admin.google.com)
2. Si NO tienes permisos, verás un mensaje que puede decir:
   - "No tienes acceso"
   - "Contacta a tu administrador"
   - A veces muestra un email de contacto del administrador

### Método 6: Verificar en la Página de Ayuda de Google Workspace

1. Ve a la página de ayuda: [support.google.com/a](https://support.google.com/a)
2. Intenta buscar información sobre tu organización
3. A veces hay información de contacto visible

### ¿Qué Hacer una Vez que Identifiques al Administrador?

**Redacta un Email al Administrador:**

```
Asunto: Solicitud para habilitar "Contraseñas de aplicaciones" en Google Workspace

Hola [Nombre del Administrador],

Soy [Tu nombre] y tengo una cuenta de Google Workspace ([tu-email@dominio.com]).

Necesito acceso a la función "Contraseñas de aplicaciones" para poder configurar 
el envío de emails desde una aplicación web que estoy desarrollando.

¿Podrías habilitar esta función para mi cuenta? El administrador debe ir a:
Admin Console > Seguridad > Acceso a datos > Contraseñas de aplicaciones

Gracias por tu ayuda.

Saludos,
[Tu nombre]
```

### Si No Puedes Contactar al Administrador

Si no puedes contactar al administrador o no responde, considera:

1. **Usar SendGrid** (Opción C) - No requiere permisos del administrador
2. **Usar una cuenta Gmail personal** (Opción A) - Solo para desarrollo/pruebas
3. **Contactar al departamento de IT/Recursos Humanos** - Pueden darte el contacto del administrador

### Nota Importante

- Si tu organización es pequeña, **tú podrías ser el administrador** si eres el dueño de la cuenta
- Si no estás seguro, intenta acceder a [admin.google.com](https://admin.google.com) con tu cuenta
- Si puedes acceder, eres el administrador y puedes habilitar las contraseñas de aplicación tú mismo

---

## 🎯 Checklist Final

Antes de considerar la migración completa:

### Configuración de Variables

- [ ] Todas las variables están configuradas en Vercel
- [ ] Las variables están configuradas en los 3 ambientes (Production, Preview, Development)
- [ ] La aplicación ha sido redesplegada después de los cambios

### Credenciales de Email/SMTP

- [ ] `SMTP_HOST` configurado (ej: `smtp.gmail.com`)
- [ ] `SMTP_PORT` configurado (ej: `587`)
- [ ] `SMTP_USER` configurado con el email que enviará los correos
- [ ] `SMTP_PASS` configurado con contraseña de aplicación de Gmail
- [ ] `ADMIN_EMAIL` configurado con el email que recibirá notificaciones

### Credenciales de Google OAuth

- [ ] Proyecto creado en Google Cloud Console
- [ ] Google Calendar API habilitada
- [ ] Pantalla de consentimiento OAuth configurada
- [ ] `GOOGLE_CLIENT_ID` obtenido y configurado
- [ ] `GOOGLE_CLIENT_SECRET` obtenido y configurado
- [ ] URIs de redirección configuradas en Google Cloud Console

### Credenciales de Google Calendar

- [ ] `ADMIN_GOOGLE_ACCESS_TOKEN` obtenido y configurado
- [ ] `ADMIN_GOOGLE_REFRESH_TOKEN` obtenido y configurado
- [ ] `GOOGLE_CALENDAR_ID` configurado (email del admin o `primary`)
- [ ] `GOOGLE_REDIRECT_URI` configurado y coincide con Google Cloud Console

### Verificación Funcional

- [ ] Se han probado todos los tipos de notificaciones
- [ ] El admin recibe notificaciones en el nuevo email
- [ ] Los usuarios reciben confirmaciones correctamente
- [ ] El remitente aparece correcto en los emails
- [ ] Los eventos se crean correctamente en Google Calendar
- [ ] Los eventos tienen link de Google Meet
- [ ] Las invitaciones de calendario se envían correctamente
- [ ] No hay errores en los logs de Vercel
- [ ] Se ha verificado que no hay emails en spam

### Checklist Rápido: Obtener Credenciales

- [ ] ✅ Contraseña de aplicación de Gmail obtenida (`SMTP_PASS`)
- [ ] ✅ Proyecto creado en Google Cloud Console
- [ ] ✅ Google Calendar API habilitada
- [ ] ✅ Credenciales OAuth 2.0 creadas (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] ✅ URIs de redirección configuradas
- [ ] ✅ Tokens de Google Calendar obtenidos (`ADMIN_GOOGLE_ACCESS_TOKEN`, `ADMIN_GOOGLE_REFRESH_TOKEN`)

---

## 📞 Soporte

Si tienes problemas con la migración:

1. Revisa los logs en Vercel (Functions Logs)
2. Verifica que todas las variables están configuradas
3. Prueba con un email de prueba desde el admin panel
4. Revisa la documentación de tu proveedor SMTP
5. Revisa los problemas comunes en la sección "Solución de Problemas" más arriba

---

## 🔗 Enlaces Útiles

### Google Cloud Console
- [Dashboard de Google Cloud](https://console.cloud.google.com/)
- [Biblioteca de APIs](https://console.cloud.google.com/apis/library)
- [Credenciales OAuth](https://console.cloud.google.com/apis/credentials)
- [Pantalla de Consentimiento](https://console.cloud.google.com/apis/credentials/consent)

### Google Account
- [Configuración de Seguridad](https://myaccount.google.com/security)
- [Contraseñas de Aplicación](https://myaccount.google.com/apppasswords)
- [Google Calendar](https://calendar.google.com/)

### Documentación Oficial
- [Google Calendar API](https://developers.google.com/calendar/api)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js con Google](https://next-auth.js.org/providers/google)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)

### Herramientas de Prueba
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) - Para probar APIs de Google
- [Google Calendar API Explorer](https://developers.google.com/apis-explorer/#search/calendar/v3/)

---

## 📝 Notas Importantes

### Sobre los Tokens de Google Calendar

- **Access Token**: Expira después de 1 hora. Se renueva automáticamente usando el refresh token.
- **Refresh Token**: No expira (a menos que sea revocado). Úsalo para obtener nuevos access tokens.
- **Regeneración**: Si necesitas regenerar los tokens, simplemente ejecuta el script `get-admin-tokens.js` nuevamente.

### Sobre las Contraseñas de Aplicación

- Solo necesitas crear una contraseña de aplicación por cuenta de Gmail.
- Puedes usar la misma contraseña para múltiples servicios (si confías en ellos).
- Si sospechas que está comprometida, revócala y crea una nueva.

### Sobre las Credenciales OAuth

- Las credenciales OAuth son públicas (Client ID) y privadas (Client Secret).
- El Client ID puede ser visto por cualquiera (no es secreto).
- El Client Secret debe mantenerse privado.
- Si comprometes el Client Secret, revócalo y crea nuevas credenciales en Google Cloud Console.

---

**Última actualización**: 2024
**Versión**: 2.0

