import dbConnect from './mongodb';
import { sendEmail } from './emailService';
import { 
  createSubscriptionExpiryWarningTemplate, 
  createSubscriptionExpiredTemplate 
} from './email-templates';
import User from '@/models/User';

interface SubscriptionNotification {
  userId: string;
  userEmail: string;
  userName: string;
  service: string;
  expiryDate: Date;
  daysLeft: number;
  notificationType: 'warning' | 'expired';
  sentAt: Date;
}

/**
 * Obtiene todas las suscripciones que están por vencer o han expirado
 * Ahora obtiene desde User.activeSubscriptions en lugar de payments
 */
export async function getSubscriptionsForNotifications() {
  await dbConnect();
  const now = new Date();
  
  // Obtener usuarios con suscripciones activas que vencen en 5 días o ya expiraron
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Buscar usuarios con activeSubscriptions que estén por vencer o hayan expirado
  const users = await User.find({
    'activeSubscriptions': {
      $elemMatch: {
        isActive: true,
        expiryDate: {
          $gte: oneDayAgo, // Desde hace 1 día (ya expiradas)
          $lte: fiveDaysFromNow // Hasta en 5 días
        }
      }
    }
  }).select('_id name email activeSubscriptions');

  // Extraer suscripciones individuales con información del usuario
  const subscriptions: any[] = [];
  
  for (const user of users) {
    if (!user.activeSubscriptions || user.activeSubscriptions.length === 0) continue;
    
    for (const sub of user.activeSubscriptions) {
      if (!sub.isActive) continue;
      
      const expiryDate = new Date(sub.expiryDate);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Solo incluir si vence en 5 días o menos, o ya expiró (hasta 1 día después)
      if (daysUntilExpiry <= 5 && daysUntilExpiry >= -1) {
        subscriptions.push({
          _id: sub._id || `${user._id}_${sub.service}`,
          userId: user._id.toString(),
          userEmail: user.email,
          userName: user.name || 'Usuario',
          service: sub.service,
          expiryDate: expiryDate,
          startDate: sub.startDate,
          amount: sub.amount || 0,
          currency: sub.currency || 'ARS',
          mercadopagoPaymentId: sub.mercadopagoPaymentId
        });
      }
    }
  }

  console.log(`📧 [SUBSCRIPTION NOTIFICATIONS] Encontradas ${subscriptions.length} suscripciones para notificar`);

  return subscriptions;
}

/**
 * Verifica si ya se envió una notificación para esta suscripción
 */
async function hasNotificationBeenSent(
  userId: string, 
  service: string, 
  notificationType: 'warning' | 'expired',
  daysLeft?: number
): Promise<boolean> {
  const conn = await dbConnect();
  const db = conn.connection.db;
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const query: any = {
    userId,
    service,
    notificationType,
    sentAt: { $gte: oneDayAgo }
  };

  // Para warnings, también verificar que sea para el mismo número de días
  if (notificationType === 'warning' && daysLeft !== undefined) {
    query.daysLeft = daysLeft;
  }

  const existingNotification = await db.collection('subscriptionNotifications').findOne(query);
  
  return !!existingNotification;
}

/**
 * Registra que se envió una notificación
 */
async function recordNotificationSent(notification: SubscriptionNotification) {
  const conn = await dbConnect();
  const db = conn.connection.db;
  
  await db.collection('subscriptionNotifications').insertOne({
    ...notification,
    createdAt: new Date()
  });

  console.log(`📧 [SUBSCRIPTION NOTIFICATIONS] Notificación registrada para ${notification.userEmail} - ${notification.service}`);
}

/**
 * Obtiene el nombre amigable del servicio
 */
function getServiceDisplayName(service: string): string {
  const serviceNames: { [key: string]: string } = {
    'TraderCall': 'Trader Call',
    'SmartMoney': 'Smart Money',
    'CashFlow': 'Cash Flow',
    'SwingTrading': 'Swing Trading',
    'DowJones': 'Dow Jones'
  };
  
  return serviceNames[service] || service;
}

/**
 * Obtiene la URL de renovación para el servicio
 */
function getRenewalUrl(service: string): string {
  const serviceUrls: { [key: string]: string } = {
    'TraderCall': 'https://lozanonahuel.vercel.app/alertas/trader-call',
    'SmartMoney': 'https://lozanonahuel.vercel.app/alertas/smart-money',

    'SwingTrading': 'https://lozanonahuel.vercel.app/entrenamientos/swing-trading',
    'DayTrading': 'https://lozanonahuel.vercel.app/entrenamientos'
  };
  
  return serviceUrls[service] || 'https://lozanonahuel.vercel.app';
}

/**
 * Envía notificación de advertencia (5 días antes)
 */
async function sendWarningNotification(
  userEmail: string,
  userName: string,
  service: string,
  expiryDate: Date,
  daysLeft: number
): Promise<boolean> {
  try {
    const serviceName = getServiceDisplayName(service);
    const renewalUrl = getRenewalUrl(service);
    
    const html = createSubscriptionExpiryWarningTemplate({
      userName,
      serviceName,
      expiryDate: expiryDate.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      daysLeft,
      renewalUrl
    });

    await sendEmail({
      to: userEmail,
      subject: `⚠️ Tu suscripción de ${serviceName} vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`,
      html
    });

    console.log(`📧 [SUBSCRIPTION NOTIFICATIONS] Advertencia enviada a ${userEmail} para ${serviceName} (${daysLeft} días antes)`);
    return true;
  } catch (error) {
    console.error(`❌ [SUBSCRIPTION NOTIFICATIONS] Error enviando advertencia a ${userEmail}:`, error);
    return false;
  }
}

