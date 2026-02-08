#!/bin/bash

# Script para comparar repositorios de testing y producción
# Muestra diferencias y permite elegir qué desplegar

set -e

echo "🔍 Comparando repositorios Testing vs Producción..."
echo ""

# Verificar que el remote de producción existe
if ! git remote | grep -q "^production$"; then
    echo "⚠️ Remote 'production' no encontrado"
    read -p "Ingresa la URL del repositorio de producción: " PROD_URL
    git remote add production "$PROD_URL"
fi

# Obtener información del remote de producción
PROD_URL=$(git remote get-url production)
echo "📦 Repositorio de Testing: $(git remote get-url origin)"
echo "📦 Repositorio de Producción: $PROD_URL"
echo ""

# Fetch del repositorio de producción
echo "📥 Obteniendo información del repositorio de producción..."
git fetch production 2>/dev/null || true

# Obtener el último commit de producción
if git rev-parse production/main >/dev/null 2>&1; then
    PROD_COMMIT_SHORT=$(git rev-parse --short production/main)
    echo "✅ Último commit en producción: $PROD_COMMIT_SHORT"
else
    echo "⚠️ No se pudo obtener el último commit de producción (puede ser la primera vez)"
    PROD_COMMIT=""
fi

# Obtener el último commit de testing
TEST_COMMIT_SHORT=$(git rev-parse --short HEAD)
echo "✅ Último commit en testing: $TEST_COMMIT_SHORT"
echo ""

# Comparar commits
if [ -n "$PROD_COMMIT" ]; then
    COMMITS_AHEAD=$(git rev-list --count production/main..HEAD 2>/dev/null || echo "0")
    COMMITS_BEHIND=$(git rev-list --count HEAD..production/main 2>/dev/null || echo "0")
    
    echo "📊 Comparación de commits:"
    echo "   - Commits en testing que NO están en producción: $COMMITS_AHEAD"
    echo "   - Commits en producción que NO están en testing: $COMMITS_BEHIND"
    echo ""
    
    if [ "$COMMITS_AHEAD" -gt 0 ]; then
        echo "📋 Últimos commits en testing (no en producción):"
        git log production/main..HEAD --oneline -20
        echo ""
    fi
    
    if [ "$COMMITS_BEHIND" -gt 0 ]; then
        echo "⚠️ Hay commits en producción que no están en testing:"
        git log HEAD..production/main --oneline -10
        echo ""
    fi
fi

# Comparar archivos modificados
echo "📁 Archivos diferentes entre testing y producción:"
echo ""

if [ -n "$PROD_COMMIT" ]; then
    DIFF_FILES=$(git diff --name-status production/main..HEAD)
else
    DIFF_FILES=$(git ls-files)
fi

if [ -n "$DIFF_FILES" ]; then
    echo "$DIFF_FILES" | while IFS= read -r line; do
        if [[ $line =~ ^([AMD])\s+(.+)$ ]]; then
            STATUS="${BASH_REMATCH[1]}"
            FILE="${BASH_REMATCH[2]}"
            
            case "$STATUS" in
                M) echo "   ✏️  MODIFICADO: $FILE" ;;
                A) echo "   ➕ NUEVO: $FILE" ;;
                D) echo "   ❌ ELIMINADO: $FILE" ;;
            esac
        fi
    done
    
    echo ""
    echo "🔍 Diferencias en archivos clave:"
    echo ""
    
    IMPORTANT_FILES=(
        "pages/api/cron/telegram-expulsion.ts"
        "pages/admin/telegram-expulsion.tsx"
        "pages/api/admin/telegram-expulsion.ts"
        "vercel.json"
        "lib/googleAuth.ts"
    )
    
    for file in "${IMPORTANT_FILES[@]}"; do
        if echo "$DIFF_FILES" | grep -q "$file"; then
            echo "📄 $file"
            if [ -n "$PROD_COMMIT" ]; then
                git diff production/main..HEAD -- "$file" | head -30
            fi
            echo ""
        fi
    done
    
else
    echo "✅ No hay diferencias entre testing y producción"
fi

echo ""
echo "💡 Para ver diferencias detalladas de un archivo específico:"
echo "   git diff production/main..HEAD -- <ruta-del-archivo>"
echo ""
echo "💡 Para crear un patch con cambios específicos:"
echo "   git diff production/main..HEAD -- <archivo1> <archivo2> > cambios.patch"
