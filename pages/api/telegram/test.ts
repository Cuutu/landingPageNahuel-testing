import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { testTelegramConnection, sendAlertToTelegram } from '@/lib/telegramBot';
import Alert from '@/models/Alert';
import User from '@/models/User';
import dbConnect from '@/lib/mongodb';

interface TelegramTestResponse {
  success?: boolean;
  message?: string;
  error?: string;
  botInfo?: {
    username?: string;
    id?: number;
  };
}

/**
 * API para probar la conexión y envío de mensajes a Telegram (solo admin)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TelegramTestResponse>
) {
  // Permitir tanto GET como POST para facilitar pruebas
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Use GET o POST.' });
  }

  try {
      // Verificar autenticación
      const session = await getServerSession(req, res, authOptions);
      
      if (!session?.user?.email) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
      }

      // Conectar a la base de datos
      await dbConnect();

      // Verificar que el usuario sea admin
      const user = await User.findOne({ email: session.user.email });
      
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Permisos insuficientes. Solo los administradores pueden probar Telegram.' 
        });
      }

    // Test de conexión
    const isConnected = await testTelegramConnection();
    
    if (!isConnected) {
      return res.status(500).json({ 
        success: false,
        error: 'Bot no conectado. Verifica que TELEGRAM_ENABLED=true y TELEGRAM_BOT_TOKEN esté configurado.' 
      });
    }

    // Obtener información del bot
    const { default: TelegramBot } = await import('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
    const botInfo = await bot.getMe();

    // Si se solicita enviar una alerta de prueba
    // Para GET, leer desde query params; para POST, desde body
    const sendTestAlert = req.method === 'GET' 
      ? req.query.sendTestAlert === 'true' 
      : req.body?.sendTestAlert;

    if (sendTestAlert) {
      // Obtener última alerta activa para prueba
      const lastAlert = await Alert.findOne({ status: 'ACTIVE' })
        .sort({ createdAt: -1 })
        .lean();

      if (!lastAlert) {
        return res.status(404).json({ 
          success: false,
          error: 'No hay alertas activas para probar. Crea una alerta primero.' 
        });
      }

      // ✅ DEBUG: Mostrar información de la alerta obtenida
      console.log('🔍 [TELEGRAM TEST] Datos de la alerta obtenida:', {
        _id: (lastAlert as any)._id,
        symbol: (lastAlert as any).symbol,
        action: (lastAlert as any).action,
        tipo: (lastAlert as any).tipo,
        entryPrice: (lastAlert as any).entryPrice,
        entryPriceRange: (lastAlert as any).entryPriceRange,
        currentPrice: (lastAlert as any).currentPrice,
        stopLoss: (lastAlert as any).stopLoss,
        takeProfit: (lastAlert as any).takeProfit,
        tipoAlerta: (lastAlert as any).tipoAlerta,
        precioMinimo: (lastAlert as any).precioMinimo,
        precioMaximo: (lastAlert as any).precioMaximo,
        analysis: (lastAlert as any).analysis?.substring(0, 50),
        date: (lastAlert as any).date,
        createdAt: (lastAlert as any).createdAt,
        chartImage: (lastAlert as any).chartImage ? 'presente' : 'ausente'
      });

      // Enviar alerta de prueba
      const sent = await sendAlertToTelegram(lastAlert as any);

      if (sent) {
        return res.status(200).json({
          success: true,
          message: `Mensaje de prueba enviado exitosamente al canal de ${(lastAlert as any).tipo || 'desconocido'}`,
          botInfo: {
            username: botInfo.username,
            id: botInfo.id
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Error enviando mensaje de prueba. Verifica los logs para más detalles.',
          botInfo: {
            username: botInfo.username,
            id: botInfo.id
          }
        });
      }
    }

    // Solo test de conexión
    return res.status(200).json({
      success: true,
      message: 'Conexión con Telegram exitosa',
      botInfo: {
        username: botInfo.username,
        id: botInfo.id
      }
    });

  } catch (error: any) {
    console.error('❌ Error en test de Telegram:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Error en test de Telegram' 
    });
  }
}