/**
 * Envía notificación de expiración (el día que expira)
 */
async function sendExpiredNotification(
  userEmail: string,
  userName: string,
  service: string,
  expiryDate: Date
): Promise<boolean> {
  try {
    const serviceName = getServiceDisplayName(service);
    const renewalUrl = getRenewalUrl(service);
    
    const html = createSubscriptionExpiredTemplate({
      userName,
      serviceName,
      expiryDate: expiryDate.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      renewalUrl
    });

    await sendEmail({
      to: userEmail,
      subject: `❌ Tu suscripción de ${serviceName} ha expirado`,
      html
    });

    console.log(`📧 [SUBSCRIPTION NOTIFICATIONS] Notificación de expiración enviada a ${userEmail} para ${serviceName}`);
    return true;
  } catch (error) {
    console.error(`❌ [SUBSCRIPTION NOTIFICATIONS] Error enviando notificación de expiración a ${userEmail}:`, error);
    return false;
  }
}

/**
 * Procesa y envía todas las notificaciones de suscripciones
 */
export async function processSubscriptionNotifications(): Promise<{
  warningsSent: number;
  expiredSent: number;
  errors: string[];
}> {
  console.log('📧 [SUBSCRIPTION NOTIFICATIONS] Iniciando procesamiento de notificaciones...');
  
  const subscriptions = await getSubscriptionsForNotifications();
  const now = new Date();
  
  let warningsSent = 0;
  let expiredSent = 0;
  const errors: string[] = [];

  for (const subscription of subscriptions) {
    try {
      const daysUntilExpiry = Math.ceil(
        (subscription.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // La información del usuario ya está en subscription
      const userEmail = subscription.userEmail;
      const userName = subscription.userName;

      // Notificación de advertencia (5 días antes)
      if (daysUntilExpiry === 5) {
        const alreadySent = await hasNotificationBeenSent(
          subscription.userId, 
          subscription.service, 
          'warning', 
          5
        );

        if (!alreadySent) {
          const success = await sendWarningNotification(
            userEmail,
            userName,
            subscription.service,
            subscription.expiryDate,
            5
          );

          if (success) {
            await recordNotificationSent({
              userId: subscription.userId,
              userEmail,
              userName,
              service: subscription.service,
              expiryDate: subscription.expiryDate,
              daysLeft: 5,
              notificationType: 'warning',
              sentAt: new Date()
            });
            warningsSent++;
          } else {
            errors.push(`Error enviando advertencia a ${userEmail} para ${subscription.service}`);
          }
        }
      }

      // Notificación de advertencia (1 día antes)
      if (daysUntilExpiry === 1) {
        const alreadySent = await hasNotificationBeenSent(
          subscription.userId, 
          subscription.service, 
          'warning', 
          1
        );

        if (!alreadySent) {
          const success = await sendWarningNotification(
            userEmail,
            userName,
            subscription.service,
            subscription.expiryDate,
            1
          );

          if (success) {
            await recordNotificationSent({
              userId: subscription.userId,
              userEmail,
              userName,
              service: subscription.service,
              expiryDate: subscription.expiryDate,
              daysLeft: 1,
              notificationType: 'warning',
              sentAt: new Date()
            });
            warningsSent++;
          } else {
            errors.push(`Error enviando advertencia a ${userEmail} para ${subscription.service}`);
          }
        }
      }

      // Notificación de expiración (el día que expira o hasta 1 día después)
      if (daysUntilExpiry <= 0 && daysUntilExpiry >= -1) {
        const alreadySent = await hasNotificationBeenSent(
          subscription.userId, 
          subscription.service, 
          'expired'
        );

        if (!alreadySent) {
          const success = await sendExpiredNotification(
            userEmail,
            userName,
            subscription.service,
            subscription.expiryDate
          );

          if (success) {
            await recordNotificationSent({
              userId: subscription.userId,
              userEmail,
              userName,
              service: subscription.service,
              expiryDate: subscription.expiryDate,
              daysLeft: 0,
              notificationType: 'expired',
              sentAt: new Date()
            });
            expiredSent++;
          } else {
            errors.push(`Error enviando notificación de expiración a ${userEmail} para ${subscription.service}`);
          }
        }
      }

    } catch (error) {
      console.error(`❌ [SUBSCRIPTION NOTIFICATIONS] Error procesando suscripción ${subscription._id}:`, error);
      errors.push(`Error procesando suscripción ${subscription._id}: ${error}`);
    }
  }

  console.log(`📧 [SUBSCRIPTION NOTIFICATIONS] Procesamiento completado:`);
  console.log(`   - Advertencias enviadas: ${warningsSent}`);
  console.log(`   - Notificaciones de expiración enviadas: ${expiredSent}`);
  console.log(`   - Errores: ${errors.length}`);

  return { warningsSent, expiredSent, errors };
}

/**
 * Limpia notificaciones antiguas (más de 30 días)
 */
export async function cleanupOldNotifications(): Promise<number> {
  const conn = await dbConnect();
  const db = conn.connection.db;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db.collection('subscriptionNotifications').deleteMany({
    sentAt: { $lt: thirtyDaysAgo }
  });

  console.log(`🧹 [SUBSCRIPTION NOTIFICATIONS] Limpiadas ${result.deletedCount} notificaciones antiguas`);
  return result.deletedCount;
}
