import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAPI } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import AdvisorySchedule from '@/models/AdvisorySchedule';
import AvailableSlot from '@/models/AvailableSlot';
import { z } from 'zod';

// Schema de validación para crear horario de asesoría
const createAdvisoryScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Formato YYYY-MM-DD
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):00$/), // Solo formato HH:00
  isAvailable: z.boolean().default(true),
  isBooked: z.boolean().default(false)
});

/**
 * API para gestionar horarios de asesorías
 * GET: Obtener todos los horarios disponibles (público)
 * POST: Crear nuevo horario (solo admin) - Sincroniza con AvailableSlot
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      console.log('📅 Obteniendo horarios de asesorías');
      
      const { date, available } = req.query;
      const filter: any = {};
      
      // Filtrar por fecha específica si se proporciona
      if (date && typeof date === 'string') {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        filter.date = {
          $gte: startDate,
          $lte: endDate
        };
      }
      
      // Filtrar solo horarios disponibles si se solicita
      if (available === 'true') {
        filter.isAvailable = true;
        filter.isBooked = false;
      }

      const schedules = await AdvisorySchedule.find(filter)
        .sort({ date: 1, time: 1 });

      console.log(`✅ Encontrados ${schedules.length} horarios de asesoría`);
      return res.status(200).json({ schedules });

    } catch (error) {
      console.error('❌ Error al obtener horarios de asesoría:', error);
      return res.status(500).json({ error: 'Error al obtener los horarios de asesoría' });
    }
  }

  if (req.method === 'POST') {
    try {
      console.log('📝 [API] Iniciando POST para crear horario de asesoría');
      console.log('📝 [API] Body recibido:', req.body);
      
      // Verificar permisos de admin
      console.log('🔍 [API] Verificando permisos de admin...');
      const adminCheck = await verifyAdminAPI(req, res);
      console.log('🔍 [API] Resultado de verificación:', adminCheck);
      
      if (!adminCheck.isAdmin) {
        console.log('❌ [API] Acceso denegado - Usuario no es admin');
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      console.log('✅ [API] Permisos de admin confirmados');
      console.log('📝 [API] Creando nuevo horario de asesoría');

      // Validar datos de entrada
      console.log('🔍 [API] Validando datos de entrada...');
      const validationResult = createAdvisoryScheduleSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log('❌ [API] Validación fallida:', validationResult.error.errors);
        return res.status(400).json({ 
          error: 'Datos inválidos',
          details: validationResult.error.errors 
        });
      }

      console.log('✅ [API] Validación exitosa');
      const scheduleData = validationResult.data;
      console.log('📝 [API] Datos validados:', scheduleData);
      
      // Convertir la fecha string a Date - CORREGIDO para evitar offset de un día
      console.log('📅 [API] Fecha recibida:', scheduleData.date);
      
      // CORREGIDO: Crear fecha como local, no como UTC
      // En lugar de agregar T00:00:00.000Z (que lo hace UTC), 
      // construimos la fecha usando los componentes locales
      const [year, month, day] = scheduleData.date.split('-').map(Number);
      const scheduleDate = new Date(year, month - 1, day); // month - 1 porque getMonth() devuelve 0-11
      
      console.log('📅 [API] Componentes de fecha:', { year, month, day });
      console.log('📅 [API] Fecha construida como local:', scheduleDate);
      console.log('📅 [API] Fecha ISO string:', scheduleDate.toISOString());
      console.log('📅 [API] Fecha local:', scheduleDate.toLocaleDateString('es-ES'));

      // Verificar que no haya conflictos con horarios existentes
      console.log('🔍 [API] Verificando conflictos...');
      const conflictingSchedule = await AdvisorySchedule.findOne({
        date: scheduleDate,
        time: scheduleData.time
      });

      if (conflictingSchedule) {
        console.log('⚠️ [API] Horario ya existe:', conflictingSchedule._id);
        return res.status(409).json({ 
          error: `Ya existe un horario para ${scheduleData.date} a las ${scheduleData.time}` 
        });
      }

      console.log('✅ [API] No hay conflictos, procediendo a crear...');

      // Crear el nuevo horario en AdvisorySchedule
      console.log('📝 [API] Creando horario en AdvisorySchedule con fecha:', scheduleDate);
      console.log('📝 [API] Datos completos para AdvisorySchedule:', {
        ...scheduleData,
        date: scheduleDate
      });
      
      const newSchedule = await AdvisorySchedule.create({
        ...scheduleData,
        date: scheduleDate
      });

      console.log('✅ [API] Horario de asesoría creado exitosamente:', newSchedule._id);
      console.log('✅ [API] Fecha guardada en DB:', newSchedule.date);
      console.log('✅ [API] Fecha guardada ISO:', new Date(newSchedule.date).toISOString());
      console.log('✅ [API] Fecha guardada local:', new Date(newSchedule.date).toLocaleDateString('es-ES'));

      // 🔄 SINCRONIZAR CON AVAILABLESLOT
      try {
        console.log('🔄 [API] Sincronizando con AvailableSlot...');
        console.log('🔄 [API] scheduleData:', scheduleData);
        console.log('🔄 [API] scheduleDate:', scheduleDate);
        
        // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY para AvailableSlot - CORREGIDO para fecha local
        const day = scheduleDate.getDate().toString().padStart(2, '0'); // getDate() en lugar de getUTCDate()
        const month = (scheduleDate.getMonth() + 1).toString().padStart(2, '0'); // getMonth() en lugar de getUTCMonth()
        const year = scheduleDate.getFullYear(); // getFullYear() en lugar de getUTCFullYear()
        const dateForAvailableSlot = `${day}/${month}/${year}`;
        
        console.log('📅 [API] Conversión local para AvailableSlot:');
        console.log('📅 [API] - scheduleDate local:', scheduleDate.toLocaleDateString('es-ES'));
        console.log('📅 [API] - día local:', day);
        console.log('📅 [API] - mes local:', month);
        console.log('📅 [API] - año local:', year);
        console.log('📅 [API] - Fecha final para AvailableSlot:', dateForAvailableSlot);

        // Verificar si ya existe en AvailableSlot
        console.log('🔍 [API] Buscando slot existente en AvailableSlot...');
        const existingAvailableSlot = await AvailableSlot.findOne({
          date: dateForAvailableSlot,
          time: scheduleData.time,
          serviceType: 'ConsultorioFinanciero'
        });

        if (existingAvailableSlot) {
          console.log('ℹ️ [API] Slot ya existe en AvailableSlot, actualizando disponibilidad...');
          existingAvailableSlot.available = scheduleData.isAvailable && !scheduleData.isBooked;
          await existingAvailableSlot.save();
          console.log('✅ [API] Slot actualizado en AvailableSlot');
        } else {
          console.log('🆕 [API] Creando nuevo slot en AvailableSlot...');
          console.log('🆕 [API] Datos para AvailableSlot:', {
            date: dateForAvailableSlot,
            time: scheduleData.time,
            serviceType: 'ConsultorioFinanciero',
            available: scheduleData.isAvailable && !scheduleData.isBooked,
            price: 50000,
            duration: 45
          });
          
          // Crear nuevo slot en AvailableSlot
          const newAvailableSlot = await AvailableSlot.create({
            date: dateForAvailableSlot,
            time: scheduleData.time,
            serviceType: 'ConsultorioFinanciero',
            available: scheduleData.isAvailable && !scheduleData.isBooked,
            price: 50000, // Precio por defecto en ARS
            duration: 45, // Duración por defecto en minutos
            reservedBy: undefined,
            reservedAt: undefined,
            bookingId: undefined
          });
          
          console.log('✅ [API] Nuevo slot creado en AvailableSlot:', newAvailableSlot._id);
        }
        
        console.log('✅ [API] Sincronización con AvailableSlot completada');
      } catch (syncError) {
        console.error('⚠️ [API] Error en sincronización con AvailableSlot:', syncError);
        console.error('⚠️ [API] Stack trace:', (syncError as Error).stack);
        // No fallar la operación principal por errores de sincronización
      }

      return res.status(201).json({ schedule: newSchedule });

    } catch (error) {
      console.error('❌ [API] Error al crear horario de asesoría:', error);
      return res.status(500).json({ error: 'Error al crear el horario de asesoría' });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
} 