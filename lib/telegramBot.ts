import TelegramBot from 'node-telegram-bot-api';
import { IAlert } from '@/models/Alert';
import { getGlobalTimezone } from '@/lib/timeConfig';

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
  price?: number;
  action?: 'BUY' | 'SELL';
  liquidityPercentage?: number;
  soldPercentage?: number;
  profitPercentage?: number;
  profitLoss?: number;
  isExecutedSale?: boolean; // ✅ NUEVO: true = venta ejecutada (16:30), false = venta programada
  isCompleteSale?: boolean; // ✅ NUEVO: true = venta total (100%), false = venta parcial
}): string {
  try {
    // ✅ DEBUG: Log de los datos recibidos
    console.log('🔍 [TELEGRAM] formatAlertMessage - Datos recibidos:', {
      symbol: alert.symbol,
      action: alert.action,
      entryPrice: alert.entryPrice,
      entryPriceRange: alert.entryPriceRange,
      currentPrice: alert.currentPrice,
      tipoAlerta: (alert as any).tipoAlerta,
      takeProfit: alert.takeProfit,
      stopLoss: alert.stopLoss,
      options: options
    });

    // ✅ CORREGIDO: Usar action de options si existe (para ventas), sino usar action de la alerta
    const action = options?.action || alert.action;
    const actionEmoji = action === 'BUY' ? '🟢' : '🔴';
    const actionText = action === 'BUY' ? 'COMPRA' : 'VENTA';
    
    // Determinar precio a mostrar
    // ✅ PRIORIDAD: Si hay price en options (venta/cierre), usar ese primero
    let priceDisplay = 'N/A';
    if (options?.price != null && !isNaN(options.price)) {
      priceDisplay = `$${options.price.toFixed(2)}`;
      console.log('💰 [TELEGRAM] Usando precio desde options.price (venta/cierre):', priceDisplay);
    } else if (options?.priceRange && options.priceRange.min != null && options.priceRange.max != null) {
      priceDisplay = `$${options.priceRange.min.toFixed(2)} - $${options.priceRange.max.toFixed(2)}`;
      console.log('💰 [TELEGRAM] Usando precio desde options.priceRange:', priceDisplay);
    } else if (alert.entryPriceRange?.min != null && alert.entryPriceRange?.max != null) {
      priceDisplay = `$${alert.entryPriceRange.min.toFixed(2)} - $${alert.entryPriceRange.max.toFixed(2)}`;
      console.log('💰 [TELEGRAM] Usando precio desde alert.entryPriceRange:', priceDisplay);
    } else if (alert.entryPrice != null && !isNaN(alert.entryPrice)) {
      priceDisplay = `$${alert.entryPrice.toFixed(2)}`;
      console.log('💰 [TELEGRAM] Usando precio desde alert.entryPrice:', priceDisplay);
    } else if (alert.currentPrice != null && !isNaN(alert.currentPrice)) {
      priceDisplay = `$${alert.currentPrice.toFixed(2)}`;
      console.log('💰 [TELEGRAM] Usando precio desde alert.currentPrice:', priceDisplay);
    } else {
      console.warn('⚠️ [TELEGRAM] No se encontró precio válido en la alerta');
    }

    // Construir mensaje
    // ✅ NUEVO: Si hay mensaje personalizado que indica cierre/venta, usar título apropiado
    let titleAction = actionText;
    let titleEmoji = actionEmoji;
    
    // Detectar si es un cierre de mercado, venta o desestimación desde el mensaje
    if (options?.message) {
      const messageLower = options.message.toLowerCase();
      if (messageLower.includes('alerta desestimada') || messageLower.includes('desestimada')) {
        titleAction = 'DESESTIMADA';
        titleEmoji = '🚫';
      } else if (messageLower.includes('cierre de mercado') || messageLower.includes('cierre')) {
        titleAction = 'CIERRE';
        titleEmoji = '📊';
      } else if (messageLower.includes('venta ejecutada') || messageLower.includes('venta parcial') || messageLower.includes('venta programada') || (messageLower.includes('venta') && !messageLower.includes('compra'))) {
        titleAction = 'VENTA';
        titleEmoji = '🔴';
      }
    }
    
    // ✅ NUEVO: También verificar el status de la alerta directamente
    if (alert.status === 'DESESTIMADA') {
      titleAction = 'DESESTIMADA';
      titleEmoji = '🚫';
    }
    
    let message = `${titleEmoji} *${titleAction} ${alert.symbol}*\n\n`;
    
    // ✅ NUEVO: Para ventas, mostrar precio de venta; para compras, precio de entrada
    if (action === 'SELL' && options?.price != null) {
      message += `💰 Precio de Venta: ${priceDisplay}\n`;
      // Mostrar precio de entrada si está disponible
      if (alert.entryPrice != null && !isNaN(alert.entryPrice)) {
        message += `📥 Precio de Entrada: $${alert.entryPrice.toFixed(2)}\n`;
      }
    } else {
      message += `💰 Precio: ${priceDisplay}\n`;
    }
    
    // ✅ NUEVO: Mostrar información de venta con indicación si es parcial o total
    if (options?.soldPercentage) {
      // Determinar si es venta parcial o total
      const tipoVenta = options.isCompleteSale || options.soldPercentage >= 100 
        ? '🔴 Venta TOTAL' 
        : '🟡 Venta PARCIAL';
      
      // Usar "Porcentaje vendido" si es venta ejecutada (16:30), sino "Porcentaje a vender"
      const textoVenta = options.isExecutedSale 
        ? 'Porcentaje vendido' 
        : 'Porcentaje a vender';
      
      message += `${tipoVenta}\n`;
      message += `📊 ${textoVenta}: ${options.soldPercentage}%\n`;
      
      // ✅ NUEVO: Mostrar rendimiento aproximado prominentemente para ventas
      if (options?.profitPercentage != null && !isNaN(options.profitPercentage)) {
        const profitSign = options.profitPercentage >= 0 ? '+' : '';
        const profitEmoji = options.profitPercentage >= 0 ? '💰' : '📉';
        // Usar "Rendimiento aproximado" para ventas programadas, "Rendimiento" para ejecutadas
        const textoRendimiento = options.isExecutedSale 
          ? 'Rendimiento' 
          : 'Rendimiento aproximado';
        message += `${profitEmoji} *${textoRendimiento}: ${profitSign}${options.profitPercentage.toFixed(2)}%*\n`;
      }
    } else {
      // ✅ Mostrar profit/loss genérico si no es una venta con porcentaje
      if (options?.profitPercentage != null && !isNaN(options.profitPercentage)) {
        const profitSign = options.profitPercentage >= 0 ? '+' : '';
        const profitEmoji = options.profitPercentage >= 0 ? '💰' : '📉';
        message += `${profitEmoji} Profit/Loss: ${profitSign}${options.profitPercentage.toFixed(2)}%\n`;
      } else if (options?.profitLoss != null && !isNaN(options.profitLoss)) {
        const profitSign = options.profitLoss >= 0 ? '+' : '';
        const profitEmoji = options.profitLoss >= 0 ? '💰' : '📉';
        message += `${profitEmoji} Profit/Loss: ${profitSign}$${options.profitLoss.toFixed(2)}\n`;
      }
    }
    
    // ✅ ELIMINADO: Take Profit y Stop Loss ya no se muestran en las alertas de Telegram
    
    if (options?.liquidityPercentage) {
      message += `💧 Liquidez: ${options.liquidityPercentage}%\n`;
    }
    
    if (alert.analysis && !options?.message) {
      const analysisPreview = alert.analysis.length > 200 
        ? alert.analysis.substring(0, 200) + '...' 
        : alert.analysis;
      message += `\n📊 Análisis:\n${analysisPreview}\n`;
    }
    
    // ✅ Agregar mensaje personalizado si existe (tiene prioridad sobre análisis)
    if (options?.message) {
      message += `\n💬 ${options.message}\n`;
    }
    
    // ✅ NUEVO: Para alertas desestimadas, mostrar motivo si está disponible
    if (alert.status === 'DESESTIMADA' && (alert as any).desestimacionMotivo) {
      message += `\n📋 Motivo: ${(alert as any).desestimacionMotivo}\n`;
    }
    
    // ✅ CORREGIDO: Usar la hora actual del momento de envío y la zona horaria de la variable de entorno
    const fechaActual = new Date(); // Hora del momento de envío de la alerta
    const zonaHoraria = getGlobalTimezone(); // Usar zona horaria de la variable de entorno
    
    const fechaFormateada = fechaActual.toLocaleString('es-AR', { 
      timeZone: zonaHoraria,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    message += `\n📅 ${fechaFormateada}`;
    
    return message;
  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error formateando mensaje:', error);
    console.error('❌ [TELEGRAM] Stack:', error.stack);
    // Retornar mensaje básico en caso de error
    const fallbackAction = options?.action || alert.action;
    return `${fallbackAction === 'BUY' ? '🟢' : '🔴'} *${fallbackAction} ${alert.symbol}*\n\n` +
           `💰 Precio: ${options?.price || alert.entryPrice || alert.currentPrice || 'N/A'}\n` +
           (options?.message ? `\n💬 ${options.message}\n` : '');
  }
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
    price?: number;
    action?: 'BUY' | 'SELL';
    liquidityPercentage?: number;
    soldPercentage?: number;
    profitPercentage?: number;
    profitLoss?: number;
    isExecutedSale?: boolean; // ✅ NUEVO: true = venta ejecutada (16:30), false = venta programada
    isCompleteSale?: boolean; // ✅ NUEVO: true = venta total (100%), false = venta parcial
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

    // ✅ NUEVO: Si hay imagen, enviar foto con mensaje como caption (unificado en un solo envío)
    if (options?.imageUrl) {
      try {
        // Telegram tiene un límite de 1024 caracteres para caption de fotos
        // Si el mensaje es muy largo, lo truncamos y añadimos indicador
        const maxCaptionLength = 1024;
        let caption = message;
        
        if (message.length > maxCaptionLength) {
          caption = message.substring(0, maxCaptionLength - 50) + '\n\n... (mensaje truncado)';
        }
        
        await bot.sendPhoto(channelId, options.imageUrl, {
          caption: caption,
          parse_mode: 'Markdown'
        });
        console.log(`✅ [TELEGRAM] Foto con mensaje enviada a canal ${alert.tipo}: ${alert.symbol}`);
        return true;
      } catch (imageError: any) {
        console.error('❌ [TELEGRAM] Error enviando foto con mensaje:', imageError.message);
        // Si falla la foto, intentar enviar solo el mensaje de texto
        console.log('🔄 [TELEGRAM] Intentando enviar solo mensaje de texto como fallback...');
      }
    }

    // Enviar solo mensaje de texto (si no hay imagen o si falló el envío de la foto)
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

    return true;

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error enviando alerta a Telegram:', error.message || error);
    return false;
  }
}

/**
 * Formatea el mensaje de un informe para Telegram (solo título y link)
 */
function formatReportMessage(report: any): string {
  // Mapear categoría a nombre del servicio
  const serviceType = report.category === 'smart-money' ? 'SmartMoney' : 
                      report.category === 'trader-call' ? 'TraderCall' : 
                      'General';
  
  // Obtener ID del informe
  const reportId = report._id?.toString() || report.id?.toString();
  
  // Construir URL del informe usando NEXTAUTH_URL
  const baseUrl = process.env.NEXTAUTH_URL || 'https://lozanonahuel.com';
  const reportUrl = `${baseUrl}/reports/${reportId}`;
  
  // Construir mensaje simple con título y link
  let message = `📰 *Nuevo Informe ${serviceType}*\n\n`;
  message += `*${report.title}*\n\n`;
  message += `🔗 [Ver informe completo](${reportUrl})`; 
  
  return message;
}

/**
 * Envía un informe a Telegram
 */
export async function sendReportToTelegram(report: any): Promise<boolean> {
  try {
    // Verificar que el bot esté habilitado
    if (!bot || process.env.TELEGRAM_ENABLED !== 'true') {
      console.log('⚠️ [TELEGRAM] Bot deshabilitado o no configurado');
      return false;
    }

    // Mapear categoría del informe al canal correspondiente
    let channelId = '';
    let serviceType = 'TraderCall';
    
    if (report.category === 'smart-money') {
      channelId = process.env.TELEGRAM_CHANNEL_SMARTMONEY || '';
      serviceType = 'SmartMoney';
    } else if (report.category === 'trader-call') {
      channelId = process.env.TELEGRAM_CHANNEL_TRADERCALL || '';
      serviceType = 'TraderCall';
    } else {
      // Si no tiene categoría específica, usar TraderCall por defecto
      channelId = process.env.TELEGRAM_CHANNEL_TRADERCALL || '';
    }
    
    if (!channelId) {
      console.warn(`⚠️ [TELEGRAM] No hay canal configurado para la categoría: ${report.category}`);
      return false;
    }

    // Formatear mensaje
    const message = formatReportMessage(report);

    // ✅ NUEVO: Crear botón inline para ir al informe
    const baseUrl = process.env.NEXTAUTH_URL || 'https://lozanonahuel.com';
    const reportId = report._id?.toString() || report.id?.toString();
    const reportUrl = `${baseUrl}/reports/${reportId}`;
    
    const inlineKeyboard = [
      [
        {
          text: '📰 Leer Informe',
          url: reportUrl
        }
      ]
    ];
    
    // Enviar mensaje de texto con el link y botón (sin imágenes)
    try {
      await bot.sendMessage(channelId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false, // Habilitar preview para que se vea el link
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
      console.log(`✅ [TELEGRAM] Mensaje de informe enviado a canal ${serviceType}: ${report.title} con botón`);
    } catch (messageError: any) {
      console.error('❌ [TELEGRAM] Error enviando mensaje de informe:', messageError.message);
      return false;
    }

    return true;

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error enviando informe a Telegram:', error.message || error);
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

/**
 * ✅ NUEVO: Envía un mensaje de texto a un canal específico
 * Usado para enviar resúmenes consolidados de operaciones
 */
export async function sendMessageToChannel(
  tipoAlerta: string, 
  mensaje: string, 
  options?: {
    inlineKeyboard?: TelegramBot.InlineKeyboardButton[][];
  }
): Promise<boolean> {
  try {
    if (!bot || process.env.TELEGRAM_ENABLED !== 'true') {
      console.log('⚠️ [TELEGRAM] Bot no habilitado, mensaje no enviado');
      return false;
    }

    const channelId = CHANNEL_MAP[tipoAlerta];
    if (!channelId) {
      console.log(`⚠️ [TELEGRAM] No hay canal configurado para ${tipoAlerta}`);
      return false;
    }

    const messageOptions: TelegramBot.SendMessageOptions = {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    };

    // Agregar botones inline si se proporcionan
    if (options?.inlineKeyboard && options.inlineKeyboard.length > 0) {
      messageOptions.reply_markup = {
        inline_keyboard: options.inlineKeyboard
      };
    }

    await bot.sendMessage(channelId, mensaje, messageOptions);

    console.log(`✅ [TELEGRAM] Mensaje enviado a canal ${tipoAlerta}`);
    return true;
  } catch (error: any) {
    console.error(`❌ [TELEGRAM] Error enviando mensaje:`, error.message || error);
    return false;
  }
}

