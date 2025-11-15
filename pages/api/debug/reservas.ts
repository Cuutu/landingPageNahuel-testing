import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';

/**
 * API de debug para ver y limpiar reservas
 * GET: Ver todas las reservas
 * DELETE: Limpiar reservas específicas
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  // Verificar que sea admin
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email || session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Solo el admin puede acceder a este endpoint' });
  }

  if (req.method === 'GET') {
    try {
      console.log('🔍 DEBUG: Consultando todas las reservas...');

      // Buscar TODAS las reservas
      const allBookings = await Booking.find({}).sort({ startDate: 1 });
      
      console.log(`📋 Total de reservas encontradas: ${allBookings.length}`);

      const bookingsInfo = allBookings.map((booking, index) => {
        const startDate = new Date(booking.startDate);
        const endDate = new Date(booking.endDate);
        
        return {
          index: index + 1,
          id: booking._id,
          userEmail: booking.userEmail,
          type: booking.type,
          serviceType: booking.serviceType,
          status: booking.status,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          startDateLocal: startDate.toLocaleString('es-UY'),
          endDateLocal: endDate.toLocaleString('es-UY'),
          price: booking.price,
          createdAt: booking.createdAt,
          hasGoogleEventId: !!booking.googleEventId,
          googleEventId: booking.googleEventId || 'NULL'
        };
      });

      // Filtrar solo las de Consultorio Financiero
      const consultorioBookings = bookingsInfo.filter(b => b.serviceType === 'ConsultorioFinanciero');
      
      // Filtrar solo las activas (pending o confirmed)
      const activeBookings = bookingsInfo.filter(b => ['pending', 'confirmed'].includes(b.status));

      // Filtrar reservas fantasma (sin googleEventId)
      const ghostBookings = consultorioBookings.filter(b => !b.hasGoogleEventId);

      console.log('📊 Resumen:');
      console.log(`  - Total reservas: ${allBookings.length}`);
      console.log(`  - Consultorio Financiero: ${consultorioBookings.length}`);
      console.log(`  - Activas (pending/confirmed): ${activeBookings.length}`);
      console.log(`  - Reservas fantasma Consultorio: ${ghostBookings.length}`);

      return res.status(200).json({
        success: true,
        total: allBookings.length,
        consultorioFinanciero: consultorioBookings.length,
        active: activeBookings.length,
        ghostBookings: ghostBookings.length,
        bookings: bookingsInfo,
        consultorioBookings,
        activeBookings,
        ghostBookingsDetails: ghostBookings,
        debug: {
          timestamp: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

    } catch (error) {
      console.error('❌ Error al consultar reservas:', error);
      return res.status(500).json({ 
        error: 'Error al consultar reservas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { bookingIds, cleanGhostBookings, userEmail } = req.body;

      console.log('🧹 Iniciando limpieza de reservas...', { 
        bookingIds: bookingIds?.length || 0,
        cleanGhostBookings,
        userEmail 
      });

      let deletedCount = 0;

      // Opción 1: Eliminar reservas específicas por ID
      if (bookingIds && Array.isArray(bookingIds) && bookingIds.length > 0) {
        const deleteResult = await Booking.deleteMany({
          _id: { $in: bookingIds }
        });
        deletedCount += deleteResult.deletedCount;
        console.log(`✅ Eliminadas ${deleteResult.deletedCount} reservas específicas`);
      }

      // Opción 2: Limpiar reservas fantasma (sin googleEventId)
      if (cleanGhostBookings) {
        const deleteResult = await Booking.deleteMany({
          $or: [
            { googleEventId: { $exists: false } },
            { googleEventId: null },
            { googleEventId: '' }
          ],
          serviceType: 'ConsultorioFinanciero',
          status: { $in: ['pending', 'confirmed'] }
        });
        deletedCount += deleteResult.deletedCount;
        console.log(`✅ Eliminadas ${deleteResult.deletedCount} reservas fantasma`);
      }

      // Opción 3: Eliminar reservas de un usuario específico
      if (userEmail) {
        const deleteResult = await Booking.deleteMany({
          userEmail,
          serviceType: 'ConsultorioFinanciero'
        });
        deletedCount += deleteResult.deletedCount;
        console.log(`✅ Eliminadas ${deleteResult.deletedCount} reservas del usuario ${userEmail}`);
      }

      // Invalidar caché después de la limpieza
      try {
        const { cache } = await import('../turnos/generate');
        if (cache) {
          cache.clear();
          console.log('✅ Caché invalidado después de limpieza');
        }
      } catch (cacheError) {
        console.log('⚠️ Error al invalidar caché:', cacheError);
      }

      return res.status(200).json({
        success: true,
        message: 'Limpieza completada exitosamente',
        deletedCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error al limpiar reservas:', error);
      return res.status(500).json({ 
        error: 'Error al limpiar reservas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
} 