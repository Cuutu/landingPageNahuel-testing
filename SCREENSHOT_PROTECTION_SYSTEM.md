# Sistema de Protección Contra Screenshots

## Descripción
Sistema implementado para proteger información sensible (precios de entrada, precio actual, stop loss, take profit) en las páginas de SMARTMONEY y TRADERCALL cuando los usuarios están suscriptos.

## Componentes Implementados

### 1. ScreenshotProtection.tsx
- **Ubicación**: `components/ScreenshotProtection.tsx`
- **Función**: Componente wrapper que detecta intentos de screenshot y activa protección
- **Características**:
  - Detecta múltiples métodos de captura de pantalla
  - Muestra overlay de protección con mensaje
  - Oculta contenido sensible durante 3 segundos

### 2. ScreenshotProtection.module.css
- **Ubicación**: `components/ScreenshotProtection.module.css`
- **Función**: Estilos CSS para la protección visual
- **Características**:
  - Blur y ocultación de elementos sensibles
  - Overlay de protección con animaciones
  - Prevención de selección de texto en modo protegido

### 3. useScreenshotProtection.ts
- **Ubicación**: `hooks/useScreenshotProtection.ts`
- **Función**: Hook personalizado para manejar la lógica de protección
- **Características**:
  - Detección avanzada de intentos de screenshot
  - Múltiples métodos de detección
  - Logging para debugging

## Métodos de Detección

### 1. Detección de Teclas
- **PrintScreen**: Tecla principal de screenshot
- **Alt + PrintScreen**: Screenshot de ventana activa
- **Ctrl/Cmd + Shift + S**: Screenshot en algunos sistemas
- **F12**: Herramientas de desarrollador
- **Ctrl/Cmd + Shift + I**: Inspector de elementos
- **Ctrl/Cmd + U**: Ver código fuente

### 2. Detección de Herramientas de Desarrollador
- Monitoreo de cambios en dimensiones de ventana
- Detección de apertura de DevTools
- Verificación periódica cada 1 segundo

### 3. Detección de Comportamiento Sospechoso
- Cambios de visibilidad de página
- Selección de texto larga (>100 caracteres)
- Cambios de foco rápidos
- Intentos de drag and drop en elementos sensibles
- Menú contextual en elementos protegidos

## Elementos Protegidos

### Clases CSS Sensibles
- **`.sensitivePrice`**: Precios individuales (entrada, actual, stop loss, take profit)
- **`.alertCard`**: Tarjetas completas de alertas
- **`.sensitiveTable`**: Tablas con datos sensibles
- **`.sensitiveChart`**: Gráficos y métricas

### Páginas Protegidas
- **SMARTMONEY**: `pages/alertas/smart-money.tsx` (solo vista de suscriptor)
- **TRADERCALL**: `pages/alertas/trader-call.tsx` (solo vista de suscriptor)

## Implementación

### 1. Envolvimiento de Vistas
```tsx
{isSubscribed ? (
  <ScreenshotProtection>
    <SubscriberView />
  </ScreenshotProtection>
) : (
  <NonSubscriberView />
)}
```

### 2. Marcado de Elementos Sensibles
```tsx
<strong className="sensitivePrice">{alert.currentPrice}</strong>
<div className={`${styles.alertCard} alertCard`}>
```

## Comportamiento

### Activación de Protección
1. **Detección**: Se detecta intento de screenshot
2. **Activación**: Se activa protección inmediatamente
3. **Duración**: Protección activa por 3 segundos
4. **Restauración**: Contenido vuelve a ser visible

### Efectos Visuales
- **Blur**: Contenido sensible se desenfoca
- **Ocultación**: Texto se reemplaza con "***"
- **Overlay**: Mensaje de protección superpuesto
- **Prevención**: Selección y drag deshabilitados

## Configuración

### Variables de Entorno
- `NODE_ENV`: Para habilitar/deshabilitar logging de debugging

### Personalización
- **Duración**: Cambiar timeout en `ScreenshotProtection.tsx` (línea 3 segundos)
- **Sensibilidad**: Ajustar umbrales en `useScreenshotProtection.ts`
- **Estilos**: Modificar `ScreenshotProtection.module.css`

## Seguridad

### Limitaciones
- No protege contra screenshots de hardware (cámaras externas)
- No protege contra herramientas de captura avanzadas
- No protege contra extensiones de navegador especializadas

### Fortalezas
- Protección contra métodos comunes de screenshot
- Detección de herramientas de desarrollador
- Prevención de selección de texto
- Blur y ocultación visual efectiva

## Testing

### Métodos de Prueba
1. **PrintScreen**: Presionar tecla PrintScreen
2. **Alt + PrintScreen**: Combinación de teclas
3. **F12**: Abrir herramientas de desarrollador
4. **Selección**: Seleccionar texto largo
5. **Menú contextual**: Click derecho en precios

### Verificación
- Contenido debe desenfocarse
- Overlay de protección debe aparecer
- Mensaje "Contenido Protegido" debe mostrarse
- Protección debe durar 3 segundos

## Mantenimiento

### Monitoreo
- Revisar logs de consola en desarrollo
- Verificar que no hay falsos positivos
- Ajustar sensibilidad según necesidad

### Actualizaciones
- Agregar nuevos métodos de detección si es necesario
- Mejorar algoritmos de detección
- Optimizar rendimiento

## Consideraciones de UX

### Experiencia del Usuario
- Protección no interfiere con uso normal
- Mensaje claro cuando se activa
- Restauración automática
- No afecta funcionalidad de la aplicación

### Accesibilidad
- Overlay visible y legible
- Contraste adecuado
- Animaciones suaves
- Compatible con lectores de pantalla
