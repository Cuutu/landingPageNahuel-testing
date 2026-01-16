# Análisis Completo del Flujo de Alertas en Operaciones

## 📋 Resumen Ejecutivo

Este documento analiza todo el tráfico y flujo de datos desde que se crea una alerta (de venta o compra) hasta que se visualiza mediante el botón "Ver alerta" en la tabla de operaciones.

----
## 🔄 Flujo Completo: De la Creación de la Alerta al Botón "Ver Alerta"

### 1. CREACIÓN DE ALERTA (Venta o Compra)

#### 1.1. Endpoint de Creación
- **Ruta**: `POST /api/alerts/create`
- **Archivo**: `pages/api/alerts/create.ts`
- **Permisos**: Solo administradores

#### 1.2. Datos de Entrada (Body Request)
```typescript
{
  symbol: string;              // Símbolo de la acción (ej: "AAPL")
  action: 'BUY' | 'SELL';      // Tipo de acción (Compra o Venta)
  entryPrice?: number;          // Precio de entrada (legacy)
  entryPriceRange?: {           // Rango de precio (nuevo sistema)
    min: number;
    max: number;
  };
  stopLoss: number;
  takeProfit: number;
  analysis?: string;            // Análisis técnico
  date?: Date;
  tipo: 'TraderCall' | 'SmartMoney';
  chartImage?: CloudinaryImage; // Imagen del gráfico
  images?: CloudinaryImage[];   // Imágenes adicionales
  tipoAlerta: 'precio' | 'rango';
  precioMinimo?: number;
  precioMaximo?: number;
  horarioCierre?: string;
  liquidityPercentage?: number;
  liquidityAmount?: number;
  esOperacionHistorica?: boolean;
  fechaEntrada?: string;
  ventasParciales?: Array<{
    fecha: string;
    precio: number;
    porcentajeVendido: number;
  }>;
}
```

#### 1.3. Proceso Interno al Crear Alerta

1. **Validación de Usuario**:
   - Verifica autenticación mediante `getServerSession`
   - Verifica que el usuario tenga rol `admin`

2. **Creación del Documento Alert**:
   - Se guarda en MongoDB usando el modelo `Alert` (`models/Alert.ts`)
   - Se almacenan todos los campos especificados

3. **Creación Automática de Operación de Compra**:
   ```typescript
   // Si es una alerta de COMPRA, automáticamente se crea una operación
   const Operation = OperationModule.default;
   const operation = new Operation({
     ticker: symbol,
     operationType: 'COMPRA',
     quantity: sharesCalculated,
     price: finalPrice || entryPriceRange?.min,
     amount: calculatedAmount,
     date: operationDate,
     alertId: alert._id,  // ⚠️ CLAVE: Se asocia la operación con la alerta
     alertSymbol: symbol,
     system: tipo,
     // ... más campos
   });
   await operation.save();
   ```

4. **Notificaciones**:
   - Se envía a Telegram (si está habilitado) mediante `sendAlertToTelegram()`
   - Se envía email (si está configurado) mediante `createAlertNotification()`

---

### 2. RELACIÓN ENTRE ALERTA Y OPERACIÓN

#### 2.1. Campo Clave: `alertId`
- **En el modelo Operation** (`models/Operation.ts`):
  ```typescript
  alertId: mongoose.Types.ObjectId; // Referencia a la alerta original
  alertSymbol: string;               // Símbolo de la alerta (para búsquedas rápidas)
  ```

- **En el modelo Alert**:
  - No hay referencia directa a operaciones
  - La relación es **uno a muchos**: Una alerta puede tener múltiples operaciones

#### 2.2. Cuándo se Asocia `alertId`
1. **Automáticamente** al crear una alerta de COMPRA → Se crea la operación con `alertId`
2. **Manual** cuando se crea una operación manualmente desde el panel admin

---

### 3. OBTENCIÓN DE OPERACIONES CON ALERTAS

#### 3.1. Endpoint de Listado
- **Ruta**: `GET /api/operations/list?system={TraderCall|SmartMoney}&limit=50&skip=0`
- **Archivo**: `pages/api/operations/list.ts`

#### 3.2. Proceso de Obtención

