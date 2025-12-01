import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * @route GET /api/user/trial-status
 * @description Verifica si el usuario ya usó su prueba gratis para un servicio
 * @query service - Servicio a verificar (TraderCall, SmartMoney, CashFlow)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    await dbConnect();

    const { service } = req.query;

    // Validar servicio
    if (!service || typeof service !== 'string') {
      return res.status(400).json({ error: 'Servicio es requerido' });
    }

    if (!['TraderCall', 'SmartMoney', 'CashFlow'].includes(service)) {
      return res.status(400).json({ error: 'Servicio inválido' });
    }

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si ya usó el trial
    const hasUsedTrial = user.trialsUsed?.[service as keyof typeof user.trialsUsed] || false;

    console.log(`✅ Trial status verificado para ${user.email} - ${service}: ${hasUsedTrial ? 'YA USADO' : 'DISPONIBLE'}`);

    return res.status(200).json({
      success: true,
      hasUsedTrial,
      service
    });

  } catch (error) {
    console.error('❌ Error verificando estado del trial:', error);
    return res.status(500).json({
      error: 'Error del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
