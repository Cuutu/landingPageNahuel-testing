import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Cronjob para marcar como inactivas las suscripciones expiradas
 * 
 * Esto mantiene la base de datos consistente y evita confusiones en el panel admin.
 * La verificación de acceso ya usa las fechas directamente, pero este cron
 * actualiza los campos isActive/activa para que la UI sea consistente.
 * 
 * Configurar en cron-job.org:
 * URL: https://tu-dominio.com/api/cron/expire-subscriptions?secret=TU_CRON_SECRET
 * Frecuencia: Cada hora o diariamente
 */

interface ExpireResult {
  userId: string;
  email: string;
  service: string;
  array: string;
  expiryDate: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autorización del cron
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret as string;
  const cronSecret = process.env.CRON_SECRET;
  
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasValidHeaderSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasValidQuerySecret = cronSecret && querySecret === cronSecret;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const noCronSecretConfigured = !cronSecret;
  
  if (!isVercelCron && !hasValidHeaderSecret && !hasValidQuerySecret && !isDevelopment && !noCronSecretConfigured) {
    console.log('⚠️ [EXPIRE SUBSCRIPTIONS] Acceso no autorizado');
    return res.status(401).json({ error: 'No autorizado' });
  }

  console.log('🔄 [EXPIRE SUBSCRIPTIONS] Iniciando proceso de expiración de suscripciones...');

  try {
    await dbConnect();

    const now = new Date();
    const results: ExpireResult[] = [];
    let totalUpdated = 0;

    // 1. Buscar usuarios con suscripciones activas pero expiradas en 'subscriptions' (admin)
    const usersWithExpiredSubscriptions = await User.find({
      'subscriptions': {
        $elemMatch: {
          activa: true,
          fechaFin: { $lt: now }
        }
      }
    });

    console.log(`📊 [EXPIRE SUBSCRIPTIONS] Usuarios con subscriptions expiradas: ${usersWithExpiredSubscriptions.length}`);

    for (const user of usersWithExpiredSubscriptions) {
      const expiredSubs = user.subscriptions.filter(
        (sub: any) => sub.activa && sub.fechaFin && new Date(sub.fechaFin) < now
      );

      for (const sub of expiredSubs) {
        results.push({
          userId: user._id.toString(),
          email: user.email,
          service: sub.tipo,
          array: 'subscriptions',
          expiryDate: sub.fechaFin
        });
      }

      // Actualizar todas las suscripciones expiradas
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'subscriptions.$[elem].activa': false
          }
        },
        {
          arrayFilters: [
            { 'elem.fechaFin': { $lt: now }, 'elem.activa': true }
          ]
        }
      );

      totalUpdated += expiredSubs.length;
    }

    // 2. Buscar usuarios con suscripciones activas pero expiradas en 'activeSubscriptions' (MercadoPago)
    const usersWithExpiredActiveSubs = await User.find({
      'activeSubscriptions': {
        $elemMatch: {
          isActive: true,
          expiryDate: { $lt: now }
        }
      }
    });

    console.log(`📊 [EXPIRE SUBSCRIPTIONS] Usuarios con activeSubscriptions expiradas: ${usersWithExpiredActiveSubs.length}`);

    for (const user of usersWithExpiredActiveSubs) {
      const expiredSubs = user.activeSubscriptions.filter(
        (sub: any) => sub.isActive && sub.expiryDate && new Date(sub.expiryDate) < now
      );

      for (const sub of expiredSubs) {
        // Evitar duplicados en resultados
        const alreadyLogged = results.some(
          r => r.email === user.email && r.service === sub.service
        );
        if (!alreadyLogged) {
          results.push({
            userId: user._id.toString(),
            email: user.email,
            service: sub.service,
            array: 'activeSubscriptions',
            expiryDate: sub.expiryDate
          });
        }
      }

      // Actualizar todas las suscripciones expiradas
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'activeSubscriptions.$[elem].isActive': false
          }
        },
        {
          arrayFilters: [
            { 'elem.expiryDate': { $lt: now }, 'elem.isActive': true }
          ]
        }
      );

      totalUpdated += expiredSubs.length;
    }

    // 3. Buscar usuarios con suscripciones activas pero expiradas en 'suscripciones' (legacy)
    const usersWithExpiredLegacy = await User.find({
      'suscripciones': {
        $elemMatch: {
          activa: true,
          fechaVencimiento: { $lt: now }
        }
      }
    });

    console.log(`📊 [EXPIRE SUBSCRIPTIONS] Usuarios con suscripciones (legacy) expiradas: ${usersWithExpiredLegacy.length}`);

    for (const user of usersWithExpiredLegacy) {
      const expiredSubs = user.suscripciones.filter(
        (sub: any) => sub.activa && sub.fechaVencimiento && new Date(sub.fechaVencimiento) < now
      );

      for (const sub of expiredSubs) {
        const alreadyLogged = results.some(
          r => r.email === user.email && r.service === sub.servicio
        );
        if (!alreadyLogged) {
          results.push({
            userId: user._id.toString(),
            email: user.email,
            service: sub.servicio,
            array: 'suscripciones',
            expiryDate: sub.fechaVencimiento
          });
        }
      }

      // Actualizar todas las suscripciones expiradas
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'suscripciones.$[elem].activa': false
          }
        },
        {
          arrayFilters: [
            { 'elem.fechaVencimiento': { $lt: now }, 'elem.activa': true }
          ]
        }
      );

      totalUpdated += expiredSubs.length;
    }

    // 4. Actualizar rol de usuarios sin suscripciones activas
    // (Solo si no son admin y su rol es 'suscriptor')
    const usersToDowngrade = await User.find({
      role: 'suscriptor',
      $and: [
        {
          $or: [
            { subscriptions: { $size: 0 } },
            { subscriptions: { $not: { $elemMatch: { activa: true, fechaFin: { $gt: now } } } } },
            { subscriptions: { $exists: false } }
          ]
        },
        {
          $or: [
            { activeSubscriptions: { $size: 0 } },
            { activeSubscriptions: { $not: { $elemMatch: { isActive: true, expiryDate: { $gt: now } } } } },
            { activeSubscriptions: { $exists: false } }
          ]
        },
        {
          $or: [
            { suscripciones: { $size: 0 } },
            { suscripciones: { $not: { $elemMatch: { activa: true, fechaVencimiento: { $gt: now } } } } },
            { suscripciones: { $exists: false } }
          ]
        }
      ]
    });

    let downgradedUsers = 0;
    for (const user of usersToDowngrade) {
      await User.updateOne(
        { _id: user._id },
        { $set: { role: 'normal' } }
      );
      downgradedUsers++;
      console.log(`👤 [EXPIRE SUBSCRIPTIONS] Usuario ${user.email} cambiado a rol 'normal'`);
    }

    console.log('✅ [EXPIRE SUBSCRIPTIONS] Proceso completado');
    console.log(`   - Suscripciones marcadas como inactivas: ${totalUpdated}`);
    console.log(`   - Usuarios cambiados a rol normal: ${downgradedUsers}`);

    return res.status(200).json({
      success: true,
      message: 'Proceso de expiración completado',
      summary: {
        subscriptionsExpired: totalUpdated,
        usersDowngraded: downgradedUsers,
        timestamp: now.toISOString()
      },
      details: results.slice(0, 50) // Limitar a 50 para no sobrecargar la respuesta
    });

  } catch (error) {
    console.error('❌ [EXPIRE SUBSCRIPTIONS] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error en el proceso de expiración',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
