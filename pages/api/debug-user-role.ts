import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No hay sesión activa' });
    }

    // Obtener datos de la sesión
    const sessionData = {
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      id: session.user.id
    };

    // Obtener datos de la base de datos
    const dbUser = await User.findOne({ email: session.user.email });
    
    const dbData = dbUser ? {
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      id: dbUser._id,
      updatedAt: dbUser.updatedAt
    } : null;

    // Verificar si hay discrepancia
    const hasDiscrepancy = sessionData.role !== dbData?.role;

    return res.status(200).json({
      success: true,
      session: sessionData,
      database: dbData,
      hasDiscrepancy,
      message: hasDiscrepancy 
        ? '⚠️ Hay discrepancia entre sesión y base de datos' 
        : '✅ Sesión y base de datos coinciden',
      recommendations: hasDiscrepancy ? [
        '1. Cierra el navegador completamente',
        '2. Borra las cookies del sitio',
        '3. Haz login nuevamente',
        '4. O visita: /api/auth/signout y luego /api/auth/signin'
      ] : []
    });

  } catch (error) {
    console.error('Error en debug-user-role:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}