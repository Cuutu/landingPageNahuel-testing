# Script para comparar repositorios de testing y produccion
# Muestra diferencias y permite elegir que desplegar

Write-Host "Comparando repositorios Testing vs Produccion..." -ForegroundColor Cyan
Write-Host ""

# Verificar que el remote de produccion existe
$remotes = git remote
if ($remotes -notcontains "production") {
    Write-Host "Remote 'production' no encontrado" -ForegroundColor Yellow
    $prodUrl = Read-Host "Ingresa la URL del repositorio de produccion"
    git remote add production $prodUrl
}

# Obtener informacion del remote de produccion
$prodUrl = git remote get-url production
Write-Host "Repositorio de Testing: $(git remote get-url origin)" -ForegroundColor Green
Write-Host "Repositorio de Produccion: $prodUrl" -ForegroundColor Yellow
Write-Host ""

# Fetch del repositorio de produccion para tener la info actualizada
Write-Host "Obteniendo informacion del repositorio de produccion..." -ForegroundColor Cyan
git fetch production 2>&1 | Out-Null

# Obtener el ultimo commit de produccion
$prodCommit = $null
$prodCommitShort = $null
$prodCommitResult = git rev-parse production/main 2>&1
if ($LASTEXITCODE -eq 0) {
    $prodCommit = $prodCommitResult
    $prodCommitShort = git rev-parse --short production/main 2>&1
    Write-Host "Ultimo commit en produccion: $prodCommitShort" -ForegroundColor Green
} else {
    Write-Host "No se pudo obtener el ultimo commit de produccion (puede ser la primera vez)" -ForegroundColor Yellow
}

# Obtener el ultimo commit de testing
$testCommit = git rev-parse HEAD
$testCommitShort = git rev-parse --short HEAD
Write-Host "Ultimo commit en testing: $testCommitShort" -ForegroundColor Green
Write-Host ""

# Comparar commits
if ($prodCommit -ne $null) {
    $commitsAhead = git rev-list --count production/main..HEAD
    $commitsBehind = git rev-list --count HEAD..production/main
    
    Write-Host "Comparacion de commits:" -ForegroundColor Cyan
    Write-Host "   - Commits en testing que NO estan en produccion: $commitsAhead" -ForegroundColor Yellow
    Write-Host "   - Commits en produccion que NO estan en testing: $commitsBehind" -ForegroundColor Yellow
    Write-Host ""
    
    if ($commitsAhead -gt 0) {
        Write-Host "Ultimos commits en testing (no en produccion):" -ForegroundColor Cyan
        git log production/main..HEAD --oneline -20
        Write-Host ""
    }
    
    if ($commitsBehind -gt 0) {
        Write-Host "Hay commits en produccion que no estan en testing:" -ForegroundColor Red
        git log HEAD..production/main --oneline -10
        Write-Host ""
    }
}

# Comparar archivos modificados
Write-Host "Archivos diferentes entre testing y produccion:" -ForegroundColor Cyan
Write-Host ""

$diffFiles = @()
if ($prodCommit -ne $null) {
    $diffFilesRaw = git diff --name-status production/main..HEAD 2>&1
    if ($LASTEXITCODE -eq 0 -and $diffFilesRaw) {
        if ($diffFilesRaw -is [string]) {
            $diffFiles = $diffFilesRaw -split "`n" | Where-Object { $_.Trim() -ne "" }
        } else {
            $diffFiles = $diffFilesRaw | Where-Object { $_ -ne $null -and $_.ToString().Trim() -ne "" }
        }
    }
}

if ($diffFiles.Count -gt 0) {
    # Agrupar por tipo de cambio
    $modified = @()
    $added = @()
    $deleted = @()
    
    foreach ($line in $diffFiles) {
        if ($line -match '^([AMD])\s+(.+)$') {
            $status = $matches[1]
            $file = $matches[2]
            
            switch ($status) {
                'M' { $modified += $file }
                'A' { $added += $file }
                'D' { $deleted += $file }
            }
        } elseif ($line -notmatch '^[AMD]') {
            $added += $line
        }
    }
    
    if ($modified.Count -gt 0) {
        Write-Host "Archivos MODIFICADOS ($($modified.Count)):" -ForegroundColor Yellow
        foreach ($file in $modified) {
            Write-Host "   M  $file" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    if ($added.Count -gt 0) {
        Write-Host "Archivos NUEVOS ($($added.Count)):" -ForegroundColor Green
        foreach ($file in $added) {
            Write-Host "   A  $file" -ForegroundColor Green
        }
        Write-Host ""
    }
    
    if ($deleted.Count -gt 0) {
        Write-Host "Archivos ELIMINADOS ($($deleted.Count)):" -ForegroundColor Red
        foreach ($file in $deleted) {
            Write-Host "   D  $file" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    # Mostrar diferencias especificas de archivos importantes
    Write-Host "Diferencias en archivos clave:" -ForegroundColor Cyan
    Write-Host ""
    
    $importantFiles = @(
        'pages/api/cron/telegram-expulsion.ts',
        'pages/admin/telegram-expulsion.tsx',
        'pages/api/admin/telegram-expulsion.ts',
        'vercel.json',
        'lib/googleAuth.ts'
    )
    
    foreach ($file in $importantFiles) {
        if ($modified -contains $file -or $added -contains $file) {
            Write-Host "Archivo: $file" -ForegroundColor Cyan
            if ($prodCommit -ne $null) {
                $diff = git diff production/main..HEAD -- "$file" 2>&1 | Select-Object -First 30
                if ($diff -and $LASTEXITCODE -eq 0) {
                    Write-Host $diff
                }
            }
            Write-Host ""
        }
    }
} else {
    Write-Host "No hay diferencias entre testing y produccion" -ForegroundColor Green
}

Write-Host ""
Write-Host "Para ver diferencias detalladas de un archivo especifico:" -ForegroundColor Cyan
Write-Host "   git diff production/main..HEAD -- <ruta-del-archivo>" -ForegroundColor Gray
Write-Host ""
Write-Host "Para crear un patch con cambios especificos:" -ForegroundColor Cyan
Write-Host "   git diff production/main..HEAD -- <archivo1> <archivo2> > cambios.patch" -ForegroundColor Gray
