import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Booking from '@/models/Booking';

/**
 * POST /api/admin/trainings/schedule/add-user
 * Body: { email: string; startDate: string; duration?: number; serviceType?: string }
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

    const { email, startDate, duration = 120, serviceType = 'SwingTrading' } = req.body || {};

    if (!email || !startDate) {
      return res.status(400).json({ error: 'email y startDate son requeridos' });
    }

    await dbConnect();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const start = new Date(startDate);
    const end = new Date(start.getTime() + duration * 60000);

    // Crear booking confirmado (manual) para entrenamiento
    const booking = new Booking({
      userId: user._id.toString(),
      userEmail: user.email,
      userName: user.name || user.email,
      type: 'training',
      serviceType,
      startDate: start,
      endDate: end,
      duration,
      status: 'confirmed',
      price: 0,
      paymentStatus: 'paid',
      notes: 'Agendado manualmente por administrador'
    });

    await booking.save();

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error('❌ Error al agendar usuario manualmente:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 