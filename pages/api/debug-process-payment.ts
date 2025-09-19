import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para procesar manualmente un pago (solo para debug)
 * POST: Procesar un pago como si viniera del webhook de MercadoPago
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/debug-process-payment`);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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
        error: 'Debes iniciar sesión para procesar un pago' 
      });
    }

    console.log('✅ Sesión verificada:', session.user.email);

    const { service = 'TraderCall', amount = 5000, currency = 'ARS' } = req.body;

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    console.log('✅ Usuario encontrado:', user.email);

    // Crear pago simulado
    const externalReference = `debug_${service}_${user._id}_${Date.now()}`;
    const paymentId = `debug_${Date.now()}`;

    const payment = new Payment({
      userId: user._id,
      userEmail: user.email,
      service,
      amount,
      currency,
      status: 'approved',
      mercadopagoPaymentId: paymentId,
      externalReference,
      paymentMethodId: 'debug',
      paymentTypeId: 'debug',
      installments: 1,
      transactionDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: {
        createdFromDebug: true,
        originalStatus: 'approved'
      }
    });

    await payment.save();
    console.log('✅ Pago creado:', payment._id);

    // Procesar el pago como si fuera exitoso
    console.log('🔄 Procesando pago exitoso...');
    
    // Llamar al método renewSubscription
    await user.renewSubscription(service, amount, currency, paymentId);
    
    console.log('✅ Suscripción renovada para:', user.email);

    // Obtener usuario actualizado
    const updatedUser = await User.findById(user._id);
    
    return res.status(200).json({
      success: true,
      message: 'Pago procesado exitosamente',
      payment: {
        id: payment._id,
        service: payment.service,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        externalReference: payment.externalReference
      },
      user: {
        email: updatedUser?.email,
        role: updatedUser?.role,
        subscriptionExpiry: updatedUser?.subscriptionExpiry,
        activeSubscriptions: updatedUser?.activeSubscriptions || []
      }
    });

  } catch (error) {
    console.error('❌ Error procesando pago:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Inténtalo nuevamente.',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
