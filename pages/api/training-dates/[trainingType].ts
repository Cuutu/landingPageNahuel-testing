import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import TrainingDate from '@/models/TrainingDate';
import Training from '@/models/Training';
import { createTrainingEvent } from '@/lib/googleCalendar';
import { createTrainingScheduleNotification } from '@/lib/trainingNotifications';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    
    const { trainingType } = req.query;

    if (req.method === 'GET') {
      return await handleGet(req, res, trainingType as string);
    } else if (req.method === 'POST') {
      return await handlePost(req, res, trainingType as string);
    } else if (req.method === 'PUT') {
      return await handlePut(req, res, trainingType as string);
    } else if (req.method === 'DELETE') {
      return await handleDelete(req, res, trainingType as string);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ 
        success: false, 
        error: `Método ${req.method} no permitido` 
      });
    }
  } catch (error) {
    console.error('Error en /api/training-dates:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
}

// GET /api/training-dates/[trainingType] - Obtener fechas de entrenamiento
async function handleGet(req: NextApiRequest, res: NextApiResponse, trainingType: string) {
  try {
    const now = new Date();
    // Desactivar en BD las fechas pasadas (best-effort)
    await TrainingDate.updateMany({ trainingType, isActive: true, date: { $lt: now } }, { $set: { isActive: false, updatedAt: new Date() } });

    // Devolver solo futuras
    const trainingDates = await TrainingDate.find({ trainingType, isActive: true, date: { $gte: now } }).sort({ date: 1 });

    return res.status(200).json({
      success: true,
      dates: trainingDates
    });
  } catch (error) {
    console.error('Error obteniendo fechas de entrenamiento:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al obtener fechas de entrenamiento'
    });
  }
}

