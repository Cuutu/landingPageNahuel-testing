# Sistema de Copia para Herramientas de TradingView

## Descripción
Sistema implementado en la página de Recursos que permite copiar automáticamente fórmulas y URLs de TradingView al portapapeles con un solo click, mostrando una notificación de confirmación.

## Componentes Implementados

### 1. CopyNotification.tsx
- **Ubicación**: `components/CopyNotification.tsx`
- **Función**: Componente de notificación que muestra confirmación de copia
- **Características**:
  - Animaciones suaves con Framer Motion
  - Auto-cierre después de 3 segundos
  - Diseño moderno con gradientes y efectos
  - Responsive para móviles

### 2. CopyNotification.module.css
- **Ubicación**: `components/CopyNotification.module.css`
- **Función**: Estilos para la notificación de copia
- **Características**:
  - Diseño glassmorphism con backdrop-filter
  - Animaciones de entrada y salida
  - Barra de progreso animada
  - Efectos hover y transiciones

### 3. useCopyToClipboard.ts
- **Ubicación**: `hooks/useCopyToClipboard.ts`
- **Función**: Hook personalizado para manejar la copia al portapapeles
- **Características**:
  - API moderna del navegador (navigator.clipboard)
  - Fallback para navegadores antiguos
  - Manejo de errores
  - Estado de notificación

## Funcionalidad Implementada

### Herramientas de TradingView
Las siguientes herramientas están disponibles para copia:

#### Listas de Seguimiento:
1. **Lista de Seguimiento Wall Street** - URL de TradingView
2. **Lista de Seguimiento Merval** - URL de TradingView

#### Fórmulas:
1. **Fórmula Dólar CCL** - `BCBA:KO*5/NYSE:KO`
2. **Fórmula Acciones en CCL** - `BCBA:ALUA/(BCBA:KO*5/NYSE:KO)`
3. **Fórmula Merval en CCL** - `BCBA:IMV/(BCBA:KO*5/NYSE:KO)`
4. **Fórmula Promedio Índices Wall Street** - `BCBA:IMV/(BCBA:KO*5/NYSE:KO)/SP:SPX`
5. **Fórmula Comparación Merval vs S&P500** - `BCBA:IMV/(BCBA:KO*5/NYSE:KO)/SP:SPX`
6. **Fórmula Comparación Nasdaq vs Dow Jones** - `NASDAQ:NDX/TVC:DJI`

## Comportamiento

### Al hacer click en una tarjeta:
1. **Copia automática** del contenido (fórmula o URL) al portapapeles
2. **Notificación visual** aparece en la esquina superior derecha
3. **Mensaje personalizado** muestra qué se copió
4. **Auto-cierre** después de 3 segundos
5. **Animaciones suaves** para mejor UX

### Indicadores visuales:
- **Icono de copia** en cada tarjeta
- **Texto "Click para copiar"** 
- **Efectos hover** que destacan la interactividad
- **Animaciones de escala** al hacer click

## Implementación Técnica

### Estructura de datos:
```typescript
const tradingViewTools = [
  {
    id: 'unique-id',
    name: 'Nombre de la herramienta',
    type: 'formula' | 'watchlist',
    formula?: 'fórmula-de-tradingview',
    url?: 'url-de-tradingview',
    image: '/path/to/image.png'
  }
];
```

### Función de manejo:
```typescript
const handleToolClick = (tool: any) => {
  if (tool.type === 'formula' && tool.formula) {
    copyToClipboard(tool.formula, tool.name);
  } else if (tool.type === 'watchlist' && tool.url) {
    copyToClipboard(tool.url, tool.name);
  }
};
```

## Compatibilidad

### Navegadores soportados:
- **Chrome/Edge**: API moderna (navigator.clipboard)
- **Firefox**: API moderna (navigator.clipboard)
- **Safari**: API moderna (navigator.clipboard)
- **Navegadores antiguos**: Fallback con document.execCommand

### Contextos seguros:
- **HTTPS**: Funciona completamente
- **HTTP localhost**: Funciona en desarrollo
- **HTTP no-localhost**: Usa fallback

## Estilos CSS

### Indicador de copia:
```css
.copyIndicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.2);
  transition: all 0.2s ease;
}
```

### Efectos hover:
```css
.card:hover .copyIndicator {
  opacity: 1;
  background: rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}
```

## Testing

### Métodos de prueba:
1. **Click en tarjeta de fórmula** - Debe copiar la fórmula
2. **Click en tarjeta de lista** - Debe copiar la URL
3. **Verificar portapapeles** - Pegar en un editor de texto
4. **Notificación** - Debe aparecer y desaparecer automáticamente
5. **Responsive** - Probar en móvil y desktop

### Verificación:
- Contenido se copia correctamente
- Notificación aparece con el nombre correcto
- Auto-cierre funciona
- Animaciones son suaves
- No hay errores en consola

## Mantenimiento

### Agregar nuevas herramientas:
1. Agregar objeto al array `tradingViewTools`
2. Incluir imagen correspondiente en `/public/logos/`
3. Definir tipo (`formula` o `watchlist`)
4. Proporcionar contenido a copiar

### Personalización:
- **Duración de notificación**: Cambiar timeout en `CopyNotification.tsx`
- **Estilos**: Modificar `CopyNotification.module.css`
- **Animaciones**: Ajustar en `CopyNotification.tsx`

## Beneficios

### Para el usuario:
- **Experiencia mejorada** - Un click en lugar de copiar manualmente
- **Feedback visual** - Confirmación clara de la acción
- **Eficiencia** - Acceso rápido a fórmulas y URLs
- **Profesionalismo** - Interfaz moderna y pulida

### Para el desarrollador:
- **Código reutilizable** - Hook y componente reutilizables
- **Fácil mantenimiento** - Estructura clara y organizada
- **Escalabilidad** - Fácil agregar nuevas herramientas
- **Compatibilidad** - Funciona en todos los navegadores
