import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import User from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    await dbConnect();

    // Obtener el usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const userCreatedAt = user.createdAt; // Fecha de creación de la cuenta del usuario

    console.log('🗑️ [NOTIFICATIONS] Descartando notificaciones leídas para usuario:', user.email);

    // En este esquema, una notificación es "leída" si el email del usuario está en readBy.
    // En lugar de borrar documentos compartidos, marcamos que el usuario la descartó (dismissedBy)
    // Solo procesamos notificaciones creadas después del registro del usuario
    const updateResult = await Notification.updateMany(
      {
        isActive: true,
        readBy: user.email,
        dismissedBy: { $ne: user.email },
        createdAt: { $gte: userCreatedAt } // Solo notificaciones posteriores al registro
      },
      {
        $addToSet: { dismissedBy: user.email }
      }
    );

    console.log('🗑️ [NOTIFICATIONS] Notificaciones descartadas (matched/modified):', updateResult.matchedCount, updateResult.modifiedCount);

    return res.status(200).json({
      success: true,
      message: 'Notificaciones leídas descartadas correctamente',
      deletedCount: updateResult.modifiedCount
    });

  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Error al eliminar notificaciones leídas:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 