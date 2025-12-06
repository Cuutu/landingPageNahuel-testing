# Guía de Implementación: Bot de Telegram para Alertas

## 📋 Resumen

Este documento describe cómo implementar un bot de Telegram automatizado que envía notificaciones a canales de Telegram cuando se crea una alerta de compra o venta en cualquier servicio (TraderCall, SmartMoney, etc.).

## 🎯 Objetivo

Cuando se suba una alerta de venta o compra a cualquier servicio de alerta, el bot debe enviar automáticamente una notificación al canal de Telegram correspondiente.

## ✅ ¿Es posible implementarlo desde MongoDB?

**Sí, hay dos enfoques posibles:**

### Enfoque 1: Hook Directo (Recomendado) ⭐
- **Ventaja**: Más simple, más rápido, menos recursos
- **Cómo funciona**: Modificar el código existente para que cuando se crea una alerta, también se envíe a Telegram
- **Ubicación**: En `pages/api/alerts/create.ts` después de crear la alerta, o en `lib/notificationUtils.ts` dentro de `createAlertNotification()`

### Enfoque 2: MongoDB Change Streams
- **Ventaja**: Desacoplado, no requiere modificar código existente
- **Desventaja**: Requiere un proceso separado corriendo constantemente, más complejo
- **Cómo funciona**: Escucha cambios en la colección `alerts` de MongoDB y reacciona automáticamente

**Recomendación**: Usar el **Enfoque 1** porque ya tienen el hook en `createAlertNotification()` y es más eficiente.

---

## 📝 Pasos de Implementación

### Paso 1: Crear el Bot de Telegram

