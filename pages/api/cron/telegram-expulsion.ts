import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramBot from 'node-telegram-bot-api';

/**
 * Cronjob para expulsar usuarios de canales de Telegram
 * cuando su suscripción ha expirado.
 * 
 * Ejecutar diariamente a las 00:00 o cada X horas
 * 
 * En Vercel: Configurar en vercel.json como cron
 * {
 *   "crons": [{
 *     "path": "/api/cron/telegram-expulsion",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */

// Mapeo de servicios a canales
const CHANNEL_MAP: Record<string, string> = {
  'TraderCall': process.env.TELEGRAM_CHANNEL_TRADERCALL || '',
  'SmartMoney': process.env.TELEGRAM_CHANNEL_SMARTMONEY || '',
};

interface ExpulsionResult {
  userId: string;
  email: string;
  telegramUserId: number;
  service: string;
  success: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autorización del cron
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret as string; // Secret en URL para cronjob.org
  const cronSecret = process.env.CRON_SECRET;
  
  // Permitir ejecución si:
  // 1. Viene de Vercel Cron (header de Vercel)
  // 2. Tiene el secret correcto en header Authorization
  // 3. Tiene el secret correcto en query string (?secret=xxx) - para cronjob.org
  // 4. Es una llamada local en desarrollo
  // 5. NO hay CRON_SECRET configurado (permite acceso libre - NO RECOMENDADO en producción)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasValidHeaderSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasValidQuerySecret = cronSecret && querySecret === cronSecret;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const noCronSecretConfigured = !cronSecret; // Si no hay secret configurado, permitir acceso
  
  if (!isVercelCron && !hasValidHeaderSecret && !hasValidQuerySecret && !isDevelopment && !noCronSecretConfigured) {
    console.log('⚠️ [TELEGRAM EXPULSION] Acceso no autorizado');
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  if (noCronSecretConfigured) {
    console.log('⚠️ [TELEGRAM EXPULSION] CRON_SECRET no configurado - acceso sin autenticación');
  }

  console.log('🚀 [TELEGRAM EXPULSION] Iniciando cronjob de expulsión...');

  try {
    // Verificar que el bot esté configurado
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
      console.log('⚠️ [TELEGRAM EXPULSION] Bot de Telegram no configurado');
      return res.status(200).json({ 
        success: true, 
        message: 'Bot de Telegram no configurado',
        expelled: 0 
      });
    }

    await dbConnect();

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    const now = new Date();
    const results: ExpulsionResult[] = [];

    // Buscar usuarios con Telegram vinculado que tengan suscripciones expiradas
    // o que ya no tengan suscripciones activas
    const usersWithTelegram = await User.find({
      telegramUserId: { $exists: true, $ne: null },
      telegramChannelAccess: { $exists: true, $ne: [] }
    });

    console.log(`📊 [TELEGRAM EXPULSION] Verificando ${usersWithTelegram.length} usuarios con Telegram vinculado`);

    for (const user of usersWithTelegram) {
      if (!user.telegramUserId || !user.telegramChannelAccess) continue;

      // Verificar cada canal al que tiene acceso
      for (const access of user.telegramChannelAccess) {
        const service = access.service as 'TraderCall' | 'SmartMoney';
        
        // Verificar si tiene suscripción activa para este servicio
        const activeSub = user.activeSubscriptions?.find(
          (sub: any) => sub.service === service && sub.isActive && new Date(sub.expiryDate) > now
        );

        // Si no tiene suscripción activa y no es admin, expulsar
        if (!activeSub && user.role !== 'admin') {
          const channelId = CHANNEL_MAP[service];
          
          if (!channelId) {
            console.log(`⚠️ [TELEGRAM EXPULSION] Canal no configurado para ${service}`);
            continue;
          }

          try {
            // Expulsar usuario del canal
            // Usamos banChatMember y luego unbanChatMember para permitir reingreso futuro
            await bot.banChatMember(channelId, user.telegramUserId);
            
            // Esperar un poco y desbanear para permitir reingreso si renueva
            await new Promise(resolve => setTimeout(resolve, 1000));
            await bot.unbanChatMember(channelId, user.telegramUserId);

            console.log(`✅ [TELEGRAM EXPULSION] Usuario expulsado: ${user.email} de ${service}`);

            // Remover el acceso del usuario
            user.telegramChannelAccess = user.telegramChannelAccess.filter(
              (a: any) => a.service !== service
            );

            results.push({
              userId: user._id.toString(),
              email: user.email,
              telegramUserId: user.telegramUserId,
              service,
              success: true
            });

            // Notificar al usuario por mensaje directo
            try {
              await bot.sendMessage(
                user.telegramUserId,
                `⚠️ *Suscripción Expirada*\n\n` +
                `Tu suscripción a *${service}* ha expirado y has sido removido del canal.\n\n` +
                `Para seguir recibiendo alertas, renueva tu suscripción en:\n` +
                `🔗 ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}\n\n` +
                `¡Gracias por ser parte de nuestra comunidad!`,
                { parse_mode: 'Markdown' }
              );
            } catch (msgError) {
              console.log(`⚠️ [TELEGRAM EXPULSION] No se pudo notificar a ${user.email}`);
            }

          } catch (error: any) {
            console.error(`❌ [TELEGRAM EXPULSION] Error expulsando ${user.email} de ${service}:`, error.message);
            
            results.push({
              userId: user._id.toString(),
              email: user.email,
              telegramUserId: user.telegramUserId,
              service,
              success: false,
              error: error.message
            });
          }
        }
      }

      // Guardar cambios en el usuario
      if (user.isModified()) {
        await user.save();
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✅ [TELEGRAM EXPULSION] Completado: ${successCount} expulsados, ${failCount} errores`);

    return res.status(200).json({
      success: true,
      message: `Cronjob de expulsión completado`,
      summary: {
        totalChecked: usersWithTelegram.length,
        expelled: successCount,
        errors: failCount
      },
      results,
      executedAt: now.toISOString()
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM EXPULSION] Error en cronjob:', error);
    return res.status(500).json({
      success: false,
      error: 'Error ejecutando cronjob de expulsión',
      details: error.message
    });
  }
}