**Paso 1: Búsqueda de Operaciones**
```typescript
const operations = await Operation.find({ system })
  .sort({ date: -1 })
  .limit(parseInt(limit as string))
  .skip(parseInt(skip as string))
  .populate('alertId', 'symbol action status profit availableForPurchase finalPriceSetAt descartadaAt date createdAt chartImage analysis images entryPrice entryPriceRange currentPrice takeProfit stopLoss');
```

**⚠️ IMPORTANTE**: El `.populate()` obtiene información de la alerta asociada, pero solo los campos especificados en el segundo parámetro.

**Paso 2: Manejo de Alertas No Populadas**
```typescript
// Si el populate falla o la alerta fue eliminada, se busca manualmente
if (op.alertId && typeof op.alertId === 'object' && op.alertId._id) {
  // Usar datos del populate
  alertData = { ... };
} else if (op.alertId) {
  // Buscar manualmente
  const alert = await Alert.findById(alertIdString).select('...');
  alertData = { ... };
}
```

**Paso 3: Construcción de Respuesta**
```typescript
operations: operationsWithAlerts.map(({ operation: op, alertData }) => ({
  _id: op._id,
  ticker: op.ticker,
  operationType: op.operationType,
  // ... campos de la operación
  alert: alertData  // ⚠️ CLAVE: Información de la alerta adjunta
}))
```

#### 3.3. Información de Alerta Incluida en la Respuesta

```typescript
alert: {
  _id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  status: 'ACTIVE' | 'CLOSED' | 'STOPPED' | 'DESESTIMADA' | 'DESCARTADA';
  availableForPurchase?: boolean;
  finalPriceSetAt?: Date;
  descartadaAt?: Date;
  date?: Date;
  createdAt?: Date;
  chartImage?: {
    public_id: string;
    secure_url: string;
    url: string;
  };
  analysis?: string;  // ⚠️ FUNDAMENTO TÉCNICO
  images?: Array<{    // ⚠️ IMÁGENES ADICIONALES
    public_id: string;
    secure_url: string;
    url: string;
    caption?: string;
  }>;
  entryPrice?: number;
  entryPriceRange?: {
    min: number;
    max: number;
  };
  currentPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}
```

---

### 4. FRONTEND: Hook `useOperations`

#### 4.1. Ubicación
- **Archivo**: `hooks/useOperations.ts`

#### 4.2. Función `fetchOperations`
```typescript
const fetchOperations = async (system: 'TraderCall' | 'SmartMoney') => {
  const response = await fetch(`/api/operations/list?system=${system}&limit=${limit}&skip=${skip}`);
  const data = await response.json();
  
  if (data.success) {
    setOperations(data.operations || []);  // ⚠️ Incluye el campo 'alert'
  }
};
```

#### 4.3. Interface de Operación en el Frontend
```typescript
interface Operation {
  // ... campos de operación
  alert?: {
    status: 'ACTIVE' | 'CLOSED' | 'STOPPED' | 'DESESTIMADA' | 'DESCARTADA';
    chartImage?: { secure_url: string; url: string; };
    analysis?: string;
    images?: Array<{ secure_url: string; url: string; caption?: string; }>;
    // ... más campos
  } | null;
}
```

---

### 5. BOTÓN "VER ALERTA" EN LA TABLA

#### 5.1. Ubicación
- **Archivo**: `components/OperationsTable.tsx`
- **Líneas**: ~785-817

#### 5.2. Renderizado Condicional
```typescript
{operation.alertId && operation.alert && (
  <button
    onClick={() => {
      setSelectedAlert(operation.alert);      // ⚠️ Se pasa la alerta completa
      setSelectedOperation(operation);        // ⚠️ Se pasa la operación completa
      setShowAlertModal(true);
    }}
  >
    <Eye className="w-4 h-4" />
    <span>Ver alerta</span>
  </button>
)}
```

**⚠️ IMPORTANTE**: El botón solo aparece si:
1. `operation.alertId` existe (hay una alerta asociada)
2. `operation.alert` existe (el populate funcionó correctamente)

---

### 6. MODAL DE VISUALIZACIÓN DE ALERTA