// POST /api/training-dates/[trainingType] - Crear nueva fecha de entrenamiento (solo admin)
async function handlePost(req: NextApiRequest, res: NextApiResponse, trainingType: string) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado'
      });
    }

    // Verificar si es admin
    const adminEmails = ['joaquinperez028@gmail.com', 'franco.l.varela99@gmail.com'];
    if (!adminEmails.includes(session.user.email)) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes'
      });
    }

    const { date, time, title } = req.body;

    if (!date || !time || !title) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: date, time, title'
      });
    }

    // Parsear fecha y hora a Date (normalizado a zona configurada)
    const base = new Date(date);
    const [hour, minute] = String(time).split(':').map((v: string) => parseInt(v, 10));
    const tz = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
    const yyyy = base.getFullYear();
    const mm = (base.getMonth() + 1).toString().padStart(2, '0');
    const dd = base.getDate().toString().padStart(2, '0');
    const hh = (hour || 0).toString().padStart(2, '0');
    const mi = (minute || 0).toString().padStart(2, '0');
    // Construir como local y que Calendar lo interprete con tz al crear
    const startDate = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00`);

    // Obtener configuración del entrenamiento (duración y nombre)
    const trainingDoc = await Training.findOne({ tipo: trainingType });
    const trainingName = trainingDoc?.nombre || (trainingType === 'SwingTrading' ? 'Swing Trading' : 'Entrenamiento');
    const durationMinutes = (trainingDoc?.duracion ? Number(trainingDoc.duracion) : 3) * 60; // duracion en horas -> minutos

    // Crear entidad en BD primero
    const newTrainingDate = await TrainingDate.create({
      trainingType,
      date: startDate,
      time,
      title,
      isActive: true,
      createdBy: session.user.email,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Crear evento en Google Calendar con Google Meet automáticamente
    try {
      // Evitar duplicado si por alguna razón ya existe un eventId
      let meetData: any = null;
      if (!newTrainingDate.googleEventId) {
        const attendeeEmail = session.user.email || process.env.ADMIN_EMAIL || 'admin@example.com';
        meetData = await createTrainingEvent(attendeeEmail, trainingName, startDate, durationMinutes);
      }

      if (meetData?.success) {
        await TrainingDate.findByIdAndUpdate(newTrainingDate._id, {
          googleEventId: meetData.eventId,
          meetLink: meetData.meetLink
        });
      }
    } catch (calendarError) {
      console.error('⚠️ Error creando evento en Google Calendar para TrainingDate:', calendarError);
      // No fallemos la creación de la fecha si Calendar falla
    }

    // Notificar a los alumnos con entrenamiento activo
    try {
      const dayOfWeek = startDate.getDay();
      const hour = startDate.getHours();
      const minute = startDate.getMinutes();
      await createTrainingScheduleNotification(
        trainingType,
        trainingName,
        {
          dayOfWeek,
          hour,
          minute,
          duration: durationMinutes,
          price: trainingDoc?.precio || 0
        }
      );
    } catch (e) {
      console.error('⚠️ Error notificando nuevo TrainingDate:', e);
    }

    // Devolver la fecha (posiblemente ya actualizada con meetLink)
    const saved = await TrainingDate.findById(newTrainingDate._id);

    return res.status(201).json({
      success: true,
      data: saved,
      message: 'Fecha de entrenamiento creada exitosamente'
    });
  } catch (error) {
    console.error('Error creando fecha de entrenamiento:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al crear fecha de entrenamiento'
    });
  }
}

// PUT /api/training-dates/[trainingType] - Actualizar fecha de entrenamiento (solo admin)
async function handlePut(req: NextApiRequest, res: NextApiResponse, trainingType: string) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado'
      });
    }

    // Verificar si es admin
    const adminEmails = ['joaquinperez028@gmail.com', 'franco.l.varela99@gmail.com'];
    if (!adminEmails.includes(session.user.email)) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes'
      });
    }

    const { id, date, time, title } = req.body;

    if (!id || !date || !time || !title) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos: id, date, time, title'
      });
    }

    // Preparar nueva fecha/hora
    const startDate = new Date(date);
    const [hour, minute] = String(time).split(':').map((v: string) => parseInt(v, 10));
    startDate.setHours(hour || 0, minute || 0, 0, 0);

    // Obtener training para duración/nombre
    const trainingDoc = await Training.findOne({ tipo: trainingType });
    const trainingName = trainingDoc?.nombre || (trainingType === 'SwingTrading' ? 'Swing Trading' : 'Entrenamiento');
    const durationMinutes = (trainingDoc?.duracion ? Number(trainingDoc.duracion) : 3) * 60;

    // Actualizar documento
    const updatedTrainingDate = await TrainingDate.findByIdAndUpdate(
      id,
      {
        date: startDate,
        time,
        title,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedTrainingDate) {
      return res.status(404).json({
        success: false,
        error: 'Fecha de entrenamiento no encontrada'
      });
    }

    // Sincronizar con Google Calendar
    try {
      const calendar = await (await import('@/lib/googleCalendar'));
      const calendarClient = await (await (calendar as any)).getAdminCalendarClient?.();
      const calendarId = calendarClient ? await (await (calendar as any)).getCorrectCalendarId?.(calendarClient) : null;

      if (updatedTrainingDate.googleEventId && calendarClient && calendarId) {
        // Actualizar evento existente
        await calendarClient.events.patch({
          calendarId,
          eventId: updatedTrainingDate.googleEventId,
          requestBody: {
            start: { dateTime: startDate.toISOString(), timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires' },
            end: { dateTime: new Date(startDate.getTime() + durationMinutes * 60000).toISOString(), timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires' },
            summary: `${trainingName} - ${session.user.email} - ${startDate.toLocaleDateString('es-ES')}`,
          },
          conferenceDataVersion: 1
        });
      } else {
        // Crear evento nuevo si no existe
        const meetData = await createTrainingEvent(session.user.email!, trainingName, startDate, durationMinutes);
        if (meetData?.success) {
          await TrainingDate.findByIdAndUpdate(updatedTrainingDate._id, {
            googleEventId: meetData.eventId,
            meetLink: meetData.meetLink
          });
        }
      }
    } catch (calendarError) {
      console.error('⚠️ Error al sincronizar con Google Calendar:', calendarError);
    }

    // Notificar actualización de horario a los alumnos
    try {
      const dayOfWeek = startDate.getDay();
      const hour = startDate.getHours();
      const minute = startDate.getMinutes();
      await createTrainingScheduleNotification(
        trainingType,
        trainingName,
        {
          dayOfWeek,
          hour,
          minute,
          duration: durationMinutes,
          price: trainingDoc?.precio || 0
        }
      );
    } catch (e) {
      console.error('⚠️ Error notificando actualización de TrainingDate:', e);
    }

    // Devolver entidad actualizada
    const saved = await TrainingDate.findById(updatedTrainingDate._id);

    return res.status(200).json({
      success: true,
      data: saved,
      message: 'Fecha de entrenamiento actualizada y sincronizada'
    });
  } catch (error) {
    console.error('Error actualizando fecha de entrenamiento:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al actualizar fecha de entrenamiento'
    });
  }
}

// DELETE /api/training-dates/[trainingType] - Eliminar fecha de entrenamiento (solo admin)
async function handleDelete(req: NextApiRequest, res: NextApiResponse, trainingType: string) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado'
      });
    }

    // Verificar si es admin
    const adminEmails = ['joaquinperez028@gmail.com', 'franco.l.varela99@gmail.com'];
    if (!adminEmails.includes(session.user.email)) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes'
      });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'ID de fecha requerido'
      });
    }

    await TrainingDate.findByIdAndUpdate(id, {
      isActive: false,
      updatedAt: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Fecha de entrenamiento eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando fecha de entrenamiento:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al eliminar fecha de entrenamiento'
    });
  }
}
