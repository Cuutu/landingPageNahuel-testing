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
      if (!user.telegramUserId || !user.telegramChannelAccess) {
        console.log(`⚠️ [TELEGRAM EXPULSION] Usuario ${user.email} sin telegramUserId o telegramChannelAccess`);
        continue;
      }

      console.log(`🔍 [TELEGRAM EXPULSION] Procesando usuario: ${user.email} (rol: ${user.role})`);
      console.log(`   - telegramUserId: ${user.telegramUserId}`);
      console.log(`   - telegramChannelAccess:`, JSON.stringify(user.telegramChannelAccess, null, 2));
      
      // ✅ DEBUG: Mostrar TODAS las suscripciones (activas e inactivas) para debugging
      console.log(`   📋 TODAS las suscripciones del usuario:`);
      if (user.suscripciones && user.suscripciones.length > 0) {
        console.log(`      - suscripciones (legacy):`, JSON.stringify(user.suscripciones.map((s: any) => ({
          servicio: s.servicio,
          activa: s.activa,
          fechaVencimiento: s.fechaVencimiento,
          fechaVencimientoDate: new Date(s.fechaVencimiento),
          esFutura: new Date(s.fechaVencimiento) > now
        })), null, 2));
      } else {
        console.log(`      - suscripciones (legacy): []`);
      }
      
      if (user.subscriptions && user.subscriptions.length > 0) {
        console.log(`      - subscriptions (intermedio):`, JSON.stringify(user.subscriptions.map((s: any) => ({
          tipo: s.tipo,
          activa: s.activa,
          fechaFin: s.fechaFin,
          fechaFinDate: s.fechaFin ? new Date(s.fechaFin) : null,
          esFutura: s.fechaFin ? new Date(s.fechaFin) > now : false
        })), null, 2));
      } else {
        console.log(`      - subscriptions (intermedio): []`);
      }
      
      if (user.activeSubscriptions && user.activeSubscriptions.length > 0) {
        console.log(`      - activeSubscriptions (nuevo):`, JSON.stringify(user.activeSubscriptions.map((s: any) => ({
          service: s.service,
          isActive: s.isActive,
          expiryDate: s.expiryDate,
          expiryDateDate: new Date(s.expiryDate),
          esFutura: new Date(s.expiryDate) > now,
          subscriptionType: s.subscriptionType
        })), null, 2));
      } else {
        console.log(`      - activeSubscriptions (nuevo): []`);
      }
      
      console.log(`   🕐 Fecha actual (now): ${now.toISOString()}`);

      // Verificar cada canal al que tiene acceso
      for (const access of user.telegramChannelAccess) {
        const service = access.service as 'TraderCall' | 'SmartMoney';
        
        console.log(`   🔎 Verificando servicio: ${service}`);
        
        // ✅ CORREGIDO: Verificar suscripción activa en los TRES sistemas (igual que subscriptionAuth.ts)
        // 1. Verificar en suscripciones (array antiguo/legacy)
        const suscripcionActiva = user.suscripciones?.find(
          (sub: any) => {
            const matchesService = sub.servicio === service;
            const isActive = sub.activa === true;
            const fechaVenc = sub.fechaVencimiento ? new Date(sub.fechaVencimiento) : null;
            const isFuture = fechaVenc ? fechaVenc > now : false;
            
            console.log(`      🔍 Verificando suscripción legacy: servicio=${sub.servicio}, activa=${sub.activa}, fechaVenc=${sub.fechaVencimiento}, esFutura=${isFuture}`);
            
            return matchesService && isActive && isFuture;
          }
        );
        
        // 2. Verificar en subscriptions (array intermedio/admin)
        const subscriptionActiva = user.subscriptions?.find(
          (sub: any) => {
            const matchesService = sub.tipo === service;
            const isActive = sub.activa === true;
            const fechaFin = sub.fechaFin ? new Date(sub.fechaFin) : null;
            const isFuture = fechaFin ? fechaFin > now : (!sub.fechaFin); // Si no tiene fechaFin, considerar activa
            
            console.log(`      🔍 Verificando subscription intermedio: tipo=${sub.tipo}, activa=${sub.activa}, fechaFin=${sub.fechaFin}, esFutura=${isFuture}`);
            
            return matchesService && isActive && isFuture;
          }
        );
        
        // 3. Verificar en activeSubscriptions (MercadoPago - incluye trials y full)
        const activeSubscription = user.activeSubscriptions?.find(
          (sub: any) => {
            const matchesService = sub.service === service;
            const isActive = sub.isActive === true;
            const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
            const isFuture = expiryDate ? expiryDate > now : false;
            
            console.log(`      🔍 Verificando activeSubscription: service=${sub.service}, isActive=${sub.isActive}, expiryDate=${sub.expiryDate}, esFutura=${isFuture}, type=${sub.subscriptionType}`);
            
            return matchesService && isActive && isFuture;
          }
        );
        
        console.log(`   📊 Resultados de verificación para ${service}:`);
        console.log(`      - suscripcionActiva (legacy):`, suscripcionActiva ? `SÍ (vence: ${suscripcionActiva.fechaVencimiento}, fecha: ${new Date(suscripcionActiva.fechaVencimiento).toISOString()})` : 'NO');
        console.log(`      - subscriptionActiva (intermedio):`, subscriptionActiva ? `SÍ (vence: ${subscriptionActiva.fechaFin || 'sin fecha'}, fecha: ${subscriptionActiva.fechaFin ? new Date(subscriptionActiva.fechaFin).toISOString() : 'N/A'})` : 'NO');
        console.log(`      - activeSubscription (nuevo):`, activeSubscription ? `SÍ (vence: ${activeSubscription.expiryDate}, fecha: ${new Date(activeSubscription.expiryDate).toISOString()}, type: ${activeSubscription.subscriptionType})` : 'NO');
        
        // Si tiene suscripción activa en cualquiera de los tres sistemas, NO expulsar
        const hasActiveSubscription = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
        
        console.log(`   ✅ Tiene suscripción activa: ${hasActiveSubscription}`);

        // ✅ TEMPORALMENTE COMENTADO PARA TESTEO: Protección de admins deshabilitada
        // Si no tiene suscripción activa en NINGÚN sistema y no es admin, expulsar
        // if (!hasActiveSubscription && user.role !== 'admin') {
        // TEMPORAL: Para testeo, también procesar admins
        if (!hasActiveSubscription) {
          console.log(`   🚨 Usuario ${user.email} NO tiene suscripción activa para ${service} - PROCESANDO EXPULSIÓN`);
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

