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
  price?: number;
  liquidityPercentage?: number;
  soldPercentage?: number;
  profitPercentage?: number;
  profitLoss?: number;
}): string {
  // ✅ DEBUG: Log de los datos recibidos
  console.log('🔍 [TELEGRAM] formatAlertMessage - Datos recibidos:', {
    symbol: alert.symbol,
    action: alert.action,
    entryPrice: alert.entryPrice,
    entryPriceRange: alert.entryPriceRange,
    currentPrice: alert.currentPrice,
    tipoAlerta: (alert as any).tipoAlerta,
    options: options
  });

  const actionEmoji = alert.action === 'BUY' ? '🟢' : '🔴';
  const actionText = alert.action === 'BUY' ? 'COMPRA' : 'VENTA';
  
  // Determinar precio a mostrar
  // ✅ PRIORIDAD: Si hay price en options (venta/cierre), usar ese primero
  let priceDisplay = 'N/A';
  if (options?.price) {
    priceDisplay = `$${options.price.toFixed(2)}`;
    console.log('💰 [TELEGRAM] Usando precio desde options.price (venta/cierre):', priceDisplay);
  } else if (options?.priceRange) {
    priceDisplay = `$${options.priceRange.min.toFixed(2)} - $${options.priceRange.max.toFixed(2)}`;
    console.log('💰 [TELEGRAM] Usando precio desde options.priceRange:', priceDisplay);
  } else if (alert.entryPriceRange?.min && alert.entryPriceRange?.max) {
    priceDisplay = `$${alert.entryPriceRange.min.toFixed(2)} - $${alert.entryPriceRange.max.toFixed(2)}`;
    console.log('💰 [TELEGRAM] Usando precio desde alert.entryPriceRange:', priceDisplay);
  } else if (alert.entryPrice) {
    priceDisplay = `$${alert.entryPrice.toFixed(2)}`;
    console.log('💰 [TELEGRAM] Usando precio desde alert.entryPrice:', priceDisplay);
  } else if (alert.currentPrice) {
    priceDisplay = `$${alert.currentPrice.toFixed(2)}`;
    console.log('💰 [TELEGRAM] Usando precio desde alert.currentPrice:', priceDisplay);
  } else {
    console.warn('⚠️ [TELEGRAM] No se encontró precio válido en la alerta');
  }

  // Construir mensaje
  let message = `${actionEmoji} *${actionText} ${alert.symbol}*\n\n`;
  
  // ✅ NUEVO: Para ventas, mostrar precio de venta; para compras, precio de entrada
  if (alert.action === 'SELL' && options?.price) {
    message += `💰 Precio de Venta: ${priceDisplay}\n`;
    // Mostrar precio de entrada si está disponible
    if (alert.entryPrice) {
      message += `📥 Precio de Entrada: $${alert.entryPrice.toFixed(2)}\n`;
    }
  } else {
    message += `💰 Precio: ${priceDisplay}\n`;
  }
  
  // ✅ NUEVO: Mostrar información de venta parcial si existe
  if (options?.soldPercentage) {
    message += `📊 Porcentaje Vendido: ${options.soldPercentage}%\n`;
  }
  
  // ✅ NUEVO: Mostrar profit/loss si existe
  if (options?.profitPercentage !== undefined) {
    const profitSign = options.profitPercentage >= 0 ? '+' : '';
    message += `📈 Profit/Loss: ${profitSign}${options.profitPercentage.toFixed(2)}%\n`;
  } else if (options?.profitLoss !== undefined) {
    const profitSign = options.profitLoss >= 0 ? '+' : '';
    message += `📈 Profit/Loss: ${profitSign}$${options.profitLoss.toFixed(2)}\n`;
  }
  
  // Solo mostrar TP/SL para compras o si no es una venta
  if (alert.action === 'BUY' || !options?.price) {
    message += `🎯 Take Profit: $${alert.takeProfit.toFixed(2)}\n`;
    message += `🛑 Stop Loss: $${alert.stopLoss.toFixed(2)}\n`;
  }
  
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
    price?: number;
    liquidityPercentage?: number;
    soldPercentage?: number;
    profitPercentage?: number;
    profitLoss?: number;
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
 * Formatea el mensaje de un informe para Telegram
 */
function formatReportMessage(report: any): string {
  // Mapear categoría a nombre del servicio
  const serviceType = report.category === 'smart-money' ? 'SmartMoney' : 
                      report.category === 'trader-call' ? 'TraderCall' : 
                      'General';
  
  // Construir mensaje
  let message = `📰 *Nuevo Informe ${serviceType}*\n\n`;
  message += `*${report.title}*\n\n`;
  
  // Agregar resumen o preview del contenido
  if (report.summary) {
    const summaryPreview = report.summary.length > 300 
      ? report.summary.substring(0, 300) + '...' 
      : report.summary;
    message += `${summaryPreview}\n\n`;
  } else if (report.content) {
    // Limpiar HTML tags para preview
    const textContent = report.content
      .replace(/<[^>]*>/g, '') // Remover tags HTML
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    
    const contentPreview = textContent.length > 300 
      ? textContent.substring(0, 300) + '...' 
      : textContent;
    message += `${contentPreview}\n\n`;
  }
  
  // Agregar información del autor si está disponible
  if (report.author && typeof report.author === 'object' && report.author.name) {
    message += `👤 Autor: ${report.author.name}\n`;
  }
  
  // Formatear fecha de publicación
  const fecha = new Date(report.publishedAt || report.createdAt || new Date());
  const fechaFormateada = fecha.toLocaleString('es-AR', { 
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  message += `📅 ${fechaFormateada}`;
  
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

    // Enviar mensaje de texto
    try {
      await bot.sendMessage(channelId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      console.log(`✅ [TELEGRAM] Mensaje de informe enviado a canal ${serviceType}: ${report.title}`);
    } catch (messageError: any) {
      console.error('❌ [TELEGRAM] Error enviando mensaje de informe:', messageError.message);
      return false;
    }

    // Enviar todas las imágenes del informe
    const imagesToSend: string[] = [];
    
    // Agregar imagen principal si existe
    if (report.thumbnailUrl) {
      imagesToSend.push(report.thumbnailUrl);
    } else if (report.imageUrl) {
      imagesToSend.push(report.imageUrl);
    }
    
    // Agregar imágenes adicionales del array images
    if (report.images && Array.isArray(report.images) && report.images.length > 0) {
      report.images.forEach((img: any) => {
        const imageUrl = img.secure_url || img.url;
        if (imageUrl && !imagesToSend.includes(imageUrl)) {
          imagesToSend.push(imageUrl);
        }
      });
    }
    
    // Enviar cada imagen
    for (let i = 0; i < imagesToSend.length; i++) {
      try {
        const imageUrl = imagesToSend[i];
        const caption = i === 0 
          ? `${report.title} - ${serviceType}` 
          : `${report.title} - Imagen ${i + 1}`;
        
        await bot.sendPhoto(channelId, imageUrl, {
          caption: caption,
          parse_mode: 'Markdown'
        });
        console.log(`✅ [TELEGRAM] Imagen ${i + 1}/${imagesToSend.length} enviada del informe: ${report.title}`);
        
        // Pequeña pausa entre imágenes para evitar rate limiting
        if (i < imagesToSend.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (imageError: any) {
        console.error(`❌ [TELEGRAM] Error enviando imagen ${i + 1} del informe:`, imageError.message);
        // Continuar con las siguientes imágenes aunque una falle
      }
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

