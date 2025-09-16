import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import connectDB from '../../../../lib/mongodb';
import Report from '../../../../models/Report';
import User from '../../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: `Método ${req.method} no permitido` 
    });
  }

  try {
    await connectDB();

    // Verificar autenticación básica (simplificada por ahora)
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false, 
        message: 'Debes estar autenticado' 
      });
    }

    // Buscar el usuario para obtener su información
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuario no encontrado' 
      });
    }

    const {
      title,
      type,
      content,
      summary,
      videoMuxId,
      pdfUrl,
      imageUrl,
      images, // Agregar imágenes adicionales
      status = 'published',
      isFeature = false,
      articles = [] // Nuevo campo para artículos
    } = req.body;

    // Debug: mostrar qué datos estamos recibiendo
    console.log('🔍 [API CREATE] Datos recibidos:', {
      title,
      type,
      content: content?.substring(0, 100) + '...',
      summary: summary?.substring(0, 100) + '...',
      hasImages: images?.length || 0,
      articlesCount: articles?.length || 0,
      articles: articles
    });

    // Validaciones
    if (!title || !type || !content || !summary) {
      return res.status(400).json({
        success: false,
        message: 'Título, tipo, contenido y resumen son campos requeridos'
      });
    }

    if (!Array.isArray(articles)) {
      console.log('⚠️ [API CREATE] No se recibieron artículos o no es un array');
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

    // Crear nuevo informe
    const newReport = new Report({
      title: title.trim(),
      type,
      content: processedContent,
      summary: summary.trim(),
      videoMuxId,
      pdfUrl,
      imageUrl,
      images: images || [], // Incluir imágenes adicionales
      author: user.name || user.email,
      authorId: user._id.toString(),
      status,
      isFeature,
      articles: articles || [] // Incluir artículos en el informe
    });

    console.log('📄 [API CREATE] Informe a guardar:', {
      title: newReport.title,
      hasArticles: !!newReport.articles,
      articlesCount: newReport.articles?.length || 0,
      articles: newReport.articles
    });

    await newReport.save();

    console.log('✅ [API CREATE] Informe guardado exitosamente. ID:', newReport._id);
    console.log('📚 [API CREATE] Artículos guardados:', newReport.articles?.length || 0);

    return res.status(201).json({
      success: true,
      message: 'Informe creado exitosamente',
      data: { 
        report: newReport
      }
    });

  } catch (error) {
    console.error('Error al crear informe:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
} 