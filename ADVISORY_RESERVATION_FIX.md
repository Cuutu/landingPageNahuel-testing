# Fix: Horarios de Consultorio Financiero - Desaparecer Solo con Pago Aprobado

## Problema Identificado

El sistema de reservas del consultorio financiero tenía un problema crítico: los horarios disponibles desaparecían inmediatamente al hacer la reserva, **antes** de que el pago fuera aprobado por MercadoPago. Esto permitía que usuarios reservaran sin pagar.

## Solución Implementada

### 1. Sistema de Reservas Temporales

Se implementó un sistema de "hold atómico" que:

- **Al iniciar reserva**: Se hace un "hold" temporal de 15 minutos en la fecha
- **Al aprobar pago**: Se confirma la reserva definitivamente
- **Al expirar**: Se libera automáticamente la fecha

### 2. Cambios en la API de Fechas Disponibles

**Archivo**: `pages/api/advisory-dates/[advisoryType].ts`

```typescript
// Antes: Solo excluía fechas con isBooked: true
if (onlyAvailable) {
  query.isBooked = false;
}

// Después: Excluye fechas reservadas Y con reservas temporales activas
if (onlyAvailable) {
  const now = new Date();
  query.$and = [
    { isBooked: false },
    {
      $or: [
        { tempReservationExpiresAt: { $exists: false } },
        { tempReservationExpiresAt: { $lte: now } }
      ]
    }
  ];
}
```

### 3. Limpieza Automática de Reservas Expiradas

**Implementación**: Limpieza automática en tiempo real

- Se ejecuta automáticamente cuando alguien consulta fechas disponibles
- Se ejecuta automáticamente cuando alguien intenta hacer una nueva reserva
- Libera inmediatamente fechas con reservas temporales vencidas
- **No requiere cron job** - es más eficiente y inmediato

### 4. Mejoras en el Frontend

**Archivo**: `pages/asesorias/consultorio-financiero.tsx`

- Filtrado adicional en el cliente para reservas temporales activas
- Refresco automático de fechas después de iniciar pago
- Mejor manejo de estados de reserva

## Flujo Completo

### 1. Usuario Selecciona Fecha
```
Usuario → Selecciona fecha → Frontend muestra fecha
```

### 2. Usuario Inicia Pago
```
Usuario → "Sacar Turno" → API crea checkout MercadoPago
                    ↓
            Hold temporal (15 min) → Fecha desaparece del calendario
```

### 3. Usuario Paga en MercadoPago
```
Usuario → MercadoPago → Pago exitoso → Webhook
```

### 4. Webhook Procesa Pago
```
Webhook → Verifica pago → Confirma reserva → Fecha queda reservada definitivamente
```

### 5. Si Pago Falla o Expira
```
Timeout (15 min) → Limpieza automática → Fecha vuelve a estar disponible
```

## Archivos Modificados

1. **`pages/api/advisory-dates/[advisoryType].ts`**
   - Filtrado mejorado de fechas disponibles
   - Limpieza automática de reservas expiradas

2. **`pages/asesorias/consultorio-financiero.tsx`**
   - Filtrado adicional en frontend
   - Refresco automático de fechas
   - Mejor manejo de estados

3. **Limpieza automática integrada**
   - Se ejecuta automáticamente en consultas de fechas
   - Se ejecuta automáticamente al crear nuevos checkouts
   - No requiere endpoints adicionales

4. **`test-advisory-reservation-flow.js`** (NUEVO)
   - Script de prueba del flujo completo

## Beneficios

✅ **Seguridad**: No se pueden reservar fechas sin pagar
✅ **Experiencia de Usuario**: Fechas desaparecen inmediatamente al iniciar pago
✅ **Robustez**: Limpieza automática de reservas expiradas
✅ **Confiabilidad**: Sistema atómico que previene condiciones de carrera

## Configuración Recomendada

### Variables de Entorno
```env
MERCADOPAGO_ACCESS_TOKEN=tu_token_aqui
NEXTAUTH_URL=https://tu-dominio.com
```

## Pruebas

Para probar el sistema:

```bash
# Instalar dependencias si es necesario
npm install node-fetch

# Ejecutar script de prueba
node test-advisory-reservation-flow.js
```

## Monitoreo

- Revisar logs del webhook de MercadoPago
- Verificar logs de limpieza automática en consultas de fechas
- Verificar que las fechas se liberan correctamente

---

**Fecha**: $(date)
**Autor**: Sistema de Reservas - Consultorio Financiero
**Estado**: ✅ Implementado y Probado
