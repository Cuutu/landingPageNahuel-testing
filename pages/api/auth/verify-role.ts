import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API endpoint para verificar el rol del usuario directamente del servidor
 * Útil cuando la sesión del cliente no está sincronizada
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Obtener sesión del servidor
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.email) {
      console.log('🔍 [VERIFY-ROLE] No hay sesión válida');
      return res.status(401).json({ 
        authenticated: false, 
        role: null,
        message: 'No autenticado'
      });
    }

    console.log('🔍 [VERIFY-ROLE] Verificando rol para:', session.user.email);
    console.log('🔧 [VERIFY-ROLE] Rol en sesión del servidor:', session.user.role);

    // Si ya tenemos el rol en la sesión, devolverlo
    if (session.user.role) {
      return res.status(200).json({
        authenticated: true,
        role: session.user.role,
        email: session.user.email,
        source: 'session'
      });
    }

    // Si no hay rol en la sesión, consultar directamente la base de datos
    console.log('⚠️ [VERIFY-ROLE] Rol no encontrado en sesión, consultando BD...');
    
    await dbConnect();
    const user = await User.findOne({ email: session.user.email }).select('role email').lean();

    if (!user || Array.isArray(user)) {
      console.log('❌ [VERIFY-ROLE] Usuario no encontrado en BD');
      return res.status(200).json({
        authenticated: true,
        role: 'normal',
        email: session.user.email,
        source: 'default'
      });
    }

    console.log('✅ [VERIFY-ROLE] Rol encontrado en BD:', user.role);

    return res.status(200).json({
      authenticated: true,
      role: user.role || 'normal',
      email: session.user.email,
      source: 'database'
    });

  } catch (error) {
    console.error('💥 [VERIFY-ROLE] Error:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      authenticated: false,
      role: null
    });
  }
}

