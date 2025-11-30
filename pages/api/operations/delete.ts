import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Operation from '@/models/Operation';

/**
 * @route DELETE /api/operations/delete
 * @description Elimina una operación existente
 * @access Admin only
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // ✅ Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    await dbConnect();

    const { operationId } = req.body;

    // ✅ Validación
    if (!operationId) {
      return res.status(400).json({ error: 'operationId es requerido' });
    }

    // ✅ Buscar la operación
    const operation = await Operation.findById(operationId);
    if (!operation) {
      return res.status(404).json({ error: 'Operación no encontrada' });
    }

    // ✅ Eliminar la operación
    await Operation.findByIdAndDelete(operationId);

    console.log(`✅ Operación ${operationId} eliminada por ${session.user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Operación eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando operación:', error);
    return res.status(500).json({
      error: 'Error del servidor al eliminar operación',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
