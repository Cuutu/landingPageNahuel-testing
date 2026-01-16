# Verificación de Ventas AEM y EBAY

## Problema Reportado

Se detectaron discrepancias entre:
- Las ventas registradas en "seguimiento y operaciones"
- El estado de las posiciones (participationPercentage)
- La liquidez liberada

### AEM
- **Ventas registradas**: 50% el 07/01 y 25% el 13/01 (total 75%)
- **Estado actual**: Solo muestra 50% vendido
- **Problema**: Falta liberar la liquidez del 25% adicional

### EBAY
- **Ventas registradas**: 25% el 07/01 y 25% el 14/01 (total 50%)
- **Estado actual**: Muestra menos del 50% vendido
- **Problema**: Discrepancia en el porcentaje vendido

## Cómo Verificar

### 1. Ejecutar el Script de Verificación

```bash
# Desde MongoDB Compass o mongosh
mongosh <connection-string> < scripts/verificar-ventas-aem-ebay.mongosh.js
```

O copiar y pegar el contenido del script directamente en MongoDB Compass.

### 2. Qué Verifica el Script

El script verifica la consistencia entre:

1. **Alerta (Alert)**
   - `participationPercentage` vs ventas parciales registradas
   - `liquidityData.shares` vs shares vendidas
   - `liquidityData.allocatedAmount` vs liquidez liberada

2. **Operaciones (Operations)**
   - Operaciones de venta registradas
   - Shares vendidas en operaciones vs ventas parciales

3. **Liquidez (Liquidity)**
   - Distribución de liquidez
   - Shares en distribución vs shares en alerta
   - Shares vendidas (soldShares) vs ventas parciales

### 3. Interpretar los Resultados

El script mostrará:

- ✅ **Sin discrepancias**: Todo está consistente
- ⚠️ **Discrepancias encontradas**: Se listarán los problemas específicos

#### Tipos de Discrepancias

1. **PARTICIPATION**: El `participationPercentage` no coincide con las ventas parciales
2. **SHARES_ALERT**: Las shares en la alerta no coinciden con las ventas parciales
3. **SHARES_OPERATIONS**: Las operaciones registradas no coinciden con las ventas parciales
4. **LIQUIDITY**: La liquidez liberada no coincide con las ventas parciales

## Posibles Causas

1. **Venta registrada pero no ejecutada**: La venta está en `liquidityData.partialSales` pero `executed: false`
2. **Venta ejecutada pero no actualizada**: La venta está ejecutada pero no se actualizó `participationPercentage`
3. **Operación creada pero venta no registrada**: Hay una operación de venta pero no está en `partialSales`
4. **Error en cálculo de porcentajes**: El porcentaje vendido se calculó incorrectamente

## Cómo Corregir

### Opción 1: Usar el Endpoint de Venta Parcial

Si falta registrar una venta, usar el endpoint `/api/admin/partial-sale` con los datos correctos.

### Opción 2: Script Manual de Corrección

Si hay discrepancias, se puede crear un script de corrección específico basado en los resultados de la verificación.

**IMPORTANTE**: Antes de corregir, hacer un backup de los datos:

```javascript
// Backup de alertas
const aemBackup = db.alerts.findOne({ symbol: 'AEM' });
const ebayBackup = db.alerts.findOne({ symbol: 'EBAY' });

// Guardar en un archivo o colección temporal
```

### Opción 3: Recalcular desde Operaciones

Si las operaciones están correctas pero la alerta no, se puede recalcular:

1. Sumar todas las operaciones de venta
2. Calcular el porcentaje vendido basado en shares originales
3. Actualizar `participationPercentage`
4. Actualizar `liquidityData.shares` y `liquidityData.allocatedAmount`

## Ejemplo de Corrección Manual

```javascript
// Ejemplo para AEM - Corregir participationPercentage
const aemAlert = db.alerts.findOne({ symbol: 'AEM' });
const originalShares = aemAlert.liquidityData.originalShares;
const partialSales = aemAlert.liquidityData.partialSales || [];

// Calcular total vendido desde ventas ejecutadas
let totalSharesSold = 0;
let totalPercentageSold = 0;

partialSales.forEach(sale => {
  if (sale.executed && !sale.discarded) {
    totalSharesSold += sale.sharesToSell || 0;
    totalPercentageSold += sale.percentage || 0;
  }
});

// Calcular nueva participación
const originalParticipation = aemAlert.originalParticipationPercentage || 100;
const newParticipation = Math.max(0, originalParticipation - totalPercentageSold);

// Actualizar alerta
db.alerts.updateOne(
  { _id: aemAlert._id },
  {
    $set: {
      participationPercentage: newParticipation,
      'liquidityData.shares': originalShares - totalSharesSold,
      'liquidityData.allocatedAmount': (originalShares - totalSharesSold) * (aemAlert.entryPrice || 0)
    }
  }
);
```

## Verificación Post-Corrección

Después de corregir, ejecutar nuevamente el script de verificación para confirmar que todo está consistente.

## Contacto

Si hay dudas o problemas, revisar:
- Los logs del servidor para ver si hubo errores durante las ventas
- Las operaciones en la colección `operations`
- El historial de cambios en las alertas
