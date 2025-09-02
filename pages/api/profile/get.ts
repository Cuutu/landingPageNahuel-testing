import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Buscar el usuario en la base de datos
    let user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      // Si el usuario no existe en la BD, crear uno con la información básica de la sesión
      user = new User({
        googleId: (session.user as any).id || session.user.email,
        name: session.user.name || '',
        email: session.user.email,
        picture: session.user.image,
      });
      
      await user.save();
      console.log('✅ Usuario creado automáticamente:', user.email);
    }

    const responseData = {
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.picture,
        phone: user.phone,
        address: user.address,
        role: user.role,
        fullName: user.fullName,
        cuitCuil: user.cuitCuil,
        educacionFinanciera: user.educacionFinanciera,
        brokerPreferencia: user.brokerPreferencia,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        compras: user.compras || [],
        suscripciones: user.suscripciones || [],
        subscriptions: user.subscriptions || []
      },
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        image: user.picture, // Solo imagen de Google
        phone: user.phone,
        address: user.address,
        role: user.role,
        fullName: user.fullName,
        cuitCuil: user.cuitCuil,
        educacionFinanciera: user.educacionFinanciera,
        brokerPreferencia: user.brokerPreferencia,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        compras: user.compras || [],
        suscripciones: user.suscripciones || [],
        subscriptions: user.subscriptions || []
      }
    };

    // Crear objeto de respuesta con los datos del perfil
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Error al obtener perfil:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
} 