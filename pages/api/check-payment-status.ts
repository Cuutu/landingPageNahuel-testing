import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para verificar el estado de un pago específico
 * GET: Verificar estado del último pago de TraderCall
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/check-payment-status`);

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
        error: 'Debes iniciar sesión para verificar el pago' 
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

    // Buscar el último pago de TraderCall
    const lastPayment = await Payment.findOne({ 
      userEmail: session.user.email,
      service: 'TraderCall'
    }).sort({ createdAt: -1 });

    if (!lastPayment) {
      console.log('❌ No hay pagos de TraderCall');
      return res.status(404).json({ 
        success: false,
        error: 'No se encontraron pagos de TraderCall' 
      });
    }

    console.log('✅ Último pago encontrado:', {
      id: lastPayment._id,
      status: lastPayment.status,
      service: lastPayment.service,
      amount: lastPayment.amount,
      externalReference: lastPayment.externalReference,
      mercadopagoPaymentId: lastPayment.mercadopagoPaymentId,
      createdAt: lastPayment.createdAt,
      updatedAt: lastPayment.updatedAt
    });

    // Verificar acceso actual del usuario
    const hasTraderCallAccess = user.activeSubscriptions?.find(
      (sub: any) => 
        sub.service === 'TraderCall' && 
        sub.isActive === true &&
        new Date(sub.expiryDate) > new Date()
    );

    const hasSuscriptorRole = user.role === 'suscriptor';

    return res.status(200).json({
      success: true,
      payment: {
        id: lastPayment._id,
        service: lastPayment.service,
        amount: lastPayment.amount,
        currency: lastPayment.currency,
        status: lastPayment.status,
        mercadopagoPaymentId: lastPayment.mercadopagoPaymentId,
        externalReference: lastPayment.externalReference,
        paymentMethodId: lastPayment.paymentMethodId,
        paymentTypeId: lastPayment.paymentTypeId,
        installments: lastPayment.installments,
        transactionDate: lastPayment.transactionDate,
        createdAt: lastPayment.createdAt,
        updatedAt: lastPayment.updatedAt,
        metadata: lastPayment.metadata
      },
      user: {
        email: user.email,
        role: user.role,
        subscriptionExpiry: user.subscriptionExpiry,
        lastPaymentDate: user.lastPaymentDate,
        activeSubscriptions: user.activeSubscriptions || []
      },
      access: {
        hasTraderCallAccess: !!hasTraderCallAccess,
        hasSuscriptorRole,
        canAccessTraderCall: !!(hasTraderCallAccess || hasSuscriptorRole)
      },
      analysis: {
        paymentNeedsProcessing: lastPayment.status === 'pending',
        webhookExecuted: !!lastPayment.mercadopagoPaymentId,
        subscriptionActive: !!hasTraderCallAccess
      },
      message: 'Estado del pago verificado correctamente'
    });

  } catch (error) {
    console.error('❌ Error verificando estado del pago:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Inténtalo nuevamente.',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
