import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API de diagnóstico para verificar suscripciones de usuario
 * GET /api/auth/debug-subscription
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    const debug: any = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        email: session?.user?.email || null,
        role: session?.user?.role || null
      },
      database: {
        connected: false,
        userFound: false,
        subscriptionData: null
      },
      diagnosis: []
    };

    if (!session?.user?.email) {
      debug.diagnosis.push('❌ No hay sesión activa - usuario no autenticado');
      return res.status(200).json(debug);
    }

    // Conectar a la BD
    await connectDB();
    debug.database.connected = true;

    // Buscar usuario con TODOS sus datos de suscripción
    const user = await User.findOne({ email: session.user.email }).lean() as any;

    if (!user) {
      debug.diagnosis.push('❌ Usuario no encontrado en la base de datos');
      return res.status(200).json(debug);
    }

    debug.database.userFound = true;

    const now = new Date();

    // Mostrar TODOS los datos de suscripción raw
    debug.database.subscriptionData = {
      // Array antiguo: suscripciones
      suscripciones: user.suscripciones?.map((sub: any) => ({
        servicio: sub.servicio,
        activa: sub.activa,
        fechaVencimiento: sub.fechaVencimiento,
        isExpired: sub.fechaVencimiento ? new Date(sub.fechaVencimiento) < now : 'N/A',
        raw: sub
      })) || [],

      // Array admin: subscriptions
      subscriptions: user.subscriptions?.map((sub: any) => ({
        tipo: sub.tipo,
        activa: sub.activa,
        fechaFin: sub.fechaFin,
        isExpired: sub.fechaFin ? new Date(sub.fechaFin) < now : 'Sin fecha fin',
        raw: sub
      })) || [],

      // Array MercadoPago: activeSubscriptions
      activeSubscriptions: user.activeSubscriptions?.map((sub: any) => ({
        service: sub.service,
        isActive: sub.isActive,
        expiryDate: sub.expiryDate,
        isExpired: sub.expiryDate ? new Date(sub.expiryDate) < now : 'N/A',
        subscriptionType: sub.subscriptionType,
        raw: sub
      })) || []
    };

    // Verificar SmartMoney
    const smartMoneyCheck = {
      inSuscripciones: user.suscripciones?.find((s: any) => 
        s.servicio === 'SmartMoney' && s.activa && new Date(s.fechaVencimiento) > now
      ),
      inSubscriptions: user.subscriptions?.find((s: any) => 
        s.tipo === 'SmartMoney' && s.activa && (!s.fechaFin || new Date(s.fechaFin) > now)
      ),
      inActiveSubscriptions: user.activeSubscriptions?.find((s: any) => 
        s.service === 'SmartMoney' && s.isActive && new Date(s.expiryDate) > now
      )
    };

    // Verificar TraderCall
    const traderCallCheck = {
      inSuscripciones: user.suscripciones?.find((s: any) => 
        s.servicio === 'TraderCall' && s.activa && new Date(s.fechaVencimiento) > now
      ),
      inSubscriptions: user.subscriptions?.find((s: any) => 
        s.tipo === 'TraderCall' && s.activa && (!s.fechaFin || new Date(s.fechaFin) > now)
      ),
      inActiveSubscriptions: user.activeSubscriptions?.find((s: any) => 
        s.service === 'TraderCall' && s.isActive && new Date(s.expiryDate) > now
      )
    };

    debug.subscriptionVerification = {
      SmartMoney: {
        hasAccess: !!(smartMoneyCheck.inSuscripciones || smartMoneyCheck.inSubscriptions || smartMoneyCheck.inActiveSubscriptions),
        foundIn: {
          suscripciones: !!smartMoneyCheck.inSuscripciones,
          subscriptions: !!smartMoneyCheck.inSubscriptions,
          activeSubscriptions: !!smartMoneyCheck.inActiveSubscriptions
        }
      },
      TraderCall: {
        hasAccess: !!(traderCallCheck.inSuscripciones || traderCallCheck.inSubscriptions || traderCallCheck.inActiveSubscriptions),
        foundIn: {
          suscripciones: !!traderCallCheck.inSuscripciones,
          subscriptions: !!traderCallCheck.inSubscriptions,
          activeSubscriptions: !!traderCallCheck.inActiveSubscriptions
        }
      }
    };

    // Diagnóstico
    if (debug.subscriptionVerification.SmartMoney.hasAccess) {
      debug.diagnosis.push('✅ Usuario tiene acceso a SmartMoney');
    } else {
      debug.diagnosis.push('❌ Usuario NO tiene acceso a SmartMoney');
    }

    if (debug.subscriptionVerification.TraderCall.hasAccess) {
      debug.diagnosis.push('✅ Usuario tiene acceso a TraderCall');
    } else {
      debug.diagnosis.push('❌ Usuario NO tiene acceso a TraderCall');
    }

    // Verificar si hay suscripciones con nombres diferentes
    const allServiceNames = new Set<string>();
    user.suscripciones?.forEach((s: any) => allServiceNames.add(s.servicio));
    user.subscriptions?.forEach((s: any) => allServiceNames.add(s.tipo));
    user.activeSubscriptions?.forEach((s: any) => allServiceNames.add(s.service));

    debug.allServiceNamesFound = Array.from(allServiceNames);

    if (allServiceNames.size > 0) {
      debug.diagnosis.push(`📋 Servicios encontrados en BD: ${Array.from(allServiceNames).join(', ')}`);
    } else {
      debug.diagnosis.push('⚠️ No se encontraron suscripciones en ningún array');
    }

    return res.status(200).json(debug);

  } catch (error: any) {
    console.error('Error en debug-subscription:', error);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
}

