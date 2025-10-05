# 🧪 Scripts de Prueba para Solución de Pagos

Este directorio contiene scripts para probar la solución de pagos implementada tanto en local como en Vercel.

## 📋 Scripts Disponibles

### 1. **test-monthly-training-payment.js**
Prueba el procesamiento de un pago específico de entrenamiento mensual.

```bash
# Probar en local
node test-monthly-training-payment.js local

# Probar en Vercel
node test-monthly-training-payment.js vercel
```

### 2. **check-monthly-subscriptions-status.js**
Verifica el estado actual de todas las suscripciones mensuales.

```bash
# Verificar en local
node check-monthly-subscriptions-status.js local

# Verificar en Vercel
node check-monthly-subscriptions-status.js vercel
```

### 3. **test-real-subscriptions.js**
Procesa automáticamente todas las suscripciones pendientes reales.

```bash
# Procesar suscripciones reales en local
node test-real-subscriptions.js local

# Procesar suscripciones reales en Vercel
node test-real-subscriptions.js vercel
```

### 4. **test-vercel-endpoints.sh** (Linux/Mac)
Script de bash para probar endpoints en Vercel usando curl.

```bash
bash test-vercel-endpoints.sh
```

### 5. **test-vercel-endpoints.ps1** (Windows)
Script de PowerShell para probar endpoints en Vercel.

```powershell
powershell -ExecutionPolicy Bypass -File test-vercel-endpoints.ps1
```

## 🚀 Cómo Usar

### **Paso 1: Verificar Estado Actual**
```bash
node check-monthly-subscriptions-status.js vercel
```

### **Paso 2: Probar Procesamiento Individual**
```bash
node test-monthly-training-payment.js vercel
```

### **Paso 3: Procesar Todas las Suscripciones Pendientes**
```bash
node test-real-subscriptions.js vercel
```

### **Paso 4: Verificar Estado Final**
```bash
node check-monthly-subscriptions-status.js vercel
```

## 📊 Interpretación de Resultados

### **Estado de Suscripciones:**
- `pending`: Pago pendiente (problema original)
- `completed`: Pago completado (solución funcionando)
- `failed`: Pago fallido
- `refunded`: Pago reembolsado

### **Respuestas del Endpoint:**
- `success: true`: Pago procesado exitosamente
- `success: false`: Error en el procesamiento
- `shouldRetry: true`: El pago está siendo procesado, reintentar

## 🔧 Solución de Problemas

### **Error: "Suscripción no encontrada"**
- Verificar que el `externalReference` sea correcto
- Usar `check-monthly-subscriptions-status.js` para obtener IDs reales

### **Error: "No se encontró pago aprobado"**
- El pago puede estar aún procesándose en MercadoPago
- Reintentar después de unos minutos
- Verificar en el dashboard de MercadoPago

### **Error de conexión**
- Verificar que Vercel esté desplegado
- Verificar que la URL sea correcta
- Verificar conectividad a internet

## 📈 Monitoreo

### **Antes de la Solución:**
```json
{
  "totalSubscriptions": 4,
  "pending": 4,
  "completed": 0
}
```

### **Después de la Solución:**
```json
{
  "totalSubscriptions": 4,
  "pending": 0,
  "completed": 4
}
```

## 🎯 Objetivo

Convertir todas las suscripciones de `paymentStatus: "pending"` a `paymentStatus: "completed"` para que los usuarios tengan acceso real a los entrenamientos.

## 📞 Soporte

Si encuentras problemas:
1. Ejecuta `check-monthly-subscriptions-status.js` para ver el estado actual
2. Revisa los logs de Vercel en el dashboard
3. Verifica que las variables de entorno estén configuradas correctamente