#### 6.1. Ubicación
- **Archivo**: `components/OperationsTable.tsx`
- **Líneas**: ~1903-2178

#### 6.2. Información Mostrada en el Modal

**Estado del Modal**:
- `selectedAlert`: Objeto con toda la información de la alerta
- `selectedOperation`: Objeto con toda la información de la operación

**Secciones del Modal** (en orden de visualización):

##### 6.2.1. Imagen de la Operación (si existe)
```typescript
{selectedOperation?.image && (
  <div>
    <h3>📸 Imagen de la Operación</h3>
    <img src={selectedOperation.image.secure_url} />
  </div>
)}
```
**Fuente**: `operation.image` (del modelo Operation)

##### 6.2.2. Notas de la Operación (si existen)
```typescript
{selectedOperation?.notes && (
  <div>
    <h3>📝 Notas de la Operación</h3>
    <div>{selectedOperation.notes}</div>
  </div>
)}
```
**Fuente**: `operation.notes` (del modelo Operation)

##### 6.2.3. Gráfico de TradingView
```typescript
{selectedAlert.chartImage && (
  <div>
    <h3>📈 Gráfico de TradingView</h3>
    <img src={selectedAlert.chartImage.secure_url} />
  </div>
)}
```
**Fuente**: `alert.chartImage` (del modelo Alert)
**Nota**: Esta es la imagen principal del gráfico subida al crear la alerta

##### 6.2.4. Fundamento Técnico
```typescript
{selectedAlert.analysis && (
  <div>
    <h3>📝 Fundamento Técnico</h3>
    <div>{selectedAlert.analysis}</div>
  </div>
)}
```
**Fuente**: `alert.analysis` (del modelo Alert)
**Nota**: Este es el análisis técnico proporcionado al crear la alerta

##### 6.2.5. Imágenes Adicionales
```typescript
{selectedAlert.images && selectedAlert.images.length > 0 && (
  <div>
    <h3>📸 Imágenes Adicionales ({selectedAlert.images.length})</h3>
    <div>
      {selectedAlert.images.map((image) => (
        <img src={image.secure_url} alt={image.caption} />
      ))}
    </div>
  </div>
)}
```
**Fuente**: `alert.images` (array del modelo Alert)
**Nota**: Imágenes adicionales subidas al crear la alerta

---

## 📊 Resumen de Información Disponible en "Ver Alerta"

### ✅ Información de la ALERTA (Alert Model)
| Campo | Fuente | Visible en Modal |
|-------|--------|------------------|
| `chartImage` | Alert.chartImage | ✅ Sí - Gráfico principal |
| `analysis` | Alert.analysis | ✅ Sí - Fundamento técnico |
| `images` | Alert.images | ✅ Sí - Galería de imágenes adicionales |
| `symbol` | Alert.symbol | ❌ No (pero disponible en `selectedAlert`) |
| `action` | Alert.action | ❌ No (pero disponible en `selectedAlert`) |
| `entryPrice` | Alert.entryPrice | ❌ No (pero disponible en `selectedAlert`) |
| `entryPriceRange` | Alert.entryPriceRange | ❌ No (pero disponible en `selectedAlert`) |
| `takeProfit` | Alert.takeProfit | ❌ No (pero disponible en `selectedAlert`) |
| `stopLoss` | Alert.stopLoss | ❌ No (pero disponible en `selectedAlert`) |
| `currentPrice` | Alert.currentPrice | ❌ No (pero disponible en `selectedAlert`) |

### ✅ Información de la OPERACIÓN (Operation Model)
| Campo | Fuente | Visible en Modal |
|-------|--------|------------------|
| `image` | Operation.image | ✅ Sí - Imagen de la operación |
| `notes` | Operation.notes | ✅ Sí - Notas de la operación |
| `ticker` | Operation.ticker | ❌ No (pero disponible en `selectedOperation`) |
| `operationType` | Operation.operationType | ❌ No (pero disponible en `selectedOperation`) |
| `price` | Operation.price | ❌ No (pero disponible en `selectedOperation`) |
| `quantity` | Operation.quantity | ❌ No (pero disponible en `selectedOperation`) |

---

