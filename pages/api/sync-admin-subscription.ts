import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import AdminSubscription from '@/models/AdminSubscription';

/**
 * API para sincronizar suscripciones del admin panel a la cuenta del usuario
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/sync-admin-subscription`);

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();
    console.log('✅ Conectado a MongoDB');

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.log('❌ No hay sesión activa');
      return res.status(401).json({ 
        success: false,
        error: 'Debes iniciar sesión' 
      });
    }

    console.log('✅ Sincronizando para:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar suscripciones activas en el admin panel
    const adminSubscriptions = await AdminSubscription.find({
      userEmail: session.user.email,
      status: 'active'
    });

    console.log('🔍 Suscripciones encontradas en admin:', {
      email: session.user.email,
      adminSubscriptionsCount: adminSubscriptions.length,
      adminSubscriptions: adminSubscriptions.map(sub => ({
        service: sub.service,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate
      }))
    });

    let syncedCount = 0;

    // Sincronizar cada suscripción activa del admin
    for (const adminSub of adminSubscriptions) {
      // Verificar si ya existe en activeSubscriptions
      const existingActiveSub = user.activeSubscriptions?.find(
        (sub: any) => sub.service === adminSub.service
      );

      if (!existingActiveSub) {
        console.log(`➕ Agregando suscripción ${adminSub.service} desde admin panel`);
        
        // Agregar a activeSubscriptions
        if (!user.activeSubscriptions) {
          user.activeSubscriptions = [];
        }

        user.activeSubscriptions.push({
          service: adminSub.service,
          startDate: adminSub.startDate,
          expiryDate: adminSub.endDate,
          isActive: true,
          mercadopagoPaymentId: `admin_sync_${Date.now()}`,
          amount: adminSub.amount || 100,
          currency: 'ARS'
        });

        syncedCount++;
      } else {
        console.log(`✅ Suscripción ${adminSub.service} ya existe en activeSubscriptions`);
        
        // Actualizar si está inactiva
        if (!existingActiveSub.isActive) {
          existingActiveSub.isActive = true;
          existingActiveSub.expiryDate = adminSub.endDate;
          syncedCount++;
          console.log(`🔄 Reactivada suscripción ${adminSub.service}`);
        }
      }
    }

    // Actualizar fechas generales si se sincronizó algo
    if (syncedCount > 0) {
      // Encontrar la fecha de expiración más lejana
      const latestExpiry = user.activeSubscriptions?.reduce((latest: Date, sub: any) => {
        const subExpiry = new Date(sub.expiryDate);
        return subExpiry > latest ? subExpiry : latest;
      }, new Date());

      if (latestExpiry) {
        user.subscriptionExpiry = latestExpiry;
        user.lastPaymentDate = new Date();
      }

      // Guardar cambios
      await user.save();
      console.log(`✅ Sincronizadas ${syncedCount} suscripciones para ${user.email}`);
    }

    return res.status(200).json({
      success: true,
      message: syncedCount > 0 ? 
        `Se sincronizaron ${syncedCount} suscripciones desde el admin panel` :
        'Todas las suscripciones ya estaban sincronizadas',
      user: {
        email: user.email,
        role: user.role
      },
      sync: {
        adminSubscriptionsFound: adminSubscriptions.length,
        subscriptionsSynced: syncedCount,
        currentActiveSubscriptions: user.activeSubscriptions?.length || 0
      },
      activeSubscriptions: user.activeSubscriptions || []
    });

  } catch (error) {
    console.error('❌ Error sincronizando suscripciones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
