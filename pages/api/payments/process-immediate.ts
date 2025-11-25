import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Booking from '@/models/Booking';
import { logger } from '@/lib/logger';
import { createTrainingEnrollmentNotification } from '@/lib/trainingNotifications';

// Cargas diferidas para evitar dependencias pesadas si no se usan
const importAdvisoryDate = async () => (await import('@/models/AdvisoryDate')).default;
const importCalendar = async () => await import('@/lib/googleCalendar');
const importEmails = async () => await import('@/lib/emailNotifications');

/**
 * ✅ NUEVO: API para procesamiento inmediato de pagos
 * Se ejecuta cuando el usuario regresa del checkout de MercadoPago
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
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false,
        error: 'No autorizado' 
      });
    }

    const { externalReference, paymentId } = req.body;
    
    if (!externalReference) {
      return res.status(400).json({ 
        success: false,
        error: 'External reference requerido' 
      });
    }

    await dbConnect();

    logger.info('IMMEDIATE start', { module: 'payments', step: 'start', user: session.user.email, reference: externalReference });

    // Buscar el pago (incluyendo ya procesados por webhook)
    const payment = await Payment.findOne({
      userEmail: session.user.email,
      externalReference: externalReference,
      status: { $in: ['pending', 'in_process', 'approved'] }
    });

    if (!payment) {
      logger.warn('IMMEDIATE payment not found', { module: 'payments', step: 'find_payment', user: session.user.email, reference: externalReference });
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }

    // Si el pago ya fue procesado por webhook, devolver éxito
    if (payment.status === 'approved') {
      logger.info('IMMEDIATE payment already processed by webhook', { module: 'payments', step: 'already_processed', paymentId: payment._id.toString() });
      return res.status(200).json({
        success: true,
        message: 'Pago ya procesado por webhook',
        payment: {
          id: payment._id,
          status: payment.status,
          service: payment.service,
          amount: payment.amount,
          currency: payment.currency,
          mercadopagoPaymentId: payment.mercadopagoPaymentId,
          alreadyProcessed: true
        }
      });
    }

    // Buscar el usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // ✅ VERIFICACIÓN REAL: Verificar con MercadoPago antes de aprobar
    logger.info('IMMEDIATE verify payment', { module: 'payments', step: 'verify_payment', paymentId: payment._id.toString() });

    // Verificar el estado real del pago con MercadoPago
    let mercadopagoStatus = 'pending';
    let mercadopagoPaymentId = paymentId;

    if (paymentId) {
      try {
        // Importar MercadoPago SDK dinámicamente
        const { MercadoPagoConfig, Payment } = await import('mercadopago');
        
        const client = new MercadoPagoConfig({
          accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
          options: { timeout: 5000 }
        });

        const paymentApi = new Payment(client);
        
        // Obtener el estado real del pago desde MercadoPago
        const mercadopagoPayment = await paymentApi.get({ id: paymentId });
        
        mercadopagoStatus = mercadopagoPayment.status || 'pending';
        mercadopagoPaymentId = mercadopagoPayment.id?.toString() || paymentId;
        
        logger.info('IMMEDIATE mercadopago status', { 
          module: 'payments', 
          step: 'mercadopago_check', 
          paymentId, 
          status: mercadopagoStatus,
          mercadopagoPaymentId 
        });

      } catch (mercadopagoError) {
        logger.error('IMMEDIATE mercadopago error', { 
          module: 'payments', 
          step: 'mercadopago_error', 
          error: mercadopagoError instanceof Error ? mercadopagoError.message : 'Unknown error',
          paymentId 
        });
        
        // Si hay error con MercadoPago, no aprobar el pago
        return res.status(400).json({
          success: false,
          error: 'No se pudo verificar el estado del pago con MercadoPago. Por favor, intenta nuevamente.',
          shouldRetry: true
        });
      }
    }

    // Solo aprobar si el estado de MercadoPago es 'approved'
    if (mercadopagoStatus !== 'approved') {
      logger.warn('IMMEDIATE payment not approved', { 
        module: 'payments', 
        step: 'not_approved', 
        paymentId, 
        status: mercadopagoStatus 
      });
      
      return res.status(400).json({
        success: false,
        error: `El pago no ha sido aprobado. Estado actual: ${mercadopagoStatus}. Por favor, completa el pago o intenta nuevamente.`,
        status: mercadopagoStatus,
        shouldRetry: mercadopagoStatus === 'pending' || mercadopagoStatus === 'in_process'
      });
    }

    // Actualizar el pago con el estado verificado
    payment.status = 'approved';
    payment.mercadopagoPaymentId = mercadopagoPaymentId;
    payment.paymentMethodId = 'verified_mercadopago';
    payment.paymentTypeId = 'verified_mercadopago';
    payment.installments = 1;
    payment.transactionDate = new Date();
    payment.updatedAt = new Date();
    
    // Agregar metadata de verificación
    if (!payment.metadata) {
      payment.metadata = {};
    }
    payment.metadata.verifiedWithMercadoPago = true;
    payment.metadata.verificationDate = new Date();
    payment.metadata.mercadopagoStatus = mercadopagoStatus;
    payment.metadata.mercadopagoPaymentId = mercadopagoPaymentId;

    await payment.save();
    logger.info('IMMEDIATE payment verified and saved', { module: 'payments', step: 'payment_saved', paymentId: payment._id.toString(), status: payment.status, mercadopagoStatus });

    // Procesar según servicio
    const service = payment.service;
    const isSubscription = ['TraderCall', 'SmartMoney', 'CashFlow'].includes(service);
    const isTraining = ['SwingTrading', 'DowJones'].includes(service);
    const isBooking = externalReference.startsWith('booking_');

    // ✅ Generar notificación automática del pago exitoso
    try {
      const notificationResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/notifications/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXTAUTH_SECRET}`,
        },
        body: JSON.stringify({
          title: `💳 Pago procesado exitosamente`,
          message: `Tu suscripción a ${service} ha sido renovada por $${payment.amount} ${payment.currency}`,
          type: 'pago',
          priority: 'alta',
          targetUsers: 'todos',
          icon: '💳',
          actionUrl: '/perfil',
          actionText: 'Ver Detalles',
          isActive: true,
          createdBy: 'sistema',
          isAutomatic: true,
          metadata: {
            paymentId: payment._id,
            service: payment.service,
            amount: payment.amount,
            currency: payment.currency,
            transactionDate: payment.transactionDate,
            automatic: true
          }
        })
      });
      
      if (notificationResponse.ok) {
        logger.info('IMMEDIATE notification created', { module: 'payments', step: 'notification_created', paymentId: payment._id.toString() });
      }
    } catch (notificationError) {
      logger.warn('IMMEDIATE notification error', { module: 'payments', step: 'notification_error', error: notificationError instanceof Error ? notificationError.message : 'Unknown error' });
    }

    if (isSubscription) {
      // Procesar suscripción inmediatamente
      await user.renewSubscription(
        service,
        payment.amount,
        payment.currency,
        payment.mercadopagoPaymentId
      );
      logger.info('IMMEDIATE subscription renewed', { module: 'payments', step: 'subscription', user: user.email, service });

      // Emails (idempotentes) para suscripción
      try {
        if (!payment.metadata) payment.metadata = {};
        // Admin
        if (!payment.metadata.adminNewSubscriberNotified) {
          const { sendAdminNewSubscriberEmail } = await importEmails();
          await sendAdminNewSubscriberEmail({
            userEmail: user.email,
            userName: user.name || user.email,
            service: service as any,
            amount: payment.amount,
            currency: payment.currency,
            paymentId: payment.mercadopagoPaymentId,
            transactionDate: new Date(),
            expiryDate: user.subscriptionExpiry
          });
          payment.metadata.adminNewSubscriberNotified = true;
          await payment.save();
        }
        // Usuario
        if (!payment.metadata.userSubscriptionConfirmationSent) {
          const { sendSubscriptionConfirmationEmail } = await importEmails();
          await sendSubscriptionConfirmationEmail({
            userEmail: user.email,
            userName: user.name || user.email,
            service: service as any,
            expiryDate: user.subscriptionExpiry
          });
          payment.metadata.userSubscriptionConfirmationSent = true;
          await payment.save();
        }
      } catch (emailErr) {
        logger.error('IMMEDIATE subscription emails error', { module: 'payments', step: 'emails', error: (emailErr as Error).message });
      }
       
    } else if (isTraining) {
      // Procesar entrenamiento inmediatamente
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
      if (user.role !== 'admin' && user.role !== 'suscriptor') {
        user.role = 'suscriptor';
      }
      await user.save();
      logger.info('IMMEDIATE training activated', { module: 'payments', step: 'training', user: user.email, service });

      try {
        if (!payment.metadata) payment.metadata = {} as any;
        if (!payment.metadata.trainingEnrollmentNotificationSent) {
          const trainingName = service === 'SwingTrading' ? 'Zero 2 Trader' : service;
          await createTrainingEnrollmentNotification(user.email, user.name || user.email, service, trainingName, payment.amount);
          payment.metadata.trainingEnrollmentNotificationSent = true;
          await payment.save();
        } else {
          logger.info('IMMEDIATE training enrollment notify skipped (already sent)', { module: 'payments' });
        }
      } catch (e) {
        logger.error('IMMEDIATE training enrollment notify error', { module: 'payments', step: 'notify', error: (e as Error).message });
      }
    } else if (isBooking) {
      // Fallback para reservas (asesorías)
      logger.info('IMMEDIATE booking start', { module: 'payments', step: 'booking_start', user: user.email, reference: externalReference });
      try {
        const refParts = externalReference.split('_');
        const serviceType = refParts[1];
        const bookingUser = user;

        // Datos desde metadata
        const reservationData = payment.metadata?.reservationData || {};
        let startDate: Date = new Date();
        let endDate: Date = new Date(Date.now() + (reservationData.duration || 45) * 60000);
        if (reservationData.startDate) {
          startDate = new Date(reservationData.startDate);
          endDate = new Date(startDate.getTime() + (reservationData.duration || 45) * 60000);
        }

        // Confirmar AdvisoryDate y corregir huso horario
        if (serviceType === 'ConsultorioFinanciero') {
          try {
            const AdvisoryDate = await importAdvisoryDate();
            const advisoryDate = await AdvisoryDate.findOne({
              advisoryType: 'ConsultorioFinanciero',
              date: {
                $gte: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
                $lt: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1)
              },
              time: `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`
            });

            if (advisoryDate) {
              const year = advisoryDate.date.getUTCFullYear();
              const month = advisoryDate.date.getUTCMonth();
              const day = advisoryDate.date.getUTCDate();
              const [hh, mm] = (advisoryDate.time || '10:00').split(':').map((v: string) => parseInt(v, 10));
              const fixedStartUtc = new Date(Date.UTC(year, month, day, hh + 3, mm || 0, 0, 0));
              const fixedEndUtc = new Date(fixedStartUtc.getTime() + (reservationData.duration || 45) * 60000);
              startDate = fixedStartUtc;
              endDate = fixedEndUtc;

              advisoryDate.isBooked = true;
              advisoryDate.confirmedBooking = true;
              advisoryDate.tempReservationTimestamp = undefined;
              advisoryDate.tempReservationExpiresAt = undefined;
              await advisoryDate.save();
            } else {
              logger.warn('IMMEDIATE advisoryDate not found', { module: 'payments', step: 'advisory_lookup', reference: externalReference });
            }
          } catch (adErr) {
            logger.error('IMMEDIATE advisory error', { module: 'payments', step: 'advisory_error', error: (adErr as Error).message });
          }
        }

        // Crear Booking
        const newBooking = new Booking({
          userId: bookingUser._id.toString(),
          userEmail: bookingUser.email,
          userName: bookingUser.name || bookingUser.email,
          type: reservationData?.type || 'advisory',
          serviceType: serviceType,
          startDate,
          endDate,
          duration: reservationData?.duration || 45,
          status: 'confirmed',
          price: payment.amount,
          paymentStatus: 'paid',
          notes: reservationData?.notes || `Reserva confirmada (fallback) - Transaction ID: ${payment.mercadopagoPaymentId}`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await newBooking.save();
        logger.info('IMMEDIATE booking saved', { module: 'payments', step: 'booking_saved', bookingId: newBooking._id.toString() });

        // Declarar eventResult fuera del try para que esté disponible en el scope del envío de emails
        let eventResult: any = null;

        // Calendar + Meet
        try {
          const { createAdvisoryEvent } = await importCalendar();
          eventResult = await createAdvisoryEvent(
            bookingUser.email,
            serviceType,
            startDate,
            reservationData?.duration || 60
          );
          if (eventResult.success) {
            await Booking.findByIdAndUpdate(newBooking._id, {
              googleEventId: eventResult.eventId,
              ...(eventResult.meetLink ? { meetingLink: eventResult.meetLink } : {})
            });
            logger.info('IMMEDIATE calendar created', { module: 'payments', step: 'calendar_created', eventId: eventResult.eventId, hasMeet: !!eventResult.meetLink });
          } else {
            logger.error('IMMEDIATE calendar error', { module: 'payments', step: 'calendar_error', error: eventResult.error });
          }
        } catch (calErr) {
          logger.error('IMMEDIATE calendar exception', { module: 'payments', step: 'calendar_exception', error: (calErr as Error).message });
        }

        // Emails
        try {
          const { sendAdvisoryConfirmationEmail, sendAdminNotificationEmail } = await importEmails();
          
          // Usar la misma lógica de formateo que createAdvisoryEvent
          const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
          const formattedDate = eventResult?.formattedDate || new Intl.DateTimeFormat('es-ES', {
            timeZone: timezone,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(startDate);
          
          const formattedTime = eventResult?.formattedTime || new Intl.DateTimeFormat('es-ES', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit'
          }).format(startDate);
          
          await sendAdvisoryConfirmationEmail(
            bookingUser.email,
            bookingUser.name || bookingUser.email,
            {
              type: serviceType,
              date: formattedDate,
              time: formattedTime,
              duration: reservationData?.duration || 45,
              price: payment.amount,
              meetLink: (await Booking.findById(newBooking._id))?.meetingLink
            }
          );
          
          // Verificar si ya se envió la notificación al admin (idempotente)
          if (!payment.metadata) payment.metadata = {};
          
          if (!payment.metadata.adminAdvisoryBookingNotified) {
            await sendAdminNotificationEmail({
              userEmail: bookingUser.email,
              userName: bookingUser.name || bookingUser.email,
              type: 'advisory',
              serviceType,
              date: formattedDate,
              time: formattedTime,
              duration: reservationData?.duration || 45,
              price: payment.amount,
              meetLink: (await Booking.findById(newBooking._id))?.meetingLink
            });
            
            // Marcar como notificado para evitar duplicados
            payment.metadata.adminAdvisoryBookingNotified = true;
            payment.metadata.adminAdvisoryBookingNotifiedAt = new Date();
            await payment.save();
            
            logger.info('IMMEDIATE admin notification sent', { module: 'payments', step: 'admin_notification_sent', user: bookingUser.email });
          } else {
            logger.info('IMMEDIATE admin notification already sent', { module: 'payments', step: 'admin_notification_skipped', user: bookingUser.email });
          }
          
          logger.info('IMMEDIATE emails sent', { module: 'payments', step: 'emails_sent', user: bookingUser.email });
        } catch (emailErr) {
          logger.error('IMMEDIATE email error', { module: 'payments', step: 'emails_error', error: (emailErr as Error).message });
        }

      } catch (bookingErr) {
        logger.error('IMMEDIATE booking error', { module: 'payments', step: 'booking_exception', error: (bookingErr as Error).message });
      }
    }

    logger.info('IMMEDIATE done', { module: 'payments', step: 'done', paymentId: payment._id.toString() });

    return res.status(200).json({
      success: true,
      message: 'Pago procesado inmediatamente',
      service: service,
      isSubscription: isSubscription,
      isTraining: isTraining,
      isBooking: isBooking
    });

  } catch (error) {
    console.error('❌ [IMMEDIATE-PROCESS] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
