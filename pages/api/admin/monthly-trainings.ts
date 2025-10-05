import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import MonthlyTraining from '../../../models/MonthlyTraining';
import TrainingDate from '../../../models/TrainingDate';
import MonthlyTrainingSubscription from '../../../models/MonthlyTrainingSubscription';
import { createTrainingEvent } from '../../../lib/googleCalendar';
import { getGlobalTimezone } from '../../../lib/timeConfig';
import User from '../../../models/User';

// Helper para crear una Date respetando la zona horaria global (GOOGLE_CALENDAR_TIMEZONE)
function createDateInTimezone(dateString: string, timeString: string = '19:00', tz?: string): Date {
  const timezone = tz || getGlobalTimezone();
  const [year, month, day] = dateString.split('-').map((v) => parseInt(v, 10));
  const [hours, minutes] = timeString.split(':').map((v) => parseInt(v, 10));

  const yyyy = year;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hours || 0).padStart(2, '0');
  const mi = String(minutes || 0).padStart(2, '0');

  // Calcular offset de la TZ para esa fecha/hora, imitando lógica usada en training-dates
  const anchorUtc = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00Z`);
  const utc = new Date(anchorUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(anchorUtc.toLocaleString('en-US', { timeZone: timezone }));
  const diffMinutes = Math.round((local.getTime() - utc.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(diffMinutes);
  const offH = String(Math.floor(abs / 60)).padStart(2, '0');
  const offM = String(abs % 60).padStart(2, '0');
  const offset = `${sign}${offH}:${offM}`;

  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00${offset}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Verificar que el usuario sea admin
  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado - Se requieren permisos de administrador' });
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res, session.user.email);
    case 'PUT':
      return handlePut(req, res, session.user.email);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// GET - Obtener entrenamientos mensuales
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id, month, year, status } = req.query;

    let filter: any = {};
    if (id) filter._id = id;
    
    if (month) filter.month = parseInt(month as string);
    if (year) filter.year = parseInt(year as string);
    if (status) filter.status = status;

    const trainings = await MonthlyTraining.find(filter)
      .sort({ year: -1, month: -1 }) // Más recientes primero
      .lean();

    // Agregar información útil
    const trainingsWithInfo = await Promise.all(trainings.map(async (training) => {
      // Contar solo estudiantes con pago completado
      const paidStudentsLegacy = training.students.filter((s: any) => s.paymentStatus === 'completed');

      // Conteo real alineado con la página pública (suscripciones mensuales)
      const subsCount = await MonthlyTrainingSubscription.countDocuments({
        trainingType: 'SwingTrading',
        subscriptionYear: training.year,
        subscriptionMonth: training.month,
        paymentStatus: 'completed',
        isActive: true
      });
      
      // Sincronizar clases desde TrainingDate (fuente de verdad usada en la página pública)
      const startOfMonth = new Date(training.year, training.month - 1, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(training.year, training.month, 0, 23, 59, 59, 999);

      const monthDates = await TrainingDate.find({
        trainingType: 'SwingTrading',
        isActive: true,
        date: { $gte: startOfMonth, $lte: endOfMonth }
      }).sort({ date: 1 }).lean();

      // Derivar clases desde TrainingDate
      const derivedClasses = monthDates.map((d: any) => {
        const dt = new Date(d.date);
        const hh = dt.getHours().toString().padStart(2, '0');
        const mm = dt.getMinutes().toString().padStart(2, '0');
        return {
          date: dt,
          startTime: `${hh}:${mm}`,
          title: d.title || 'Clase',
          status: dt.getTime() < Date.now() ? 'completed' : 'scheduled',
          meetingLink: d.meetLink || undefined
        };
      });

      const totalClassesDerived = derivedClasses.length;
      const completedClassesDerived = derivedClasses.filter((c: any) => c.status === 'completed').length;

      return {
        ...training,
        availableSpots: Math.max(0, training.maxStudents - subsCount),
        // Preferir conteo derivado de TrainingDate si hay datos, para alinear con la página pública
        totalClasses: totalClassesDerived > 0 ? totalClassesDerived : training.classes.length,
        completedClasses: totalClassesDerived > 0 ? completedClassesDerived : training.classes.filter((c: any) => c.status === 'completed').length,
        monthName: getMonthName(training.month),
        canEnroll: training.status === 'open' && subsCount < training.maxStudents,
        isEnrolled: false, // Se calculará en el frontend basado en el usuario logueado
        // Mostrar el conteo basado en suscripciones (página pública) con fallback al legado
        paidStudentsCount: subsCount ?? paidStudentsLegacy.length,
        paymentRange: training.paymentRange,
        // Exponer clases derivadas para UI que lo requiera
        derivedClasses
      };
    }));

    return res.status(200).json({
      success: true,
      data: trainingsWithInfo
    });
  } catch (error) {
    console.error('Error obteniendo entrenamientos mensuales:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST - Crear nuevo entrenamiento mensual
async function handlePost(req: NextApiRequest, res: NextApiResponse, adminEmail: string) {
  try {
    const {
      title,
      description,
      month,
      year,
      maxStudents = 10,
      price,
      classes
    } = req.body;

    // Validaciones básicas
    if (!title || !description || !month || !year || !price || !classes) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'El mes debe estar entre 1 y 12' });
    }

    if (classes.length === 0) {
      return res.status(400).json({ error: 'Debe definir al menos una clase' });
    }

    // Verificar que no exista ya un entrenamiento para ese mes/año
    const existingTraining = await MonthlyTraining.findOne({ month, year, type: 'swing-trading' });
    if (existingTraining) {
      return res.status(400).json({ error: `Ya existe un entrenamiento para ${getMonthName(month)} ${year}` });
    }

    // Crear el entrenamiento
    const now = new Date();
    const newTraining = new MonthlyTraining({
      type: 'swing-trading',
      title,
      description,
      month,
      year,
      maxStudents,
      price,
      paymentRange: `swing-trading-${year}-${month.toString().padStart(2, '0')}`, // Generar rango único
      classes: classes.map((cls: any, index: number) => ({
        ...cls,
        _id: undefined, // Dejar que MongoDB genere el ID
        date: createDateInTimezone(cls.date, cls.startTime, getGlobalTimezone()), // Respetar zona horaria global
        status: 'scheduled'
      })),
      students: [],
      status: 'open',
      createdBy: adminEmail,
      // Ventana: desde creación hasta fin de mes
      registrationOpenDate: now,
      registrationCloseDate: new Date(year, month, 0, 23, 59, 59, 999)
    });

    await newTraining.save();

    // Crear eventos de Calendar con Meet para cada clase Y sincronizar con TrainingDate
    try {
      const tz = getGlobalTimezone();
      const updatedClasses = [] as any[];
      const TrainingDate = (await import('@/models/TrainingDate')).default;
      
      for (const cls of newTraining.classes as any[]) {
        const startDate: Date = cls.date;
        const durationMinutes = 120; // Duración estándar
        const trainingName = newTraining.title || 'Entrenamiento Swing Trading';

        const meet = await createTrainingEvent(
          adminEmail,
          trainingName,
          startDate,
          durationMinutes
        );
        if (meet?.success) {
          cls.googleEventId = meet.eventId;
          cls.meetingLink = meet.meetLink;
          
          // Sincronizar con TrainingDate para que aparezcan los links
          try {
            const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const dayEnd = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
            
            const existingTrainingDate = await TrainingDate.findOne({
              trainingType: 'SwingTrading',
              date: { $gte: dayStart, $lt: dayEnd }
            });
            
            if (existingTrainingDate) {
              // Actualizar el TrainingDate existente con el meetLink
              existingTrainingDate.meetLink = meet.meetLink;
              existingTrainingDate.googleEventId = meet.eventId;
              await existingTrainingDate.save();
            } else {
              // Crear nuevo TrainingDate si no existe
              const newTrainingDate = new TrainingDate({
                trainingType: 'SwingTrading',
                date: startDate,
                title: cls.title || trainingName,
                isActive: true,
                meetLink: meet.meetLink,
                googleEventId: meet.eventId
              });
              await newTrainingDate.save();
            }
          } catch (syncErr) {
            console.error('⚠️ Error sincronizando con TrainingDate:', syncErr);
          }
        }
        updatedClasses.push(cls);
      }
      newTraining.classes = updatedClasses as any;
      await newTraining.save();
    } catch (calendarErr) {
      console.error('⚠️ Error creando eventos de Calendar para clases del pack:', calendarErr);
      // No fallar la creación del entrenamiento si falla Calendar
    }

    return res.status(201).json({
      success: true,
      message: 'Entrenamiento mensual creado exitosamente',
      data: newTraining
    });
  } catch (error) {
    console.error('Error creando entrenamiento mensual:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT - Actualizar entrenamiento mensual
async function handlePut(req: NextApiRequest, res: NextApiResponse, adminEmail: string) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID requerido' });
    }

    const training = await MonthlyTraining.findById(id);
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // No permitir cambios si ya tiene estudiantes inscritos (excepto ciertos campos)
    if (training.students.length > 0) {
      const allowedFields = ['title', 'description', 'status', 'classes'];
      const hasRestrictedChanges = Object.keys(updateData).some(key => 
        !allowedFields.includes(key) && key !== 'id'
      );
      
      if (hasRestrictedChanges) {
        return res.status(400).json({ 
          error: 'No se pueden modificar ciertos campos cuando ya hay estudiantes inscritos' 
        });
      }
    }

    // Procesar fechas si se están actualizando las clases
    if (updateData.classes) {
      // Para cada clase: si no tiene googleEventId, crear evento; si cambia fecha/hora, intentar actualizar
      const nextClasses = [] as any[];
      for (const cls of updateData.classes) {
        const processed = {
          ...cls,
          date: createDateInTimezone(cls.date, cls.startTime, getGlobalTimezone())
        } as any;
        try {
          if (!processed.googleEventId) {
            const meet = await createTrainingEvent(
              adminEmail,
              training.title || 'Entrenamiento Swing Trading',
              processed.date,
              120
            );
            if (meet?.success) {
              processed.googleEventId = meet.eventId;
              processed.meetingLink = meet.meetLink;
            }
          }
        } catch (e) {
          console.error('⚠️ Error creando evento para clase actualizada:', e);
        }
        nextClasses.push(processed);
      }
      updateData.classes = nextClasses;
    }

    const updatedTraining = await MonthlyTraining.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Entrenamiento actualizado exitosamente',
      data: updatedTraining
    });
  } catch (error) {
    console.error('Error actualizando entrenamiento mensual:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE - Eliminar entrenamiento mensual
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID requerido' });
    }

    const training = await MonthlyTraining.findById(id);
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // No permitir eliminar si ya tiene estudiantes inscritos
    if (training.students.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar un entrenamiento con estudiantes inscritos' 
      });
    }

    await MonthlyTraining.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Entrenamiento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando entrenamiento mensual:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Helper function para obtener nombre del mes
function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || 'Mes inválido';
}
