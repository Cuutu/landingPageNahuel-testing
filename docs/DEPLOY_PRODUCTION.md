# 🚀 Guía de Despliegue a Producción

Esta guía explica cómo desplegar cambios desde el ambiente de **testing** al ambiente de **producción**.

## 📋 Requisitos Previos

1. **Dos repositorios separados:**
   - **Testing**: `https://github.com/Cuutu/landingPageNahuel-testing`
   - **Producción**: `https://github.com/joaquinperez028/landingPageNahuel`

2. **Acceso a ambos repositorios** (permisos de push)

3. **Variables de entorno configuradas** en Vercel para producción

## 🔧 Configuración Inicial (Solo una vez)

### Paso 1: Agregar remote de producción

```bash
# Desde el repositorio de testing
git remote add production https://github.com/joaquinperez028/landingPageNahuel.git

# Verificar que se agregó correctamente
git remote -v
```

Deberías ver:
```
origin      https://github.com/Cuutu/landingPageNahuel-testing.git (fetch)
origin      https://github.com/Cuutu/landingPageNahuel-testing.git (push)
production  https://github.com/joaquinperez028/landingPageNahuel.git (fetch)
production  https://github.com/joaquinperez028/landingPageNahuel.git (push)
```

## 📦 Proceso de Despliegue

### Método 1: Script Automatizado (Recomendado)

#### En Windows (PowerShell):

```powershell
.\scripts\deploy-to-production.ps1
```

#### En Linux/Mac:

```bash
chmod +x scripts/deploy-to-production.sh
./scripts/deploy-to-production.sh
```

El script:
- ✅ Verifica que estás en la rama `main`
- ✅ Verifica que no hay cambios sin commitear
- ✅ Ejecuta `npm run build` para asegurar que compila
- ✅ Muestra un resumen de cambios
- ✅ Pide confirmación antes de desplegar
- ✅ Hace push a producción

### Método 2: Manual

```bash
# 1. Asegurarte de estar en main y tener todo commiteado
git status
git checkout main

# 2. Verificar que compila
npm run build

# 3. Ver qué cambios se van a desplegar
git log production/main..HEAD --oneline

# 4. Hacer push a producción
git push production main
```

## ✅ Checklist Antes de Desplegar

Antes de cada despliegue, verifica:

- [ ] **Build exitoso**: `npm run build` debe completar sin errores
- [ ] **Tests pasan** (si los hay): `npm test`
- [ ] **Variables de entorno**: Verificar que todas estén configuradas en Vercel producción
- [ ] **Cronjobs**: Verificar que `vercel.json` tenga los cronjobs configurados
- [ ] **Base de datos**: Asegurar que la BD de producción esté accesible
- [ ] **Secrets**: Verificar que `CRON_SECRET` esté configurado en producción

## 🔐 Variables de Entorno en Producción

### Variables que DEBEN ser diferentes en producción:

1. **NEXTAUTH_URL**: 
   - Testing: `https://testing-lozanonahuel.vercel.app`
   - Producción: `https://lozanonahuel.com`

2. **MercadoPago**:
   - Testing: Credenciales de prueba (`MP_TEST_*`)
   - Producción: Credenciales reales (`MP_PUBLIC_KEY`, `MERCADOPAGO_ACCESS_TOKEN`)

3. **MongoDB**:
   - Pueden usar la misma BD o diferentes (recomendado: diferentes)

4. **Telegram**:
   - Testing: Canales de prueba (opcional)
   - Producción: Canales reales

### Variables que pueden ser iguales:

- `NEXTAUTH_SECRET` (pero mejor usar diferentes)
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (si usan el mismo proyecto)
- `MUX_TOKEN_ID` y `MUX_TOKEN_SECRET`

## 🚨 Proceso de Rollback (Si algo sale mal)

Si necesitás revertir un despliegue:

```bash
# 1. Ver el último commit en producción
git log production/main -1

# 2. Revertir al commit anterior
git checkout production/main
git reset --hard HEAD~1
git push production main --force

# O revertir a un commit específico
git reset --hard <commit-hash>
git push production main --force
```

**⚠️ CUIDADO**: `--force` sobrescribe el historial. Solo usarlo si es absolutamente necesario.

## 📊 Verificación Post-Despliegue

Después de desplegar, verifica:

1. **Build en Vercel**: 
   - Ve a Vercel Dashboard → Tu proyecto de producción
   - Verifica que el deploy haya sido exitoso

2. **Funcionalidades críticas**:
   - Login/Logout
   - Suscripciones
   - Pagos
   - Telegram (si aplica)
   - Cronjobs

3. **Logs**:
   - Revisa los logs en Vercel para ver si hay errores
   - Verifica que los cronjobs se ejecuten correctamente

## 🔄 Flujo de Trabajo Recomendado

```
1. Desarrollo en Testing
   ↓
2. Commit y Push a testing repo
   ↓
3. Probar en testing-lozanonahuel.vercel.app
   ↓
4. Si todo funciona bien:
   ↓
5. Ejecutar script de deploy
   ↓
6. Verificar en producción
```

## 📝 Notas Importantes

- **NUNCA** hacer push directo a producción sin probar en testing primero
- **SIEMPRE** ejecutar `npm run build` antes de desplegar
- **VERIFICAR** que las variables de entorno estén correctas en producción
- **MANTENER** ambos repositorios sincronizados (testing siempre debe tener los cambios más recientes)

## 🆘 Troubleshooting

### Error: "remote production already exists"

```bash
# Remover el remote existente
git remote remove production

# Agregarlo nuevamente
git remote add production https://github.com/joaquinperez028/landingPageNahuel.git
```

### Error: "Permission denied"

Verifica que tengas permisos de push en el repositorio de producción.

### Error: "Build failed in production"

1. Verifica los logs en Vercel
2. Compara las variables de entorno entre testing y producción
3. Verifica que todas las dependencias estén en `package.json`

---

**Última actualización**: Febrero 2026
