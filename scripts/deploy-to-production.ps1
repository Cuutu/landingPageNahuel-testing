# Script PowerShell para desplegar cambios de testing a producción
# Uso: .\scripts\deploy-to-production.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando despliegue a producción..." -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que estamos en la rama main
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "❌ Error: Debes estar en la rama 'main' para desplegar" -ForegroundColor Red
    Write-Host "Rama actual: $currentBranch" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Estás en la rama: $currentBranch" -ForegroundColor Green

# 2. Verificar que no hay cambios sin commitear
$status = git status --porcelain
if ($status) {
    Write-Host "❌ Error: Tienes cambios sin commitear" -ForegroundColor Red
    Write-Host "Por favor, commitea o descarta los cambios antes de desplegar"
    git status
    exit 1
}

Write-Host "✅ No hay cambios sin commitear" -ForegroundColor Green

# 3. Verificar que el remote de producción existe
$remotes = git remote
if ($remotes -notcontains "production") {
    Write-Host "⚠️ Remote 'production' no encontrado" -ForegroundColor Yellow
    $prodUrl = Read-Host "Ingresa la URL del repositorio de producción"
    git remote add production $prodUrl
}

$prodUrl = git remote get-url production
Write-Host "✅ Remote de producción configurado: $prodUrl" -ForegroundColor Green

# 4. Ejecutar build para verificar que todo compila
Write-Host ""
Write-Host "🔨 Ejecutando build para verificar que todo compila..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "✅ Build exitoso" -ForegroundColor Green
} catch {
    Write-Host "❌ Error en el build. No se puede desplegar." -ForegroundColor Red
    exit 1
}

# 5. Mostrar resumen de commits que se van a desplegar
Write-Host ""
Write-Host "📋 Últimos commits que se desplegarán:" -ForegroundColor Cyan
try {
    git log production/main..HEAD --oneline -10
} catch {
    Write-Host "No hay commits nuevos (primera vez?)" -ForegroundColor Yellow
}

# 6. Confirmación
Write-Host ""
Write-Host "⚠️  ADVERTENCIA: Estás a punto de desplegar a PRODUCCIÓN" -ForegroundColor Yellow
Write-Host "Repositorio de producción: $prodUrl" -ForegroundColor Yellow
$confirm = Read-Host "¿Estás seguro de continuar? (escribe 'SI' para confirmar)"

if ($confirm -ne "SI") {
    Write-Host "❌ Despliegue cancelado" -ForegroundColor Red
    exit 0
}

# 7. Hacer push a producción
Write-Host ""
Write-Host "📤 Haciendo push a producción..." -ForegroundColor Cyan
try {
    git push production main
    Write-Host ""
    Write-Host "✅ ¡Despliegue exitoso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Próximos pasos:" -ForegroundColor Cyan
    Write-Host "1. Verifica que Vercel detecte el push y despliegue automáticamente"
    Write-Host "2. Revisa los logs en Vercel Dashboard"
    Write-Host "3. Prueba la funcionalidad en producción"
} catch {
    Write-Host "❌ Error al hacer push" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
