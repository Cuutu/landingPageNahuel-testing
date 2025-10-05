# Script para probar endpoints en Vercel usando PowerShell
# Ejecutar con: powershell -ExecutionPolicy Bypass -File test-vercel-endpoints.ps1

$VERCEL_URL = "https://lozanonahuel.vercel.app"

Write-Host "🧪 Probando endpoints en Vercel..." -ForegroundColor Green
Write-Host "🌐 URL base: $VERCEL_URL" -ForegroundColor Cyan
Write-Host ""

# Test 1: Verificar estado de suscripciones
Write-Host "📋 Test 1: Verificando estado de suscripciones..." -ForegroundColor Yellow
try {
    $response1 = Invoke-RestMethod -Uri "$VERCEL_URL/api/debug/monthly-subscriptions" -Method GET
    $response1 | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error en Test 1: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Probar procesamiento de pago
Write-Host "🔄 Test 2: Probando procesamiento de pago..." -ForegroundColor Yellow
try {
    $body = @{
        externalReference = "MTS_68e1984cec460c812f3d6bd2_1736021852069"
    } | ConvertTo-Json

    $response2 = Invoke-RestMethod -Uri "$VERCEL_URL/api/payments/process-monthly-training-payment" -Method POST -Body $body -ContentType "application/json"
    $response2 | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error en Test 2: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Verificar que el endpoint existe
Write-Host "🔍 Test 3: Verificando que el endpoint existe..." -ForegroundColor Yellow
try {
    $response3 = Invoke-WebRequest -Uri "$VERCEL_URL/api/payments/process-monthly-training-payment" -Method HEAD
    Write-Host "✅ Endpoint existe - Status: $($response3.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error en Test 3: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "✅ Pruebas completadas" -ForegroundColor Green
