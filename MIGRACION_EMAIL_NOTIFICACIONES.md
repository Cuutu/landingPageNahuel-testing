# 📧 Guía Completa: Migración de Notificaciones a Otro Correo

## 🎯 Resumen

Esta guía te explica paso a paso cómo migrar **todas las notificaciones** (tanto las que se envían como las que recibe el administrador) a otro correo electrónico.

---

## 📋 Variables de Entorno a Configurar

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

**Para Gmail:**
1. Activa la autenticación en 2 pasos en tu cuenta Google
2. Ve a **Gestión de la cuenta Google** > **Seguridad** > **Contraseñas de aplicaciones**
3. Crea una contraseña de aplicación específica para "Mail"
4. Usa esa contraseña (16 caracteres) en `SMTP_PASS`

**Para SendGrid:**
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu_sendgrid_api_key
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

### 3. Verificar Logs en Vercel

1. Ve a **Deployments** en Vercel
2. Selecciona el último deployment
3. Ve a **Functions Logs**
4. Busca mensajes que contengan `📧` o `EMAIL`
5. Verifica que no hay errores relacionados con SMTP

**Logs esperados**:
```
📧 [EMAIL SERVICE] Enviando email a: admin@ejemplo.com
✅ [EMAIL SERVICE] Email enviado exitosamente
```

**Errores a revisar**:
```
❌ [EMAIL SERVICE] Error enviando email
❌ No se encontró email válido para el administrador
```

---

## 🐛 Solución de Problemas

### Problema 1: No se reciben notificaciones del admin

**Causas posibles**:
- `ADMIN_EMAIL` no está configurado correctamente
- El email está en spam
- Error en la configuración SMTP

**Solución**:
1. Verifica que `ADMIN_EMAIL` está configurado en Vercel
2. Revisa la carpeta de spam del email
3. Verifica los logs en Vercel para ver errores
4. Prueba enviando un email de prueba desde el admin panel

### Problema 2: Los emails no se envían

**Causas posibles**:
- Credenciales SMTP incorrectas
- Puerto SMTP bloqueado
- Contraseña de aplicación incorrecta (Gmail)

**Solución**:
1. Verifica `SMTP_USER` y `SMTP_PASS`
2. Para Gmail, asegúrate de usar una contraseña de aplicación (no la contraseña normal)
3. Verifica que el puerto `SMTP_PORT` es correcto
4. Prueba con otro proveedor SMTP (SendGrid, Mailgun)

### Problema 3: El remitente aparece incorrecto

**Causa**: `EMAIL_FROM_ADDRESS` no está configurado o es incorrecto

**Solución**:
1. Configura `EMAIL_FROM_ADDRESS` en Vercel
2. Asegúrate de que el dominio esté verificado en tu proveedor SMTP
3. Redesplega la aplicación

### Problema 4: Múltiples destinatarios no funcionan

**Causa**: `ADMIN_EMAILS` no está configurado correctamente

**Solución**:
1. Verifica que los emails están separados por comas
2. No dejes espacios después de las comas
3. Ejemplo correcto: `admin1@ejemplo.com,admin2@ejemplo.com`
4. Ejemplo incorrecto: `admin1@ejemplo.com, admin2@ejemplo.com` (con espacio)

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

## 🎯 Checklist Final

Antes de considerar la migración completa:

- [ ] Todas las variables están configuradas en Vercel
- [ ] Las variables están configuradas en los 3 ambientes (Production, Preview, Development)
- [ ] La aplicación ha sido redesplegada después de los cambios
- [ ] Se han probado todos los tipos de notificaciones
- [ ] El admin recibe notificaciones en el nuevo email
- [ ] Los usuarios reciben confirmaciones correctamente
- [ ] El remitente aparece correcto en los emails
- [ ] No hay errores en los logs de Vercel
- [ ] Se ha verificado que no hay emails en spam

---

## 📞 Soporte

Si tienes problemas con la migración:

1. Revisa los logs en Vercel (Functions Logs)
2. Verifica que todas las variables están configuradas
3. Prueba con un email de prueba desde el admin panel
4. Revisa la documentación de tu proveedor SMTP

---

**Última actualización**: 2024
**Versión**: 1.0

