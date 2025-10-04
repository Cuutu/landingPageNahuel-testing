import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import Payment from '@/models/Payment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Buscar todas las suscripciones mensuales pendientes
    const pendingSubscriptions = await MonthlyTrainingSubscription.find({
      paymentStatus: 'pending'
    });

    console.log(`📋 Encontradas ${pendingSubscriptions.length} suscripciones pendientes`);

    const results = [];

    for (const subscription of pendingSubscriptions) {
      try {
        // Buscar el pago correspondiente en la tabla Payment
        const payment = await Payment.findOne({
          externalReference: subscription.paymentId
        });

        if (payment && payment.status === 'approved') {
          // Actualizar la suscripción mensual
          subscription.paymentStatus = 'completed';
          subscription.isActive = true;
          subscription.accessGranted = true;
          subscription.updatedAt = new Date();
          
          await subscription.save();

          results.push({
            subscriptionId: subscription._id,
            userEmail: subscription.userEmail,
            status: 'updated',
            paymentStatus: payment.status,
            paymentId: payment.mercadopagoPaymentId
          });

          console.log(`✅ Suscripción actualizada: ${subscription._id}`);
        } else {
          results.push({
            subscriptionId: subscription._id,
            userEmail: subscription.userEmail,
            status: 'no_payment_found',
            paymentStatus: payment?.status || 'not_found'
          });

          console.log(`⚠️ No se encontró pago aprobado para: ${subscription._id}`);
        }
      } catch (error) {
        results.push({
          subscriptionId: subscription._id,
          userEmail: subscription.userEmail,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });

        console.error(`❌ Error procesando suscripción ${subscription._id}:`, error);
      }
    }

    // Obtener estadísticas actualizadas
    const updatedStats = await MonthlyTrainingSubscription.aggregate([
      {
        $group: {
          _id: {
            year: '$subscriptionYear',
            month: '$subscriptionMonth',
            trainingType: '$trainingType'
          },
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0]
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: `Procesadas ${pendingSubscriptions.length} suscripciones`,
      results,
      updatedStats,
      summary: {
        total: pendingSubscriptions.length,
        updated: results.filter(r => r.status === 'updated').length,
        errors: results.filter(r => r.status === 'error').length,
        noPaymentFound: results.filter(r => r.status === 'no_payment_found').length
      }
    });

  } catch (error) {
    console.error('Error en fix monthly subscriptions:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
