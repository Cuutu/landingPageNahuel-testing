import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import EmailList from '@/models/EmailList';

/**
 * API para gestionar la lista de emails de envío masivo
 * GET: Obtener lista de emails
 * POST: Agregar email a la lista
 * DELETE: Eliminar email de la lista
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('📧 [EMAIL LIST] Método:', req.method);
  
  try {
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Verificar que el usuario sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    console.log('✅ [EMAIL LIST] Acceso de admin confirmado para:', session.user.email);

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }

  } catch (error) {
    console.error('❌ [EMAIL LIST] Error:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * GET: Obtener lista de emails con filtros y paginación
 */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { 
      page = '1', 
      limit = '50', 
      source, 
      search, 
      active = 'true'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Construir filtros
    const filters: any = {};
    
    if (source) {
      filters.source = source;
    }
    
    if (active !== 'all') {
      filters.isActive = active === 'true';
    }
    
    if (search) {
      filters.email = { $regex: search, $options: 'i' };
    }

    console.log('🔍 [EMAIL LIST] Filtros aplicados:', filters);

    // Obtener emails con paginación
    const emails = await EmailList.find(filters)
      .sort({ addedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Obtener total para paginación
    const total = await EmailList.countDocuments(filters);

    // Obtener estadísticas
    const stats = await (EmailList as any).getStats();

    console.log(`📊 [EMAIL LIST] Encontrados ${emails.length} emails de ${total} total`);

    return res.status(200).json({
      success: true,
      data: {
        emails,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        stats
      }
    });

  } catch (error) {
    console.error('❌ [EMAIL LIST] Error en GET:', error);
    return res.status(500).json({ error: 'Error obteniendo lista de emails' });
  }
}

/**
 * POST: Agregar email a la lista
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { email, source = 'manual' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    console.log('📧 [EMAIL LIST] Agregando email:', email);

    // Agregar email si no existe
    const result = await (EmailList as any).addEmailIfNotExists(
      email,
      source
    );

    console.log('📧 [EMAIL LIST] Resultado:', {
      email: result.email.email,
      wasAdded: result.wasAdded,
      wasReactivated: result.wasReactivated
    });

    return res.status(200).json({
      success: true,
      message: result.wasAdded 
        ? 'Email agregado exitosamente' 
        : result.wasReactivated 
          ? 'Email reactivado exitosamente'
          : 'Email ya existía en la lista',
      data: {
        email: result.email,
        wasAdded: result.wasAdded,
        wasReactivated: result.wasReactivated
      }
    });

  } catch (error) {
    console.error('❌ [EMAIL LIST] Error en POST:', error);
    return res.status(500).json({ error: 'Error agregando email a la lista' });
  }
}

/**
 * DELETE: Eliminar/desactivar email de la lista
 */
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { email, action = 'deactivate' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    console.log('🗑️ [EMAIL LIST] Eliminando email:', email, 'Acción:', action);

    let result;
    
    if (action === 'deactivate') {
      // Desactivar en lugar de eliminar
      result = await EmailList.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { isActive: false },
        { new: true }
      );
    } else if (action === 'delete') {
      // Eliminar permanentemente
      result = await EmailList.findOneAndDelete({ email: email.toLowerCase().trim() });
    } else {
      return res.status(400).json({ error: 'Acción no válida. Use "deactivate" o "delete"' });
    }

    if (!result) {
      return res.status(404).json({ error: 'Email no encontrado' });
    }

    console.log('✅ [EMAIL LIST] Email procesado:', result.email);

    return res.status(200).json({
      success: true,
      message: action === 'deactivate' ? 'Email desactivado exitosamente' : 'Email eliminado permanentemente',
      data: { email: result.email }
    });

  } catch (error) {
    console.error('❌ [EMAIL LIST] Error en DELETE:', error);
    return res.status(500).json({ error: 'Error procesando email' });
  }
}
