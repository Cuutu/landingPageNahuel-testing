# 🔍 Guía de Comparación de Repositorios

Esta guía te ayuda a comparar los repositorios de **testing** y **producción** para decidir qué cambios desplegar.

## 🚀 Uso Rápido

### Comparar repositorios:

**Windows (PowerShell):**
```powershell
.\scripts\compare-repos.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/compare-repos.sh
./scripts/compare-repos.sh
```

## 📊 Qué muestra el script

1. **Últimos commits** en cada repositorio
2. **Archivos diferentes** entre testing y producción
3. **Diferencias detalladas** en archivos clave
4. **Commits** que están en testing pero no en producción

## 🎯 Despliegue Selectivo

Si querés desplegar solo algunos archivos específicos:

### Opción 1: Script Automatizado

```powershell
.\scripts\deploy-selective.ps1
```

Este script:
- ✅ Excluye automáticamente archivos de testing (login, etc.)
- ✅ Muestra solo los archivos que se pueden desplegar
- ✅ Te permite confirmar antes de desplegar
- ✅ Verifica que compile antes de desplegar

### Opción 2: Manual con Git

```bash
# 1. Ver diferencias de un archivo específico
git diff production/main..HEAD -- pages/api/cron/telegram-expulsion.ts

# 2. Crear un patch con cambios específicos
git diff production/main..HEAD -- pages/api/cron/telegram-expulsion.ts vercel.json > cambios-telegram.patch

# 3. Aplicar el patch en producción (desde el repo de producción)
git apply cambios-telegram.patch
```

## 📝 Archivos que NO se deben desplegar

Por defecto, el script excluye:

- `lib/googleAuth.ts` - Login de testing
- `pages/auth/signin.tsx` - Login de testing  
- `.env*` - Variables de entorno
- `scripts/make-admin*` - Scripts de testing

## 🔧 Personalizar exclusiones

Editá `scripts/deploy-selective.ps1` y modificá el array `$excludePatterns`:

```powershell
$excludePatterns = @(
    'lib/googleAuth.ts',           # Login de testing
    'pages/auth/signin.tsx',       # Login de testing
    'lib/mux.ts',                  # Si tiene cambios de testing
    # Agregá más patrones aquí
)
```

## 📋 Ejemplo de Uso

```powershell
# 1. Comparar repositorios
.\scripts\compare-repos.ps1

# Salida:
# 📦 Repositorio de Testing: https://github.com/Cuutu/landingPageNahuel-testing.git
# 📦 Repositorio de Producción: https://github.com/joaquinperez028/landingPageNahuel.git
# 
# ✅ Último commit en producción: abc1234
# ✅ Último commit en testing: def5678
# 
# 📊 Comparación de commits:
#    - Commits en testing que NO están en producción: 5
# 
# 📁 Archivos diferentes:
#    ✏️  MODIFICADO: pages/api/cron/telegram-expulsion.ts
#    ➕ NUEVO: pages/admin/telegram-expulsion.tsx
#    ✏️  MODIFICADO: vercel.json
#    ✏️  MODIFICADO: lib/googleAuth.ts  ← Este NO queremos desplegar

# 2. Desplegar solo los cambios de Telegram
.\scripts\deploy-selective.ps1

# El script excluirá automáticamente lib/googleAuth.ts
# Y desplegará solo:
# - pages/api/cron/telegram-expulsion.ts
# - pages/admin/telegram-expulsion.tsx
# - vercel.json
```

## 🆘 Troubleshooting

### Error: "fatal: ambiguous argument 'production/main'"

El repositorio de producción no tiene la rama `main` o no se puede acceder.

**Solución:**
```bash
# Verificar qué ramas tiene producción
git ls-remote --heads production

# Si usa otra rama (ej: master), ajustar el script
```

### Error: "Permission denied"

No tenés permisos de push en el repositorio de producción.

**Solución:** Verificar permisos en GitHub o usar un token de acceso personal.

---

**Última actualización**: Febrero 2026
