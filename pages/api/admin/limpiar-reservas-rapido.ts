import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';

/**
 * ENDPOINT TEMPORAL para limpiar reservas fantasma rápidamente
 * Solo GET para mayor seguridad y simplicidad
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  // Verificar que sea admin
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Solo el admin puede acceder a este endpoint' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET permitido' });
  }

  try {
    console.log('🧹 LIMPIEZA RÁPIDA: Iniciando...');

    // Paso 1: Consultar todas las reservas problemáticas
    const reservasProblematicas = await Booking.find({
      $or: [
        { googleEventId: { $exists: false } },
        { googleEventId: null },
        { googleEventId: '' }
      ],
      serviceType: 'ConsultorioFinanciero',
      status: { $in: ['pending', 'confirmed'] }
    });

    console.log(`📋 Reservas problemáticas encontradas: ${reservasProblematicas.length}`);

    // Mostrar detalles de las reservas que se van a eliminar
    reservasProblematicas.forEach((booking, index) => {
      console.log(`  ${index + 1}. ID: ${booking._id}`);
      console.log(`     Usuario: ${booking.userEmail}`);
      console.log(`     Fecha: ${booking.startDate.toLocaleString('es-UY')}`);
      console.log(`     Tipo: ${booking.type} - ${booking.serviceType}`);
      console.log(`     Estado: ${booking.status}`);
      console.log(`     Google Event ID: ${booking.googleEventId || 'NULL'}`);
      console.log('     ---');
    });

    // Paso 2: Eliminar reservas fantasma
    const deleteResult = await Booking.deleteMany({
      $or: [
        { googleEventId: { $exists: false } },
        { googleEventId: null },
        { googleEventId: '' }
      ],
      serviceType: 'ConsultorioFinanciero',
      status: { $in: ['pending', 'confirmed'] }
    });

    console.log(`✅ Eliminadas ${deleteResult.deletedCount} reservas fantasma`);

    // Paso 3: Invalidar caché
    try {
      const { cache } = await import('../turnos/generate');
      if (cache) {
        cache.clear();
        console.log('✅ Caché invalidado');
      }
    } catch (cacheError) {
      console.log('⚠️ Error al invalidar caché:', cacheError);
    }

    // Paso 4: Verificar que no queden reservas problemáticas
    const reservasRestantes = await Booking.find({
      serviceType: 'ConsultorioFinanciero',
      status: { $in: ['pending', 'confirmed'] }
    });

    console.log(`📋 Reservas restantes de Consultorio Financiero: ${reservasRestantes.length}`);

    // Paso 5: Mostrar un resumen de todas las reservas actuales
    const todasLasReservas = await Booking.find({}).sort({ startDate: 1 });
    
    console.log(`📊 RESUMEN FINAL:`);
    console.log(`  - Total de reservas en la BD: ${todasLasReservas.length}`);
    console.log(`  - Reservas eliminadas: ${deleteResult.deletedCount}`);
    console.log(`  - Reservas restantes de Consultorio: ${reservasRestantes.length}`);

    return res.status(200).json({
      success: true,
      message: 'Limpieza rápida completada',
      reservasEliminadas: deleteResult.deletedCount,
      reservasProblematicasOriginales: reservasProblematicas.length,
      reservasRestantesConsultorio: reservasRestantes.length,
      totalReservasEnBD: todasLasReservas.length,
      detallesReservasEliminadas: reservasProblematicas.map(b => ({
        id: b._id,
        userEmail: b.userEmail,
        startDate: b.startDate.toISOString(),
        startDateLocal: b.startDate.toLocaleString('es-UY'),
        type: b.type,
        serviceType: b.serviceType,
        status: b.status,
        googleEventId: b.googleEventId || 'NULL'
      })),
      reservasRestantes: reservasRestantes.map(b => ({
        id: b._id,
        userEmail: b.userEmail,
        startDate: b.startDate.toISOString(),
        startDateLocal: b.startDate.toLocaleString('es-UY'),
        hasGoogleEventId: !!b.googleEventId
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en limpieza rápida:', error);
    return res.status(500).json({ 
      error: 'Error en limpieza rápida',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 