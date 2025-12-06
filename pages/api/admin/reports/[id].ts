import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import Notification from '@/models/Notification';

/**
 * Endpoint para eliminar informes (solo administradores)
 * DELETE /api/admin/reports/[id]
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      message: `Método ${req.method} no permitido. Use DELETE.`
    });
  }

  try {
    await dbConnect();

    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        message: 'Debes estar autenticado'
      });
    }

    // Verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores pueden eliminar informes.'
      });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ID del informe requerido'
      });
    }

    console.log(`🗑️ [DELETE REPORT] Intentando eliminar informe: ${id}`);

    // Buscar el informe
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Informe no encontrado'
      });
    }

    console.log(`📄 [DELETE REPORT] Informe encontrado: ${report.title}`);

    // ✅ OPCIONAL: Eliminar notificaciones relacionadas
    try {
      const deletedNotifications = await Notification.deleteMany({
        type: 'alerta',
        'metadata.reportId': id
      });
      console.log(`📢 [DELETE REPORT] Notificaciones eliminadas: ${deletedNotifications.deletedCount}`);
    } catch (notificationError) {
      console.warn('⚠️ [DELETE REPORT] Error eliminando notificaciones (continuando):', notificationError);
      // No fallar si hay error con notificaciones
    }

    // Eliminar el informe
    await Report.findByIdAndDelete(id);

    console.log(`✅ [DELETE REPORT] Informe eliminado exitosamente: ${report.title} (ID: ${id})`);

    return res.status(200).json({
      success: true,
      message: 'Informe eliminado exitosamente',
      data: {
        deletedReport: {
          id: report._id.toString(),
          title: report.title,
          category: report.category
        }
      }
    });

  } catch (error) {
    console.error('❌ [DELETE REPORT] Error eliminando informe:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar el informe',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

