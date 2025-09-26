import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';

/**
 * POST /api/admin/trainings/schedule/migrate
 * Body: { fromStartDate: string; toStartDate: string; serviceType?: string; keepMeet?: boolean }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const adminCheck = await verifyAdminAccess({ req, res } as any);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { fromStartDate, toStartDate, serviceType = 'SwingTrading', keepMeet = false } = req.body || {};

    if (!fromStartDate || !toStartDate) {
      return res.status(400).json({ error: 'fromStartDate y toStartDate son requeridos' });
    }

    await dbConnect();

    const from = new Date(fromStartDate);
    const to = new Date(toStartDate);

    const bookings = await Booking.find({
      type: 'training',
      serviceType,
      startDate: from
    });

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'No hay reservas para migrar en esa fecha' });
    }

    for (const b of bookings) {
      const durationMs = (b.endDate?.getTime?.() || b.startDate.getTime() + (b.duration || 180) * 60000) - b.startDate.getTime();
      b.startDate = to;
      b.endDate = new Date(to.getTime() + durationMs);
      if (!keepMeet) {
        b.meetingLink = undefined as any;
        b.googleEventId = undefined as any;
        if (!b.notes) b.notes = '';
        b.notes += ' | Migrado sin Meet';
      } else {
        if (!b.notes) b.notes = '';
        b.notes += ' | Migrado (conserva Meet)';
      }
      await b.save();
    }

    return res.status(200).json({ success: true, migrated: bookings.length });
  } catch (error) {
    console.error('❌ Error migrando reservas:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 