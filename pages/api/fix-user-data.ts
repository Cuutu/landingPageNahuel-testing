import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API para limpiar datos inválidos del usuario
 * POST: Limpiar entrenamientos y suscripciones con datos inválidos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/fix-user-data`);

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();
    console.log('✅ Conectado a MongoDB');

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.log('❌ No hay sesión activa');
      return res.status(401).json({ 
        success: false,
        error: 'Debes iniciar sesión' 
      });
    }

    console.log('✅ Sesión verificada:', session.user.email);

    // Buscar usuario sin validación
    const user = await User.findOne({ email: session.user.email }).lean() as any;
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    console.log('✅ Usuario encontrado, limpiando datos inválidos...');

    // Limpiar datos inválidos usando updateOne para evitar validación
    const updateOperations: any = {};

    // Limpiar entrenamientos con tipos inválidos
    const validTrainingTypes = ['SwingTrading', 'DowJones', 'DayTrading', 'Advanced'];
    const cleanedTrainings = (user.entrenamientos || []).filter((training: any) => 
      validTrainingTypes.includes(training.tipo)
    );

    // Limpiar activeSubscriptions con servicios inválidos o campos faltantes
    const validServices = ['TraderCall', 'SmartMoney', 'CashFlow'];
    const cleanedActiveSubscriptions = (user.activeSubscriptions || []).filter((sub: any) => 
      validServices.includes(sub.service) && 
      sub.amount !== undefined && 
      sub.amount !== null
    ).map((sub: any) => ({
      ...sub,
      service: sub.service === 'cash-flow' ? 'CashFlow' : sub.service // Normalizar nombres
    }));

    updateOperations.entrenamientos = cleanedTrainings;
    updateOperations.activeSubscriptions = cleanedActiveSubscriptions;

    console.log('🔧 Aplicando limpieza:', {
      originalTrainings: user.entrenamientos?.length || 0,
      cleanedTrainings: cleanedTrainings.length,
      originalActiveSubscriptions: user.activeSubscriptions?.length || 0,
      cleanedActiveSubscriptions: cleanedActiveSubscriptions.length
    });

    // Actualizar usando updateOne para evitar validación
    await User.updateOne(
      { email: session.user.email },
      { $set: updateOperations }
    );

    console.log('✅ Datos del usuario limpiados exitosamente');

    // Obtener usuario actualizado
    const updatedUser = await User.findOne({ email: session.user.email });

    return res.status(200).json({
      success: true,
      message: 'Datos del usuario limpiados exitosamente',
      cleaned: {
        trainings: user.entrenamientos?.length - cleanedTrainings.length,
        activeSubscriptions: (user.activeSubscriptions?.length || 0) - cleanedActiveSubscriptions.length
      },
      user: {
        email: updatedUser?.email,
        role: updatedUser?.role,
        entrenamientos: updatedUser?.entrenamientos?.length || 0,
        activeSubscriptions: updatedUser?.activeSubscriptions?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Error limpiando datos del usuario:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
