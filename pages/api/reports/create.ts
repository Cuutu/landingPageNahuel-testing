import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Report from '../../../models/Report';
import User from '../../../models/User';
import { getCloudinaryImageUrl, CloudinaryUploadResult } from '../../../lib/cloudinary';
import { createReportNotification } from '../../../lib/notificationUtils';

// Definir interface para las imágenes procesadas
interface ProcessedImage {
  public_id: string;
  url: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  caption: string;
  order: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    await dbConnect();

    // Verificar que el usuario existe y es admin
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Solo los administradores pueden crear informes' 
      });
    }

    const { 
      title, 
      content, 
      type, 
      category,
      summary,
      isFeature,
      images,
      articles // Agregar campo de artículos
    } = req.body;

    // Validar datos requeridos
    if (!title || !content) {
      return res.status(400).json({ 
        message: 'Título y contenido son requeridos' 
      });
    }

    // Validar artículos si se proporcionan
    if (articles && Array.isArray(articles)) {
      console.log('📚 [API CREATE] Validando artículos:', articles.length);
      
      if (articles.length > 10) {
        return res.status(400).json({
          message: 'Un informe no puede tener más de 10 artículos'
        });
      }

      // Validar cada artículo
      for (const article of articles) {
        if (!article.title || !article.content || !article.order) {
          console.log('❌ [API CREATE] Artículo inválido:', article);
          return res.status(400).json({
            message: 'Cada artículo debe tener título, contenido y orden'
          });
        }
        if (article.order < 1 || article.order > 10) {
          return res.status(400).json({
            message: 'El orden de los artículos debe estar entre 1 y 10'
          });
        }
      }
    } else {
      console.log('⚠️ [API CREATE] No se recibieron artículos o no es un array');
    }

    console.log('📝 Creando nuevo informe:', {
      title,
      type,
      category,
      summary,
      imagesCount: images?.length || 0,
      articlesCount: articles?.length || 0,
      author: user.email
    });

    // Procesar imágenes adicionales
    let processedImages: ProcessedImage[] = [];
    if (images && Array.isArray(images)) {
      processedImages = images.map((img: any, index: number): ProcessedImage => ({
        public_id: img.public_id,
        url: img.secure_url || img.url,
        secure_url: img.secure_url || img.url,
        width: img.width,
        height: img.height,
        format: img.format,
        bytes: img.bytes,
        caption: img.caption || '',
        order: index + 1
      }));

      console.log('📸 Imágenes adicionales procesadas:', processedImages.length);
    }

    // Procesar el contenido para convertir saltos de línea en HTML
    const processContent = (text: string): string => {
      if (!text) return '';
      
      // Convertir saltos de línea dobles en párrafos
      return text
        .split('\n\n')
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length > 0)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
    };

    const processedContent = processContent(content);

    // Crear el informe
    const newReport = new Report({
      title,
      content: processedContent,
      summary: summary || '',
      author: user._id,
      type: type || 'text',
      category: category || 'general',
      images: processedImages,
      isFeature: isFeature || false,
      articles: articles || [], // Incluir artículos en el informe
      isPublished: true,
      publishedAt: new Date()
    });

    console.log('📄 [API CREATE] Informe a guardar:', {
      title: newReport.title,
      hasArticles: !!newReport.articles,
      articlesCount: newReport.articles?.length || 0,
      articles: newReport.articles
    });

    const savedReport = await newReport.save();

    console.log('✅ Informe creado exitosamente:', savedReport._id);
    console.log('📚 [API CREATE] Artículos guardados:', savedReport.articles?.length || 0);
    if (savedReport.articles && savedReport.articles.length > 0) {
      console.log('📋 [API CREATE] Detalles de artículos guardados:', savedReport.articles.map((article: any) => ({
        title: article.title,
        order: article.order,
        isPublished: article.isPublished
      })));
    }

    // 📰 NUEVA FUNCIONALIDAD: Crear notificación automática
    try {
      await createReportNotification(savedReport);
      console.log('✅ Notificación automática enviada para informe:', savedReport._id);
    } catch (notificationError) {
      console.error('❌ Error al enviar notificación automática:', notificationError);
      // No fallar la creación del informe si la notificación falla
    }

    // Poblar datos del autor para la respuesta
    await savedReport.populate('author', 'name email');

    // Generar URLs optimizadas para Cloudinary
    const responseData = {
      ...savedReport.toJSON(),
      // URLs de imágenes adicionales optimizadas
      optimizedImages: processedImages.map((img: ProcessedImage) => ({
        ...img,
        optimizedUrl: getCloudinaryImageUrl(img.public_id, {
          width: 800,
          height: 600,
          crop: 'fill',
          format: 'webp'
        })
      }))
    };

    return res.status(201).json({
      success: true,
      message: 'Informe creado exitosamente',
      data: {
        report: responseData
      }
    });

  } catch (error) {
    console.error('❌ Error creando informe:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 