#!/bin/bash

# Script para probar endpoints en Vercel usando curl
# Ejecutar con: bash test-vercel-endpoints.sh

VERCEL_URL="https://lozanonahuel.vercel.app"

echo "🧪 Probando endpoints en Vercel..."
echo "🌐 URL base: $VERCEL_URL"
echo ""

# Test 1: Verificar estado de suscripciones
echo "📋 Test 1: Verificando estado de suscripciones..."
curl -s "$VERCEL_URL/api/debug/monthly-subscriptions" | jq '.' 2>/dev/null || echo "❌ Error en Test 1"
echo ""

# Test 2: Probar procesamiento de pago (usando ID de ejemplo)
echo "🔄 Test 2: Probando procesamiento de pago..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"externalReference":"MTS_68e1984cec460c812f3d6bd2_1736021852069"}' \
  -s "$VERCEL_URL/api/payments/process-monthly-training-payment" | jq '.' 2>/dev/null || echo "❌ Error en Test 2"
echo ""

# Test 3: Verificar que el endpoint existe
echo "🔍 Test 3: Verificando que el endpoint existe..."
curl -I -s "$VERCEL_URL/api/payments/process-monthly-training-payment" | head -1
echo ""

echo "✅ Pruebas completadas"
