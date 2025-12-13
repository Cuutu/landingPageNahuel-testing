import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

interface SubscriptionStatus {
  service: string;
  isActive: boolean;
  expiryDate?: string;
  subscriptionType?: 'full' | 'trial';
}

/**
 * API endpoint para verificar las suscripciones del usuario directamente del servidor
 * Útil cuando la sesión del cliente no está sincronizada
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { service } = req.query;

  try {
    // Obtener sesión del servidor
    const session = await getServerSession(req, res, authOptions);

    console.log('🔍 [VERIFY-SUBSCRIPTION] Verificando suscripción...');
    console.log('🔍 [VERIFY-SUBSCRIPTION] Sesión encontrada:', !!session);
    console.log('🔍 [VERIFY-SUBSCRIPTION] Email:', session?.user?.email || 'No disponible');

    if (!session?.user?.email) {
      console.log('❌ [VERIFY-SUBSCRIPTION] No hay sesión válida');
      return res.status(401).json({ 
        authenticated: false, 
        subscriptions: [],
        message: 'No autenticado'
      });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.user.email }).lean() as any;

    if (!user) {
      console.log('❌ [VERIFY-SUBSCRIPTION] Usuario no encontrado en BD');
      return res.status(200).json({
        authenticated: true,
        email: session.user.email,
        subscriptions: [],
        message: 'Usuario no encontrado'
      });
    }

    console.log('🔍 [VERIFY-SUBSCRIPTION] Usuario encontrado:', user.email);
    console.log('🔍 [VERIFY-SUBSCRIPTION] Rol:', user.role);

    const now = new Date();
    const activeSubscriptions: SubscriptionStatus[] = [];

    // Verificar en todos los arrays de suscripciones
    const servicesToCheck = service 
      ? [service as string] 
      : ['TraderCall', 'SmartMoney', 'CashFlow'];

    for (const svc of servicesToCheck) {
      // Verificar en suscripciones (array antiguo)
      const suscripcionActiva = user.suscripciones?.find(
        (sub: any) => 
          sub.servicio === svc && 
          sub.activa === true && 
          new Date(sub.fechaVencimiento) > now
      );

      // Verificar en subscriptions (array admin)
      const subscriptionActiva = user.subscriptions?.find(
        (sub: any) => 
          sub.tipo === svc && 
          sub.activa === true &&
          (!sub.fechaFin || new Date(sub.fechaFin) > now)
      );

      // Verificar en activeSubscriptions (MercadoPago)
      const activeSubscription = user.activeSubscriptions?.find(
        (sub: any) => 
          sub.service === svc && 
          sub.isActive === true &&
          new Date(sub.expiryDate) > now
      );

      const isActive = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
      
      if (isActive) {
        const subDetails: SubscriptionStatus = {
          service: svc,
          isActive: true,
        };

        // Obtener detalles de la suscripción activa
        if (activeSubscription) {
          subDetails.expiryDate = activeSubscription.expiryDate;
          subDetails.subscriptionType = activeSubscription.subscriptionType;
        } else if (suscripcionActiva) {
          subDetails.expiryDate = suscripcionActiva.fechaVencimiento;
        } else if (subscriptionActiva) {
          subDetails.expiryDate = subscriptionActiva.fechaFin;
        }

        activeSubscriptions.push(subDetails);
      }
    }

    console.log('✅ [VERIFY-SUBSCRIPTION] Suscripciones activas:', activeSubscriptions);

    return res.status(200).json({
      authenticated: true,
      email: session.user.email,
      role: user.role,
      subscriptions: activeSubscriptions,
      hasActiveSubscription: activeSubscriptions.length > 0,
      // Si se pidió un servicio específico, indicar si tiene acceso
      ...(service && {
        hasAccess: activeSubscriptions.some(s => s.service === service),
        serviceRequested: service
      })
    });

  } catch (error) {
    console.error('💥 [VERIFY-SUBSCRIPTION] Error:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      authenticated: false,
      subscriptions: []
    });
  }
}

