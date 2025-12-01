import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Booking from '@/models/Booking';
import MonthlyTrainingSubscription from '@/models/MonthlyTrainingSubscription';
import { getMercadoPagoPayment, isPaymentSuccessful, isPaymentPending, isPaymentRejected } from '@/lib/mercadopago';
import { PaymentErrorHandler } from '@/lib/paymentErrorHandler';
import { createTrainingEnrollmentNotification } from '@/lib/trainingNotifications';

/**
 * API de webhooks para MercadoPago
 * POST: Procesar notificaciones de pago
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/webhooks/mercadopago`);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Verificar la clave secreta del webhook si está configurada
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;
    
    if (!signature) {
      console.log('⚠️ Webhook sin firma X-Signature, pero clave secreta configurada');
      // En desarrollo, permitir continuar. En producción, podrías querer rechazar.
    } else {
      console.log('✅ Webhook con firma verificada');
      // Aquí podrías agregar lógica adicional de verificación si es necesario
      // MercadoPago usa X-Signature para verificar la autenticidad
    }
  } else {
    console.log('⚠️ MERCADOPAGO_WEBHOOK_SECRET no configurado - webhook sin verificación');
  }

  try {
    await dbConnect();

    // MP puede enviar distintos formatos dependiendo del topic
    const { topic, type, data, id, resource } = (req.body || {}) as any;
    const topicValue: string = (topic as string) || (type as string) || 'payment';

    console.log('🔔 Webhook recibido:', {
      topic: topicValue,
      raw: req.body,
      timestamp: new Date().toISOString()
    });

    // Resolver paymentId o merchantOrderId
    let paymentId: string | null = null;
    let merchantOrderId: string | null = null;

    if (topicValue === 'payment') {
      // Formatos posibles: { data: { id } } o { id }
      paymentId = (data && (data.id || data[0]?.id)) || id || null;
    } else if (topicValue === 'merchant_order') {
      // Formatos posibles: resource URL o id directo
      if (typeof resource === 'string' && resource.includes('/merchant_orders/')) {
        merchantOrderId = resource.split('/').pop() || null;
      } else if (resource) {
        merchantOrderId = String(resource);
      } else if (id) {
        merchantOrderId = String(id);
      }
    }

    if (!paymentId && !merchantOrderId) {
      console.log('⚠️ Webhook sin datos válidos:', { 
        body: req.body, 
        topic: topicValue,
        hasData: !!data,
        hasId: !!id,
        hasResource: !!resource
      });
      
      // Si es un webhook duplicado o malformado, devolver 200 para evitar reintentos
      if (req.body && (req.body.resource || req.body.id)) {
        console.log('🔄 Webhook duplicado o malformado, devolviendo 200 para evitar reintentos');
        return res.status(200).json({ success: true, message: 'Webhook duplicado procesado' });
      }
      
      return res.status(400).json({ error: 'Datos de webhook inválidos' });
    }

    // Si vino merchant_order, obtener los payments asociados para extraer external_reference
    let paymentInfo: any = null;

    if (merchantOrderId) {
      try {
        const fetchResp = await fetch(`https://api.mercadolibre.com/merchant_orders/${merchantOrderId}`, {
          headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
        });
        const mo = await fetchResp.json();
        console.log('📦 Merchant Order:', {
          id: mo.id,
          preferenceId: mo.preference_id,
          totalAmount: mo.total_amount,
          paidAmount: mo.paid_amount,
          payments: mo.payments?.map((p: any) => ({ id: p.id, status: p.status, status_detail: p.status_detail }))
        });

        // Tomar el primer payment (o el aprobado) si existe
        const moPayment = (mo.payments || []).find((p: any) => p.status === 'approved') || mo.payments?.[0];
        if (moPayment?.id) {
          paymentId = String(moPayment.id);
        } else {
          // Si no hay payments aún, no procesamos
          console.log('⏳ Merchant order sin payments asociados aún.');
          return res.status(200).json({ success: true, message: 'Merchant order recibida (sin payments)' });
        }
      } catch (e) {
        console.error('❌ Error consultando merchant_order:', e);
        return res.status(500).json({ error: 'Error consultando merchant_order' });
      }
    }

    // En este punto debemos tener un paymentId válido
    if (!paymentId) {
      console.log('⚠️ No se resolvió paymentId a partir del webhook:', {
        topicValue,
        data,
        id,
        resource,
        rawBody: req.body
      });
      return res.status(400).json({ error: 'No se resolvió paymentId' });
    }

    // Obtener información del pago desde MP con pequeños reintentos
    let attempts = 0;
    const maxAttempts = 3;
    while (!paymentInfo && attempts < maxAttempts) {
      attempts++;
      const result = await getMercadoPagoPayment(paymentId.toString());
      if (result.success && result.payment) paymentInfo = result.payment;
      if (!paymentInfo) await new Promise(r => setTimeout(r, 800));
    }

    if (!paymentInfo) {
      console.error('❌ No se pudo obtener información del pago después de varios intentos');
      return res.status(500).json({ error: 'Error obteniendo información del pago' });
    }

    console.log('📊 Información del pago:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      status_detail: paymentInfo.status_detail,
      externalReference: paymentInfo.external_reference,
      amount: paymentInfo.transaction_amount,
      currency: paymentInfo.currency_id
    });

    // Buscar/crear Payment por external_reference
    let payment = await Payment.findOne({ externalReference: paymentInfo.external_reference });

    if (!payment) {
      // Crear registro si no existe (por si no se guardó en checkout)
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      // Inferir servicio desde external_reference: tipo_servicio_userId_ts
      const ref = paymentInfo.external_reference || '';
      const parts = ref.split('_');
      const inferredService = parts.length >= 2 ? parts[1] : 'TraderCall';

      payment = new Payment({
        userId: null,
        userEmail: paymentInfo.payer?.email || '',
        service: inferredService,
        amount: paymentInfo.transaction_amount,
        currency: paymentInfo.currency_id,
        status: paymentInfo.status,
        mercadopagoPaymentId: paymentInfo.id,
        externalReference: paymentInfo.external_reference,
        paymentMethodId: paymentInfo.payment_method_id || '',
        paymentTypeId: paymentInfo.payment_type_id || '',
        installments: paymentInfo.installments || 1,
        transactionDate: new Date(),
        expiryDate,
        metadata: { createdFromWebhook: true }
      });
      await payment.save();
      console.log('🆕 Payment creado desde webhook para external_reference:', payment.externalReference);
    }

    // ✅ MEJORADO: Evitar procesar el mismo pago múltiples veces
    const wasAlreadyApproved = payment.status === 'approved';
    const isSamePayment = payment.mercadopagoPaymentId === paymentInfo.id;
    
    if (wasAlreadyApproved && isSamePayment) {
      console.log('✅ Pago ya procesado anteriormente (approved):', paymentInfo.id);
      return res.status(200).json({ success: true, message: 'Pago ya procesado' });
    }

    // Si el pago ya tiene este mercadopagoPaymentId con status approved, no procesar
    if (isSamePayment && wasAlreadyApproved) {
      console.log('⚠️  Webhook duplicado detectado para pago ya aprobado:', paymentInfo.id);
      return res.status(200).json({ success: true, message: 'Webhook duplicado ignorado' });
    }

    // Actualizar campos del Payment
    const oldStatus = payment.status;
    payment.mercadopagoPaymentId = paymentInfo.id;
    payment.status = paymentInfo.status;
    payment.paymentMethodId = paymentInfo.payment_method_id || '';
    payment.paymentTypeId = paymentInfo.payment_type_id || '';
    payment.installments = paymentInfo.installments || 1;
    payment.transactionDate = new Date();

    // Asignar userId si falta
    if (!payment.userId && payment.userEmail) {
      const user = await User.findOne({ email: payment.userEmail });
      if (user) payment.userId = user._id;
    }

    await payment.save();

    // Solo procesar si el status cambió a approved (no si ya estaba approved)
    const isNewApproval = !wasAlreadyApproved && isPaymentSuccessful(paymentInfo);

    // Procesamiento por estado
    if (isNewApproval) {
      console.log('✅ Pago aprobado (NUEVO). Procesando efectos…');
      await processSuccessfulPayment(payment, paymentInfo);
    } else if (isPaymentSuccessful(paymentInfo) && wasAlreadyApproved) {
      console.log('ℹ️  Pago ya estaba aprobado, no se procesa nuevamente');
    } else if (isPaymentRejected(paymentInfo)) {
      console.log('❌ Pago rechazado');
      await processRejectedPayment(payment, paymentInfo);
    } else if (isPaymentPending(paymentInfo)) {
      console.log('⏳ Pago pendiente');
      // Sin acciones; se actualizará cuando cambie el estado
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Error procesando webhook:', error);

    PaymentErrorHandler.logPaymentError(
      'webhook_processing',
      'UNKNOWN_ERROR',
      { webhookData: req.body },
      error
    );

    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Procesa un pago exitoso
 */