1. Abrir Telegram y buscar `@BotFather`
2. Enviar el comando `/newbot`
3. Seguir las instrucciones para darle un nombre y username al bot
4. **Guardar el TOKEN** que te da BotFather (ejemplo: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Crear los canales de Telegram para cada servicio:
   - Canal para TraderCall (ej: `@tradercall_alertas`)
   - Canal para SmartMoney (ej: `@smartmoney_alertas`)
   - (Agregar más según sea necesario)
6. Agregar el bot como administrador de cada canal
7. Obtener el **Chat ID** de cada canal:
   - Agregar `@userinfobot` al canal
   - El bot te dará el Chat ID (ej: `-1001234567890`)
   - **Guardar los Chat IDs** de cada canal

### Paso 2: Instalar Dependencias

```bash
npm install node-telegram-bot-api
npm install --save-dev @types/node-telegram-bot-api
```

### Paso 3: Configurar Variables de Entorno

Agregar al archivo `.env.local` (y documentar en `.env.example`)

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=tu_token_del_bot
TELEGRAM_CHANNEL_TRADERCALL=-1001234567890
TELEGRAM_CHANNEL_SMARTMONEY=-1001234567891
TELEGRAM_ENABLED=true
```

**Nota**: Los Chat IDs de canales suelen ser números negativos largos.

### Paso 4: Crear el Servicio de Telegram

Crear el archivo `lib/telegramBot.ts`:

```typescript
import TelegramBot from 'node-telegram-bot-api';
import { IAlert } from '@/models/Alert';

// Inicializar el bot solo si está habilitado
let bot: TelegramBot | null = null;

if (process.env.TELEGRAM_ENABLED === 'true' && process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
}

/**
 * Mapeo de tipos de alerta a canales de Telegram
 */
const CHANNEL_MAP: Record<string, string> = {
  'TraderCall': process.env.TELEGRAM_CHANNEL_TRADERCALL || '',
  'SmartMoney': process.env.TELEGRAM_CHANNEL_SMARTMONEY || '',
  // Agregar más servicios según sea necesario
};

/**
 * Formatea el mensaje de la alerta para Telegram
 */
function formatAlertMessage(alert: IAlert, options?: {
  message?: string;
  imageUrl?: string;
  priceRange?: { min: number; max: number };
  liquidityPercentage?: number;
}): string {
  const actionEmoji = alert.action === 'BUY' ? '🟢' : '🔴';
  const actionText = alert.action === 'BUY' ? 'COMPRA' : 'VENTA';
  
  // Determinar precio a mostrar
  let priceDisplay = 'N/A';
  if (options?.priceRange) {
    priceDisplay = `$${options.priceRange.min} - $${options.priceRange.max}`;
  } else if (alert.entryPriceRange?.min && alert.entryPriceRange?.max) {
    priceDisplay = `$${alert.entryPriceRange.min} - $${alert.entryPriceRange.max}`;
  } else if (alert.entryPrice) {
    priceDisplay = `$${alert.entryPrice.toFixed(2)}`;
  } else if (alert.currentPrice) {
    priceDisplay = `$${alert.currentPrice.toFixed(2)}`;
  }

  // Construir mensaje
  let message = `${actionEmoji} *${actionText} ${alert.symbol}*\n\n`;
  message += `💰 Precio: ${priceDisplay}\n`;
  message += `🎯 Take Profit: $${alert.takeProfit.toFixed(2)}\n`;
  message += `🛑 Stop Loss: $${alert.stopLoss.toFixed(2)}\n`;
  
  if (options?.liquidityPercentage) {
    message += `💧 Liquidez: ${options.liquidityPercentage}%\n`;
  }
  
  if (alert.analysis) {
    message += `\n📊 Análisis:\n${alert.analysis.substring(0, 200)}${alert.analysis.length > 200 ? '...' : ''}\n`;
  }
  
  // Agregar mensaje personalizado si existe
  if (options?.message) {
    message += `\n💬 ${options.message}\n`;
  }
  
  message += `\n📅 ${new Date(alert.date).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}`;
  
  return message; 
}

/**
 * Envía una alerta a Telegram
 */
export async function sendAlertToTelegram(
  alert: IAlert,
  options?: {
    message?: string;
    imageUrl?: string;
    priceRange?: { min: number; max: number };
    liquidityPercentage?: number;
  }
): Promise<boolean> {
  try {
    // Verificar que el bot esté habilitado
    if (!bot || process.env.TELEGRAM_ENABLED !== 'true') {
      console.log('⚠️ [TELEGRAM] Bot deshabilitado o no configurado');
      return false;
    }

    // Obtener el canal correspondiente al tipo de alerta
    const channelId = CHANNEL_MAP[alert.tipo];
    
    if (!channelId) {
      console.warn(`⚠️ [TELEGRAM] No hay canal configurado para el tipo de alerta: ${alert.tipo}`);
      return false;
    }

    // Formatear mensaje
    const message = formatAlertMessage(alert, options);

    // Enviar mensaje de texto
    await bot.sendMessage(channelId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    // Si hay imagen, enviarla también
    if (options?.imageUrl) {
      try {
        await bot.sendPhoto(channelId, options.imageUrl, {
          caption: `${alert.action} ${alert.symbol} - ${alert.tipo}`,
          parse_mode: 'Markdown'
        });
      } catch (imageError) {
        console.error('❌ [TELEGRAM] Error enviando imagen:', imageError);
        // Continuar aunque falle la imagen
      }
    }

    console.log(`✅ [TELEGRAM] Alerta enviada a canal ${alert.tipo}: ${alert.symbol}`);
    return true;

  } catch (error) {
    console.error('❌ [TELEGRAM] Error enviando alerta a Telegram:', error);
    return false;
  }
}

/**
 * Verifica la conexión del bot
 */
export async function testTelegramConnection(): Promise<boolean> {
  try {
    if (!bot || process.env.TELEGRAM_ENABLED !== 'true') {
      return false;
    }

    const botInfo = await bot.getMe();
    console.log('✅ [TELEGRAM] Bot conectado:', botInfo.username);
    return true;
  } catch (error) {
    console.error('❌ [TELEGRAM] Error de conexión:', error);
    return false;
  }
}
```

### Paso 5: Integrar con el Sistema de Notificaciones

Modificar `lib/notificationUtils.ts` para agregar la llamada a Telegram:

En la función `createAlertNotification()`, después de crear la notificación en la base de datos, agregar:

```typescript
// ... código existente ...

// Crear la notificación en la base de datos
const notificationDoc = new Notification(notification);
await notificationDoc.save();

console.log(`✅ [ALERT NOTIFICATION] Notificación global creada exitosamente: ${notificationDoc._id}`);

// ✅ NUEVO: Enviar a Telegram
try {
  const { sendAlertToTelegram } = await import('@/lib/telegramBot');
  await sendAlertToTelegram(alert, {
    message: overrides?.message,
    imageUrl: overrides?.imageUrl || notification.metadata?.imageUrl,
    priceRange: overrides?.priceRange || notification.metadata?.priceRange,
    liquidityPercentage: overrides?.liquidityPercentage || notification.metadata?.liquidityPercentage
  });
} catch (telegramError) {
  console.error('❌ [ALERT NOTIFICATION] Error enviando a Telegram:', telegramError);
  // No fallar la notificación si Telegram falla
}

// ... resto del código existente ...
```

### Paso 6: Agregar Endpoint de Prueba (Opcional)

Crear `pages/api/telegram/test.ts` para probar la conexión:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { testTelegramConnection, sendAlertToTelegram } from '@/lib/telegramBot';
import Alert from '@/models/Alert';
import dbConnect from '@/lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar que sea admin
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }

  try {
    await dbConnect();

    // Test de conexión
    const isConnected = await testTelegramConnection();
    if (!isConnected) {
      return res.status(500).json({ error: 'Bot no conectado' });
    }

    // Obtener última alerta para prueba
    const lastAlert = await Alert.findOne({ status: 'ACTIVE' })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastAlert) {
      return res.status(404).json({ error: 'No hay alertas para probar' });
    }

    // Enviar alerta de prueba
    const sent = await sendAlertToTelegram(lastAlert as any);

    return res.status(200).json({
      success: sent,
      message: sent ? 'Mensaje de prueba enviado' : 'Error enviando mensaje'
    });

  } catch (error) {
    console.error('Error en test de Telegram:', error);
    return res.status(500).json({ error: 'Error en test' });
  }
}
```

---

## 🔄 Enfoque Alternativo: MongoDB Change Streams

Si prefieres un enfoque completamente desacoplado, puedes usar MongoDB Change Streams:

### Crear `lib/telegramChangeStream.ts`:

```typescript
import { MongoClient } from 'mongodb';
import { sendAlertToTelegram } from './telegramBot';
import dbConnect from './mongodb';

let changeStream: any = null;

export async function startTelegramChangeStream() {
  try {
    await dbConnect();
    
    const mongoose = require('mongoose');
    const Alert = mongoose.models.Alert;
    
    // Crear Change Stream para la colección de alertas
    changeStream = Alert.watch([
      {
        $match: {
          'operationType': 'insert',
          'fullDocument.status': 'ACTIVE'
        }
      }
    ]);

    changeStream.on('change', async (change: any) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        const alert = change.fullDocument;
        console.log('🔔 [TELEGRAM STREAM] Nueva alerta detectada:', alert.symbol);
        
        try {
          await sendAlertToTelegram(alert);
        } catch (error) {
          console.error('❌ [TELEGRAM STREAM] Error enviando alerta:', error);
        }
      }
    });

    console.log('✅ [TELEGRAM STREAM] Change Stream iniciado');
  } catch (error) {
    console.error('❌ [TELEGRAM STREAM] Error iniciando Change Stream:', error);
  }
}

export function stopTelegramChangeStream() {
  if (changeStream) {
    changeStream.close();
    console.log('🛑 [TELEGRAM STREAM] Change Stream detenido');
  }
}
```

**Nota**: Este enfoque requiere que el proceso esté corriendo constantemente. En Vercel, esto no es ideal porque las funciones serverless no mantienen conexiones persistentes. Por eso recomendamos el Enfoque 1.

---

## 📋 Checklist de Implementación

- [ ] Crear bot en Telegram con BotFather
- [ ] Crear canales de Telegram para cada servicio
- [ ] Obtener Chat IDs de cada canal
- [ ] Agregar variables de entorno
- [ ] Instalar dependencias (`node-telegram-bot-api`)
- [ ] Crear `lib/telegramBot.ts`
- [ ] Modificar `lib/notificationUtils.ts` para integrar Telegram
- [ ] Probar con una alerta de prueba
- [ ] Verificar que los mensajes lleguen correctamente a los canales
- [ ] Documentar en `.env.example`

---

## 🎨 Personalización de Mensajes

Puedes personalizar el formato de los mensajes en la función `formatAlertMessage()` de `lib/telegramBot.ts`:

- Agregar emojis diferentes según el tipo de alerta
- Incluir más información (ganancias, pérdidas, etc.)
- Agregar botones inline con links a la web
- Formatear fechas en zona horaria local

---

## 🔒 Consideraciones de Seguridad

1. **Nunca hardcodear tokens**: Siempre usar variables de entorno
2. **Validar origen**: El bot solo debe enviar mensajes, no recibir comandos públicos
3. **Rate limiting**: Telegram tiene límites de mensajes por segundo (30 mensajes/segundo)
4. **Manejo de errores**: No fallar la creación de alertas si Telegram falla

---

## 🐛 Troubleshooting

### El bot no envía mensajes
- Verificar que `TELEGRAM_ENABLED=true`
- Verificar que el token sea correcto
- Verificar que el bot sea admin del canal
- Verificar que el Chat ID sea correcto (debe ser negativo para canales)

### Error: "Chat not found"
- El bot debe ser administrador del canal
- El Chat ID debe ser el del canal, no del grupo

### Los mensajes no se formatean correctamente
- Verificar que `parse_mode: 'Markdown'` esté configurado
- Escapar caracteres especiales de Markdown (_, *, [, ], etc.)

---

## 📚 Recursos

- [Documentación de node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [API de Telegram Bot](https://core.telegram.org/bots/api)
- [Cómo obtener Chat ID de un canal](https://gist.github.com/mraaroncruz/ba19fd2436f3c89ef4d4e8e5c5e5b5e5)

---

## ✅ Próximos Pasos

Una vez implementado, podrías agregar:
- Notificaciones cuando se actualiza el precio de una alerta
- Notificaciones cuando se cierra una alerta (TP/SL)
- Estadísticas diarias de alertas
- Comandos para consultar alertas activas desde Telegram

