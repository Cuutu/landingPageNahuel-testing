import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAPI } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import AvailableSlot from '@/models/AvailableSlot';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Método no permitido',
      message: 'Este endpoint solo acepta peticiones POST' 
    });
  }

  try {
    // Verificar autenticación y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado', message: 'Debes iniciar sesión' });
    }

    const adminCheck = await verifyAdminAPI(req, res);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado', message: adminCheck.error || 'Se requieren permisos de administrador' });
    }

    await dbConnect();

    const { 
      serviceType = 'ConsultorioFinanciero',
      startDate, // DD/MM/YYYY
      endDate,   // DD/MM/YYYY
      timeSlots = ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'], // Horarios por defecto
      price = 199,
      duration = 60,
      skipWeekends = true,
      skipExisting = true
    } = req.body;

    console.log(`🚀 Creando horarios disponibles para ${serviceType}`);
    console.log(`📅 Desde: ${startDate} hasta: ${endDate}`);
    console.log(`⏰ Horarios: ${timeSlots.join(', ')}`);

    // Validar datos requeridos
    if (!startDate || !endDate || !timeSlots || timeSlots.length === 0) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requieren startDate, endDate y timeSlots'
      });
    }

    // Parsear fechas
    const [startDay, startMonth, startYear] = startDate.split('/').map(Number);
    const [endDay, endMonth, endYear] = endDate.split('/').map(Number);
    
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    if (start > end) {
      return res.status(400).json({
        error: 'Fechas inválidas',
        message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin'
      });
    }

    const slotsToCreate = [];
    const skippedSlots = [];
    const errorSlots = [];

    // Iterar por cada día en el rango
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Saltar fines de semana si está configurado
      if (skipWeekends && (currentDate.getDay() === 0 || currentDate.getDay() === 6)) {
        console.log(`⏭️ Saltando fin de semana: ${dateStr}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Crear slots para cada horario del día
      for (const time of timeSlots) {
        const slotData = {
          date: dateStr,
          time,
          serviceType,
          available: true,
          price,
          duration
        };

        // Verificar si ya existe (si skipExisting está habilitado)
        if (skipExisting) {
          const existingSlot = await AvailableSlot.findOne({
            date: dateStr,
            time,
            serviceType
          });

          if (existingSlot) {
            skippedSlots.push(`${dateStr} ${time}`);
            continue;
          }
        }

        try {
          const slot = new AvailableSlot(slotData);
          await slot.save();
          slotsToCreate.push(`${dateStr} ${time}`);
        } catch (error) {
          console.error(`❌ Error creando slot ${dateStr} ${time}:`, error);
          errorSlots.push(`${dateStr} ${time}`);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✅ Proceso completado:`);
    console.log(`   - Creados: ${slotsToCreate.length}`);
    console.log(`   - Saltados: ${skippedSlots.length}`);
    console.log(`   - Errores: ${errorSlots.length}`);

    res.status(200).json({
      success: true,
      message: 'Horarios creados exitosamente',
      created: slotsToCreate.length,
      skipped: skippedSlots.length,
      errors: errorSlots.length,
      details: {
        createdSlots: slotsToCreate,
        skippedSlots,
        errorSlots
      },
      config: {
        serviceType,
        startDate,
        endDate,
        timeSlots,
        price,
        duration,
        skipWeekends,
        skipExisting
      }
    });

  } catch (error) {
    console.error('❌ Error al crear horarios disponibles:', error);
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron crear los horarios disponibles',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
} 