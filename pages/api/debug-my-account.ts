import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API para debuggear exactamente qué tiene tu cuenta
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/debug-my-account`);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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

    console.log('✅ Debuggeando cuenta de:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Analizar acceso a TraderCall específicamente
    const traderCallInActiveSubscriptions = user.activeSubscriptions?.find(
      (sub: any) => sub.service === 'TraderCall'
    );

    const traderCallInSuscripciones = user.suscripciones?.find(
      (sub: any) => sub.servicio === 'TraderCall'
    );

    const traderCallInSubscriptions = user.subscriptions?.find(
      (sub: any) => sub.tipo === 'TraderCall'
    );

    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        subscriptionExpiry: user.subscriptionExpiry,
        lastPaymentDate: user.lastPaymentDate
      },
      arrays: {
        activeSubscriptions: {
          total: user.activeSubscriptions?.length || 0,
          items: user.activeSubscriptions || [],
          hasTraderCall: !!traderCallInActiveSubscriptions
        },
        suscripciones: {
          total: user.suscripciones?.length || 0,
          items: user.suscripciones || [],
          hasTraderCall: !!traderCallInSuscripciones
        },
        subscriptions: {
          total: user.subscriptions?.length || 0,
          items: user.subscriptions || [],
          hasTraderCall: !!traderCallInSubscriptions
        }
      },
      traderCallAccess: {
        fromActiveSubscriptions: !!traderCallInActiveSubscriptions,
        fromSuscripciones: !!traderCallInSuscripciones,
        fromSubscriptions: !!traderCallInSubscriptions,
        shouldHaveAccess: !!(traderCallInActiveSubscriptions || traderCallInSuscripciones || traderCallInSubscriptions)
      },
      adminPanelNote: "El admin panel muestra un sistema diferente. Tu acceso real viene de los arrays del usuario."
    });

  } catch (error) {
    console.error('❌ Error debuggeando cuenta:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
