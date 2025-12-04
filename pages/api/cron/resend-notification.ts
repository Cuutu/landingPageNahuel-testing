import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { createAlertNotification } from '@/lib/notificationUtils';

/**
 * Endpoint para reenviar notificación de una alerta específica
 * GET /api/cron/resend-notification?symbol=RGTI&type=entry_confirmed
 * 
 * Tipos disponibles:
 * - entry_confirmed: Compra confirmada (rango convertido a precio fijo)
 * - sale_executed: Venta ejecutada
 * - discarded_buy: Compra descartada
 * - discarded_sale: Venta descartada
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { symbol, type } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ success: false, message: 'Falta el parámetro symbol' });
  }

  const notificationType = (type as string) || 'entry_confirmed';

  try {
    await dbConnect();

    console.log(`🔄 Buscando alerta ${symbol} para reenviar notificación tipo: ${notificationType}`);

    // Buscar la alerta más reciente con ese símbolo
    const alert = await Alert.findOne({ 
      symbol: symbol.toUpperCase() 
    }).sort({ createdAt: -1 });

    if (!alert) {
      return res.status(404).json({ 
        success: false, 
        message: `No se encontró alerta para ${symbol}` 
      });
    }

    console.log(`✅ Alerta encontrada:`, {
      symbol: alert.symbol,
      entryPrice: alert.entryPrice,
      status: alert.status,
      tipo: alert.tipo
    });

    // Determinar mensaje según el tipo
    let message = '';
    let title = '';
    const price = alert.entryPrice || alert.currentPrice || 0;

    switch (notificationType) {
      case 'entry_confirmed':
        title = `✅ Compra Confirmada: ${alert.symbol}`;
        message = `✅ Compra confirmada: ${alert.symbol} - La posición está ahora activa con precio de entrada $${price.toFixed(2)}.`;
        break;
      case 'sale_executed':
        title = `✅ Venta Ejecutada: ${alert.symbol}`;
        message = `✅ Venta ejecutada: ${alert.symbol} - Posición cerrada a $${price.toFixed(2)}.`;
        break;
      case 'discarded_buy':
        title = `❌ Compra Descartada: ${alert.symbol}`;
        message = `❌ Compra descartada: ${alert.symbol} - La alerta ha sido cancelada.`;
        break;
      case 'discarded_sale':
        title = `❌ Venta Descartada: ${alert.symbol}`;
        message = `❌ Venta descartada: ${alert.symbol} - La posición sigue ACTIVA sin venta programada.`;
        break;
      default:
        title = `🔔 Notificación: ${alert.symbol}`;
        message = `Notificación manual para ${alert.symbol} a $${price.toFixed(2)}.`;
    }

    // Enviar la notificación
    await createAlertNotification(alert, {
      message: message,
      price: price,
      action: notificationType.includes('sale') ? 'SELL' : 'BUY',
      skipDuplicateCheck: true,
      title: title
    });

    console.log(`✅ Notificación reenviada para ${alert.symbol}`);

    return res.status(200).json({
      success: true,
      message: `Notificación enviada para ${alert.symbol}`,
      details: {
        symbol: alert.symbol,
        type: notificationType,
        title: title,
        price: price
      }
    });

  } catch (error) {
    console.error('❌ Error reenviando notificación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
