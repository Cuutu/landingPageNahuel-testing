#!/bin/bash

# Script para desplegar cambios de testing a producción
# Uso: ./scripts/deploy-to-production.sh

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue a producción..."
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar que estamos en la rama main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${RED}❌ Error: Debes estar en la rama 'main' para desplegar${NC}"
    echo "Rama actual: $CURRENT_BRANCH"
    exit 1
fi

echo -e "${GREEN}✅ Estás en la rama: $CURRENT_BRANCH${NC}"

# 2. Verificar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}❌ Error: Tienes cambios sin commitear${NC}"
    echo "Por favor, commitea o descarta los cambios antes de desplegar"
    git status
    exit 1
fi

echo -e "${GREEN}✅ No hay cambios sin commitear${NC}"

# 3. Verificar que el remote de producción existe
if ! git remote | grep -q "^production$"; then
    echo -e "${YELLOW}⚠️ Remote 'production' no encontrado${NC}"
    echo "Agregando remote de producción..."
    read -p "Ingresa la URL del repositorio de producción: " PROD_URL
    git remote add production "$PROD_URL"
fi

echo -e "${GREEN}✅ Remote de producción configurado${NC}"

# 4. Ejecutar build para verificar que todo compila
echo ""
echo "🔨 Ejecutando build para verificar que todo compila..."
if npm run build; then
    echo -e "${GREEN}✅ Build exitoso${NC}"
else
    echo -e "${RED}❌ Error en el build. No se puede desplegar.${NC}"
    exit 1
fi

# 5. Mostrar resumen de commits que se van a desplegar
echo ""
echo "📋 Últimos commits que se desplegarán:"
git log production/main..HEAD --oneline -10 || echo "No hay commits nuevos (primera vez?)"

# 6. Confirmación
echo ""
echo -e "${YELLOW}⚠️  ADVERTENCIA: Estás a punto de desplegar a PRODUCCIÓN${NC}"
echo "Repositorio de producción: $(git remote get-url production)"
read -p "¿Estás seguro de continuar? (escribe 'SI' para confirmar): " CONFIRM

if [ "$CONFIRM" != "SI" ]; then
    echo "❌ Despliegue cancelado"
    exit 0
fi

# 7. Hacer push a producción
echo ""
echo "📤 Haciendo push a producción..."
if git push production main; then
    echo ""
    echo -e "${GREEN}✅ ¡Despliegue exitoso!${NC}"
    echo ""
    echo "📝 Próximos pasos:"
    echo "1. Verifica que Vercel detecte el push y despliegue automáticamente"
    echo "2. Revisa los logs en Vercel Dashboard"
    echo "3. Prueba la funcionalidad en producción"
else
    echo -e "${RED}❌ Error al hacer push${NC}"
    exit 1
fi
