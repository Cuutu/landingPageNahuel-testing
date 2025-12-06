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
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Método no permitido' });
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
    const { sendTestAlert } = req.body;

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

