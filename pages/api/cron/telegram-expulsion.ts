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

    // ✅ CORREGIDO: Buscar TODOS los usuarios con Telegram vinculado
    // No solo los que tienen telegramChannelAccess, porque algunos pueden haberse unido manualmente
    const allUsersWithTelegram = await User.find({
      telegramUserId: { $exists: true, $ne: null }
    }).select('telegramUserId telegramChannelAccess email role suscripciones subscriptions activeSubscriptions');

    console.log(`📊 [TELEGRAM EXPULSION] Encontrados ${allUsersWithTelegram.length} usuarios con Telegram vinculado`);
    
    // ✅ NUEVO: Determinar qué servicios verificar para cada usuario
    // Si tiene telegramChannelAccess, usar esos servicios
    // Si no, verificar ambos servicios (TraderCall y SmartMoney) para ver si está en algún canal
    const usersToProcess: Array<{
      user: any;
      servicesToCheck: Array<'TraderCall' | 'SmartMoney'>;
    }> = [];
    
    for (const user of allUsersWithTelegram) {
      const servicesToCheck: Array<'TraderCall' | 'SmartMoney'> = [];
      
      // Si tiene telegramChannelAccess, usar esos servicios
      if (user.telegramChannelAccess && user.telegramChannelAccess.length > 0) {
        user.telegramChannelAccess.forEach((access: any) => {
          if (access.service && !servicesToCheck.includes(access.service)) {
            servicesToCheck.push(access.service);
          }
        });
      } else {
        // Si no tiene telegramChannelAccess, verificar ambos servicios
        // (puede haberse unido manualmente al canal)
        // Nota: Esto se verificará más adelante con la API de Telegram
        servicesToCheck.push('TraderCall', 'SmartMoney');
      }
      
      if (servicesToCheck.length > 0) {
        usersToProcess.push({ user, servicesToCheck });
      }
    }
    
    console.log(`📊 [TELEGRAM EXPULSION] Verificando ${usersToProcess.length} usuarios con servicios a verificar`);

    for (const { user, servicesToCheck } of usersToProcess) {
      if (!user.telegramUserId) {
        console.log(`⚠️ [TELEGRAM EXPULSION] Usuario ${user.email} sin telegramUserId`);
        continue;
      }

      console.log(`🔍 [TELEGRAM EXPULSION] Procesando usuario: ${user.email} (rol: ${user.role})`);
      console.log(`   - telegramUserId: ${user.telegramUserId}`);
      console.log(`   - telegramChannelAccess:`, user.telegramChannelAccess && user.telegramChannelAccess.length > 0 
        ? JSON.stringify(user.telegramChannelAccess, null, 2) 
        : 'NINGUNO (verificando si está en canales manualmente)');
      
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

      // Verificar cada servicio para este usuario
      for (const service of servicesToCheck) {
        const channelId = CHANNEL_MAP[service];
        
        // ✅ NUEVO: Si el usuario no tiene telegramChannelAccess para este servicio,
        // verificar si realmente está en el canal usando la API de Telegram
        const hasAccessInDB = user.telegramChannelAccess?.some((a: any) => a.service === service);
        
        if (!hasAccessInDB && channelId) {
          try {
            const member = await bot.getChatMember(channelId, user.telegramUserId);
            // Si el usuario NO está en el canal (left o kicked), saltar este servicio
            if (member.status === 'left' || member.status === 'kicked') {
              console.log(`   ⚠️ Usuario ${user.email} NO está en canal ${service} (status: ${member.status}) - saltando`);
              continue;
            }
            // Si está en el canal, agregar a telegramChannelAccess para futuras verificaciones
            console.log(`   ✅ Usuario ${user.email} está en canal ${service} (status: ${member.status}) pero no tiene telegramChannelAccess - agregando`);
            if (!user.telegramChannelAccess) {
              user.telegramChannelAccess = [];
            }
            user.telegramChannelAccess.push({
              service,
              channelId,
              joinedAt: new Date(),
              inviteLink: undefined
            });
          } catch (error: any) {
            // ✅ MEJORADO: Manejar diferentes tipos de errores
            if (error.message?.includes('PARTICIPANT_ID_INVALID')) {
              console.log(`   ⚠️ telegramUserId inválido para ${user.email} (${user.telegramUserId}) en ${service} - el usuario puede haber eliminado su cuenta de Telegram`);
            } else if (error.message?.includes('USER_NOT_PARTICIPANT')) {
              console.log(`   ⚠️ Usuario ${user.email} no está en el canal ${service}`);
            } else {
              console.log(`   ⚠️ No se pudo verificar si ${user.email} está en ${service}: ${error.message}`);
            }
            // Saltar este servicio para este usuario
            continue;
          }
        }
        
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

        // ✅ CORREGIDO: Si no tiene suscripción activa en NINGÚN sistema y no es admin, expulsar
        if (!hasActiveSubscription && user.role !== 'admin') {
          console.log(`   🚨 Usuario ${user.email} NO tiene suscripción activa para ${service} - PROCESANDO EXPULSIÓN`);
          const channelId = CHANNEL_MAP[service];
          
          if (!channelId) {
            console.log(`⚠️ [TELEGRAM EXPULSION] Canal no configurado para ${service}`);
            continue;
          }

          try {
            // ✅ NUEVO: Verificar que el bot tenga permisos de administrador antes de intentar expulsar
            let botHasAdminRights = false;
            try {
              const botInfo = await bot.getMe();
              const botMember = await bot.getChatMember(channelId, botInfo.id);
              
              console.log(`   🔍 Verificando permisos del bot en ${service}:`);
              console.log(`      - Bot ID: ${botInfo.id}`);
              console.log(`      - Bot username: ${botInfo.username}`);
              console.log(`      - Status en canal: ${botMember.status}`);
              
              if (botMember.status === 'administrator') {
                const canRestrict = (botMember as any).can_restrict_members === true;
                console.log(`      - can_restrict_members: ${canRestrict}`);
                botHasAdminRights = canRestrict;
              } else {
                console.log(`      - Bot NO es administrador (status: ${botMember.status})`);
                botHasAdminRights = false;
              }
              
              if (!botHasAdminRights) {
                const errorMsg = `Bot NO tiene permisos de administrador en ${service} (canal: ${channelId}). El bot debe ser administrador y tener el permiso 'can_restrict_members' habilitado.`;
                console.error(`❌ [TELEGRAM EXPULSION] ${errorMsg}`);
                
                results.push({
                  userId: user._id.toString(),
                  email: user.email,
                  telegramUserId: user.telegramUserId,
                  service,
                  success: false,
                  error: errorMsg
                });
                continue;
              }
              
              console.log(`   ✅ Bot tiene permisos de administrador en ${service}`);
            } catch (permError: any) {
              console.error(`❌ [TELEGRAM EXPULSION] Error verificando permisos del bot en ${service}:`, permError.message);
              const errorMsg = permError.message?.includes('CHAT_ADMIN_REQUIRED') 
                ? `Bot no tiene permisos de administrador en ${service}. Verificar que el bot sea admin del canal.`
                : `Error verificando permisos: ${permError.message}`;
              
              results.push({
                userId: user._id.toString(),
                email: user.email,
                telegramUserId: user.telegramUserId,
                service,
                success: false,
                error: errorMsg
              });
              continue;
            }

            // ✅ MEJORADO: Verificar estado del usuario antes de expulsar
            let memberStatus: string | null = null;
            try {
              const member = await bot.getChatMember(channelId, user.telegramUserId);
              memberStatus = member.status;
              console.log(`   📊 Estado actual del usuario en ${service}: ${memberStatus}`);
              
              // Si el usuario ya no está en el canal (left, kicked, banned), solo limpiar acceso en DB
              if (memberStatus === 'left' || memberStatus === 'kicked' || memberStatus === 'banned') {
                console.log(`   ℹ️ Usuario ${user.email} ya no está en el canal ${service} (status: ${memberStatus}) - solo limpiando acceso en DB`);
                
                // Remover el acceso del usuario en la base de datos
                if (user.telegramChannelAccess) {
                  user.telegramChannelAccess = user.telegramChannelAccess.filter(
                    (a: any) => a.service !== service
                  );
                }
                
                results.push({
                  userId: user._id.toString(),
                  email: user.email,
                  telegramUserId: user.telegramUserId,
                  service,
                  success: true,
                  error: `Usuario ya estaba fuera del canal (${memberStatus})`
                });
                continue; // Saltar al siguiente servicio
              }
            } catch (statusError: any) {
              // Si no podemos obtener el estado, puede ser que el usuario no esté en el canal
              if (statusError.message?.includes('USER_NOT_PARTICIPANT') || 
                  statusError.message?.includes('PARTICIPANT_ID_INVALID')) {
                console.log(`   ℹ️ Usuario ${user.email} no está en el canal ${service} - solo limpiando acceso en DB`);
                
                // Remover el acceso del usuario en la base de datos
                if (user.telegramChannelAccess) {
                  user.telegramChannelAccess = user.telegramChannelAccess.filter(
                    (a: any) => a.service !== service
                  );
                }
                
                results.push({
                  userId: user._id.toString(),
                  email: user.email,
                  telegramUserId: user.telegramUserId,
                  service,
                  success: true,
                  error: 'Usuario no está en el canal'
                });
                continue; // Saltar al siguiente servicio
              }
              // Si es otro error, continuar con el intento de expulsión
              console.log(`   ⚠️ No se pudo verificar estado del usuario, continuando con expulsión: ${statusError.message}`);
            }

            // Expulsar usuario del canal
            // Usamos banChatMember y luego unbanChatMember para permitir reingreso futuro
            console.log(`   🔨 Intentando expulsar usuario ${user.email} (${user.telegramUserId}) del canal ${service}...`);
            
            try {
              // Intentar banear al usuario
              await bot.banChatMember(channelId, user.telegramUserId, {
                revoke_messages: false // No eliminar mensajes anteriores
              });
              
              console.log(`   ✅ Usuario baneado exitosamente`);
              
              // Esperar un poco y desbanear para permitir reingreso si renueva
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              try {
                await bot.unbanChatMember(channelId, user.telegramUserId, {
                  only_if_banned: true // Solo desbanear si está baneado
                });
                console.log(`   ✅ Usuario desbaneado (puede reingresar si renueva)`);
              } catch (unbanError: any) {
                // Si falla el unban, no es crítico - el usuario puede seguir siendo baneado
                console.log(`   ⚠️ No se pudo desbanear usuario (no crítico): ${unbanError.message}`);
              }

              console.log(`✅ [TELEGRAM EXPULSION] Usuario expulsado: ${user.email} de ${service}`);

              // Remover el acceso del usuario
              if (user.telegramChannelAccess) {
                user.telegramChannelAccess = user.telegramChannelAccess.filter(
                  (a: any) => a.service !== service
                );
              }

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
                console.log(`   ✅ Notificación enviada a ${user.email}`);
              } catch (msgError: any) {
                console.log(`   ⚠️ [TELEGRAM EXPULSION] No se pudo notificar a ${user.email}: ${msgError.message}`);
                // No es crítico si no se puede notificar
              }
            } catch (banError: any) {
              // Si el ban falla, puede ser que el usuario ya esté baneado o haya otro problema
              throw banError; // Re-lanzar para que se maneje en el catch externo
            }

          } catch (error: any) {
            console.error(`❌ [TELEGRAM EXPULSION] Error expulsando ${user.email} de ${service}:`, error.message);
            console.error(`   Detalles del error:`, {
              code: error.response?.body?.error_code,
              description: error.response?.body?.description,
              parameters: error.response?.body?.parameters
            });
            
            // ✅ MEJORADO: Mensajes de error más descriptivos y específicos
            let errorMessage = error.message || 'Error desconocido';
            let shouldCleanAccess = false; // Si debemos limpiar el acceso en DB aunque falle la expulsión
            
            if (error.message?.includes('CHAT_ADMIN_REQUIRED') || 
                error.response?.body?.error_code === 400) {
              errorMessage = `Bot no tiene permisos de administrador en el canal ${service}. Verificar que el bot sea admin y tenga permiso 'can_restrict_members' habilitado.`;
            } else if (error.message?.includes('PARTICIPANT_ID_INVALID') ||
                       error.response?.body?.error_code === 400) {
              errorMessage = `telegramUserId inválido o usuario no encontrado en el canal: ${user.telegramUserId}`;
              shouldCleanAccess = true; // Si el ID es inválido, limpiar acceso en DB
            } else if (error.message?.includes('USER_NOT_PARTICIPANT') ||
                       error.response?.body?.error_code === 400) {
              errorMessage = `Usuario no está en el canal ${service}`;
              shouldCleanAccess = true; // Si no está en el canal, limpiar acceso en DB
            } else if (error.message?.includes('USER_ALREADY_PARTICIPANT')) {
              // Este error no debería ocurrir, pero si pasa, significa que el usuario sigue en el canal
              errorMessage = `Usuario sigue en el canal pero no se pudo expulsar. Verificar permisos del bot.`;
            } else if (error.message?.includes('BOT_NOT_FOUND') || 
                       error.response?.body?.error_code === 401) {
              errorMessage = `Bot no encontrado o token inválido. Verificar TELEGRAM_BOT_TOKEN.`;
            } else if (error.message?.includes('CHAT_NOT_FOUND') ||
                       error.response?.body?.error_code === 400) {
              errorMessage = `Canal no encontrado. Verificar que TELEGRAM_CHANNEL_${service.toUpperCase()} esté configurado correctamente.`;
            }
            
            // Si el error indica que el usuario no está en el canal, limpiar acceso en DB
            if (shouldCleanAccess && user.telegramChannelAccess) {
              console.log(`   🧹 Limpiando acceso en DB para ${user.email} en ${service}`);
              user.telegramChannelAccess = user.telegramChannelAccess.filter(
                (a: any) => a.service !== service
              );
            }
            
            results.push({
              userId: user._id.toString(),
              email: user.email,
              telegramUserId: user.telegramUserId,
              service,
              success: false,
              error: errorMessage
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
        totalChecked: allUsersWithTelegram.length,
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

