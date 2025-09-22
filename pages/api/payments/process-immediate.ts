import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Booking from '@/models/Booking';
import { logger } from '@/lib/logger';

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

    // Buscar el pago pendiente
    const payment = await Payment.findOne({
      userEmail: session.user.email,
      externalReference: externalReference,
      status: { $in: ['pending', 'in_process'] }
    });

    if (!payment) {
      logger.warn('IMMEDIATE payment not found', { module: 'payments', step: 'find_payment', user: session.user.email, reference: externalReference });
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
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

    // ✅ PROCESAMIENTO INMEDIATO: Asumir que el pago es exitoso si el usuario regresó
    logger.info('IMMEDIATE mark approved', { module: 'payments', step: 'mark_approved', paymentId: payment._id.toString() });

    // Actualizar el pago
    payment.status = 'approved';
    payment.mercadopagoPaymentId = paymentId || `immediate_${Date.now()}`;
    payment.paymentMethodId = 'immediate_processing';
    payment.paymentTypeId = 'immediate_processing';
    payment.installments = 1;
    payment.transactionDate = new Date();
    payment.updatedAt = new Date();
    
    // Agregar metadata de procesamiento inmediato
    if (!payment.metadata) {
      payment.metadata = {};
    }
    payment.metadata.processedImmediately = true;
    payment.metadata.immediateProcessingDate = new Date();
    payment.metadata.processedOnReturn = true;

    await payment.save();
    logger.info('IMMEDIATE payment saved', { module: 'payments', step: 'payment_saved', paymentId: payment._id.toString(), status: payment.status });

    // Procesar según servicio
    const service = payment.service;
    const isSubscription = ['TraderCall', 'SmartMoney', 'CashFlow'].includes(service);
    const isTraining = ['SwingTrading', 'DowJones'].includes(service);
    const isBooking = externalReference.startsWith('booking_');

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
      await user.save();
      logger.info('IMMEDIATE training activated', { module: 'payments', step: 'training', user: user.email, service });
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
        let endDate: Date = new Date(Date.now() + (reservationData.duration || 60) * 60000);
        if (reservationData.startDate) {
          startDate = new Date(reservationData.startDate);
          endDate = new Date(startDate.getTime() + (reservationData.duration || 60) * 60000);
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
              const fixedEndUtc = new Date(fixedStartUtc.getTime() + (reservationData.duration || 60) * 60000);
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
          duration: reservationData?.duration || 60,
          status: 'confirmed',
          price: payment.amount,
          paymentStatus: 'paid',
          notes: reservationData?.notes || `Reserva confirmada (fallback) - Transaction ID: ${payment.mercadopagoPaymentId}`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        await newBooking.save();
        logger.info('IMMEDIATE booking saved', { module: 'payments', step: 'booking_saved', bookingId: newBooking._id.toString() });

        // Calendar + Meet
        try {
          const { createAdvisoryEvent } = await importCalendar();
          const eventResult = await createAdvisoryEvent(
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
          await sendAdvisoryConfirmationEmail(
            bookingUser.email,
            bookingUser.name || bookingUser.email,
            {
              type: serviceType,
              date: startDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }),
              time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
              duration: reservationData?.duration || 60,
              price: payment.amount,
              meetLink: (await Booking.findById(newBooking._id))?.meetingLink
            }
          );
          await sendAdminNotificationEmail({
            userEmail: bookingUser.email,
            userName: bookingUser.name || bookingUser.email,
            type: 'advisory',
            serviceType,
            date: startDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }),
            time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
            duration: reservationData?.duration || 60,
            price: payment.amount,
            meetLink: (await Booking.findById(newBooking._id))?.meetingLink
          });
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
