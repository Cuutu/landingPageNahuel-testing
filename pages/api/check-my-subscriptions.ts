import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API para verificar las suscripciones actuales del usuario logueado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/check-my-subscriptions`);

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

    console.log('✅ Verificando suscripciones para:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Verificar específicamente TraderCall en activeSubscriptions
    const traderCallSub = user.activeSubscriptions?.find(
      (sub: any) => sub.service === 'TraderCall'
    );

    console.log('🔍 Estado de suscripciones:', {
      email: user.email,
      role: user.role,
      totalActiveSubscriptions: user.activeSubscriptions?.length || 0,
      hasTraderCall: !!traderCallSub,
      traderCallDetails: traderCallSub
    });

    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        subscriptionExpiry: user.subscriptionExpiry,
        lastPaymentDate: user.lastPaymentDate
      },
      subscriptions: {
        activeSubscriptions: user.activeSubscriptions || [],
        suscripciones: user.suscripciones || [],
        subscriptions: user.subscriptions || []
      },
      traderCall: {
        hasSubscription: !!traderCallSub,
        details: traderCallSub || null,
        isActive: traderCallSub?.isActive || false,
        isExpired: traderCallSub ? new Date(traderCallSub.expiryDate) <= new Date() : null
      }
    });

  } catch (error) {
    console.error('❌ Error verificando suscripciones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
