import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { GetServerSidePropsContext } from 'next';

interface SubscriptionVerificationResult {
  isSubscribed: boolean;
  user?: any;
  session?: any;
  subscriptionDetails?: {
    service: string;
    expiryDate?: string;
    type?: string;
  } | null;
}

/**
 * Verifica si el usuario tiene una suscripción activa a un servicio específico
 * ✅ SIMPLIFICADO: Solo confía en la BD para la verificación
 */
export async function verifySubscriptionAccess(
  context: GetServerSidePropsContext,
  serviceName: 'SmartMoney' | 'TraderCall' | 'CashFlow'
): Promise<SubscriptionVerificationResult> {
  try {
    console.log(`🔍 [SUBSCRIPTION] Verificando acceso a ${serviceName}...`);
    
    // 1. Obtener sesión del servidor
    const session = await getServerSession(context.req, context.res, authOptions);
    
    console.log('🔍 [SUBSCRIPTION] Sesión obtenida:', !!session);
    console.log('🔍 [SUBSCRIPTION] Email en sesión:', session?.user?.email || 'NO HAY');
    
    // 2. Si no hay sesión, el usuario no está autenticado (pero puede ver la página pública)
    if (!session?.user?.email) {
      console.log('⚠️ [SUBSCRIPTION] No hay sesión - usuario no autenticado');
      return {
        isSubscribed: false,
        session: null
      };
    }

    console.log('👤 [SUBSCRIPTION] Usuario autenticado:', session.user.email);

    // 3. Buscar usuario en BD y verificar suscripción
    try {
      await connectDB();
      const user = await User.findOne({ email: session.user.email }).lean() as any;
      
      console.log('🗄️ [SUBSCRIPTION] Usuario encontrado en BD:', !!user);
      
      if (!user) {
        console.log('❌ [SUBSCRIPTION] Usuario no existe en BD');
        return {
          isSubscribed: false,
          session: session
        };
      }
      
      console.log('🗄️ [SUBSCRIPTION] Rol en BD:', user.role);
      
      const now = new Date();
      
      // Verificar en suscripciones (array antiguo)
      const suscripcionActiva = user.suscripciones?.find(
        (sub: any) => 
          sub.servicio === serviceName && 
          sub.activa === true && 
          new Date(sub.fechaVencimiento) > now
      );
      
      // Verificar en subscriptions (array admin)
      const subscriptionActiva = user.subscriptions?.find(
        (sub: any) => 
          sub.tipo === serviceName && 
          sub.activa === true &&
          (!sub.fechaFin || new Date(sub.fechaFin) > now)
      );

      // Verificar en activeSubscriptions (MercadoPago)
      const activeSubscription = user.activeSubscriptions?.find(
        (sub: any) => 
          sub.service === serviceName && 
          sub.isActive === true &&
          new Date(sub.expiryDate) > now
      );

      const isSubscribed = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
      
      console.log('🔍 [SUBSCRIPTION] Verificación de suscripción:', {
        servicio: serviceName,
        email: user.email,
        role: user.role,
        suscripcionActiva: !!suscripcionActiva,
        subscriptionActiva: !!subscriptionActiva,
        activeSubscription: !!activeSubscription,
        isSubscribed
      });

      // Obtener detalles de la suscripción activa
      let subscriptionDetails = null;
      if (activeSubscription) {
        subscriptionDetails = {
          service: activeSubscription.service,
          expiryDate: activeSubscription.expiryDate,
          type: activeSubscription.subscriptionType
        };
      } else if (suscripcionActiva) {
        subscriptionDetails = {
          service: suscripcionActiva.servicio,
          expiryDate: suscripcionActiva.fechaVencimiento,
          type: 'legacy'
        };
      } else if (subscriptionActiva) {
        subscriptionDetails = {
          service: subscriptionActiva.tipo,
          expiryDate: subscriptionActiva.fechaFin,
          type: 'admin'
        };
      }

      if (isSubscribed) {
        console.log(`✅ [SUBSCRIPTION] Acceso PERMITIDO a ${serviceName}`);
      } else {
        console.log(`⚠️ [SUBSCRIPTION] Usuario NO tiene suscripción activa a ${serviceName}`);
      }

      return {
        isSubscribed,
        user: {
          ...session.user,
          role: user.role
        },
        session: session,
        subscriptionDetails
      };
      
    } catch (dbError) {
      console.error('💥 [SUBSCRIPTION] Error consultando BD:', dbError);
      
      // FALLBACK: Si no podemos consultar BD, asumir no suscrito
      return {
        isSubscribed: false,
        user: session.user,
        session: session
      };
    }

  } catch (error) {
    console.error('💥 [SUBSCRIPTION] Error general:', error);
    return {
      isSubscribed: false
    };
  }
}

/**
 * Verifica suscripción para API routes
 */
export async function verifySubscriptionAPI(
  req: any,
  res: any,
  serviceName: 'SmartMoney' | 'TraderCall' | 'CashFlow'
): Promise<{ isSubscribed: boolean; user?: any; error?: string }> {
  try {
    console.log(`🔍 [SUBSCRIPTION API] Verificando acceso a ${serviceName}...`);
    
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return { isSubscribed: false, error: 'No autenticado' };
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email }).lean() as any;
    
    if (!user) {
      return { isSubscribed: false, error: 'Usuario no encontrado' };
    }

    const now = new Date();
    
    const suscripcionActiva = user.suscripciones?.find(
      (sub: any) => 
        sub.servicio === serviceName && 
        sub.activa === true && 
        new Date(sub.fechaVencimiento) > now
    );
    
    const subscriptionActiva = user.subscriptions?.find(
      (sub: any) => 
        sub.tipo === serviceName && 
        sub.activa === true &&
        (!sub.fechaFin || new Date(sub.fechaFin) > now)
    );

    const activeSubscription = user.activeSubscriptions?.find(
      (sub: any) => 
        sub.service === serviceName && 
        sub.isActive === true &&
        new Date(sub.expiryDate) > now
    );

    const isSubscribed = !!(suscripcionActiva || subscriptionActiva || activeSubscription);

    return {
      isSubscribed,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };

  } catch (error) {
    console.error('💥 [SUBSCRIPTION API] Error:', error);
    return { isSubscribed: false, error: 'Error interno' };
  }
}

