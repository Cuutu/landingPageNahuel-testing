import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import User from '@/models/User';
import Booking from '@/models/Booking';

/**
 * POST /api/entrenamientos/reservar-sesion
 * Body: { startDate: string; duration?: number; serviceType?: 'SwingTrading' | 'DowJones' }
 * Requiere: usuario autenticado con entrenamiento activo del tipo indicado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { startDate, duration = 180, serviceType = 'SwingTrading' } = req.body || {};
    if (!startDate) {
      return res.status(400).json({ error: 'startDate es requerido' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Verificar que el usuario tenga el entrenamiento activo (pago único ya realizado)
    const hasTraining = (user.entrenamientos || []).some((e: any) => e.tipo === serviceType && e.activo);
    if (!hasTraining) {
      return res.status(403).json({ error: 'No tenés acceso activo al entrenamiento' });
    }

    // Crear booking de entrenamiento confirmado sin cobro
    const start = new Date(startDate);
    const end = new Date(start.getTime() + duration * 60000);

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
      notes: 'Reserva de sesión por alumno con entrenamiento activo'
    });

    await booking.save();

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error('❌ Error al reservar sesión de entrenamiento:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 