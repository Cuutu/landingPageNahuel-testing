import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para procesar manualmente un pago pendiente
 * POST: Procesar el último pago pendiente de TraderCall
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/process-pending-payment`);

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
        error: 'Debes iniciar sesión para procesar el pago' 
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

    // Buscar el último pago pendiente de TraderCall
    const pendingPayment = await Payment.findOne({ 
      userEmail: session.user.email,
      service: 'TraderCall',
      status: 'pending'
    }).sort({ createdAt: -1 });

    if (!pendingPayment) {
      console.log('❌ No hay pagos pendientes de TraderCall');
      return res.status(404).json({ 
        success: false,
        error: 'No hay pagos pendientes de TraderCall para procesar' 
      });
    }

    console.log('✅ Pago pendiente encontrado:', {
      id: pendingPayment._id,
      externalReference: pendingPayment.externalReference,
      amount: pendingPayment.amount,
      service: pendingPayment.service
    });

    // Actualizar el pago a aprobado
    pendingPayment.status = 'approved';
    pendingPayment.mercadopagoPaymentId = `manual_${Date.now()}`;
    pendingPayment.paymentMethodId = 'manual_processing';
    pendingPayment.paymentTypeId = 'manual';
    pendingPayment.transactionDate = new Date();
    pendingPayment.updatedAt = new Date();
    
    // Agregar metadata de procesamiento manual
    if (!pendingPayment.metadata) {
      pendingPayment.metadata = {};
    }
    pendingPayment.metadata.processedManually = true;
    pendingPayment.metadata.manualProcessingDate = new Date();
    pendingPayment.metadata.processedBy = session.user.email;

    await pendingPayment.save();
    console.log('✅ Pago actualizado a aprobado');

    // Procesar la suscripción usando el método del modelo User
    console.log('🔄 Procesando suscripción de TraderCall...');
    
    await user.renewSubscription(
      pendingPayment.service,
      pendingPayment.amount,
      pendingPayment.currency,
      pendingPayment.mercadopagoPaymentId
    );
    
    console.log('✅ Suscripción de TraderCall procesada exitosamente');

    // Obtener usuario actualizado para verificar los cambios
    const updatedUser = await User.findById(user._id);
    
    // Verificar el acceso después del procesamiento
    const hasTraderCallAccess = updatedUser?.activeSubscriptions?.find(
      (sub: any) => 
        sub.service === 'TraderCall' && 
        sub.isActive === true &&
        new Date(sub.expiryDate) > new Date()
    );

    const hasSuscriptorRole = updatedUser?.role === 'suscriptor';

    console.log('🔍 Estado después del procesamiento:', {
      userRole: updatedUser?.role,
      hasTraderCallAccess: !!hasTraderCallAccess,
      activeSubscriptionsCount: updatedUser?.activeSubscriptions?.length || 0
    });

    return res.status(200).json({
      success: true,
      message: 'Pago procesado exitosamente y suscripción activada',
      payment: {
        id: pendingPayment._id,
        service: pendingPayment.service,
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        status: pendingPayment.status,
        externalReference: pendingPayment.externalReference,
        mercadopagoPaymentId: pendingPayment.mercadopagoPaymentId,
        updatedAt: pendingPayment.updatedAt
      },
      user: {
        email: updatedUser?.email,
        role: updatedUser?.role,
        subscriptionExpiry: updatedUser?.subscriptionExpiry,
        lastPaymentDate: updatedUser?.lastPaymentDate,
        activeSubscriptions: updatedUser?.activeSubscriptions || []
      },
      access: {
        hasTraderCallAccess: !!hasTraderCallAccess,
        hasSuscriptorRole,
        canAccessTraderCall: !!(hasTraderCallAccess || hasSuscriptorRole)
      }
    });

  } catch (error) {
    console.error('❌ Error procesando pago pendiente:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Inténtalo nuevamente.',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
