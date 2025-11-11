import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';
import AvailableSlot from '@/models/AvailableSlot';
import { z } from 'zod';

// Cache para verificación de disponibilidad
const availabilityCache = new Map<string, { available: boolean; timestamp: number; }>();
const CACHE_DURATION = 30000; // 30 segundos

// Schema de validación flexible que acepta múltiples formatos de fecha
const checkAvailabilitySchema = z.object({
  fecha: z.string().min(1), // Aceptar cualquier string de fecha no vacío
  horario: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  serviceType: z.string().optional(),
  servicioTipo: z.string().optional(), // Compatibilidad con frontend
  tipo: z.string().optional() // Compatibilidad con frontend
}).transform((data) => ({
  // Normalizar los campos para mantener compatibilidad
  fecha: data.fecha,
  horario: data.horario,
  serviceType: data.serviceType || data.servicioTipo || 'ConsultorioFinanciero'
}));

/**
 * API optimizada para verificar disponibilidad de turnos específicos
 * Compatible con Google Calendar API y escalable para múltiples formatos de fecha
 * POST: Verifica si un horario específico está disponible
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Headers para cache controlado
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30');
  
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const startTime = Date.now(); // Mover fuera del try para acceso global

  try {
    // Validar entrada
    const validationResult = checkAvailabilitySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        details: validationResult.error.errors 
      });
    }

    const { fecha, horario, serviceType } = validationResult.data;

    // Generar clave de caché
    const cacheKey = `${fecha}_${horario}_${serviceType}`;
    
    // Verificar caché
    const cached = availabilityCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return res.status(200).json({
        available: cached.available,
        fecha,
        horario,
        serviceType,
        cached: true,
        responseTime: `${Date.now() - startTime}ms`
      });
    }

    // **ESCALABLE: Parsear fecha usando función centralizada compatible con Google Calendar**
    const targetDate = parseToGoogleCalendarCompatibleDate(fecha);
    if (!targetDate) {
      return res.status(400).json({ 
        error: 'Formato de fecha inválido',
        receivedFormat: fecha,
        supportedFormats: ['DD/MM/YYYY', 'YYYY-MM-DD', 'Lun 15 Ene']
      });
    }

    // Parsear horario
    const [hour, minute] = horario.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return res.status(400).json({ error: 'Formato de horario inválido' });
    }

    // **GOOGLE CALENDAR COMPATIBLE: Crear fecha/hora específica**
    const requestedDateTime = new Date(targetDate);
    requestedDateTime.setHours(hour, minute, 0, 0);

    // **CORREGIDO: Crear fecha de fin basada en duración estándar (45 minutos)**
    const endDateTime = new Date(requestedDateTime.getTime() + 45 * 60000); // 45 minutos después

    // **CORREGIDO: Query con la misma lógica que la API de bookings (rangos superpuestos)**
    // IMPORTANTE: NO filtrar por serviceType porque un horario ocupado es ocupado sin importar el tipo de servicio
    const conflictingBookings = await Booking.find({
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        {
          // Nueva reserva empieza durante una existente
          startDate: { $lte: requestedDateTime },
          endDate: { $gt: requestedDateTime }
        },
        {
          // Nueva reserva termina durante una existente
          startDate: { $lt: endDateTime },
          endDate: { $gte: endDateTime }
        },
        {
          // Nueva reserva contiene una existente
          startDate: { $gte: requestedDateTime },
          endDate: { $lte: endDateTime }
        }
      ]
    }, '_id startDate endDate userEmail serviceType').lean();

    // **NUEVO: Verificar también en AvailableSlot**
    const dateStr = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}/${targetDate.getFullYear()}`;
    
    console.log(`🔍 Verificando AvailableSlot: ${dateStr} ${horario} (${serviceType})`);
    
    const availableSlot = await AvailableSlot.findOne({
      date: dateStr,
      time: horario,
      serviceType: serviceType
    }).lean();

    // Determinar disponibilidad considerando AMBOS sistemas
    const hasBookingConflicts = conflictingBookings.length > 0;
    const hasAvailableSlot = !!(availableSlot && (availableSlot as any).available === true);

    // Si existe un AvailableSlot, usarlo como fuente de verdad
    // Si no existe, usar el sistema legacy de verificación de conflictos en Booking
    const isAvailable = availableSlot ? hasAvailableSlot : !hasBookingConflicts;

    console.log(`📊 Resultado de verificación:`);
    console.log(`   - AvailableSlot encontrado: ${!!availableSlot}`);
    console.log(`   - AvailableSlot.available: ${(availableSlot as any)?.available}`);
    console.log(`   - Conflictos en Booking: ${hasBookingConflicts}`);
    console.log(`   - Disponible final: ${isAvailable}`);

    // **DEBUG: Log detallado si hay conflictos**
    if (conflictingBookings.length > 0) {
      console.log(`⚠️ Conflictos encontrados para ${fecha} ${horario}:`);
      conflictingBookings.forEach((booking, index) => {
        console.log(`  ${index + 1}. ID: ${booking._id}`);
        console.log(`     Usuario: ${booking.userEmail}`);
        console.log(`     Servicio: ${booking.serviceType || 'N/A'}`);
        console.log(`     Inicio: ${booking.startDate?.toISOString()}`);
        console.log(`     Fin: ${booking.endDate?.toISOString()}`);
        console.log(`     Solicitado: ${requestedDateTime.toISOString()} - ${endDateTime.toISOString()}`);
      });
    }

    // **OPTIMIZACIÓN: Guardar en caché**
    availabilityCache.set(cacheKey, {
      available: isAvailable,
      timestamp: Date.now()
    });

    // Limpiar caché viejo
    if (availabilityCache.size > 100) {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      availabilityCache.forEach((value, key) => {
        if (now - value.timestamp > CACHE_DURATION * 2) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        availabilityCache.delete(key);
      });
    }

    const responseTime = Date.now() - startTime;

    return res.status(200).json({
      available: isAvailable,
      fecha,
      horario,
      serviceType,
      cached: false,
      responseTime: `${responseTime}ms`,
      requestedDateTime: requestedDateTime.toISOString() // Google Calendar compatible
    });

  } catch (error) {
    console.error('❌ Error al verificar disponibilidad:', error);
    return res.status(500).json({ 
      error: 'Error al verificar disponibilidad',
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}

/**
 * **FUNCIÓN CENTRALIZADA ESCALABLE**
 * Parsea múltiples formatos de fecha y devuelve Date object compatible con Google Calendar API
 * Soporta todos los formatos existentes y futuros
 */
