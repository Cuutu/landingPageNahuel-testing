import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para consultar directamente el estado del pago en MercadoPago
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/check-mercadopago-status`);

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

    console.log('✅ Consultando MercadoPago para:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar pagos pendientes de TraderCall de las últimas 24 horas
    const recentPendingPayments = await Payment.find({
      $or: [
        { userEmail: session.user.email },
        { userId: user._id }
      ],
      service: 'TraderCall',
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (recentPendingPayments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron pagos pendientes de TraderCall en las últimas 24 horas'
      });
    }

    console.log(`🔍 Encontrados ${recentPendingPayments.length} pagos pendientes`);

    // Importar SDK de MercadoPago
    const { MercadoPagoConfig, Payment: MPPayment } = await import('mercadopago');
    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 }
    });
    const mpPayment = new MPPayment(client);

    const results = [];

    // Verificar cada pago pendiente en MercadoPago
    for (const payment of recentPendingPayments) {
      try {
        console.log(`🔍 Consultando pago: ${payment.externalReference}`);
        
        // Buscar por external_reference en MercadoPago
        const searchResponse = await mpPayment.search({
          criteria: {
            external_reference: payment.externalReference
          }
        });

        console.log(`📊 Resultados de búsqueda para ${payment.externalReference}:`, {
          total: searchResponse.results?.length || 0,
          results: searchResponse.results?.map(p => ({
            id: p.id,
            status: p.status,
            external_reference: p.external_reference
          }))
        });

        if (searchResponse.results && searchResponse.results.length > 0) {
          const mpPaymentData = searchResponse.results[0];
          
          const result = {
            localPaymentId: payment._id,
            externalReference: payment.externalReference,
            localStatus: payment.status,
            mercadopagoStatus: mpPaymentData.status,
            mercadopagoId: mpPaymentData.id,
            statusChanged: payment.status !== mpPaymentData.status,
            shouldProcessWebhook: mpPaymentData.status === 'approved' && payment.status === 'pending'
          };

          results.push(result);

          // Si el pago está aprobado en MercadoPago pero pendiente localmente, procesarlo
          if (result.shouldProcessWebhook) {
            console.log(`🚀 Procesando pago aprobado: ${mpPaymentData.id}`);
            
            // Actualizar el pago local
            payment.status = 'approved';
            payment.mercadopagoPaymentId = mpPaymentData.id?.toString();
            await payment.save();

            // Procesar la suscripción
            await user.renewSubscription(
              'TraderCall',
              payment.amount,
              payment.currency || 'ARS',
              mpPaymentData.id?.toString()
            );

            result.processed = true;
            console.log('✅ Suscripción procesada automáticamente');
          }
        } else {
          results.push({
            localPaymentId: payment._id,
            externalReference: payment.externalReference,
            localStatus: payment.status,
            error: 'No encontrado en MercadoPago'
          });
        }
      } catch (mpError) {
        console.error(`❌ Error consultando MercadoPago para ${payment.externalReference}:`, mpError);
        results.push({
          localPaymentId: payment._id,
          externalReference: payment.externalReference,
          localStatus: payment.status,
          error: mpError instanceof Error ? mpError.message : 'Error desconocido'
        });
      }
    }

    // Verificar estado final del usuario
    const updatedUser = await User.findById(user._id);
    const hasActiveTraderCall = updatedUser?.activeSubscriptions?.some((sub: any) => 
      sub.service === 'TraderCall' && 
      sub.isActive && 
      new Date(sub.expiryDate) > new Date()
    );

    return res.status(200).json({
      success: true,
      message: 'Consulta a MercadoPago completada',
      pendingPaymentsChecked: recentPendingPayments.length,
      results,
      finalStatus: {
        hasActiveTraderCall,
        userRole: updatedUser?.role,
        activeSubscriptions: updatedUser?.activeSubscriptions?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Error consultando MercadoPago:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
