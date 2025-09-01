import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/googleAuth';
import connectDB from '../../../../lib/mongodb';
import Report from '../../../../models/Report';
import User from '../../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await connectDB();

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
        message: 'Acceso denegado. Solo administradores pueden gestionar informes.' 
      });
    }

    if (req.method === 'GET') {
      // Obtener parámetros de consulta
      const { 
        page = '1', 
        limit = '10', 
        status = 'all', 
        type = 'all',
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Construir filtro
      const filter: any = {};
      
      if (status !== 'all') {
        filter.status = status;
      }
      
      if (type !== 'all') {
        filter.type = type;
      }
      
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { summary: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } }
        ];
      }

      // Construir sort
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

      // Ejecutar consulta
      const [reports, total] = await Promise.all([
        Report.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Report.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      return res.status(200).json({
        success: true,
        data: {
          reports,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
          }
        }
      });

    } else if (req.method === 'POST') {
      const {
        title,
        type,
        content,
        summary,
        videoMuxId,
        pdfUrl,
        imageUrl,
        status = 'draft',
        isFeature = false
      } = req.body;

      // Validaciones
      if (!title || !type || !content || !summary) {
        return res.status(400).json({
          success: false,
          message: 'Título, tipo, contenido y resumen son campos requeridos'
        });
      }

      // Crear nuevo informe
      const newReport = new Report({
        title: title.trim(),
        type,
        content,
        summary: summary.trim(),
        videoMuxId,
        pdfUrl,
        imageUrl,
        author: user.name || user.email,
        authorId: user._id.toString(),
        status,
        isFeature,
      });

      await newReport.save();

      return res.status(201).json({
        success: true,
        message: 'Informe creado exitosamente',
        data: { report: newReport }
      });

    } else {
      return res.status(405).json({ 
        success: false, 
        message: `Método ${req.method} no permitido` 
      });
    }

  } catch (error) {
    console.error('Error en API de informes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
} 