import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para debuggear el estado de suscripción de un usuario
 * GET: Obtener información detallada del usuario y sus pagos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/debug-user-subscription`);

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
        error: 'Debes iniciar sesión para verificar tu estado' 
      });
    }

    console.log('✅ Sesión verificada:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar pagos del usuario
    const payments = await Payment.find({ 
      userEmail: session.user.email 
    }).sort({ createdAt: -1 }).limit(10);

    console.log('✅ Usuario encontrado:', {
      email: user.email,
      role: user.role,
      subscriptionExpiry: user.subscriptionExpiry,
      activeSubscriptions: user.activeSubscriptions?.length || 0,
      payments: payments.length
    });

    // Verificar acceso a TraderCall
    const hasTraderCallAccess = user.activeSubscriptions?.find(
      (sub: any) => 
        sub.service === 'TraderCall' && 
        sub.isActive === true &&
        new Date(sub.expiryDate) > new Date()
    );

    const hasSuscriptorRole = user.role === 'suscriptor';

    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        role: user.role,
        subscriptionExpiry: user.subscriptionExpiry,
        lastPaymentDate: user.lastPaymentDate,
        activeSubscriptions: user.activeSubscriptions || [],
        suscripciones: user.suscripciones || [],
        subscriptions: user.subscriptions || []
      },
      payments: payments.map(payment => ({
        id: payment._id,
        service: payment.service,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        mercadopagoPaymentId: payment.mercadopagoPaymentId,
        externalReference: payment.externalReference,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      })),
      access: {
        hasTraderCallAccess: !!hasTraderCallAccess,
        hasSuscriptorRole,
        canAccessTraderCall: !!(hasTraderCallAccess || hasSuscriptorRole)
      },
      message: 'Estado del usuario obtenido correctamente'
    });

  } catch (error) {
    console.error('❌ Error obteniendo estado del usuario:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Inténtalo nuevamente.',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
