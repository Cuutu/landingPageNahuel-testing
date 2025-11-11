import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAPI } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import AdvisorySchedule from '@/models/AdvisorySchedule';
import AvailableSlot from '@/models/AvailableSlot';

/**
 * API para sincronizar horarios de AdvisorySchedule con AvailableSlot
 * POST: Sincroniza todos los horarios existentes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🔄 [SYNC] Iniciando sincronización de horarios de asesorías...');
    
    // Verificar permisos de admin
    const adminCheck = await verifyAdminAPI(req, res);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    await dbConnect();

    // Obtener todos los horarios de AdvisorySchedule
    const advisorySchedules = await AdvisorySchedule.find({}).sort({ date: 1, time: 1 });
    console.log(`📊 [SYNC] Encontrados ${advisorySchedules.length} horarios en AdvisorySchedule`);

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const schedule of advisorySchedules) {
      try {
        // Convertir fecha de Date a DD/MM/YYYY para AvailableSlot
        const day = schedule.date.getDate().toString().padStart(2, '0');
        const month = (schedule.date.getMonth() + 1).toString().padStart(2, '0');
        const year = schedule.date.getFullYear();
        const dateForAvailableSlot = `${day}/${month}/${year}`;

        // Verificar si ya existe en AvailableSlot
        const existingAvailableSlot = await AvailableSlot.findOne({
          date: dateForAvailableSlot,
          time: schedule.time,
          serviceType: 'ConsultorioFinanciero'
        });

        if (existingAvailableSlot) {
          // Actualizar disponibilidad
          existingAvailableSlot.available = schedule.isAvailable && !schedule.isBooked;
          await existingAvailableSlot.save();
          updatedCount++;
          console.log(`✅ [SYNC] Actualizado: ${dateForAvailableSlot} ${schedule.time}`);
        } else {
          // Crear nuevo slot
          await AvailableSlot.create({
            date: dateForAvailableSlot,
            time: schedule.time,
            serviceType: 'ConsultorioFinanciero',
            available: schedule.isAvailable && !schedule.isBooked,
            price: 50000, // Precio por defecto en ARS
            duration: 45, // Duración por defecto en minutos
            reservedBy: undefined,
            reservedAt: undefined,
            bookingId: undefined
          });
          createdCount++;
          console.log(`🆕 [SYNC] Creado: ${dateForAvailableSlot} ${schedule.time}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [SYNC] Error procesando ${schedule.date} ${schedule.time}:`, error);
      }
    }

    console.log(`📊 [SYNC] Sincronización completada - Creados: ${createdCount}, Actualizados: ${updatedCount}, Errores: ${errorCount}`);

    return res.status(200).json({
      success: true,
      message: 'Sincronización completada',
      stats: {
        totalProcessed: advisorySchedules.length,
        created: createdCount,
        updated: updatedCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ [SYNC] Error en sincronización:', error);
    return res.status(500).json({ error: 'Error en la sincronización' });
  }
} 