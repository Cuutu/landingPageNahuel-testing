import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API para vincular cuenta de Telegram con cuenta web
 * 
 * GET: Obtener estado de vinculación del usuario
 * POST: Vincular cuenta ingresando el Telegram User ID directamente
 * DELETE: Desvincular cuenta de Telegram
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const user = await User.findOne({ email: session.user.email });
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  if (req.method === 'GET') {
    // Obtener estado de vinculación
    return res.status(200).json({
      success: true,
      isLinked: !!user.telegramUserId,
      telegramUserId: user.telegramUserId || null,
      telegramUsername: user.telegramUsername || null,
      linkedAt: user.telegramLinkedAt || null,
      channelAccess: user.telegramChannelAccess || []
    });

  } else if (req.method === 'POST') {
    // Vincular cuenta con Telegram User ID
    return handleLinkAccount(req, res, user);

  } else if (req.method === 'DELETE') {
    // Desvincular cuenta
    return handleUnlinkAccount(req, res, user);

  } else {
    return res.status(405).json({ error: 'Método no permitido' });
  }
}

/**
 * Vincula la cuenta de Telegram ingresando el User ID directamente
 * El usuario puede obtener su ID usando @userinfobot en Telegram
 */
async function handleLinkAccount(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const { telegramUserId, telegramUsername } = req.body;

    if (!telegramUserId) {
      return res.status(400).json({ 
        error: 'telegramUserId es requerido',
        instructions: 'Puedes obtener tu ID enviando un mensaje a @userinfobot en Telegram'
      });
    }

    const telegramId = Number(telegramUserId);
    if (isNaN(telegramId) || telegramId <= 0) {
      return res.status(400).json({ error: 'El ID de Telegram debe ser un número válido' });
    }

    // Verificar que el telegramUserId no esté ya vinculado a otra cuenta
    const existingUser = await User.findOne({ 
      telegramUserId: telegramId,
      _id: { $ne: user._id }
    });
    
    if (existingUser) {
      return res.status(409).json({
        error: 'Este ID de Telegram ya está vinculado a otra cuenta',
        message: 'Si crees que es un error, contacta al soporte.'
      });
    }

    // Vincular la cuenta
    user.telegramUserId = telegramId;
    user.telegramUsername = telegramUsername || null;
    user.telegramLinkedAt = new Date();
    
    await user.save();

    console.log(`✅ [TELEGRAM] Cuenta vinculada: ${user.email} -> ${telegramId} (@${telegramUsername || 'sin username'})`);

    return res.status(200).json({
      success: true,
      telegramUserId: telegramId,
      telegramUsername: telegramUsername || null,
      linkedAt: user.telegramLinkedAt,
      message: '¡Cuenta de Telegram vinculada exitosamente!'
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error vinculando cuenta:', error);
    return res.status(500).json({ error: 'Error vinculando cuenta' });
  }
}

/**
 * Desvincula la cuenta de Telegram
 */
async function handleUnlinkAccount(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    if (!user.telegramUserId) {
      return res.status(400).json({ error: 'No tienes una cuenta de Telegram vinculada' });
    }

    const oldTelegramId = user.telegramUserId;

    user.telegramUserId = undefined;
    user.telegramUsername = undefined;
    user.telegramLinkedAt = undefined;
    user.telegramChannelAccess = [];
    
    await user.save();

    console.log(`🔓 [TELEGRAM] Cuenta desvinculada: ${user.email} (era ${oldTelegramId})`);

    return res.status(200).json({
      success: true,
      message: 'Cuenta de Telegram desvinculada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM] Error desvinculando cuenta:', error);
    return res.status(500).json({ error: 'Error desvinculando cuenta' });
  }
}

