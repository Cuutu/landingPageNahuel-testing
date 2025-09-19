import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import { getMercadoPagoPayment, isPaymentSuccessful } from '@/lib/mercadopago';

/**
 * Cron job para procesar automáticamente pagos pendientes
 * Verifica el estado de pagos pendientes en MercadoPago y los procesa si están aprobados
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/cron/process-pending-payments`);

  // Verificar que sea un cron job (solo GET desde Vercel)
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  // Verificar autorización del cron (opcional)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('❌ Acceso no autorizado al cron job');
    return res.status(401).json({ 
      success: false,
      error: 'No autorizado' 
    });
  }

  try {
    await dbConnect();
    console.log('✅ Conectado a MongoDB para procesar pagos pendientes');

    // Buscar todos los pagos pendientes de los últimos 7 días
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const pendingPayments = await Payment.find({
      status: 'pending',
      createdAt: { $gte: sevenDaysAgo },
      service: { $in: ['TraderCall', 'SmartMoney', 'CashFlow', 'SwingTrading', 'DowJones'] }
    }).sort({ createdAt: -1 });

    console.log(`🔍 Encontrados ${pendingPayments.length} pagos pendientes para revisar`);

    if (pendingPayments.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay pagos pendientes para procesar',
        processed: 0,
        failed: 0
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Procesar cada pago pendiente
    for (const payment of pendingPayments) {
      try {
        console.log(`🔄 Procesando pago: ${payment._id} (${payment.externalReference})`);

        // Si no tiene preferenceId, intentar extraerlo del metadata
        let preferenceId = payment.metadata?.preferenceId;
        
        if (!preferenceId) {
          console.log(`⚠️ Pago ${payment._id} no tiene preferenceId, saltando`);
          continue;
        }

        // Consultar el estado del pago en MercadoPago usando la preferencia
        console.log(`🔍 Consultando estado de preferencia: ${preferenceId}`);
        
        // Buscar pagos asociados a esta preferencia
        const searchResult = await searchPaymentsByPreference(preferenceId);
        
        if (!searchResult.success || !searchResult.payments || searchResult.payments.length === 0) {
          console.log(`⚠️ No se encontraron pagos para la preferencia ${preferenceId}`);
          continue;
        }

        // Buscar el pago aprobado más reciente
        const approvedPayment = searchResult.payments.find((p: any) => 
          isPaymentSuccessful({ status: p.status })
        );

        if (!approvedPayment) {
          console.log(`⏳ Pago ${payment._id} aún está pendiente en MercadoPago`);
          continue;
        }

        console.log(`✅ Pago encontrado y aprobado en MercadoPago:`, {
          paymentId: approvedPayment.id,
          status: approvedPayment.status,
          amount: approvedPayment.transaction_amount
        });

        // Actualizar el pago en nuestra base de datos
        payment.status = 'approved';
        payment.mercadopagoPaymentId = approvedPayment.id;
        payment.paymentMethodId = approvedPayment.payment_method_id || 'auto_processed';
        payment.paymentTypeId = approvedPayment.payment_type_id || 'auto_processed';
        payment.installments = approvedPayment.installments || 1;
        payment.transactionDate = new Date();
        payment.updatedAt = new Date();
        
        // Agregar metadata de procesamiento automático
        if (!payment.metadata) {
          payment.metadata = {};
        }
        payment.metadata.processedAutomatically = true;
        payment.metadata.autoProcessingDate = new Date();
        payment.metadata.originalMercadoPagoData = approvedPayment;

        await payment.save();
        console.log(`✅ Pago ${payment._id} actualizado en la base de datos`);

        // Buscar el usuario y procesar la suscripción
        const user = await User.findById(payment.userId);
        if (!user) {
          console.error(`❌ Usuario no encontrado para pago ${payment._id}`);
          results.errors.push({
            paymentId: payment._id,
            error: 'Usuario no encontrado'
          });
          results.failed++;
          continue;
        }

        // Procesar la suscripción según el tipo de servicio
        const service = payment.service;
        const isSubscription = ['TraderCall', 'SmartMoney', 'CashFlow'].includes(service);
        const isTraining = ['SwingTrading', 'DowJones'].includes(service);

        if (isSubscription) {
          // Procesar suscripción
          await user.renewSubscription(
            service,
            payment.amount,
            payment.currency,
            payment.mercadopagoPaymentId
          );
          
          console.log(`✅ Suscripción ${service} procesada para usuario: ${user.email}`);
          
        } else if (isTraining) {
          // Procesar entrenamiento
          const nuevoEntrenamiento = {
            tipo: service,
            fechaInscripcion: new Date(),
            progreso: 0,
            activo: true,
            precio: payment.amount,
            metodoPago: 'mercadopago',
            transactionId: payment.mercadopagoPaymentId
          };

          user.entrenamientos.push(nuevoEntrenamiento);
          await user.save();
          
          console.log(`✅ Entrenamiento ${service} procesado para usuario: ${user.email}`);
        }

        results.processed++;
        console.log(`🎉 Pago ${payment._id} procesado exitosamente`);

      } catch (error) {
        console.error(`❌ Error procesando pago ${payment._id}:`, error);
        results.failed++;
        results.errors.push({
          paymentId: payment._id,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`✅ Procesamiento completado:`, {
      total: pendingPayments.length,
      processed: results.processed,
      failed: results.failed
    });

    return res.status(200).json({
      success: true,
      message: `Procesamiento automático completado`,
      total: pendingPayments.length,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error) {
    console.error('❌ Error en el cron job de procesamiento automático:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * Busca pagos asociados a una preferencia de MercadoPago
 */
async function searchPaymentsByPreference(preferenceId: string) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
    }

    // Buscar pagos por external_reference (que contiene información de la preferencia)
    const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${preferenceId}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      payments: data.results || []
    };

  } catch (error) {
    console.error('Error buscando pagos por preferencia:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      payments: []
    };
  }
}
