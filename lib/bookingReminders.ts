import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';
import { sendAdvisoryReminderEmail, sendTrainingReminderEmail } from '@/lib/emailNotifications';

/**
 * Procesa y envía recordatorios de asesorías próximas.
 * - 24 horas antes
 * - 1 hora antes
 */
export async function processAdvisoryReminders(): Promise<{
  totalCandidates: number;
  reminders24hSent: number;
  reminders1hSent: number;
  errors: string[];
}> {
  await dbConnect();

  const now = new Date();
  const errors: string[] = [];
  let reminders24hSent = 0;
  let reminders1hSent = 0;

  // Ventanas de tiempo
  const in24hStart = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 15 * 60 * 1000); // 24h - 15m
  const in24hEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);  // 24h + 15m

  const in1hStart = new Date(now.getTime() + 60 * 60 * 1000 - 10 * 60 * 1000); // 1h - 10m
  const in1hEnd = new Date(now.getTime() + 60 * 60 * 1000 + 10 * 60 * 1000);  // 1h + 10m

  // Buscar asesorías confirmadas futuras
  const candidates = await Booking.find({
    type: 'advisory',
    status: 'confirmed',
    startDate: { $gte: new Date(now.getTime() - 5 * 60 * 1000) } // tolerancia por si quedó justo ahora
  }).limit(500);

  for (const booking of candidates) {
    try {
      const start = new Date(booking.startDate);

      // 24h window
      const isIn24hWindow = start >= in24hStart && start <= in24hEnd;
      if (isIn24hWindow && !booking.reminder24hSent) {
        await sendAdvisoryReminderEmail({
          userEmail: booking.userEmail,
          userName: booking.userName,
          serviceType: booking.serviceType || 'Consultorio Financiero',
          startDate: start,
          durationMinutes: booking.duration,
          meetLink: booking.meetingLink,
          reminderType: '24h'
        });
        booking.reminder24hSent = true;
        await booking.save();
        reminders24hSent++;
        continue; // evitar doble envío el mismo ciclo
      }

      // 1h window
      const isIn1hWindow = start >= in1hStart && start <= in1hEnd;
      if (isIn1hWindow && !booking.reminder1hSent) {
        await sendAdvisoryReminderEmail({
          userEmail: booking.userEmail,
          userName: booking.userName,
          serviceType: booking.serviceType || 'Consultorio Financiero',
          startDate: start,
          durationMinutes: booking.duration,
          meetLink: booking.meetingLink,
          reminderType: '1h'
        });
        booking.reminder1hSent = true;
        await booking.save();
        reminders1hSent++;
        continue;
      }
    } catch (err: any) {
      errors.push(`${booking._id}: ${err?.message || 'Error desconocido'}`);
    }
  }

  return {
    totalCandidates: candidates.length,
    reminders24hSent,
    reminders1hSent,
    errors
  };
}

/**
 * Procesa y envía recordatorios de entrenamientos (p.ej., SwingTrading).
 * - 24 horas antes
 * - 1 hora antes
 */
export async function processTrainingReminders(): Promise<{
  totalCandidates: number;
  reminders24hSent: number;
  reminders1hSent: number;
  errors: string[];
}> {
  await dbConnect();

  const now = new Date();
  const errors: string[] = [];
  let reminders24hSent = 0;
  let reminders1hSent = 0;

  // Ventanas de tiempo
  const in24hStart = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 15 * 60 * 1000);
  const in24hEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);

  const in1hStart = new Date(now.getTime() + 60 * 60 * 1000 - 10 * 60 * 1000);
  const in1hEnd = new Date(now.getTime() + 60 * 60 * 1000 + 10 * 60 * 1000);

  // Buscar entrenamientos confirmados futuras (SwingTrading)
  const candidates = await Booking.find({
    type: 'training',
    status: 'confirmed',
    serviceType: { $in: ['SwingTrading', 'AdvancedStrategies'] },
    startDate: { $gte: new Date(now.getTime() - 5 * 60 * 1000) }
  }).limit(500);

  for (const booking of candidates) {
    try {
      const start = new Date(booking.startDate);
      const trainingName = booking.serviceType || 'Entrenamiento';

      // 24h window
      const isIn24hWindow = start >= in24hStart && start <= in24hEnd;
      if (isIn24hWindow && !booking.reminder24hSent) {
        await sendTrainingReminderEmail({
          userEmail: booking.userEmail,
          userName: booking.userName,
          trainingName,
          startDate: start,
          durationMinutes: booking.duration || 120,
          meetLink: booking.meetingLink,
          reminderType: '24h'
        });
        booking.reminder24hSent = true;
        await booking.save();
        reminders24hSent++;
        continue;
      }

      // 1h window
      const isIn1hWindow = start >= in1hStart && start <= in1hEnd;
      if (isIn1hWindow && !booking.reminder1hSent) {
        await sendTrainingReminderEmail({
          userEmail: booking.userEmail,
          userName: booking.userName,
          trainingName,
          startDate: start,
          durationMinutes: booking.duration || 120,
          meetLink: booking.meetingLink,
          reminderType: '1h'
        });
        booking.reminder1hSent = true;
        await booking.save();
        reminders1hSent++;
        continue;
      }
    } catch (err: any) {
      errors.push(`${booking._id}: ${err?.message || 'Error desconocido'}`);
    }
  }

  return {
    totalCandidates: candidates.length,
    reminders24hSent,
    reminders1hSent,
    errors
  };
} 