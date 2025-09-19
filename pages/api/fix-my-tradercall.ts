import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para arreglar específicamente la suscripción de TraderCall del usuario actual
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/fix-my-tradercall`);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
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

    console.log('✅ Arreglando TraderCall para:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar el pago más reciente de TraderCall
    const recentTraderCallPayment = await Payment.findOne({
      $or: [
        { userEmail: session.user.email },
        { userId: user._id }
      ],
      service: 'TraderCall',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
    }).sort({ createdAt: -1 });

    if (!recentTraderCallPayment) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró un pago reciente de TraderCall'
      });
    }

    console.log('💰 Pago encontrado:', {
      id: recentTraderCallPayment._id,
      status: recentTraderCallPayment.status,
      amount: recentTraderCallPayment.amount,
      service: recentTraderCallPayment.service
    });

    // Verificar si ya tiene la suscripción activa
    const hasActiveTraderCall = user.activeSubscriptions?.some((sub: any) => 
      sub.service === 'TraderCall' && 
      sub.isActive && 
      new Date(sub.expiryDate) > new Date()
    );

    if (hasActiveTraderCall) {
      return res.status(200).json({
        success: true,
        message: 'Ya tienes una suscripción activa de TraderCall',
        currentSubscription: user.activeSubscriptions?.find((sub: any) => sub.service === 'TraderCall')
      });
    }

    // Forzar la asignación de la suscripción (simular webhook exitoso)
    console.log('🔧 Forzando asignación de suscripción TraderCall...');
    
    // Usar el método renewSubscription del usuario
    await user.renewSubscription(
      'TraderCall', 
      recentTraderCallPayment.amount, 
      recentTraderCallPayment.currency || 'ARS',
      recentTraderCallPayment.mercadopagoPaymentId || `manual_fix_${Date.now()}`
    );

    // Actualizar el estado del pago a aprobado si estaba pendiente
    if (recentTraderCallPayment.status === 'pending') {
      recentTraderCallPayment.status = 'approved';
      recentTraderCallPayment.mercadopagoPaymentId = recentTraderCallPayment.mercadopagoPaymentId || `manual_fix_${Date.now()}`;
      await recentTraderCallPayment.save();
      console.log('✅ Pago marcado como aprobado');
    }

    // Obtener el usuario actualizado
    const updatedUser = await User.findById(user._id);
    const newSubscription = updatedUser?.activeSubscriptions?.find((sub: any) => sub.service === 'TraderCall');

    console.log('✅ Suscripción TraderCall asignada exitosamente');

    return res.status(200).json({
      success: true,
      message: 'Suscripción de TraderCall asignada correctamente',
      payment: {
        id: recentTraderCallPayment._id,
        status: recentTraderCallPayment.status,
        amount: recentTraderCallPayment.amount
      },
      subscription: newSubscription,
      user: {
        email: updatedUser?.email,
        role: updatedUser?.role,
        subscriptionExpiry: updatedUser?.subscriptionExpiry
      }
    });

  } catch (error) {
    console.error('❌ Error arreglando TraderCall:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
