import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import User from '@/models/User';
import Booking from '@/models/Booking';
import { sendTrainingConfirmationEmail, sendAdminNotificationEmail } from '@/lib/emailNotifications';
import TrainingDate from '@/models/TrainingDate';
import { addAttendeeToEvent } from '@/lib/googleCalendar';

/**
 * POST /api/entrenamientos/reservar-sesion
 * Body: { startDate: string; duration?: number; serviceType?: 'SwingTrading' | 'DowJones' }
 * Requiere: usuario autenticado con entrenamiento activo del tipo indicado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { startDate, duration = 180, serviceType = 'SwingTrading' } = req.body || {};
    if (!startDate) {
      return res.status(400).json({ error: 'startDate es requerido' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Verificar que el usuario tenga el entrenamiento activo (pago único ya realizado)
    const hasTraining = (user.entrenamientos || []).some((e: any) => e.tipo === serviceType && e.activo);
    if (!hasTraining) {
      return res.status(403).json({ error: 'No tenés acceso activo al entrenamiento' });
    }

    // Validar conflicto horario existente para este usuario
    const start = new Date(startDate);
    const effectiveDuration = 120; // minutos
    const end = new Date(start.getTime() + effectiveDuration * 60000);
    let meetLink: string | undefined;
    let googleEventId: string | undefined;

    // Intentar buscar un TrainingDate coincidente para asociar Meet y agregar asistente
    try {
      const closeDate = await TrainingDate.findOne({
        trainingType: serviceType,
        date: { $gte: new Date(start.getTime() - 2 * 60 * 60 * 1000), $lte: new Date(start.getTime() + 2 * 60 * 60 * 1000) }
      });
      if (closeDate) {
        meetLink = closeDate.meetLink;
        googleEventId = closeDate.googleEventId;
        if (googleEventId) {
          await addAttendeeToEvent(googleEventId, user.email);
        }
      }
    } catch (e) {
      console.error('⚠️ Error vinculando TrainingDate/Meet:', e);
    }

    const overlapping = await Booking.findOne({
      userId: user._id.toString(),
      startDate: { $lt: end },
      endDate: { $gt: start },
      status: { $ne: 'cancelled' }
    });
    const isAdminUser = user.role === 'admin';
    const allowOverlap = process.env.ALLOW_TEST_OVERLAP === 'true' || isAdminUser;
    if (overlapping && !allowOverlap) {
      return res.status(409).json({ error: 'Ya tenés una reserva que se superpone con ese horario' });
    }

    // Crear booking de entrenamiento confirmado sin cobro
    const booking = new Booking({
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.name || user.email,
      type: 'training',
      serviceType,
      startDate: start,
      endDate: end,
      duration: effectiveDuration,
      status: 'confirmed',
      price: 0,
      paymentStatus: 'paid',
      notes: 'Reserva de sesión por alumno con entrenamiento activo',
      meetingLink: meetLink
    });

    await booking.save();

    // Enviar emails de confirmación
    try {
      const tz = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
      const dateStr = start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
      const timeStr = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: tz });
      await sendTrainingConfirmationEmail(user.email, user.name || user.email, {
        type: serviceType,
        date: dateStr,
        time: timeStr,
        duration: effectiveDuration,
        meetLink: meetLink
      });

      await sendAdminNotificationEmail({
        userEmail: user.email,
        userName: user.name || user.email,
        type: 'training',
        serviceType,
        date: dateStr,
        time: timeStr,
        duration: effectiveDuration,
        meetLink: meetLink
      });
    } catch (e) {
      console.error('⚠️ Error enviando emails de confirmación de reserva:', e);
    }

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error('❌ Error al reservar sesión de entrenamiento:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 