## 🔍 Datos NO Mostrados en el Modal (pero disponibles)

### Información Disponible pero No Renderizada
Los siguientes datos están disponibles en `selectedAlert` y `selectedOperation`, pero **NO se muestran en el modal**:

**De la Alerta**:
- `symbol`: Símbolo de la acción
- `action`: Tipo de acción (BUY/SELL)
- `status`: Estado de la alerta
- `entryPrice` / `entryPriceRange`: Precio/rango de entrada
- `currentPrice`: Precio actual
- `takeProfit`: Precio de take profit
- `stopLoss`: Precio de stop loss
- `profit`: Porcentaje de ganancia/pérdida
- `date`: Fecha de creación
- `tipo`: Tipo de servicio (TraderCall/SmartMoney)
- Y muchos otros campos...

**De la Operación**:
- `ticker`: Símbolo
- `operationType`: Tipo (COMPRA/VENTA)
- `price`: Precio de ejecución
- `quantity`: Cantidad de acciones
- `amount`: Monto total
- `date`: Fecha de la operación
- `status`: Estado de la operación
- Y otros campos...

---

## 🚨 Puntos Críticos y Posibles Problemas

### 1. **Alertas No Populadas**
- **Problema**: Si una alerta fue eliminada o el `populate()` falla, el botón "Ver alerta" no aparece
- **Solución actual**: El backend intenta buscar la alerta manualmente si el populate falla

### 2. **Datos Incompletos**
- **Problema**: Si la alerta no tiene `chartImage`, `analysis` o `images`, el modal puede quedar vacío
- **Solución actual**: Se muestra un mensaje indicando que no hay información adicional

### 3. **Operaciones sin Alerta**
- **Problema**: Si una operación fue creada manualmente sin `alertId`, no tendrá botón "Ver alerta"
- **Comportamiento esperado**: Es normal, las operaciones manuales no necesitan alerta

---

## 📝 Recomendaciones para Mejorar la Visualización

### 1. Mostrar Más Información en el Modal
Actualmente el modal solo muestra:
- Imágenes
- Análisis técnico
- Notas

**Sugerencia**: Agregar una sección con información básica:
- Símbolo de la acción
- Tipo de operación (COMPRA/VENTA)
- Precio de entrada
- Precio actual (si está disponible)
- Take Profit y Stop Loss

### 2. Agregar Fecha de Creación
Mostrar cuándo se creó la alerta y cuándo se ejecutó la operación.

### 3. Mostrar Estado de la Alerta
Indicar si la alerta está ACTIVA, CERRADA, DESESTIMADA, etc.

---

## 🔗 Flujo Visual Resumido

```
1. ADMIN crea ALERTA
   ↓
2. Se guarda en MongoDB (collection: alerts)
   ↓
3. Se crea automáticamente OPERACIÓN (si es COMPRA)
   ↓
4. OPERACIÓN tiene campo alertId → referencia a ALERTA
   ↓
5. Usuario abre tabla de OPERACIONES
   ↓
6. Frontend llama a /api/operations/list
   ↓
7. Backend busca OPERACIONES y hace .populate('alertId')
   ↓
8. Backend retorna OPERACIONES con campo 'alert' poblado
   ↓
9. Frontend renderiza tabla con botón "Ver alerta"
   ↓
10. Usuario hace clic en "Ver alerta"
   ↓
11. Se abre MODAL con:
    - Imagen de la operación (si existe)
    - Notas de la operación (si existen)
    - Gráfico de TradingView (de la alerta)
    - Fundamento técnico (de la alerta)
    - Imágenes adicionales (de la alerta)
```

---

## 📌 Conclusión

El botón "Ver alerta" muestra información de **DOS FUENTES**:
1. **De la ALERTA** (Alert Model): Gráficos, análisis técnico, imágenes adicionales
2. **De la OPERACIÓN** (Operation Model): Imágenes de la operación, notas de la operación

La información disponible en el modal es **limitada** y se enfoca principalmente en contenido visual (imágenes) y el análisis técnico. Hay mucha más información disponible en los objetos `selectedAlert` y `selectedOperation` que podría mostrarse para proporcionar un contexto más completo.

