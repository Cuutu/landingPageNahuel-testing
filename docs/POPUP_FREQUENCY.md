# Sistema de Frecuencia de Popup

## 📋 Descripción

El sistema de frecuencia de popup permite controlar cuándo se muestra el popup de suscripción en la landing page, evitando que aparezca constantemente y mejorando la experiencia del usuario.

## 🎯 Características

### Frecuencia Configurable
- **Semanal**: Se muestra cada 7 días (configuración actual)
- **Mensual**: Se puede cambiar a 30 días
- **Personalizable**: Cualquier número de días

### Comportamiento Inteligente
- **Primera visita**: Siempre se muestra
- **Usuarios autenticados**: Nunca se muestra
- **Cierre manual**: No se muestra por 2 semanas adicionales
- **Suscripción exitosa**: No se muestra por 1 semana

## 🔧 Configuración

### Hook `usePopupFrequency`
##
```tsx
const { isVisible: showPopup, closePopupExtended } = usePopupFrequency({
  frequencyDays: 7, // Mostrar cada semana (cambiar a 30 para mensual)
  manualCloseExtraDays: 14, // Si cierra manualmente, no mostrar por 2 semanas más
  delayMs: 3000, // Delay de 3 segundos
  isAuthenticated: !!session
});
```

### Opciones Disponibles

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `frequencyDays` | `number` | `7` | Días entre apariciones del popup |
| `manualCloseExtraDays` | `number` | `14` | Días adicionales si se cierra manualmente |
| `delayMs` | `number` | `3000` | Milisegundos antes de mostrar |
| `isAuthenticated` | `boolean` | `false` | Si el usuario está logueado |

## 📊 Comportamiento por Escenario

### 1. Primera Visita
- ✅ Popup se muestra después de 3 segundos
- 📝 Se guarda la fecha en localStorage

### 2. Visita Recurrente (dentro de 7 días)
- ❌ Popup no se muestra
- 📅 Espera hasta que pasen 7 días

### 3. Usuario Autenticado
- ❌ Popup nunca se muestra
- 🔐 Independiente del localStorage

### 4. Cierre Manual (botón X o overlay)
- ❌ Popup se cierra inmediatamente
- ⏰ No se muestra por 21 días (7 + 14 adicionales)

### 5. Suscripción Exitosa
- ✅ Popup se cierra después de 3 segundos
- ⏰ No se muestra por 7 días

## 🛠 Implementación

### Archivos Modificados

1. **`hooks/usePopupFrequency.ts`**
   - Hook personalizado para manejar la lógica
   - Funciones para cerrar con tiempo extendido
   - Validación de frecuencia

2. **`pages/index.tsx`**
   - Integración del hook
   - Manejo de eventos de cierre
   - Configuración de frecuencia

### localStorage Keys

- `lastPopupDate`: Fecha ISO de la última vez que se mostró el popup

## 🔄 Cambiar Frecuencia

### Para Mensual (30 días)
```tsx
const { isVisible: showPopup, closePopupExtended } = usePopupFrequency({
  frequencyDays: 30, // Cambiar a 30 días
  manualCloseExtraDays: 30, // También extender el tiempo manual
  delayMs: 3000,
  isAuthenticated: !!session
});
```

### Para Personalizado
```tsx
const { isVisible: showPopup, closePopupExtended } = usePopupFrequency({
  frequencyDays: 14, // Cada 2 semanas
  manualCloseExtraDays: 21, // 3 semanas adicionales si cierra manual
  delayMs: 5000, // 5 segundos de delay
  isAuthenticated: !!session
});
```

## 🧪 Testing

### Verificar Funcionamiento

1. **Limpiar localStorage**:
   ```javascript
   localStorage.removeItem('lastPopupDate');
   ```

2. **Simular fecha futura**:
   ```javascript
   const futureDate = new Date();
   futureDate.setDate(futureDate.getDate() + 8); // 8 días adelante
   localStorage.setItem('lastPopupDate', futureDate.toISOString());
   ```

3. **Verificar estado actual**:
   ```javascript
   console.log('Última fecha popup:', localStorage.getItem('lastPopupDate'));
   ```

## 📈 Beneficios

- ✅ **Mejor UX**: No molesta constantemente al usuario
- ✅ **Conversión optimizada**: Aparece en momentos estratégicos
- ✅ **Configurable**: Fácil ajuste según necesidades
- ✅ **Inteligente**: Respeta las preferencias del usuario
- ✅ **Reutilizable**: Hook disponible para otros popups

## 🔮 Futuras Mejoras

- [ ] **A/B Testing**: Diferentes frecuencias por segmento
- [ ] **Analytics**: Tracking de interacciones con popup
- [ ] **Personalización**: Frecuencia basada en comportamiento
- [ ] **Múltiples popups**: Sistema para diferentes tipos de popups 