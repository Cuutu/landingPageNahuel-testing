import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAPI } from '@/lib/adminAuth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

/**
 * API para gestionar suscripciones de usuarios a alertas
 * GET: Obtener usuarios suscritos por tipo de alerta
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📊 [API] Suscripciones - método: ${req.method}`);
  
  await connectDB();

  // Verificar autenticación y permisos de admin
  const adminCheck = await verifyAdminAPI(req, res);
  if (!adminCheck.isAdmin) {
    return res.status(401).json({ error: adminCheck.error || 'No autorizado' });
  }

  console.log(`✅ [API] Admin verificado para suscripciones: ${adminCheck.user?.email}`);

  switch (req.method) {
    case 'GET':
      try {
        const { tipo, limit = 50, page = 1 } = req.query;

        // Si se especifica un tipo de alerta, filtrar por ese tipo
        let query: any = {};
        if (tipo && tipo !== 'all') {
          query.subscriptions = { $elemMatch: { tipo: tipo, activa: true } };
        } else {
          // Solo usuarios con suscripciones activas
          query.subscriptions = { $exists: true, $not: { $size: 0 } };
        }

        const skip = (Number(page) - 1) * Number(limit);
        
        const users = await User.find(query)
          .select('name email role subscriptions createdAt lastLogin')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit));

        const totalUsers = await User.countDocuments(query);

        // Obtener estadísticas por tipo de alerta
        const alertStats = await User.aggregate([
          { $match: { subscriptions: { $exists: true, $not: { $size: 0 } } } },
          { $unwind: '$subscriptions' },
          { $match: { 'subscriptions.activa': true } },
          { 
            $group: { 
              _id: '$subscriptions.tipo', 
              count: { $sum: 1 },
              ingresosMensuales: { $sum: '$subscriptions.precio' }
            } 
          },
          { $sort: { count: -1 } }
        ]);

        return res.status(200).json({
          success: true,
          users: users.map(user => ({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            subscriptions: user.subscriptions || [],
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            // Calcular ingresos totales del usuario
            ingresoMensual: (user.subscriptions || [])
              .filter((sub: any) => sub.activa)
              .reduce((total: number, sub: any) => total + (sub.precio || 0), 0)
          })),
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(totalUsers / Number(limit)),
            totalUsers,
            hasNext: skip + Number(limit) < totalUsers,
            hasPrev: Number(page) > 1
          },
          estadisticas: {
            totalSuscriptores: totalUsers,
            alertStats: alertStats.map(stat => ({
              tipo: stat._id,
              suscriptores: stat.count,
              ingresosMensuales: stat.ingresosMensuales
            })),
            ingresosTotales: alertStats.reduce((total, stat) => total + stat.ingresosMensuales, 0)
          }
        });
      } catch (error) {
        console.error('Error al obtener suscripciones:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

    case 'POST':
      try {
        const { userId, tipo, precio, days } = req.body; // ✅ NUEVO: days opcional

        if (!userId || !tipo) {
          return res.status(400).json({ error: 'userId y tipo son requeridos' });
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Verificar si ya tiene esta suscripción activa
        const existingActiveSub = user.activeSubscriptions?.find(
          (sub: any) => sub.service === tipo && sub.isActive && new Date(sub.expiryDate) > new Date()
        );

        const existingLegacySub = user.subscriptions?.find(
          (sub: any) => sub.tipo === tipo && sub.activa
        );

        // Si tiene suscripción activa, permitir renovación/apilado (no bloquear)
        // El método renewSubscription manejará el apilado automáticamente

        // Usar renewSubscription para mantener consistencia con el sistema
        const subscriptionDays = days || 30; // Default 30 días
        const subscriptionPrice = precio || 99;
        
        // Guardar fecha de expiración anterior para detectar renovación
        const previousExpiry = existingActiveSub 
          ? new Date(existingActiveSub.expiryDate) 
          : undefined;
        const isRenewal: boolean | undefined = existingActiveSub !== undefined && previousExpiry && previousExpiry > new Date() ? true : undefined;

        // Usar renewSubscription que actualiza ambos sistemas (activeSubscriptions y subscriptions)
        await user.renewSubscription(
          tipo,
          subscriptionPrice,
          'ARS',
          undefined, // No hay paymentId para asignación manual
          'full',
          subscriptionDays
        );

        // Recargar usuario para obtener fechas actualizadas
        await user.save();
        const updatedUser = await User.findById(userId);

        // Obtener la suscripción actualizada para las fechas
        const updatedSub = updatedUser?.activeSubscriptions?.find(
          (sub: any) => sub.service === tipo && sub.isActive
        );

        console.log(`✅ Suscripción ${tipo} agregada/renovada para usuario ${user.email} (${subscriptionDays} días)`);
        console.log(`🔍 [DEBUG] Detalles de suscripción guardada:`, {
          email: user.email,
          service: tipo,
          expiryDate: updatedSub?.expiryDate,
          isActive: updatedSub?.isActive,
          startDate: updatedSub?.startDate,
          daysUntilExpiry: updatedSub ? Math.ceil((new Date(updatedSub.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
        });

        // 📧 Enviar emails de notificación
        try {
          const { sendAdminNewSubscriberEmail, sendSubscriptionConfirmationEmail } = await import('@/lib/emailNotifications');
          
          // Email al admin
          await sendAdminNewSubscriberEmail({
            userEmail: user.email,
            userName: user.name || user.email,
            service: tipo as 'TraderCall' | 'SmartMoney' | 'CashFlow',
            amount: subscriptionPrice,
            currency: 'ARS',
            transactionDate: new Date(),
            expiryDate: updatedSub?.expiryDate || updatedUser?.subscriptionExpiry
          });

          // Email al usuario
          await sendSubscriptionConfirmationEmail({
            userEmail: user.email,
            userName: user.name || user.email,
            service: tipo as 'TraderCall' | 'SmartMoney' | 'CashFlow',
            expiryDate: updatedSub?.expiryDate || updatedUser?.subscriptionExpiry,
            startDate: updatedSub?.startDate,
            isRenewal: isRenewal || undefined,
            previousExpiry: previousExpiry || undefined
          });

          console.log(`✅ Emails enviados para suscripción ${tipo} de ${user.email}`);
        } catch (emailError) {
          console.error('❌ Error enviando emails (suscripción asignada correctamente):', emailError);
          // No fallar la operación si los emails fallan
        }

        return res.status(200).json({
          success: true,
          message: `Suscripción ${tipo} ${isRenewal ? 'renovada' : 'agregada'} exitosamente (${subscriptionDays} días)`,
          expiryDate: updatedSub?.expiryDate || updatedUser?.subscriptionExpiry,
          isRenewal
        });
      } catch (error) {
        console.error('Error al agregar suscripción:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

    case 'DELETE':
      try {
        const { userId, tipo } = req.body;

        if (!userId || !tipo) {
          return res.status(400).json({ error: 'userId y tipo son requeridos' });
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        let subscriptionRemoved = false;

        // ✅ IMPORTANTE: Buscar y desactivar en AMBOS arrays
        
        // 1. Desactivar en subscriptions legacy (si existe)
        const legacyUpdateResult = await User.findByIdAndUpdate(userId, {
          $set: { 
            'subscriptions.$[elem].activa': false,
            'subscriptions.$[elem].fechaFin': new Date()
          }
        }, {
          arrayFilters: [{ 
            'elem.tipo': tipo, 
            'elem.activa': true 
          }]
        });

        if (legacyUpdateResult) {
          subscriptionRemoved = true;
          console.log(`✅ Suscripción ${tipo} desactivada en subscriptions legacy`);
        }

        // 2. ✅ NUEVO: Desactivar en activeSubscriptions (MercadoPago)
        const activeUpdateResult = await User.findByIdAndUpdate(userId, {
          $set: { 
            'activeSubscriptions.$[elem].isActive': false,
            'activeSubscriptions.$[elem].expiryDate': new Date() // Forzar expiración
          }
        }, {
          arrayFilters: [{ 
            'elem.service': tipo, 
            'elem.isActive': true 
          }]
        });

        if (activeUpdateResult) {
          subscriptionRemoved = true;
          console.log(`✅ Suscripción ${tipo} desactivada en activeSubscriptions`);
        }

        if (!subscriptionRemoved) {
          return res.status(404).json({ 
            error: `No se encontró suscripción activa de ${tipo} para este usuario` 
          });
        }

        // Verificar si quedan suscripciones activas en AMBOS arrays
        const updatedUser = await User.findById(userId);
        const hasLegacySubscriptions = updatedUser?.subscriptions?.some(
          (sub: any) => sub.activa
        );
        const hasActiveSubscriptions = updatedUser?.activeSubscriptions?.some(
          (sub: any) => sub.isActive && new Date(sub.expiryDate) > new Date()
        );

        // Si no tiene más suscripciones activas, cambiar rol a normal (solo si no es admin)
        if (!hasLegacySubscriptions && !hasActiveSubscriptions && updatedUser?.role !== 'admin') {
          await User.findByIdAndUpdate(userId, { role: 'normal' });
          console.log(`✅ Rol cambiado a 'normal' para ${user.email} (sin suscripciones activas)`);
        }

        console.log(`❌ Suscripción ${tipo} desactivada para usuario ${user.email}`);

        return res.status(200).json({
          success: true,
          message: 'Suscripción desactivada exitosamente'
        });
      } catch (error) {
        console.error('Error al desactivar suscripción:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

    case 'PUT':
      try {
        const { action } = req.body;
        
        if (action === 'cleanup-expired') {
          // Limpiar suscripciones expiradas automáticamente
          const now = new Date();
          
          // Buscar usuarios con suscripciones expiradas
          const usersWithExpiredSubs = await User.find({
            'subscriptions': {
              $elemMatch: {
                'activa': true,
                'fechaFin': { $lt: now }
              }
            }
          });

          let cleanedCount = 0;
          
          for (const user of usersWithExpiredSubs) {
            // Desactivar suscripciones expiradas
            await User.findByIdAndUpdate(user._id, {
              $set: { 
                'subscriptions.$[elem].activa': false 
              }
            }, {
              arrayFilters: [{ 
                'elem.activa': true,
                'elem.fechaFin': { $lt: now }
              }]
            });

            // Verificar si quedan suscripciones activas
            const updatedUser = await User.findById(user._id);
            const hasActiveSubscriptions = updatedUser?.subscriptions?.some(
              (sub: any) => sub.activa
            );

            // Si no tiene más suscripciones activas, cambiar rol a normal (solo si no es admin)
            if (!hasActiveSubscriptions && updatedUser?.role !== 'admin') {
              await User.findByIdAndUpdate(user._id, { role: 'normal' });
            }

            cleanedCount++;
          }

          console.log(`🧹 Limpieza automática: ${cleanedCount} usuarios con suscripciones expiradas`);

          return res.status(200).json({
            success: true,
            message: `Limpieza completada. ${cleanedCount} usuarios procesados`,
            cleanedCount
          });
        }

        return res.status(400).json({ error: 'Acción no válida' });
      } catch (error) {
        console.error('Error en limpieza automática:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
} 