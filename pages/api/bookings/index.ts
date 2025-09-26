import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';
import AvailableSlot from '@/models/AvailableSlot';
import AdvisoryDate from '@/models/AdvisoryDate';
import { z } from 'zod';
import { createTrainingEvent, createAdvisoryEvent } from '@/lib/googleCalendar';
import { 
  sendTrainingConfirmationEmail, 
  sendAdvisoryConfirmationEmail, 
  sendAdminNotificationEmail 
} from '@/lib/emailNotifications';

// Schema de validación para crear reservas
const createBookingSchema = z.object({
  type: z.enum(['training', 'advisory']),
  serviceType: z.enum(['ConsultorioFinanciero', 'CuentaAsesorada', 'SwingTrading', 'AdvancedStrategies']).optional(),
  startDate: z.string().datetime(),
  duration: z.number().min(30).max(300).default(90), // Entre 30 minutos y 5 horas
  price: z.number().min(0).optional(),
  notes: z.string().max(500).optional()
});

/**
 * API para gestionar reservas
 * GET: Obtener reservas del usuario autenticado
 * POST: Crear nueva reserva
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  // Verificar autenticación
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const userEmail = session.user.email;
  const userName = session.user.name || 'Usuario';

  if (req.method === 'GET') {
    try {
      console.log('📅 Obteniendo reservas para:', userEmail);
      
      const bookings = await Booking.find({ userEmail })
        .sort({ startDate: -1 })
        .limit(50);

      return res.status(200).json({ bookings });
    } catch (error) {
      console.error('❌ Error al obtener reservas:', error);
      return res.status(500).json({ error: 'Error al obtener las reservas' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('📝 Creando nueva reserva para:', userEmail);
      
      // Validar datos de entrada
      const validationResult = createBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Datos inválidos',
          details: validationResult.error.errors 
        });
      }

      const { type, serviceType, startDate, duration, price, notes } = validationResult.data;
      const startDateTime = new Date(startDate);
      const effectiveDuration = type === 'training' ? 120 : duration;
      const endDateTime = new Date(startDateTime.getTime() + effectiveDuration * 60000);

      console.log('🔍 Datos de la nueva reserva:', {
        userEmail,
        type,
        serviceType,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        duration,
        startDateFormatted: startDateTime.toLocaleString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Argentina/Buenos_Aires'
        })
      });

             // ✅ NUEVO: Verificar disponibilidad según el tipo de reserva
       const timezone = 'America/Argentina/Buenos_Aires';
       let availableSlot = null;
       let advisoryDate = null;
       
       if (type === 'advisory') {
         // Para asesorías, verificar en AdvisoryDate
         console.log('🔍 Verificando disponibilidad en AdvisoryDate para asesoría...');
         
         advisoryDate = await AdvisoryDate.findOne({
           date: startDateTime,
           advisoryType: 'ConsultorioFinanciero',
           isActive: true,
           isBooked: false
         });

         if (!advisoryDate) {
           console.log('❌ Fecha de asesoría no disponible en AdvisoryDate');
           return res.status(409).json({ 
             error: 'Fecha de asesoría no disponible. Esta fecha ya fue reservada o no existe.',
             details: {
               date: startDateTime.toISOString(),
               type: 'advisory',
               found: false
             }
           });
         }

         console.log('✅ Fecha de asesoría disponible en AdvisoryDate:', advisoryDate._id);
         
         // Marcar como reservada
         advisoryDate.isBooked = true;
         await advisoryDate.save();
         
       } else {
         // Para entrenamientos, verificar en AvailableSlot
         const dateStr = startDateTime.toLocaleDateString('es-ES', {
           day: '2-digit',
           month: '2-digit',
           year: 'numeric',
           timeZone: timezone
         });
         const timeStr = startDateTime.toLocaleTimeString('es-ES', {
           hour: '2-digit',
           minute: '2-digit',
           hour12: false,
           timeZone: timezone
         });

         console.log('🔍 Verificando disponibilidad en AvailableSlot para entrenamiento:', {
           date: dateStr,
           time: timeStr,
           serviceType,
           startDateUTC: startDateTime.toISOString(),
           startDateLocal: startDateTime.toLocaleString('es-ES', { timeZone: timezone })
         });

         availableSlot = await AvailableSlot.findOne({
           date: dateStr,
           time: timeStr,
           serviceType,
           available: true
         });

         if (!availableSlot) {
           console.log('❌ Horario no disponible en AvailableSlot');
           return res.status(409).json({ 
             error: 'Horario no disponible. Este horario ya fue reservado o no existe.',
             details: {
               date: dateStr,
               time: timeStr,
               serviceType,
               found: false
             }
           });
         }

         console.log('✅ Horario disponible en AvailableSlot:', availableSlot._id);
         
         // Marcar como no disponible (se actualizará después de crear la reserva)
         availableSlot.available = false;
         availableSlot.reservedBy = userEmail;
         availableSlot.reservedAt = new Date();
         await availableSlot.save();
       }

      // Verificar que no haya conflictos de horario en Booking (como respaldo)
      const conflictingBookings = await Booking.find({
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          {
            // Nueva reserva empieza durante una existente
            startDate: { $lte: startDateTime },
            endDate: { $gt: startDateTime }
          },
          {
            // Nueva reserva termina durante una existente
            startDate: { $lt: endDateTime },
            endDate: { $gte: endDateTime }
          },
          {
            // Nueva reserva contiene una existente
            startDate: { $gte: startDateTime },
            endDate: { $lte: endDateTime }
          }
        ]
      });

      console.log(`🔍 Reservas conflictivas encontradas: ${conflictingBookings.length}`);
      
      if (conflictingBookings.length > 0) {
        console.log('❌ Detalles de reservas conflictivas:');
        conflictingBookings.forEach((booking, index) => {
          console.log(`  ${index + 1}. ID: ${booking._id}`);
          console.log(`     Usuario: ${booking.userEmail}`);
          console.log(`     Tipo: ${booking.type} - ${booking.serviceType}`);
          console.log(`     Inicio: ${booking.startDate.toISOString()}`);
          console.log(`     Fin: ${booking.endDate.toISOString()}`);
          console.log(`     Formateado: ${booking.startDate.toLocaleString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Argentina/Buenos_Aires'
          })}`);
        });
        
        return res.status(409).json({ 
          error: 'Horario no disponible. Ya existe una reserva en ese período.',
          conflictingBookings: conflictingBookings.map(b => ({
            id: b._id,
            userEmail: b.userEmail,
            startDate: b.startDate,
            endDate: b.endDate,
            type: b.type,
            serviceType: b.serviceType
          }))
        });
      }

      // Crear la reserva en la base de datos
      const newBooking = await Booking.create({
        userId: session.user.id || userEmail,
        userEmail,
        userName,
        type,
        serviceType,
        startDate: startDateTime,
        endDate: endDateTime,
        duration: effectiveDuration,
        price,
        notes,
        status: 'confirmed', // Por ahora confirmamos automáticamente
        paymentStatus: price ? 'pending' : 'paid'
      });

      console.log('✅ Reserva creada en Booking:', newBooking._id);

      // Actualizar el bookingId en AvailableSlot si es un entrenamiento
      if (type === 'training' && availableSlot) {
        availableSlot.bookingId = newBooking._id.toString();
        await availableSlot.save();
        console.log('✅ BookingId actualizado en AvailableSlot');
      }

      // Definir nombre del evento
      const eventName = serviceType || (type === 'training' ? 'Entrenamiento de Trading' : 'Asesoría Financiera');

              // Crear evento con Google Meet automáticamente en el calendario del admin
        try {
          console.log('📅 Intentando crear evento con Google Meet en Google Calendar...');
          console.log('🔑 Variables de entorno disponibles:', {
            hasAdminAccessToken: !!process.env.ADMIN_GOOGLE_ACCESS_TOKEN,
            hasAdminRefreshToken: !!process.env.ADMIN_GOOGLE_REFRESH_TOKEN,
            hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
            hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            timezone: process.env.GOOGLE_CALENDAR_TIMEZONE
          });
          
          let meetData;
          
          if (type === 'training') {
            console.log('🏋️ Creando evento de entrenamiento con Google Meet...');
            meetData = await createTrainingEvent(userEmail, eventName, startDateTime, effectiveDuration);
          } else {
            console.log('💼 Creando evento de asesoría con Google Meet...');
            meetData = await createAdvisoryEvent(userEmail, eventName, startDateTime, duration);
          }

          // Actualizar la reserva con los datos de Google Meet
          if (meetData?.success) {
            console.log('✅ Evento creado exitosamente con ID:', meetData.eventId);
            
            const updateData: any = {
              googleEventId: meetData.eventId
            };
            
            // Si se creó el Google Meet, guardar el link
            if (meetData.meetLink) {
              updateData.meetingLink = meetData.meetLink;
              console.log('🔗 Google Meet creado:', meetData.meetLink);
            }
            
            await Booking.findByIdAndUpdate(newBooking._id, updateData);
          } else {
            console.log('⚠️ Evento creado pero sin Google Meet:', meetData?.error);
            // Guardar solo el ID del evento si existe
            if (meetData?.eventId) {
              await Booking.findByIdAndUpdate(newBooking._id, {
                googleEventId: meetData.eventId
              });
            }
          }
        } catch (calendarError: any) {
          console.error('❌ Error detallado al crear evento en Google Calendar:', {
            error: calendarError?.message || 'Error desconocido',
            stack: calendarError?.stack,
            code: calendarError?.code,
            status: calendarError?.status
          });
          // No fallar la reserva si el calendario falla
        }

      // ✅ CRÍTICO: Invalidar caché de turnos después de crear reserva exitosa
      try {
        console.log('🧹 Invalidando caché de turnos después de crear reserva...');
        
        // Usar endpoint interno para invalidar caché
        const invalidateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/turnos/invalidate-cache`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (invalidateResponse.ok) {
          console.log('✅ Caché de turnos invalidado exitosamente');
        } else {
          console.log('⚠️ Error al invalidar caché, pero continúo');
        }
      } catch (cacheError) {
        console.error('⚠️ Error al invalidar caché (no crítico):', cacheError);
        // No fallar la reserva si la invalidación de caché falla
      }

      // ✅ NUEVO: Enviar notificaciones por email
      try {
        console.log('📧 Enviando notificaciones por email...');
        
        // Formatear fecha y hora para los emails
        const formattedDate = startDateTime.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Argentina/Buenos_Aires'
        });
        
        const formattedTime = startDateTime.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Argentina/Buenos_Aires'
        });

        const emailDetails = {
          type: eventName,
          date: formattedDate,
          time: formattedTime,
          duration,
          price
        };

        // Obtener el link de Meet si existe
        const meetLink = newBooking.meetingLink;
        
        // Enviar email de confirmación al usuario
        if (type === 'training') {
          console.log('📧 Enviando email de confirmación de entrenamiento...');
          await sendTrainingConfirmationEmail(userEmail, userName, {
            ...emailDetails,
            meetLink
          });
        } else {
          console.log('📧 Enviando email de confirmación de asesoría...');
          await sendAdvisoryConfirmationEmail(userEmail, userName, {
            ...emailDetails,
            meetLink
          });
        }

        // Enviar notificación al administrador
        console.log('📧 Enviando notificación al administrador..');
        await sendAdminNotificationEmail({
          userEmail,
          userName,
          type,
          serviceType: serviceType || eventName,
          date: formattedDate,
          time: formattedTime,
          duration,
          price,
          meetLink
        });

        console.log('✅ Notificaciones por email enviadas exitosamente');

      } catch (emailError) {
        console.error('❌ Error al enviar notificaciones por email:', emailError);
        // No fallar la reserva si los emails fallan
        console.log('⚠️ La reserva se completó exitosamente, pero hubo problemas con las notificaciones por email');
      }

      console.log('✅ Reserva creada exitosamente:', newBooking._id);
      return res.status(201).json({ 
        success: true, 
        booking: newBooking,
        message: 'Reserva creada exitosamente'
      });

    } catch (error) {
      console.error('❌ Error al crear reserva:', error);
      return res.status(500).json({ 
        error: 'Error interno del servidor al crear la reserva',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
} 