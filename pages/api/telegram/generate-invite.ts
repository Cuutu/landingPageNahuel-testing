import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramBot from 'node-telegram-bot-api';

/**
 * API para generar link de invitación temporal a canal de Telegram
 * POST: Genera un link de invitación de 1 solo uso que expira en 1 día
 */

// Mapeo de servicios a canales
const CHANNEL_MAP: Record<string, string> = {
  'TraderCall': process.env.TELEGRAM_CHANNEL_TRADERCALL || '',
  'SmartMoney': process.env.TELEGRAM_CHANNEL_SMARTMONEY || '',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { service } = req.body;

    // Validar servicio
    if (!service || !['TraderCall', 'SmartMoney'].includes(service)) {
      return res.status(400).json({ error: 'Servicio inválido. Debe ser TraderCall o SmartMoney' });
    }

    // Verificar que el usuario tenga suscripción activa al servicio
    const activeSub = user.activeSubscriptions?.find(
      (sub: any) => sub.service === service && sub.isActive && new Date(sub.expiryDate) > new Date()
    );

    if (!activeSub && user.role !== 'admin') {
      return res.status(403).json({ 
        error: `No tienes suscripción activa a ${service}. Debes suscribirte primero.` 
      });
    }

    // Verificar que el bot esté configurado
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
      return res.status(500).json({ error: 'Bot de Telegram no configurado' });
    }

    const channelId = CHANNEL_MAP[service];
    if (!channelId) {
      return res.status(500).json({ error: `Canal de Telegram no configurado para ${service}` });
    }

    // Crear instancia del bot
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

    // Calcular fecha de expiración (1 día desde ahora)
    const expireDate = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 1 día en segundos

    // Generar link de invitación
    const inviteLink = await bot.createChatInviteLink(channelId, {
      expire_date: expireDate,
      member_limit: 1, // Solo 1 uso
      name: `${user.email} - ${service} - ${new Date().toISOString().split('T')[0]}`
    });

    console.log(`✅ [TELEGRAM] Link de invitación generado para ${user.email} - ${service}`);

    // Guardar el link en el usuario (opcional, para tracking)
    if (!user.telegramChannelAccess) {
      user.telegramChannelAccess = [];
    }

    // Actualizar o agregar acceso al canal
    const existingAccess = user.telegramChannelAccess.find(
      (access: any) => access.service === service
    );

    if (existingAccess) {
      existingAccess.inviteLink = inviteLink.invite_link;
    } else {
      user.telegramChannelAccess.push({
        service,
        channelId,
        joinedAt: new Date(),
        inviteLink: inviteLink.invite_link
      });
    }

    await user.save();

    return res.status(200).json({
      success: true,
      inviteLink: inviteLink.invite_link,
      expiresAt: new Date(expireDate * 1000).toISOString(),
      message: `Link de invitación generado. Expira en 24 horas y solo puede usarse 1 vez.`,
      service
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error generando link de invitación:', error);
    
    // Manejar errores específicos de Telegram
    if (error.message?.includes('CHAT_ADMIN_REQUIRED')) {
      return res.status(500).json({ 
        error: 'El bot no tiene permisos de administrador en el canal' 
      });
    }
    
    if (error.message?.includes('chat not found')) {
      return res.status(500).json({ 
        error: 'Canal de Telegram no encontrado. Verificar configuración.' 
      });
    }

    return res.status(500).json({ 
      error: 'Error generando link de invitación',
      details: error.message 
    });
  }
}

