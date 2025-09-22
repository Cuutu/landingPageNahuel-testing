import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';
import { updateEventWithGoogleMeet } from '@/lib/googleCalendar';
import { 
  sendTrainingConfirmationEmail, 
  sendAdvisoryConfirmationEmail, 
  sendAdminNotificationEmail 
} from '@/lib/emailNotifications';

/**
 * API para actualizar reservas existentes con Google Meet
 * POST /api/bookings/update-meet-link
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();
    
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { bookingId, meetLink } = req.body;

    // Validaciones
    if (!bookingId || !meetLink) {
      return res.status(400).json({ 
        error: 'ID de reserva y link de Meet son requeridos' 
      });
    }

    console.log('🔄 Actualizando reserva con Google Meet:', bookingId);

    // Buscar la reserva
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Actualizar la reserva con el link de Meet
    booking.meetingLink = meetLink;
    await booking.save();

    console.log('✅ Reserva actualizada con Google Meet');

    // Actualizar evento en Google Calendar si existe
    if (booking.googleEventId) {
      try {
        await updateEventWithGoogleMeet(booking.googleEventId, meetLink);
        console.log('✅ Evento de Google Calendar actualizado');
      } catch (calendarError) {
        console.error('⚠️ Error al actualizar evento en Google Calendar:', calendarError);
        // No fallar si el calendario no se puede actualizar
      }
    }

    // Enviar email de confirmación con el link de Meet
    try {
      console.log('📧 Enviando email de confirmación con link de Meet...');
      
      // Formatear fecha y hora
      const formattedDate = booking.startDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
      });
      
      const formattedTime = booking.startDate.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
      });

      const emailDetails = {
        type: booking.serviceType || (booking.type === 'training' ? 'Entrenamiento de Trading' : 'Asesoría Financiera'),
        date: formattedDate,
        time: formattedTime,
        duration: booking.duration,
        price: booking.price,
        meetLink
      };

      // Enviar email al usuario
      if (booking.type === 'training') {
        await sendTrainingConfirmationEmail(booking.userEmail, booking.userName, emailDetails);
      } else {
        await sendAdvisoryConfirmationEmail(booking.userEmail, booking.userName, emailDetails);
      }

      // Enviar notificación al admin
      await sendAdminNotificationEmail({
        userEmail: booking.userEmail,
        userName: booking.userName,
        type: booking.type,
        serviceType: booking.serviceType || emailDetails.type,
        date: formattedDate,
        time: formattedTime,
        duration: booking.duration,
        price: booking.price,
        meetLink
      });

      console.log('✅ Emails enviados exitosamente');

    } catch (emailError) {
      console.error('❌ Error al enviar emails:', emailError);
      // No fallar si los emails no se pueden enviar
    }

    return res.status(200).json({
      success: true,
      message: 'Reserva actualizada con Google Meet exitosamente',
      meetLink
    });

  } catch (error) {
    console.error('❌ Error al actualizar reserva con Google Meet:', error);
    
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 