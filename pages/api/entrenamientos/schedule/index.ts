import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Training from '@/models/Training';
import { z } from 'zod';
import { createTrainingScheduleNotification } from '@/lib/trainingNotifications';

// Schema de validación para crear horarios de entrenamiento
const createTrainingScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59).default(0),
  duration: z.number().min(60).max(240).default(90), // 1-4 horas por sesión
  type: z.enum(['SwingTrading', 'DowJones']),
  price: z.number().min(0),
  maxBookingsPerDay: z.number().min(1).max(5).default(2), // Máximo 2 estudiantes por día
  activo: z.boolean().default(true)
});

/**
 * API para gestionar horarios de entrenamientos
 * GET: Obtener todos los horarios (público)
 * POST: Crear nuevo horario (solo admin)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      console.log('🎓 Obteniendo horarios de entrenamientos');
      
      const { type } = req.query;
      
      // Buscar entrenamientos activos
      const filter: any = { activo: true };
      if (type && ['SwingTrading', 'DowJones'].includes(type as string)) {
        filter.tipo = type;
      }

      const trainings = await Training.find(filter);
      
      // Extraer todos los horarios de todos los entrenamientos
      const allSchedules = trainings.flatMap(training => 
        training.horarios
          .filter((h: any) => h.activo)
          .map((h: any) => ({
            _id: h._id,
            dayOfWeek: h.dia,
            hour: Math.floor(parseInt(h.hora.split(':')[0])),
            minute: parseInt(h.hora.split(':')[1]) || 0,
            duration: training.duracion || 90,
            type: training.tipo,
            price: training.precio,
            cuposDisponibles: h.cuposDisponibles || 1,
            activo: h.activo,
            trainingId: training._id,
            trainingName: training.nombre
          }))
      );

      // Ordenar por día y hora
      allSchedules.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) {
          return a.dayOfWeek - b.dayOfWeek;
        }
        if (a.hour !== b.hour) {
          return a.hour - b.hour;
        }
        return a.minute - b.minute;
      });

      console.log(`✅ Encontrados ${allSchedules.length} horarios de entrenamiento configurados`);
      return res.status(200).json({ schedules: allSchedules });

    } catch (error) {
      console.error('❌ Error al obtener horarios de entrenamiento:', error);
      return res.status(500).json({ error: 'Error al obtener los horarios de entrenamiento' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Verificar permisos de admin
      const adminCheck = await verifyAdminAccess({ req, res } as any);
      if (!adminCheck.isAdmin) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      console.log('📝 Creando nuevo horario de entrenamiento');

      // Validar datos de entrada
      const validationResult = createTrainingScheduleSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Datos inválidos',
          details: validationResult.error.errors 
        });
      }

      const scheduleData = validationResult.data;

      // Buscar o crear el entrenamiento
      let training = await Training.findOne({ tipo: scheduleData.type });
      
      if (!training) {
        // Crear entrenamiento básico si no existe
        training = new Training({
          tipo: scheduleData.type,
          nombre: scheduleData.type === 'SwingTrading' 
            ? 'Zero 2 Trader' 
            : 'Dow Jones Advanced',
          descripcion: scheduleData.type === 'SwingTrading'
            ? 'Entrenamiento completo de Zero 2 Trader desde cero'
            : 'Estrategias avanzadas de trading profesional',
          precio: scheduleData.price,
          duracion: scheduleData.duration,
          metricas: {
            rentabilidad: scheduleData.type === 'SwingTrading' ? 120 : 180,
            estudiantesActivos: 0,
            entrenamientosRealizados: 0,
            satisfaccion: 5.0
          },
          solicitudes: [],
          horarios: [],
          contenido: {
            modulos: scheduleData.type === 'SwingTrading' ? 12 : 16,
            lecciones: scheduleData.type === 'SwingTrading' ? 85 : 120,
            certificacion: true,
            nivelAcceso: scheduleData.type === 'SwingTrading' ? 'Básico' : 'Avanzado'
          },
          activo: true
        });
      }

      // Formatear hora
      const horaFormateada = `${scheduleData.hour.toString().padStart(2, '0')}:${scheduleData.minute.toString().padStart(2, '0')}`;

      // Verificar que no haya conflictos
      const conflictingSchedule = training.horarios.find((h: any) => 
        h.dia === scheduleData.dayOfWeek && 
        h.hora === horaFormateada && 
        h.activo
      );

      if (conflictingSchedule) {
        return res.status(409).json({ 
          error: `Ya existe un horario activo para ${scheduleData.type} en ese día y hora` 
        });
      }

      // Agregar el nuevo horario
      const newSchedule = {
        dia: scheduleData.dayOfWeek,
        hora: horaFormateada,
        cuposDisponibles: scheduleData.maxBookingsPerDay,
        activo: true
      };

      training.horarios.push(newSchedule);
      training.precio = scheduleData.price; // Actualizar precio
      training.duracion = scheduleData.duration; // Actualizar duración

      await training.save();

      console.log('✅ Horario de entrenamiento creado exitosamente');

      // ✅ NUEVO: Crear notificación de nuevo horario
      try {
        const trainingName = training.nombre;
        
        await createTrainingScheduleNotification(
          training.tipo,
          trainingName,
          {
            dayOfWeek: scheduleData.dayOfWeek,
            hour: scheduleData.hour,
            minute: scheduleData.minute,
            duration: scheduleData.duration,
            price: scheduleData.price
          }
        );

        console.log('✅ Notificación de nuevo horario creada exitosamente');
      } catch (notificationError) {
        console.error('❌ Error al crear notificación de horario:', notificationError);
        // No fallar la creación del horario si las notificaciones fallan
      }

      return res.status(201).json({ 
        schedule: {
          ...newSchedule,
          _id: training.horarios[training.horarios.length - 1]._id,
          type: training.tipo,
          price: training.precio,
          duration: training.duracion,
          trainingId: training._id
        }
      });

    } catch (error) {
      console.error('❌ Error al crear horario de entrenamiento:', error);
      return res.status(500).json({ error: 'Error al crear el horario de entrenamiento' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
} 