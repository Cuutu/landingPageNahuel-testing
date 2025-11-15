import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    const {
      fullName,
      phone,
      address,
      cuitCuil,
      educacionFinanciera,
      brokerPreferencia
    } = req.body;

    // Validación básica
    if (!fullName || fullName.trim() === '') {
      return res.status(400).json({ message: 'El nombre completo es obligatorio' });
    }

    // Buscar o crear el usuario
    let user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      // Crear nuevo usuario si no existe
      const newUser = await User.create({
        googleId: (session.user as any).id || session.user.email,
        name: session.user.name,
        email: session.user.email,
        picture: session.user.image,
        fullName: fullName.trim(),
        phone: phone || null,
        address: address || null,
        cuitCuil: cuitCuil || null,
        educacionFinanciera: educacionFinanciera || null,
        brokerPreferencia: brokerPreferencia || null,
      });

      console.log('✅ Usuario creado:', newUser.email);

      return res.status(200).json({
        success: true,
        message: 'Perfil creado exitosamente',
        profile: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          image: newUser.picture,
          fullName: newUser.fullName,
          phone: newUser.phone,
          address: newUser.address,
          cuitCuil: newUser.cuitCuil,
          educacionFinanciera: newUser.educacionFinanciera,
          brokerPreferencia: newUser.brokerPreferencia,
        }
      });
    }

    // Actualizar usuario existente
    user.fullName = fullName.trim();
    user.phone = phone || null;
    user.address = address || null;
    user.cuitCuil = cuitCuil || null;
    user.educacionFinanciera = educacionFinanciera || null;
    user.brokerPreferencia = brokerPreferencia || null;
    
    // Actualizar también campos básicos si han cambiado
    user.name = session.user.name || user.name;
    user.picture = session.user.image || user.picture;

    await user.save();
    console.log('✅ Usuario actualizado:', user.email);

    // Crear objeto de respuesta con los datos actualizados
    const updatedProfile = {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.picture, // Solo imagen de Google
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      cuitCuil: user.cuitCuil,
      educacionFinanciera: user.educacionFinanciera,
      brokerPreferencia: user.brokerPreferencia,
      updatedAt: user.updatedAt
    };

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      profile: updatedProfile
    });

  } catch (error) {
    console.error('❌ Error al actualizar perfil:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
} 