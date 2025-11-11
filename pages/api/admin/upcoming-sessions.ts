import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';
import { z } from 'zod';

// Schema de validación para consultar sesiones próximas
const upcomingSessionsSchema = z.object({
  days: z.string().transform(val => parseInt(val) || 30).pipe(z.number().min(1).max(90)).optional().default("30"),
  status: z.enum(['all', 'confirmed', 'pending']).optional().default('all'),
  type: z.enum(['all', 'training', 'advisory']).optional().default('all'),
  serviceType: z.string().optional()
});

/**
 * API para obtener sesiones próximas (asesorías y entrenamientos)
 * GET: Retorna todas las sesiones programadas ordenadas por proximidad
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar permisos de admin
    const adminCheck = await verifyAdminAccess({ req, res } as any);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    await dbConnect();

    // Validar parámetros de consulta
    const validationResult = upcomingSessionsSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        details: validationResult.error.errors 
      });
    }

    const { days, status, type, serviceType } = validationResult.data as any;

    console.log('📅 Obteniendo sesiones próximas para admin...');

    // Calcular fechas límite (usar fecha/hora actual)
    const now = new Date();
    const futureLimit = new Date(now);
    futureLimit.setDate(now.getDate() + days);

    // Construir filtro base por rango
    const filter: any = {
      startDate: { $gte: now, $lte: futureLimit }
    };

    // Estado
    if (status !== 'all') {
      filter.status = status;
    } else {
      filter.status = { $in: ['confirmed', 'pending'] };
    }

    // Tipo
    if (type && type !== 'all') {
      filter.type = type;
    }

    // serviceType
    if (serviceType) {
      filter.serviceType = serviceType;
    }

    // Obtener reservas
    const bookings = await Booking.find(filter).sort({ startDate: 1 }).lean();

    // Mapear respuesta
    const sessions = bookings.map((booking: any) => {
      const sessionDate = new Date(booking.startDate);
      const diffTime = sessionDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let serviceName = '';
      switch (booking.serviceType) {
        case 'ConsultorioFinanciero': serviceName = 'Consultorio Financiero'; break;
        case 'CuentaAsesorada': serviceName = 'Cuenta Asesorada'; break;
        case 'SwingTrading': serviceName = 'Swing Trading'; break;
        case 'AdvancedStrategies': serviceName = 'Estrategias Avanzadas'; break;
        case 'DowJones': serviceName = 'Dow Jones - Estrategias Avanzadas'; break;
        default: serviceName = booking.serviceType || 'Servicio';
      }

      return {
        _id: booking._id,
        type: booking.type,
        serviceType: booking.serviceType,
        serviceName,
        startDate: booking.startDate,
        endDate: booking.endDate,
        duration: booking.duration || 45,
        price: booking.price || 0,
        status: booking.status,
        user: { name: booking.userName || 'Usuario sin nombre', email: booking.userEmail || 'Sin email', image: null },
        meetingLink: booking.meetingLink || null,
        notes: booking.notes || null,
        daysUntil: Math.max(0, daysUntil)
      };
    });

    // Ordenar por proximidad (primero los más próximos)
    sessions.sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const stats = {
      total: sessions.length,
      today: sessions.filter(s => s.daysUntil === 0).length,
      tomorrow: sessions.filter(s => s.daysUntil === 1).length,
      thisWeek: sessions.filter(s => s.daysUntil <= 7).length,
      byType: { advisory: sessions.filter(s => s.type === 'advisory').length, training: sessions.filter(s => s.type === 'training').length },
      byStatus: { confirmed: sessions.filter(s => s.status === 'confirmed').length, pending: sessions.filter(s => s.status === 'pending').length },
      withMeetingLink: sessions.filter(s => s.meetingLink).length
    };

    return res.status(200).json({ sessions, stats, meta: { daysRange: days, statusFilter: status, type, serviceType, generatedAt: new Date().toISOString() } });

  } catch (error) {
    console.error('❌ Error al obtener sesiones próximas:', error);
    return res.status(500).json({ error: 'Error al obtener sesiones próximas', details: process.env.NODE_ENV === 'development' ? error : undefined });
  }
} 