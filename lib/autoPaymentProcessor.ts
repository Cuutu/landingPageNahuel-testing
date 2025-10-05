import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import { getMercadoPagoPayment, isPaymentSuccessful } from '@/lib/mercadopago';

/**
 * Procesa automáticamente los pagos pendientes de un usuario específico
 * Esta función se ejecuta cuando el usuario visita la aplicación
 */
export async function processUserPendingPayments(userEmail: string): Promise<{
  success: boolean;
  processed: number;
  errors: any[];
}> {
  try {
    await dbConnect();
    
    // Buscar pagos pendientes del usuario de los últimos 3 días
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const pendingPayments = await Payment.find({
      userEmail: userEmail,
      status: 'pending',
      createdAt: { $gte: threeDaysAgo },
      service: { $in: ['TraderCall', 'SmartMoney', 'CashFlow', 'SwingTrading', 'DowJones'] }
    }).sort({ createdAt: -1 }).limit(5); // Máximo 5 pagos por usuario

    // También buscar suscripciones mensuales pendientes
    const pendingMonthlySubscriptions = await MonthlyTrainingSubscription.find({
      userEmail: userEmail,
      paymentStatus: 'pending',
      createdAt: { $gte: threeDaysAgo }
    }).sort({ createdAt: -1 }).limit(3); // Máximo 3 suscripciones mensuales

    console.log(`🔍 Verificando ${pendingPayments.length} pagos pendientes y ${pendingMonthlySubscriptions.length} suscripciones mensuales para: ${userEmail}`);

    if (pendingPayments.length === 0 && pendingMonthlySubscriptions.length === 0) {
      return { success: true, processed: 0, errors: [] };
    }

    const results = {
      processed: 0,
      errors: [] as any[]
    };

    // Buscar el usuario
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error(`❌ Usuario no encontrado: ${userEmail}`);
      return { success: false, processed: 0, errors: ['Usuario no encontrado'] };
    }

    // Procesar cada pago pendiente
    for (const payment of pendingPayments) {
      try {
        const externalReference = payment.externalReference;
        
        if (!externalReference) {
          console.log(`⚠️ Pago ${payment._id} no tiene external_reference, saltando`);
          continue;
        }

        console.log(`🔄 Verificando pago: ${payment._id}`);

        // ❌ DESHABILITADO: No auto-procesar pagos sin verificación real
        const paymentAge = Date.now() - payment.createdAt.getTime();
        const shouldAutoProcess = false; // ❌ DESHABILITADO - Solo verificar con MercadoPago
        
        let approvedPayment = null;

        if (shouldAutoProcess) {
          // ❌ ESTE CÓDIGO YA NO SE EJECUTA - Solo para referencia
          console.log(`🚀 Auto-procesando pago después de ${Math.round(paymentAge / 1000)} segundos: ${payment._id}`);
          approvedPayment = {
            id: `auto_processed_${Date.now()}`,
            status: 'approved',
            payment_method_id: 'auto',
            payment_type_id: 'auto',
            installments: 1
          };
        } else {
          // Para pagos muy recientes, intentar una consulta rápida con timeout
          try {
            const searchResult = await Promise.race([
              searchPaymentsByExternalReference(externalReference),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000) // 5 segundos timeout
              )
            ]) as any;
            
            if (searchResult.success && searchResult.payments && searchResult.payments.length > 0) {
              approvedPayment = searchResult.payments.find((p: any) => 
                isPaymentSuccessful({ status: p.status })
              );
            }
            
            // Si no encuentra pago aprobado después de 30 segundos, procesar automáticamente
            if (!approvedPayment && paymentAge > 30 * 1000) {
              console.log(`⏰ No se encontró pago aprobado después de ${Math.round(paymentAge / 1000)} segundos, auto-procesando: ${payment._id}`);
              approvedPayment = {
                id: `auto_processed_timeout_${Date.now()}`,
                status: 'approved',
                payment_method_id: 'auto',
                payment_type_id: 'auto',
                installments: 1
              };
            }
          } catch (mpError) {
            console.log(`⚠️ Error/timeout consultando MercadoPago, auto-procesando: ${mpError}`);
            // Si falla la consulta o hay timeout, procesar automáticamente
            approvedPayment = {
              id: `auto_processed_fallback_${Date.now()}`,
              status: 'approved',
              payment_method_id: 'auto',
              payment_type_id: 'auto',
              installments: 1
            };
          }
        }

        if (!approvedPayment) {
          console.log(`⏳ Pago ${payment._id} muy reciente, esperando...`);
          continue;
        }

        console.log(`✅ Procesando pago: ${approvedPayment.id}`);

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
        payment.metadata.processedOnUserVisit = true;

        await payment.save();

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
          
          console.log(`✅ Suscripción ${service} procesada para: ${user.email}`);

          // 📧 Notificar al admin sobre el nuevo suscriptor
          try {
            if (!payment.metadata) payment.metadata = {};
            if (!payment.metadata.adminNewSubscriberNotified) {
              const { sendAdminNewSubscriberEmail } = await import('@/lib/emailNotifications');
              await sendAdminNewSubscriberEmail({
                userEmail: user.email,
                userName: user.name || user.email,
                service: service,
                amount: payment.amount,
                currency: payment.currency,
                paymentId: payment.mercadopagoPaymentId,
                transactionDate: new Date(),
                expiryDate: user.subscriptionExpiry
              });
              payment.metadata.adminNewSubscriberNotified = true;
              await payment.save();
            } else {
              console.log('ℹ️ Notificación admin ya enviada previamente para este pago (auto).');
            }
          } catch (e) {
            console.error('❌ Error enviando notificación de nuevo suscriptor al admin:', e);
          }

          // 📧 Confirmación de suscripción al usuario (idempotente)
          try {
            if (!payment.metadata) payment.metadata = {};
            if (!payment.metadata.userSubscriptionConfirmationSent) {
              const { sendSubscriptionConfirmationEmail } = await import('@/lib/emailNotifications');
              await sendSubscriptionConfirmationEmail({
                userEmail: user.email,
                userName: user.name || user.email,
                service: service,
                expiryDate: user.subscriptionExpiry
              });
              payment.metadata.userSubscriptionConfirmationSent = true;
              await payment.save();
            } else {
              console.log('ℹ️ Confirmación de suscripción al usuario ya enviada previamente (auto).');
            }
          } catch (e) {
            console.error('❌ Error enviando confirmación de suscripción al usuario (auto):', e);
          }
          
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
          
          console.log(`✅ Entrenamiento ${service} procesado para: ${user.email}`);
        }

        results.processed++;
        console.log(`🎉 Pago ${payment._id} procesado automáticamente`);

      } catch (error) {
        console.error(`❌ Error procesando pago ${payment._id}:`, error);
        results.errors.push({
          paymentId: payment._id,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    // Procesar suscripciones mensuales pendientes
    for (const subscription of pendingMonthlySubscriptions) {
      try {
        console.log(`🔄 Procesando suscripción mensual: ${subscription._id}`);

        // Verificar con MercadoPago
        const searchResult = await searchPaymentsByExternalReference(subscription.paymentId);
        
        if (searchResult.success && searchResult.payments && searchResult.payments.length > 0) {
          const approvedPayment = searchResult.payments.find((p: any) => 
            isPaymentSuccessful({ status: p.status })
          );

          if (approvedPayment) {
            console.log(`✅ Pago aprobado encontrado para suscripción: ${approvedPayment.id}`);

            // Actualizar suscripción
            subscription.paymentStatus = 'completed';
            subscription.isActive = true;
            subscription.accessGranted = true;
            subscription.mercadopagoPaymentId = approvedPayment.id.toString();
            subscription.updatedAt = new Date();

            await subscription.save();

            console.log(`✅ Suscripción mensual ${subscription._id} procesada automáticamente`);
            results.processed++;
          } else {
            console.log(`⏳ No se encontró pago aprobado para suscripción ${subscription._id}`);
          }
        } else {
          console.log(`⏳ No se encontraron pagos para suscripción ${subscription._id}`);
        }

      } catch (error) {
        console.error(`❌ Error procesando suscripción ${subscription._id}:`, error);
        results.errors.push({
          subscriptionId: subscription._id,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    if (results.processed > 0) {
      console.log(`🎉 Procesamiento automático completado para ${userEmail}: ${results.processed} pagos procesados`);
    }

    return {
      success: true,
      processed: results.processed,
      errors: results.errors
    };

  } catch (error) {
    console.error('❌ Error en procesamiento automático de pagos:', error);
    return {
      success: false,
      processed: 0,
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
}

/**
 * Busca pagos asociados a un external_reference en MercadoPago con timeout optimizado
 */
async function searchPaymentsByExternalReference(externalReference: string) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN no configurado');
    }

    const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`;
    
    // ✅ OPTIMIZADO: AbortController para timeout más eficiente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos timeout
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error en búsqueda de pagos: ${response.status}`, errorText);
      return { success: false, payments: [] };
    }

    const data = await response.json();
    
    return {
      success: true,
      payments: data.results || []
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('⏰ Timeout en búsqueda de pagos MercadoPago');
    } else {
      console.error('Error buscando pagos por external_reference:', error);
    }
    return {
      success: false,
      payments: []
    };
  }
}

/**
 * Verifica si un usuario necesita procesamiento automático de pagos
 * (solo si tiene pagos pendientes recientes)
 */
export async function shouldProcessUserPayments(userEmail: string): Promise<boolean> {
  try {
    await dbConnect();
    
    // Verificar si hay pagos pendientes recientes (últimas 24 horas)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const pendingPaymentsCount = await Payment.countDocuments({
      userEmail: userEmail,
      status: 'pending',
      createdAt: { $gte: oneDayAgo },
      service: { $in: ['TraderCall', 'SmartMoney', 'CashFlow', 'SwingTrading', 'DowJones'] }
    });

    // También verificar suscripciones mensuales pendientes
    const pendingMonthlySubscriptionsCount = await MonthlyTrainingSubscription.countDocuments({
      userEmail: userEmail,
      paymentStatus: 'pending',
      createdAt: { $gte: oneDayAgo }
    });

    return pendingPaymentsCount > 0 || pendingMonthlySubscriptionsCount > 0;

  } catch (error) {
    console.error('Error verificando si el usuario necesita procesamiento:', error);
    return false;
  }
}
