import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar que sea admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    console.log('🧹 Iniciando limpieza de entrenamientos con tipos no válidos...');

    // Buscar usuarios con entrenamientos con tipos no válidos
    const usersWithInvalidTrainings = await User.find({
      'entrenamientos.tipo': { $nin: ['SwingTrading'] }
    });

    console.log(`📊 Encontrados ${usersWithInvalidTrainings.length} usuarios con entrenamientos no válidos`);

    let totalCleaned = 0;
    const results = [];

    for (const user of usersWithInvalidTrainings) {
      const originalCount = user.entrenamientos.length;
      
      // Filtrar solo entrenamientos válidos (SwingTrading)
      user.entrenamientos = user.entrenamientos.filter(
        (entrenamiento: any) => entrenamiento.tipo === 'SwingTrading'
      );
      
      const newCount = user.entrenamientos.length;
      const removedCount = originalCount - newCount;
      
      if (removedCount > 0) {
        await user.save();
        totalCleaned += removedCount;
        
        results.push({
          userEmail: user.email,
          removedTrainings: removedCount,
          remainingTrainings: newCount
        });
        
        console.log(`✅ Usuario ${user.email}: eliminados ${removedCount} entrenamientos, quedan ${newCount}`);
      }
    }

    console.log(`🎉 Limpieza completada. Total de entrenamientos eliminados: ${totalCleaned}`);

    return res.status(200).json({
      success: true,
      message: 'Limpieza completada exitosamente',
      summary: {
        usersProcessed: usersWithInvalidTrainings.length,
        totalTrainingsRemoved: totalCleaned,
        usersAffected: results.length
      },
      details: results
    });

  } catch (error) {
    console.error('❌ Error en limpieza de entrenamientos:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