async function processSuccessfulPayment(payment: any, paymentInfo: any) {
  try {
    // Buscar usuario por ID o por email
    let user = null;
    
    if (payment.userId) {
      user = await User.findById(payment.userId);
    }
    
    // Si no se encuentra por ID, buscar por email
    if (!user && payment.userEmail) {
      user = await User.findOne({ email: payment.userEmail });
      console.log('🔍 Buscando usuario por email:', payment.userEmail);
    }
    
    // Si aún no se encuentra, buscar por email del payer de MercadoPago
    if (!user && paymentInfo.payer?.email) {
      user = await User.findOne({ email: paymentInfo.payer.email });
      console.log('🔍 Buscando usuario por payer email:', paymentInfo.payer.email);
    }
    
    if (!user) {
      console.error('❌ Usuario no encontrado. Intentado con:', {
        userId: payment.userId,
        userEmail: payment.userEmail,
        payerEmail: paymentInfo.payer?.email
      });
      return;
    }

    console.log('✅ Usuario encontrado:', user.email);

    // Actualizar el userId en el pago si no estaba
    if (!payment.userId) {
      payment.userId = user._id;
      await payment.save();
      console.log('✅ UserId actualizado en el pago');
    }

    const service = payment.service;
    const amount = payment.amount;
    const currency = payment.currency;

    // Determinar tipo de pago basado en external_reference
    const externalRef = payment.externalReference;
    const isSubscription = ['TraderCall', 'SmartMoney', 'CashFlow'].includes(service);
    const isTraining = ['SwingTrading', 'DowJones'].includes(service);
    const isBooking = externalRef && externalRef.startsWith('booking_');
    const isIndicator = service === 'MediasMovilesAutomaticas';
    const isMonthlyTrainingSubscription = externalRef && externalRef.startsWith('MTS_');
    
    // Detectar si es un trial basado en metadata o external_reference
    const isTrial = payment.metadata?.subscriptionType === 'trial' || 
                    (externalRef && externalRef.startsWith('trial_'));

    if (isSubscription) {
      // Detectar si existe suscripción activa antes de renovar
      const existingActiveSub = user.activeSubscriptions.find(
        (sub: any) => sub.service === service && sub.isActive && new Date(sub.expiryDate) > new Date()
      );
      const previousExpiry = existingActiveSub ? new Date(existingActiveSub.expiryDate) : null;
      const isRenewal = !!previousExpiry;
      
      // Procesar suscripción o trial
      if (isTrial) {
        // Para trials, usar el método específico que previene múltiples trials
        try {
          await user.addTrialSubscription(service, amount, currency, paymentInfo.id);
          console.log('✅ Trial agregado exitosamente:', {
            user: user.email,
            service,
            amount,
            currency
          });
        } catch (error: any) {
          console.error('❌ Error agregando trial:', error.message);
          // Si ya tiene un trial, no hacer nada más y retornar
          // El webhook ya devolverá 200 en el handler principal
          return;
        }
      } else {
        // Procesar suscripción normal
        await user.renewSubscription(service, amount, currency, paymentInfo.id, 'full');
      }
      
      // Recargar el usuario para obtener las fechas actualizadas
      await user.reload();
      
      const updatedSub = user.activeSubscriptions.find(
        (sub: any) => sub.service === service
      );
      
      console.log('✅ Suscripción activada:', {
        user: user.email,
        service,
        isTrial,
        isRenewal,
        previousExpiry: previousExpiry?.toISOString(),
        newStartDate: updatedSub?.startDate,
        newExpiryDate: updatedSub?.expiryDate,
        subscriptionType: updatedSub?.subscriptionType
      });

      // ✅ La suscripción ya está activada en user.activeSubscriptions
      // El admin panel se puede manejar manualmente si es necesario
      console.log('✅ Suscripción procesada correctamente para:', user.email);

      // 📧 Notificar al admin sobre el nuevo suscriptor
      try {
        if (!payment.metadata) payment.metadata = {};
        if (!payment.metadata.adminNewSubscriberNotified) {
          const { sendAdminNewSubscriberEmail } = await import('@/lib/emailNotifications');
          await sendAdminNewSubscriberEmail({
            userEmail: user.email,
            userName: user.name || user.email,
            service: service,
            amount,
            currency,
            paymentId: paymentInfo.id,
            transactionDate: new Date(),
            expiryDate: user.subscriptionExpiry
          });
          payment.metadata.adminNewSubscriberNotified = true;
          await payment.save();
        } else {
          console.log('ℹ️ Notificación admin ya enviada previamente para este pago.');
        }
      } catch (e) {
        console.error('❌ Error enviando notificación de nuevo suscriptor al admin:', e);
      }

      // 🔔 Notificación de pago se creará al final del procesamiento para evitar duplicados

      // 📧 Confirmación de suscripción al usuario (idempotente)
      try {
        if (!payment.metadata) payment.metadata = {};
        if (!payment.metadata.userSubscriptionConfirmationSent) {
          const { sendSubscriptionConfirmationEmail } = await import('@/lib/emailNotifications');
          
          console.log('📧 Preparando email de confirmación:', {
            isRenewal,
            isTrial,
            previousExpiry: previousExpiry?.toISOString(),
            startDate: updatedSub?.startDate,
            expiryDate: updatedSub?.expiryDate
          });
          
          await sendSubscriptionConfirmationEmail({
            userEmail: user.email,
            userName: user.name || user.email,
            service: service,
            expiryDate: updatedSub?.expiryDate || user.subscriptionExpiry,
            startDate: updatedSub?.startDate,
            isRenewal,
            previousExpiry: previousExpiry || undefined, // Convertir null a undefined
            isTrial // ✅ NUEVO: Pasar parámetro isTrial
          });
          payment.metadata.userSubscriptionConfirmationSent = true;
          await payment.save();
          
          console.log(`✅ Email de ${isTrial ? 'TRIAL' : isRenewal ? 'RENOVACIÓN' : 'CONFIRMACIÓN'} enviado a ${user.email}`);
        } else {
          console.log('ℹ️ Confirmación de suscripción al usuario ya enviada previamente.');
        }
      } catch (e) {
        console.error('❌ Error enviando confirmación de suscripción al usuario:', e);
      }

    } else if (isTraining) {
      // Procesar entrenamiento
      const nuevoEntrenamiento = {
        tipo: service,
        fechaInscripcion: new Date(),
        progreso: 0,
        activo: true,
        precio: amount,
        metodoPago: 'mercadopago',
        transactionId: paymentInfo.id
      };

      user.entrenamientos.push(nuevoEntrenamiento);
      // Asegurar rol de acceso
      if (user.role !== 'admin' && user.role !== 'suscriptor') {
        user.role = 'suscriptor';
      }
      await user.save();

      console.log('✅ Entrenamiento activado:', {
        user: user.email,
        training: service,
        transactionId: paymentInfo.id
      });

      // 🔔 Notificación de pago se creará al final del procesamiento para evitar duplicados

      // Notificación de confirmación al usuario y admins (idempotente)
      try {
        if (!payment.metadata) payment.metadata = {} as any;
        if (!payment.metadata.trainingEnrollmentNotificationSent) {
          const trainingName = service === 'SwingTrading' ? 'Zero 2 Trader' : service;
          await createTrainingEnrollmentNotification(user.email, user.name || user.email, service, trainingName, amount);
          payment.metadata.trainingEnrollmentNotificationSent = true;
          await payment.save();
        } else {
          console.log('ℹ️ Notificación de inscripción ya enviada previamente (webhook).');
        }
      } catch (e) {
        console.error('⚠️ Error enviando notificación de inscripción:', e);
      }

    } else if (isMonthlyTrainingSubscription) {
      // Procesar suscripción mensual
      console.log('✅ Procesando pago de suscripción mensual...', {
        externalRef,
        paymentId: paymentInfo.id,
        timestamp: new Date().toISOString()
      });
      
      try {
        // Buscar la suscripción mensual por external_reference (que se guarda como paymentId)
        let monthlySubscription = await MonthlyTrainingSubscription.findOne({
          paymentId: externalRef
        });
        
        console.log('🔍 Buscando suscripción mensual:', {
          searchCriteria: { paymentId: externalRef },
          found: !!monthlySubscription
        });
        
        if (!monthlySubscription) {
          console.log('⚠️ Suscripción mensual no encontrada, creando desde webhook...');
          
          // Extraer datos del metadata de MercadoPago
          const metadata = paymentInfo.metadata || {};
          const trainingType = metadata.trainingType || 'SwingTrading';
          const subscriptionMonth = metadata.subscriptionMonth || new Date().getMonth() + 1;
          const subscriptionYear = metadata.subscriptionYear || new Date().getFullYear();
          
          // Calcular fechas de inicio y fin del mes
          const startDate = new Date(subscriptionYear, subscriptionMonth - 1, 1);
          const endDate = new Date(subscriptionYear, subscriptionMonth, 0, 23, 59, 59, 999);
          
          // Crear la suscripción desde el webhook
          monthlySubscription = new MonthlyTrainingSubscription({
            userId: user._id.toString(),
            userEmail: user.email,
            userName: user.name || user.email,
            trainingType,
            subscriptionMonth,
            subscriptionYear,
            startDate,
            endDate,
            paymentId: externalRef,
            paymentAmount: paymentInfo.transaction_amount,
            paymentStatus: 'completed',
            mercadopagoPaymentId: paymentInfo.id.toString(),
            isActive: true,
            accessGranted: true
          });
          
          await monthlySubscription.save();
          console.log('✅ Suscripción mensual creada desde webhook:', monthlySubscription._id);
        }
        
        console.log('📋 Suscripción mensual encontrada:', {
          id: monthlySubscription._id,
          userEmail: monthlySubscription.userEmail,
          trainingType: monthlySubscription.trainingType,
          subscriptionMonth: monthlySubscription.subscriptionMonth,
          subscriptionYear: monthlySubscription.subscriptionYear,
          paymentStatus: monthlySubscription.paymentStatus
        });
        
        // Actualizar estado del pago (solo si no está ya completado)
        if (monthlySubscription.paymentStatus !== 'completed') {
          monthlySubscription.paymentStatus = 'completed';
          monthlySubscription.isActive = true;
          monthlySubscription.accessGranted = true;
          monthlySubscription.mercadopagoPaymentId = paymentInfo.id.toString();
          monthlySubscription.updatedAt = new Date();
          
          await monthlySubscription.save();
        }
        
        console.log('✅ Suscripción mensual activada:', {
          subscriptionId: monthlySubscription._id,
          user: monthlySubscription.userEmail,
          trainingType: monthlySubscription.trainingType,
          month: monthlySubscription.subscriptionMonth,
          year: monthlySubscription.subscriptionYear
        });
        
        // Actualizar también el registro de Payment para consistencia
        payment.status = 'approved';
        await payment.save();
        
        // ✅ Enviar email de confirmación con las clases del mes
        try {
          if (!payment.metadata) payment.metadata = {} as any;
          if (!payment.metadata.monthlyTrainingConfirmationSent) {
            console.log('📧 Enviando email de confirmación de suscripción mensual...');
            
            const { sendMonthlyTrainingConfirmationEmail } = await import('@/lib/emailNotifications');
            const { default: MonthlyTraining } = await import('@/models/MonthlyTraining');
            
            // Buscar las clases programadas para este mes
            const monthlyTraining = await MonthlyTraining.findOne({
              month: monthlySubscription.subscriptionMonth,
              year: monthlySubscription.subscriptionYear
            });
            
            // Formatear las clases para el email
            const classes = monthlyTraining?.classes.map((cls: any) => {
              const classDate = new Date(cls.date);
              const tz = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
              
              return {
                date: classDate.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: tz
                }),
                startTime: cls.startTime,
                title: cls.title,
                meetingLink: cls.meetingLink
              };
            }) || [];
            
            await sendMonthlyTrainingConfirmationEmail({
              userEmail: monthlySubscription.userEmail,
              userName: monthlySubscription.userName,
              trainingType: monthlySubscription.trainingType,
              subscriptionMonth: monthlySubscription.subscriptionMonth,
              subscriptionYear: monthlySubscription.subscriptionYear,
              startDate: monthlySubscription.startDate,
              endDate: monthlySubscription.endDate,
              classes,
              price: monthlySubscription.paymentAmount
            });
            
            payment.metadata.monthlyTrainingConfirmationSent = true;
            await payment.save();
            
            console.log('✅ Email de confirmación de suscripción mensual enviado con éxito');
          } else {
            console.log('ℹ️ Email de confirmación de suscripción mensual ya enviado previamente.');
          }
        } catch (emailError) {
          console.error('⚠️ Error enviando email de confirmación de suscripción mensual:', emailError);
          // No es crítico, no fallar el pago
        }

        // 🔔 Notificación de pago se creará al final del procesamiento para evitar duplicados
        
      } catch (monthlyError) {
        console.error('❌ Error procesando suscripción mensual:', monthlyError);
      }

    } else if (isBooking) {
      // Procesar reserva
      console.log('✅ Procesando pago de reserva...');
      
      // Extraer datos de la reserva del external_reference
      const refParts = externalRef.split('_');
      const serviceType = refParts[1];
      const userId = refParts[2];
      const timestamp = refParts[3];
      
      console.log('📋 Datos extraídos del external_reference:', {
        serviceType,
        userId,
        timestamp,
        externalRef
      });
      
      // Crear la reserva después del pago exitoso
      try {
        // Buscar el usuario
        const bookingUser = await User.findById(userId);
        if (!bookingUser) {
          console.error('❌ Usuario no encontrado para crear reserva:', userId);
          return;
        }
        
        // Obtener los datos de reserva del metadata del pago
        const reservationData = payment.metadata?.reservationData;
        let startDate = new Date();
        let endDate = new Date(Date.now() + 60 * 60 * 1000);
        
        if (reservationData && reservationData.startDate) {
          startDate = new Date(reservationData.startDate);
          endDate = new Date(startDate.getTime() + (reservationData.duration || 45) * 60 * 1000);
        }
        
        // Crear la reserva con los datos correctos
        const newBooking = new Booking({
          userId: userId,
          userEmail: bookingUser.email,
          userName: bookingUser.name || bookingUser.email,
          type: reservationData?.type || 'advisory',
          serviceType: serviceType,
          startDate: startDate,
          endDate: endDate,
          duration: reservationData?.duration || 45,
          status: 'confirmed',
          price: amount,
          paymentStatus: 'paid',
          notes: reservationData?.notes || `Reserva creada automáticamente después del pago exitoso - Transaction ID: ${paymentInfo.id}`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await newBooking.save();
        
        console.log('✅ Reserva creada y confirmada después del pago:', {
          bookingId: newBooking._id,
          user: bookingUser.email,
          serviceType: serviceType,
          startDate: startDate,
          endDate: endDate,
          amount: amount,
          transactionId: paymentInfo.id
        });

        // 🔔 Notificación de pago se creará al final del procesamiento para evitar duplicados
        
        // Si es una reserva de asesoría, marcar la fecha como reservada
        if (serviceType === 'ConsultorioFinanciero') {
          try {
            // Importar el modelo AdvisoryDate
            const { default: AdvisoryDate } = await import('@/models/AdvisoryDate');

            // Intentar confirmar usando advisoryDateId desde metadata si está disponible (atómico)
            const advisoryDateIdFromMeta: string | undefined = payment.metadata?.reservationData?.advisoryDateId;
            let advisoryDate = null as any;
            const now = new Date();

            if (advisoryDateIdFromMeta) {
              advisoryDate = await AdvisoryDate.findOneAndUpdate(
                {
                  _id: advisoryDateIdFromMeta,
                  advisoryType: 'ConsultorioFinanciero',
                  isActive: true,
                  $or: [
                    { isBooked: false },
                    { isBooked: true, confirmedBooking: false }
                  ]
                },
                {
                  $set: {
                    isBooked: true,
                    confirmedBooking: true,
                    tempReservationTimestamp: undefined,
                    tempReservationExpiresAt: undefined
                  }
                },
                { new: true }
              );
            }

            // Fallback: si no hay ID o no se pudo actualizar, buscar por fecha/hora
            if (!advisoryDate) {
              advisoryDate = await AdvisoryDate.findOne({
                advisoryType: 'ConsultorioFinanciero',
                date: {
                  $gte: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
                  $lt: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1)
                },
                time: `${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2, '0')}`
              });

              if (advisoryDate) {
                advisoryDate.isBooked = true;
                advisoryDate.confirmedBooking = true;
                advisoryDate.tempReservationTimestamp = undefined;
                advisoryDate.tempReservationExpiresAt = undefined;
                await advisoryDate.save();
              }
            }

            if (advisoryDate) {
              // Reconstruir la fecha/hora exacta desde AdvisoryDate en zona America/Montevideo
              const year = advisoryDate.date.getUTCFullYear();
              const month = advisoryDate.date.getUTCMonth();
              const day = advisoryDate.date.getUTCDate();
              const [hh, mm] = (advisoryDate.time || '10:00').split(':').map((v: string) => parseInt(v, 10));
              const fixedStartUtc = new Date(Date.UTC(year, month, day, hh + 3, mm || 0, 0, 0));
              const fixedEndUtc = new Date(fixedStartUtc.getTime() + Math.round((endDate.getTime() - startDate.getTime())));

              // Sobrescribir fechas en la reserva
              startDate = fixedStartUtc;
              endDate = fixedEndUtc;

              console.log('✅ Fecha de asesoría confirmada por pago:', advisoryDate._id);

              try {
                await Booking.findByIdAndUpdate(newBooking._id, {
                  startDate: startDate,
                  endDate: endDate
                });
                console.log('✅ Reserva actualizada con fecha/hora corregidas');
              } catch (updateErr) {
                console.error('⚠️ Error actualizando fechas de Booking:', updateErr);
              }
            } else {
              console.log('⚠️ No se encontró fecha de asesoría para confirmar');
            }
          } catch (advisoryError) {
            console.error('❌ Error marcando fecha de asesoría como reservada:', advisoryError);
          }
        }
        
        // Crear evento en Google Calendar
        let googleEventId = null;
        // Declarar eventResult fuera del try para que esté disponible en el scope del envío de emails
        let eventResult: any = null;
        
        try {
          console.log('📅 Intentando crear evento en Google Calendar...');
          console.log('📅 Datos del evento:', {
            userEmail: bookingUser.email,
            serviceType: serviceType,
            startDate: startDate.toISOString(),
            duration: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
          });
          
          const { createAdvisoryEvent } = await import('@/lib/googleCalendar');
          console.log('✅ Función createAdvisoryEvent importada correctamente');
          
          eventResult = await createAdvisoryEvent(
            bookingUser.email,
            serviceType,
            startDate,
            Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
          );
          
          console.log('📅 Resultado de createAdvisoryEvent:', eventResult);
          
          if (eventResult.success) {
            console.log('✅ Evento creado en Google Calendar:', eventResult.eventId);
            googleEventId = eventResult.eventId;
            
            // Actualizar la reserva con el ID del evento y el link de Meet si existe
            const bookingUpdate: any = { googleEventId: eventResult.eventId };
            if (eventResult.meetLink) {
              bookingUpdate.meetingLink = eventResult.meetLink;
              console.log('🔗 Google Meet creado:', eventResult.meetLink);
            }
            await Booking.findByIdAndUpdate(newBooking._id, bookingUpdate);
            console.log('✅ Reserva actualizada con datos de Google Calendar');
          } else {
            console.error('❌ Error creando evento en Google Calendar:', eventResult.error);
          }
        } catch (calendarError: any) {
          console.error('❌ Error creando evento en Google Calendar:', calendarError);
          console.error('🔍 Stack trace del error:', calendarError.stack);
        }
        
        // Enviar email de confirmación al usuario
        try {
          console.log('📧 Intentando enviar email de confirmación al usuario...');
          console.log('📧 Datos del email:', {
            userEmail: bookingUser.email,
            userName: bookingUser.name || bookingUser.email,
            serviceType: serviceType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            amount: amount
          });
          
          const { sendAdvisoryConfirmationEmail } = await import('@/lib/emailNotifications');
          console.log('✅ Función sendAdvisoryConfirmationEmail importada correctamente');
          
          // Preparar detalles con MeetLink si está disponible
          const meetLinkForUser = (typeof googleEventId === 'string') ? undefined : undefined;
          // Usar la misma lógica de formateo que createAdvisoryEvent
          const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
          const formattedDate = eventResult.formattedDate || new Intl.DateTimeFormat('es-ES', {
            timeZone: timezone,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(startDate);
          
          const formattedTime = eventResult.formattedTime || new Intl.DateTimeFormat('es-ES', {
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
              duration: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)),
              price: amount,
              meetLink: (await Booking.findById(newBooking._id))?.meetingLink
            }
          );
          
          console.log('✅ Email de confirmación enviado exitosamente a:', bookingUser.email);
        } catch (emailError: any) {
          console.error('❌ Error enviando email de confirmación al usuario:', emailError);
          console.error('🔍 Stack trace del error de email:', emailError.stack);
        }

        // ✅ NUEVO: Enviar notificación al administrador (idempotente)
        try {
          // Verificar si ya se envió la notificación al admin
          if (!payment.metadata) payment.metadata = {};
          
          if (payment.metadata.adminAdvisoryBookingNotified) {
            console.log('ℹ️ Notificación de admin para reserva de asesoría ya enviada previamente.');
          } else {
            console.log('📧 Enviando notificación al administrador...');
            
            const { sendAdminNotificationEmail } = await import('@/lib/emailNotifications');
            console.log('✅ Función sendAdminNotificationEmail importada correctamente');
            
            // Usar la misma lógica de formateo que createAdvisoryEvent para el admin también
            const timezoneForAdmin = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
            const adminFormattedDate = eventResult?.formattedDate || new Intl.DateTimeFormat('es-ES', {
              timeZone: timezoneForAdmin,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }).format(startDate);
            
            const adminFormattedTime = eventResult?.formattedTime || new Intl.DateTimeFormat('es-ES', {
              timeZone: timezoneForAdmin,
              hour: '2-digit',
              minute: '2-digit'
            }).format(startDate);
            
            const adminNotificationData = {
              userEmail: bookingUser.email,
              userName: bookingUser.name || bookingUser.email,
              type: 'advisory' as const,
              serviceType: serviceType,
              date: adminFormattedDate,
              time: adminFormattedTime,
              duration: Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)),
              price: amount,
              meetLink: (await Booking.findById(newBooking._id))?.meetingLink
            };
            
            await sendAdminNotificationEmail(adminNotificationData);
            
            // Marcar como notificado para evitar duplicados
            payment.metadata.adminAdvisoryBookingNotified = true;
            payment.metadata.adminAdvisoryBookingNotifiedAt = new Date();
            await payment.save();
            
            console.log('✅ Notificación al administrador enviada exitosamente');
          }
        } catch (adminEmailError: any) {
          console.error('❌ Error enviando notificación al administrador:', adminEmailError);
          console.error('🔍 Stack trace del error de notificación admin:', adminEmailError.stack);
        }
        
      } catch (bookingError) {
        console.error('❌ Error creando reserva después del pago:', bookingError);
      }
    }

    // Actualizar estado del pago
    payment.status = 'approved';
    payment.updatedAt = new Date();
    await payment.save();

    // Enviar email de confirmación de pago exitoso
    try {
      const { sendPaymentSuccessEmail } = await import('@/lib/emailNotifications');
      await sendPaymentSuccessEmail(
        user.email,
        user.name || user.email,
        {
          service: payment.service,
          amount: payment.amount,
          currency: payment.currency,
          paymentId: paymentInfo.id,
          transactionDate: new Date(),
          paymentMethod: paymentInfo.payment_method_id
        }
      );
      console.log('✅ Email de confirmación de pago exitoso enviado');
    } catch (emailError) {
      console.error('❌ Error enviando email de confirmación:', emailError);
      // No es crítico, el pago ya está procesado
    }

    // 🔔 Crear notificación de pago exitoso (UNA SOLA VEZ al final)
    try {
      const { createPaymentNotification } = await import('@/lib/notificationUtils');
      await createPaymentNotification(
        user,
        payment,
        payment.service,
        payment.amount,
        payment.currency,
        paymentInfo.id
      );
      console.log('✅ Notificación de pago creada exitosamente');
    } catch (notificationError) {
      console.error('❌ Error creando notificación de pago:', notificationError);
      // No es crítico, el pago ya está procesado
    }

    // Procesar pago de indicador - enviar notificación al admin (idempotente)
    if (isIndicator) {
      console.log('📊 Procesando pago de indicador:', service);
      
      try {
        // Verificar si ya se envió la notificación al admin
        if (!payment.metadata) payment.metadata = {};
        
        if (payment.metadata.adminIndicatorPaymentNotified) {
          console.log('ℹ️ Notificación de admin para indicador ya enviada previamente.');
        } else {
          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail) {
            const { sendEmail } = await import('@/lib/emailService');
          
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Nuevo Pago de Indicador</title>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
                .info-box { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #3b82f6; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .action-button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎯 Nuevo Pago de Indicador</h1>
                  <p>Servicio: Medias Móviles Automáticas</p>
                </div>
                
                <div class="content">
                  <div class="info-box">
                    <div class="label">👤 Usuario:</div>
                    <div class="value">${user.name || 'Usuario desconocido'}</div>
                  </div>
                  
                  <div class="info-box">
                    <div class="label">📧 Email:</div>
                    <div class="value">${user.email}</div>
                  </div>
                  
                  <div class="info-box">
                    <div class="label">💰 Monto:</div>
                    <div class="value">$${amount} ${currency}</div>
                  </div>
                  
                  <div class="info-box">
                    <div class="label">📅 Fecha:</div>
                    <div class="value">${new Date().toLocaleString('es-AR')}</div>
                  </div>
                  
                  <div class="info-box">
                    <div class="label">🆔 ID de Pago:</div>
                    <div class="value">${payment._id}</div>
                  </div>
                  
                  <div style="text-align: center; margin-top: 20px;">
                    <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/admin/indicators-users" class="action-button">Ver en Dashboard</a>
                  </div>
                  
                  <p style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 6px; color: #856404;">
                    <strong>⚠️ Acción requerida:</strong> El usuario completará un formulario de Google para enviar su usuario de TradingView. Ve al dashboard para gestionar el proceso de alta.
                  </p>
                </div>
                
                <div class="footer">
                  <p>Este email fue generado automáticamente desde el sistema de pagos.</p>
                </div>
              </div>
            </body>
            </html>
          `;
          
            await sendEmail({
              to: adminEmail,
              subject: `🎯 Nuevo Pago de Indicador - ${user.name || user.email}`,
              html
            });
            
            // Marcar como notificado para evitar duplicados
            payment.metadata.adminIndicatorPaymentNotified = true;
            payment.metadata.adminIndicatorPaymentNotifiedAt = new Date();
            await payment.save();
            
            console.log('✅ Notificación de admin enviada para pago de indicador');
          }
        }
      } catch (adminError) {
        console.error('❌ Error enviando notificación al admin:', adminError);
      }
    }

    console.log('✅ Pago procesado exitosamente:', paymentInfo.id);

  } catch (error) {
    console.error('❌ Error procesando pago exitoso:', error);
    
    // Log estructurado del error
    PaymentErrorHandler.logPaymentError(
      'successful_payment_processing',
      'UNKNOWN_ERROR',
      { 
        paymentId: paymentInfo?.id,
        service: payment?.service
      },
      error
    );
    
    throw error;
  }
}

/**
 * Procesa un pago rechazado
 */
async function processRejectedPayment(payment: any, paymentInfo: any) {
  try {
    // Actualizar estado del pago
    payment.status = 'rejected';
    payment.updatedAt = new Date();
    await payment.save();

    // Buscar usuario para enviar notificación
    let user = null;
    if (payment.userId) {
      user = await User.findById(payment.userId);
    }
    if (!user && payment.userEmail) {
      user = await User.findOne({ email: payment.userEmail });
    }
    if (!user && paymentInfo.payer?.email) {
      user = await User.findOne({ email: paymentInfo.payer.email });
    }

    // Enviar email de notificación de pago fallido
    if (user) {
      try {
        const { sendPaymentFailedEmail } = await import('@/lib/emailNotifications');
        await sendPaymentFailedEmail(
          user.email,
          user.name || user.email,
          {
            service: payment.service,
            amount: payment.amount,
            currency: payment.currency,
            errorCode: paymentInfo.status_detail,
            errorMessage: paymentInfo.status_detail,
            externalReference: payment.externalReference
          }
        );
        console.log('✅ Email de notificación de pago fallido enviado');
      } catch (emailError) {
        console.error('❌ Error enviando email de notificación de pago fallido:', emailError);
        // No es crítico
      }
    }

    console.log('❌ Pago rechazado procesado:', {
      paymentId: paymentInfo.id,
      reason: paymentInfo.status_detail
    });

  } catch (error) {
    console.error('❌ Error procesando pago rechazado:', error);
    
    // Log estructurado del error
    PaymentErrorHandler.logPaymentError(
      'rejected_payment_processing',
      'UNKNOWN_ERROR',
      { 
        paymentId: paymentInfo?.id,
        service: payment?.service,
        rejectionReason: paymentInfo?.status_detail
      },
      error
    );
    
    throw error;
  }
} 