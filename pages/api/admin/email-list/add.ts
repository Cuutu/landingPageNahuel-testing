import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import EmailList from '@/models/EmailList';

/**
 * API para agregar emails individuales a la lista de envío masivo
 * POST: Agregar un email específico
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('📧 [ADD EMAIL] Método:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

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

    const { email, tags, notes } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    console.log('📧 [ADD EMAIL] Agregando email:', email);

    // Agregar email si no existe
    const result = await (EmailList as any).addEmailIfNotExists(
      email,
      'manual',
      tags,
      notes
    );

    console.log('📧 [ADD EMAIL] Resultado:', {
      email: result.email.email,
      wasAdded: result.wasAdded,
      wasReactivated: result.wasReactivated
    });

    return res.status(200).json({
      success: true,
      message: result.wasAdded 
        ? 'Email agregado exitosamente a la lista de envío masivo' 
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
    console.error('❌ [ADD EMAIL] Error:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
