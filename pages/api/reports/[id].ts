import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Report from '../../../models/Report';
import User from '../../../models/User';
import { getCloudinaryImageUrl } from '../../../lib/cloudinary';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado.' });
    }

    await dbConnect();

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID del informe requerido' });
    }

    console.log('📖 Obteniendo informe:', id);

    // Buscar el informe por ID
    const report = await Report.findById(id)
      .populate('author', 'name email image')
      .lean() as any;

    if (!report) {
      return res.status(404).json({ message: 'Informe no encontrado' });
    }

    // Verificar que el informe esté publicado
    if (!report.isPublished) {
      return res.status(403).json({ message: 'Informe no disponible' });
    }

    // Procesar informe para incluir URLs optimizadas de Cloudinary
    let optimizedImageUrl = null;
    if (report.coverImage?.public_id) {
      optimizedImageUrl = getCloudinaryImageUrl(report.coverImage.public_id, {
        width: 800,
        height: 600,
        crop: 'fill',
        format: 'webp'
      });
    }

    // Generar URLs optimizadas para imágenes adicionales
    let optimizedImages: any[] = [];
    if (report.images && report.images.length > 0) {
      optimizedImages = report.images
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((img: any) => ({
          ...img,
          optimizedUrl: getCloudinaryImageUrl(img.public_id, {
            width: 800,
            height: 600,
            crop: 'fill',
            format: 'webp'
          }),
          thumbnailUrl: getCloudinaryImageUrl(img.public_id, {
            width: 300,
            height: 200,
            crop: 'fill',
            format: 'webp'
          })
        }));
    }

    const processedReport = {
      ...report,
      // Imágenes adicionales optimizadas
      optimizedImages,
    };

    // Incrementar contador de vistas de forma asíncrona
    Report.findByIdAndUpdate(
      id, 
      { $inc: { views: 1 } }, 
      { new: false }
    ).catch(error => {
      console.error('Error actualizando vistas:', error);
    });

    console.log('✅ Informe obtenido exitosamente:', report.title);

    return res.status(200).json({
      success: true,
      data: {
        report: processedReport
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo informe:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 