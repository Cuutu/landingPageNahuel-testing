import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Booking from '@/models/Booking';

/**
 * DELETE /api/admin/trainings/schedule/remove-user
 * Body: { bookingId?: string; email?: string; startDate?: string; serviceType?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const adminCheck = await verifyAdminAccess({ req, res } as any);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { bookingId, email, startDate, serviceType = 'SwingTrading' } = req.body || {};

    await dbConnect();

    let result;
    if (bookingId) {
      result = await Booking.findByIdAndDelete(bookingId);
    } else if (email && startDate) {
      result = await Booking.findOneAndDelete({
        userEmail: email,
        type: 'training',
        serviceType,
        startDate: new Date(startDate)
      });
    } else {
      return res.status(400).json({ error: 'bookingId o (email y startDate) son requeridos' });
    }

    if (!result) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Error al eliminar usuario de entrenamiento:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 