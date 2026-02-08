# Script para desplegar SOLO los archivos de Telegram Expulsion
# Despliegue minimo y seguro

$ErrorActionPreference = "Stop"

Write-Host "Despliegue SOLO de funcionalidad Telegram Expulsion" -ForegroundColor Cyan
Write-Host ""

# Archivos especificos a desplegar
# NOTA: vercel.json NO se despliega porque usaremos cronjob.org en produccion
# Solo desplegamos el cronjob principal, los otros archivos (admin) no existen en este repo
$telegramFiles = @(
    'pages/api/cron/telegram-expulsion.ts'
)

Write-Host "Archivos a desplegar:" -ForegroundColor Green
foreach ($file in $telegramFiles) {
    Write-Host "   - $file" -ForegroundColor Green
}
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

# Verificar que los archivos existen y tienen cambios
Write-Host "Verificando archivos..." -ForegroundColor Cyan
$filesToDeploy = @()

# Obtener lista de archivos diferentes entre produccion y HEAD
$allDiffFiles = git diff --name-status production/main..HEAD 2>&1
$modifiedFiles = @()
$newFiles = @()

foreach ($line in $allDiffFiles) {
    if ($line -match '^([AMD])\s+(.+)$') {
        $status = $matches[1]
        $file = $matches[2]
        if ($status -eq 'M' -or $status -eq 'A') {
            if ($status -eq 'M') {
                $modifiedFiles += $file
            } else {
                $newFiles += $file
            }
        }
    }
}

foreach ($file in $telegramFiles) {
    if (Test-Path $file) {
        # Verificar si es archivo nuevo o modificado
        $isNew = $newFiles -contains $file
        $isModified = $modifiedFiles -contains $file
        
        if ($isNew) {
            $filesToDeploy += $file
            Write-Host "   [NUEVO] $file" -ForegroundColor Green
        } elseif ($isModified) {
            $filesToDeploy += $file
            Write-Host "   [MODIFICADO] $file" -ForegroundColor Green
        } else {
            # Verificar si existe en produccion
            $existsInProd = git ls-tree -r --name-only production/main -- "$file" 2>&1
            if ($LASTEXITCODE -eq 0 -and $existsInProd) {
                Write-Host "   [SKIP] $file no tiene cambios" -ForegroundColor Gray
            } else {
                # Archivo nuevo que no fue detectado por git diff (puede pasar)
                $filesToDeploy += $file
                Write-Host "   [NUEVO] $file (forzado)" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   [ERROR] $file no existe localmente" -ForegroundColor Red
    }
}

if ($filesToDeploy.Count -eq 0) {
    Write-Host ""
    Write-Host "No hay cambios para desplegar" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Archivos que se desplegaran: $($filesToDeploy.Count)" -ForegroundColor Cyan
Write-Host ""

# Confirmacion
$prodUrl = git remote get-url production
Write-Host "ADVERTENCIA: Estas a punto de desplegar a PRODUCCION" -ForegroundColor Yellow
Write-Host "Repositorio: $prodUrl" -ForegroundColor Yellow
Write-Host "Archivos a desplegar:" -ForegroundColor Yellow
foreach ($file in $filesToDeploy) {
    Write-Host "   - $file" -ForegroundColor Yellow
}
Write-Host ""
$confirm = Read-Host "Continuar? (escribe 'SI' para confirmar)"

if ($confirm -ne "SI") {
    Write-Host "Despliegue cancelado" -ForegroundColor Red
    exit 0
}

# Crear una rama temporal para el deploy
$tempBranch = "deploy-telegram-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host ""
Write-Host "Creando rama temporal: $tempBranch" -ForegroundColor Cyan

# Guardar el estado actual
$currentBranch = git branch --show-current
$hasStash = $false
try {
    git stash push -m "Stash antes de deploy telegram" 2>&1 | Out-Null
    $hasStash = $true
} catch {
    # No hay cambios para hacer stash
}

# Crear rama desde produccion
Write-Host "Creando rama desde produccion/main..." -ForegroundColor Cyan
$checkoutOutput = git checkout -b $tempBranch production/main 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR al crear rama temporal" -ForegroundColor Red
    git checkout $currentBranch
    if ($hasStash) {
        git stash pop 2>&1 | Out-Null
    }
    exit 1
}

# Aplicar solo los archivos de Telegram
Write-Host ""
Write-Host "Aplicando archivos de Telegram..." -ForegroundColor Cyan
foreach ($file in $filesToDeploy) {
    Write-Host "   Aplicando: $file" -ForegroundColor Gray
    $checkoutFileOutput = git checkout $currentBranch -- "$file" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ERROR al aplicar $file" -ForegroundColor Red
        git checkout $currentBranch 2>&1 | Out-Null
        git branch -D $tempBranch 2>&1 | Out-Null
        if ($hasStash) {
            git stash pop 2>&1 | Out-Null
        }
        exit 1
    }
}

# Verificar que compile
Write-Host ""
Write-Host "Verificando que compile..." -ForegroundColor Cyan
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build exitoso" -ForegroundColor Green
    } else {
        throw "Build fallo con codigo $LASTEXITCODE"
    }
} catch {
    Write-Host "Error en el build. Revirtiendo cambios..." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    git checkout $currentBranch
    git branch -D $tempBranch
    if ($hasStash) {
        git stash pop 2>&1 | Out-Null
    }
    exit 1
}

# Hacer push a produccion
Write-Host ""
Write-Host "Desplegando a produccion..." -ForegroundColor Cyan
try {
    git add .
    git commit -m "Deploy: Funcionalidad Telegram Expulsion" 2>&1 | Out-Null
    
    git push production $tempBranch:main
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Despliegue exitoso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Archivos desplegados:" -ForegroundColor Cyan
        foreach ($file in $filesToDeploy) {
            Write-Host "   [OK] $file" -ForegroundColor Green
        }
    } else {
        throw "Push fallo con codigo $LASTEXITCODE"
    }
} catch {
    Write-Host "Error al desplegar" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

# Limpiar
Write-Host ""
Write-Host "Limpiando..." -ForegroundColor Cyan
git checkout $currentBranch
git branch -D $tempBranch
if ($hasStash) {
    git stash pop 2>&1 | Out-Null
}

Write-Host ""
Write-Host "Proceso completado" -ForegroundColor Green
Write-Host ""
Write-Host "NOTA IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - vercel.json NO fue desplegado (usaras cronjob.org en produccion)" -ForegroundColor Yellow
Write-Host "   - Configura cronjob.org para llamar a:" -ForegroundColor Cyan
Write-Host "     https://lozanonahuel.com/api/cron/telegram-expulsion" -ForegroundColor Cyan
Write-Host "   - Con header: Authorization: Bearer <CRON_SECRET>" -ForegroundColor Cyan
Write-Host "   - Frecuencia: Diario a las 00:00 UTC" -ForegroundColor Cyan
