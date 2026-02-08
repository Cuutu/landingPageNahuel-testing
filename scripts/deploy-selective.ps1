# Script para desplegar cambios selectivos a produccion
# Permite elegir que archivos desplegar

$ErrorActionPreference = "Stop"

Write-Host "Despliegue Selectivo a Produccion" -ForegroundColor Cyan
Write-Host ""

# Verificar que el remote de produccion existe
$remotes = git remote
if ($remotes -notcontains "production") {
    Write-Host "Remote 'production' no encontrado" -ForegroundColor Yellow
    $prodUrl = Read-Host "Ingresa la URL del repositorio de produccion"
    git remote add production $prodUrl
}

# Fetch del repositorio de produccion
Write-Host "Obteniendo informacion del repositorio de produccion..." -ForegroundColor Cyan
git fetch production 2>&1 | Out-Null

# Obtener archivos diferentes
$diffFiles = @()
try {
    $diffFilesRaw = git diff --name-only production/main..HEAD 2>&1
    if ($LASTEXITCODE -eq 0) {
        if ($diffFilesRaw -is [string]) {
            $diffFiles = $diffFilesRaw -split "`n" | Where-Object { $_.Trim() -ne "" }
        } else {
            $diffFiles = $diffFilesRaw | Where-Object { $_ -ne $null -and $_.ToString().Trim() -ne "" }
        }
    }
} catch {
    Write-Host "No se puede comparar con produccion (puede ser la primera vez)" -ForegroundColor Yellow
    $diffFiles = @()
}

if ($diffFiles.Count -eq 0) {
    Write-Host "No hay diferencias entre testing y produccion" -ForegroundColor Green
    exit 0
}

Write-Host "Archivos diferentes encontrados: $($diffFiles.Count)" -ForegroundColor Cyan
Write-Host ""

# Filtrar archivos que NO queremos desplegar (configurables)
$excludePatterns = @(
    'lib/googleAuth.ts',           # Login de testing
    'pages/auth/signin.tsx',       # Login de testing
    'lib/mux.ts',                  # Si tiene cambios de testing
    '.env*',                       # Variables de entorno
    '*.local',                     # Archivos locales
    'scripts/',                    # TODOS los scripts (MongoDB, debugging, etc.)
    'consulta-',                   # Scripts de consulta
    'mongodb-debug-',             # Scripts de debugging
    '*.md',                        # Documentacion (ANALISIS_*.md, MIGRACION_*.md, etc.)
    'docs/',                       # Carpeta de documentacion
    'pages/api/cron/expire-subscriptions.ts'  # Archivo eliminado
)

# Mostrar archivos excluidos automaticamente
$excludedFiles = @()
$filesToShow = @()

foreach ($file in $diffFiles) {
    $shouldExclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($file -like "*$pattern*") {
            $shouldExclude = $true
            break
        }
    }
    
    if ($shouldExclude) {
        $excludedFiles += $file
    } else {
        $filesToShow += $file
    }
}

if ($excludedFiles.Count -gt 0) {
    Write-Host "Archivos EXCLUIDOS automaticamente (no se desplegaran):" -ForegroundColor Yellow
    foreach ($file in $excludedFiles) {
        Write-Host "   [EXCLUIDO] $file" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($filesToShow.Count -eq 0) {
    Write-Host "Todos los archivos estan excluidos. No hay nada para desplegar." -ForegroundColor Yellow
    exit 0
}

# Mostrar archivos que se pueden desplegar
Write-Host "Archivos que se DESPLEGARAN:" -ForegroundColor Green
$index = 1
$selectedFiles = @()

foreach ($file in $filesToShow) {
    Write-Host "   [$index] $file" -ForegroundColor Green
    $selectedFiles += $file
    $index++
}

Write-Host ""
Write-Host "Estos archivos se desplegaran a produccion" -ForegroundColor Cyan
Write-Host ""

# Confirmacion
$prodUrl = git remote get-url production
Write-Host "ADVERTENCIA: Estas a punto de desplegar a PRODUCCION" -ForegroundColor Yellow
Write-Host "Repositorio: $prodUrl" -ForegroundColor Yellow
Write-Host "Archivos a desplegar: $($selectedFiles.Count)" -ForegroundColor Yellow
$confirm = Read-Host "Continuar? (escribe 'SI' para confirmar)"

if ($confirm -ne "SI") {
    Write-Host "Despliegue cancelado" -ForegroundColor Red
    exit 0
}

# Crear una rama temporal para el deploy
$tempBranch = "deploy-to-prod-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host ""
Write-Host "Creando rama temporal: $tempBranch" -ForegroundColor Cyan

# Guardar el estado actual
$currentBranch = git branch --show-current
git stash push -m "Stash antes de deploy selectivo" 2>&1 | Out-Null

# Crear rama desde produccion
git checkout -b $tempBranch production/main 2>&1 | Out-Null

# Aplicar solo los archivos seleccionados
foreach ($file in $selectedFiles) {
    Write-Host "   Aplicando: $file" -ForegroundColor Gray
    git checkout $currentBranch -- "$file" 2>&1 | Out-Null
}

# Verificar que compile
Write-Host ""
Write-Host "Verificando que compile..." -ForegroundColor Cyan
try {
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build exitoso" -ForegroundColor Green
    } else {
        throw "Build fallo con codigo $LASTEXITCODE"
    }
} catch {
    Write-Host "Error en el build. Revirtiendo cambios..." -ForegroundColor Red
    git checkout $currentBranch
    git branch -D $tempBranch
    git stash pop 2>&1 | Out-Null
    exit 1
}

# Hacer push a produccion
Write-Host ""
Write-Host "Desplegando a produccion..." -ForegroundColor Cyan
try {
    git push production $tempBranch:main
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Despliegue exitoso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Archivos desplegados:" -ForegroundColor Cyan
        foreach ($file in $selectedFiles) {
            Write-Host "   [OK] $file" -ForegroundColor Green
        }
    } else {
        throw "Push fallo con codigo $LASTEXITCODE"
    }
} catch {
    Write-Host "Error al desplegar" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

# Limpiar
Write-Host ""
Write-Host "Limpiando..." -ForegroundColor Cyan
git checkout $currentBranch
git branch -D $tempBranch
git stash pop 2>&1 | Out-Null

Write-Host ""
Write-Host "Proceso completado" -ForegroundColor Green