function parseToGoogleCalendarCompatibleDate(dateStr: string): Date | null {
  try {
    // Formato ISO (YYYY-MM-DD) - Compatible con Google Calendar
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const date = new Date(dateStr);
      return isValidDate(date) ? date : null;
    }

    // Formato DD/MM/YYYY - Enviado por el frontend optimizado
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split('/').map(Number);
      if (isValidDateComponents(day, month, year)) {
        // Crear Date object compatible con Google Calendar API
        return new Date(year, month - 1, day); // month es 0-indexed
      }
      return null;
    }

    // Formato español (Lun 15 Ene) - Para compatibilidad legacy
    if (/^\w{3} \d{1,2} \w{3}$/.test(dateStr)) {
      return parseSpanishDateToGoogleCalendarFormat(dateStr);
    }

    // Formato ISO completo (YYYY-MM-DDTHH:mm:ss.sssZ) - Google Calendar nativo
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateStr)) {
      const date = new Date(dateStr);
      return isValidDate(date) ? date : null;
    }

    // Formato timestamp (números) - Para compatibilidad futura
    if (/^\d+$/.test(dateStr)) {
      const timestamp = parseInt(dateStr);
      const date = new Date(timestamp);
      return isValidDate(date) ? date : null;
    }

    return null;
  } catch (error) {
    console.error('Error al parsear fecha:', error);
    return null;
  }
}

/**
 * Parsea fecha en formato español a Date object compatible con Google Calendar
 */
function parseSpanishDateToGoogleCalendarFormat(dateStr: string): Date | null {
  const monthMap: { [key: string]: number } = {
    'Ene': 0, 'Feb': 1, 'Mar': 2, 'Abr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Ago': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dic': 11
  };

  const parts = dateStr.split(' ');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[1]);
  const month = monthMap[parts[2]];
  const year = new Date().getFullYear();

  if (isValidDateComponents(day, month + 1, year)) {
    const date = new Date(year, month, day);
    
    // Si la fecha es anterior a hoy, asumimos que es del próximo año
    if (date < new Date()) {
      date.setFullYear(year + 1);
    }

    return date;
  }

  return null;
}

/**
 * Valida componentes de fecha
 */
function isValidDateComponents(day: number, month: number, year: number): boolean {
  return (
    !isNaN(day) && day > 0 && day <= 31 &&
    !isNaN(month) && month > 0 && month <= 12 &&
    !isNaN(year) && year > 1900 && year < 3000
  );
}

/**
 * Valida que un Date object sea válido
 */
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
} 