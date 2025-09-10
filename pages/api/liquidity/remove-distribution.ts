import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Liquidity from '@/models/Liquidity';
import User from '@/models/User';

interface RemoveDistributionRequest {
  alertId: string;
}

interface RemoveDistributionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RemoveDistributionResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Permisos insuficientes. Solo administradores.' });
    }

    const { alertId }: RemoveDistributionRequest = req.body || {};

    if (!alertId) {
      return res.status(400).json({ success: false, error: 'alertId es requerido' });
    }

    const liquidity = await Liquidity.findOne({ createdBy: user._id });
    if (!liquidity) {
      return res.status(404).json({ success: false, error: 'No hay liquidez configurada' });
    }

    const dist = liquidity.distributions.find((d: any) => d.alertId === alertId);
    if (!dist) {
      return res.status(404).json({ success: false, error: 'Distribución no encontrada' });
    }

    // Si existen acciones restantes, devolver el monto asignado a disponible
    // removeDistribution ya ajusta available y distributed
    liquidity.removeDistribution(alertId);
    await liquidity.save();

    return res.status(200).json({ success: true, message: 'Distribución removida' });
  } catch (error) {
    console.error('Error al remover distribución:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
