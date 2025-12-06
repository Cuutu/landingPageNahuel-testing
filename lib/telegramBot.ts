import TelegramBot from 'node-telegram-bot-api';
import { IAlert } from '@/models/Alert';

// Inicializar el bot solo si está habilitado
let bot: TelegramBot | null = null;

if (process.env.TELEGRAM_ENABLED === 'true' && process.env.TELEGRAM_BOT_TOKEN) {
  try {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ [TELEGRAM] Bot inicializado correctamente');
  } catch (error) {
    console.error('❌ [TELEGRAM] Error inicializando bot:', error);
  }
} else {
  console.log('ℹ️ [TELEGRAM] Bot deshabilitado o token no configurado');
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
    priceDisplay = `$${options.priceRange.min.toFixed(2)} - $${options.priceRange.max.toFixed(2)}`;
  } else if (alert.entryPriceRange?.min && alert.entryPriceRange?.max) {
    priceDisplay = `$${alert.entryPriceRange.min.toFixed(2)} - $${alert.entryPriceRange.max.toFixed(2)}`;
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
    const analysisPreview = alert.analysis.length > 200 
      ? alert.analysis.substring(0, 200) + '...' 
      : alert.analysis;
    message += `\n📊 Análisis:\n${analysisPreview}\n`;
  }
  
  // Agregar mensaje personalizado si existe
  if (options?.message) {
    message += `\n💬 ${options.message}\n`;
  }
  
  // Formatear fecha en zona horaria de Argentina
  const fecha = new Date(alert.date || alert.createdAt || new Date());
  const fechaFormateada = fecha.toLocaleString('es-AR', { 
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  message += `\n📅 ${fechaFormateada}`;
  
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
    try {
      await bot.sendMessage(channelId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      console.log(`✅ [TELEGRAM] Mensaje enviado a canal ${alert.tipo}: ${alert.symbol}`);
    } catch (messageError: any) {
      console.error('❌ [TELEGRAM] Error enviando mensaje:', messageError.message);
      return false;
    }

    // Si hay imagen, enviarla también
    if (options?.imageUrl) {
      try {
        await bot.sendPhoto(channelId, options.imageUrl, {
          caption: `${alert.action} ${alert.symbol} - ${alert.tipo}`,
          parse_mode: 'Markdown'
        });
        console.log(`✅ [TELEGRAM] Imagen enviada a canal ${alert.tipo}: ${alert.symbol}`);
      } catch (imageError: any) {
        console.error('❌ [TELEGRAM] Error enviando imagen:', imageError.message);
        // Continuar aunque falle la imagen
      }
    }

    return true;

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error enviando alerta a Telegram:', error.message || error);
    return false;
  }
}

/**
 * Verifica la conexión del bot
 */
export async function testTelegramConnection(): Promise<boolean> {
  try {
    if (!bot || process.env.TELEGRAM_ENABLED !== 'true') {
      console.log('⚠️ [TELEGRAM] Bot no configurado');
      return false;
    }

    const botInfo = await bot.getMe();
    console.log('✅ [TELEGRAM] Bot conectado:', botInfo.username);
    return true;
  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error de conexión:', error.message || error);
    return false;
  }
}

