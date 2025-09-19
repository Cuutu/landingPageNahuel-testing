import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para debuggear el estado del webhook y pagos automáticos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/debug-webhook-status`);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido. Usa GET o POST.' 
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

    console.log('✅ Debuggeando webhook para:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar todos los pagos recientes del usuario (últimas 24 horas)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPayments = await Payment.find({
      $or: [
        { userEmail: session.user.email },
        { userId: user._id }
      ],
      createdAt: { $gte: last24Hours }
    }).sort({ createdAt: -1 });

    // Analizar cada pago
    const paymentAnalysis = recentPayments.map(payment => {
      const isTraderCall = payment.service === 'TraderCall';
      const isPending = payment.status === 'pending';
      const isApproved = payment.status === 'approved';
      
      return {
        id: payment._id,
        service: payment.service,
        status: payment.status,
        amount: payment.amount,
        createdAt: payment.createdAt,
        mercadopagoPaymentId: payment.mercadopagoPaymentId,
        externalReference: payment.externalReference,
        analysis: {
          isTraderCall,
          isPending,
          isApproved,
          hasWebhookId: !!payment.mercadopagoPaymentId,
          shouldTriggerSubscription: isTraderCall && isApproved
        }
      };
    });

    // Estado actual del usuario
    const currentState = {
      role: user.role,
      activeSubscriptions: user.activeSubscriptions || [],
      hasTraderCallActive: user.activeSubscriptions?.some((sub: any) => 
        sub.service === 'TraderCall' && 
        sub.isActive && 
        new Date(sub.expiryDate) > new Date()
      )
    };

    // Diagnóstico
    const diagnosis = {
      hasRecentPayments: recentPayments.length > 0,
      hasPendingTraderCall: paymentAnalysis.some(p => p.analysis.isTraderCall && p.analysis.isPending),
      hasApprovedTraderCall: paymentAnalysis.some(p => p.analysis.isTraderCall && p.analysis.isApproved),
      webhookWorking: paymentAnalysis.some(p => p.analysis.hasWebhookId),
      subscriptionAssigned: currentState.hasTraderCallActive
    };

    let recommendations = [];
    
    if (diagnosis.hasPendingTraderCall && !diagnosis.hasApprovedTraderCall) {
      recommendations.push("Tienes un pago de TraderCall pendiente. El webhook debería procesarlo cuando MercadoPago lo apruebe.");
    }
    
    if (diagnosis.hasApprovedTraderCall && !diagnosis.subscriptionAssigned) {
      recommendations.push("⚠️ PROBLEMA: Tienes un pago aprobado pero no se asignó la suscripción. El webhook no funcionó correctamente.");
    }
    
    if (!diagnosis.webhookWorking) {
      recommendations.push("⚠️ PROBLEMA: Los pagos no tienen mercadopagoPaymentId, indica que el webhook no se está ejecutando.");
    }
    
    if (diagnosis.subscriptionAssigned) {
      recommendations.push("✅ Todo funciona correctamente. Tienes la suscripción de TraderCall activa.");
    }

    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        role: user.role
      },
      currentState,
      recentPayments: paymentAnalysis,
      diagnosis,
      recommendations,
      webhookUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
      middlewareActive: true // El middleware siempre está activo
    });

  } catch (error) {
    console.error('❌ Error debuggeando webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
