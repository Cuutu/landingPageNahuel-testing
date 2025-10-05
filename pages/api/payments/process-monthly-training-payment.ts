import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

/**
 * API para procesar pagos de entrenamientos mensuales
 * Verifica con MercadoPago y actualiza el paymentStatus
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    const { externalReference } = req.body;

    if (!externalReference) {
      return res.status(400).json({
        success: false,
        error: 'externalReference es requerido'
      });
    }

    await dbConnect();

    console.log('🔍 Procesando pago de entrenamiento mensual:', externalReference);

    // Buscar la suscripción mensual
    const monthlySubscription = await MonthlyTrainingSubscription.findOne({
      paymentId: externalReference
    });

    if (!monthlySubscription) {
      console.error('❌ Suscripción mensual no encontrada:', externalReference);
      return res.status(404).json({
        success: false,
        error: 'Suscripción no encontrada'
      });
    }

    console.log('📋 Suscripción encontrada:', {
      id: monthlySubscription._id,
      userEmail: monthlySubscription.userEmail,
      paymentStatus: monthlySubscription.paymentStatus
    });

    // Si ya está procesada, devolver éxito
    if (monthlySubscription.paymentStatus === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Pago ya procesado',
        subscription: {
          id: monthlySubscription._id,
          userEmail: monthlySubscription.userEmail,
          trainingType: monthlySubscription.trainingType,
          paymentStatus: monthlySubscription.paymentStatus
        }
      });
    }

    // Verificar con MercadoPago
    const payment = new Payment(client);
    
    try {
      // Buscar pagos por external_reference
      const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`;
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error en búsqueda de pagos: ${response.status}`);
      }

      const searchData = await response.json();
      const payments = searchData.results || [];

      console.log('🔍 Pagos encontrados en MercadoPago:', payments.length);

      // Buscar pago aprobado
      const approvedPayment = payments.find((p: any) => p.status === 'approved');

      if (!approvedPayment) {
        console.log('⏳ No se encontró pago aprobado, estado actual:', payments.map((p: any) => p.status));
        return res.status(400).json({
          success: false,
          error: 'No se encontró pago aprobado en MercadoPago',
          shouldRetry: true,
          statuses: payments.map((p: any) => p.status)
        });
      }

      console.log('✅ Pago aprobado encontrado:', {
        id: approvedPayment.id,
        status: approvedPayment.status,
        amount: approvedPayment.transaction_amount
      });

      // Actualizar suscripción
      monthlySubscription.paymentStatus = 'completed';
      monthlySubscription.isActive = true;
      monthlySubscription.accessGranted = true;
      monthlySubscription.mercadopagoPaymentId = approvedPayment.id.toString();
      monthlySubscription.updatedAt = new Date();

      await monthlySubscription.save();

      console.log('✅ Suscripción mensual actualizada:', {
        subscriptionId: monthlySubscription._id,
        userEmail: monthlySubscription.userEmail,
        paymentStatus: monthlySubscription.paymentStatus
      });

      return res.status(200).json({
        success: true,
        message: 'Pago procesado exitosamente',
        subscription: {
          id: monthlySubscription._id,
          userEmail: monthlySubscription.userEmail,
          trainingType: monthlySubscription.trainingType,
          subscriptionMonth: monthlySubscription.subscriptionMonth,
          subscriptionYear: monthlySubscription.subscriptionYear,
          paymentStatus: monthlySubscription.paymentStatus,
          isActive: monthlySubscription.isActive,
          accessGranted: monthlySubscription.accessGranted
        },
        payment: {
          id: approvedPayment.id,
          status: approvedPayment.status,
          amount: approvedPayment.transaction_amount,
          currency: approvedPayment.currency_id
        }
      });

    } catch (mpError) {
      console.error('❌ Error consultando MercadoPago:', mpError);
      
      // Fallback: Si no se puede verificar con MercadoPago, marcar como pendiente
      return res.status(400).json({
        success: false,
        error: 'Error verificando pago con MercadoPago. Por favor, intenta nuevamente.',
        shouldRetry: true
      });
    }

  } catch (error) {
    console.error('❌ Error procesando pago de entrenamiento mensual:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
