import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Training from '@/models/Training';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado'
      });
    }

    // Verificar si es admin por rol en la sesión
    if (session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes'
      });
    }

    if (req.method === 'GET') {
      // Obtener precios actuales
      const swingTrading = await Training.findOne({ tipo: 'SwingTrading' });
      const dowJones = await Training.findOne({ tipo: 'DowJones' });

      return res.status(200).json({
        success: true,
        prices: {
          swingTrading: swingTrading?.precio || 10,
          dowJones: dowJones?.precio || 20
        }
      });
    }

    if (req.method === 'PUT') {
      const { swingTrading, dowJones } = req.body;

      // Validar que los precios sean números positivos
      if (typeof swingTrading !== 'number' || swingTrading < 0) {
        return res.status(400).json({
          success: false,
          error: 'Precio de Zero 2 Trader inválido'
        });
      }

      if (typeof dowJones !== 'number' || dowJones < 0) {
        return res.status(400).json({
          success: false,
          error: 'Precio de Dow Jones inválido'
        });
      }

      // Actualizar precios en la base de datos
      await Training.findOneAndUpdate(
        { tipo: 'SwingTrading' },
        { precio: swingTrading },
        { upsert: true, new: true }
      );

      await Training.findOneAndUpdate(
        { tipo: 'DowJones' },
        { precio: dowJones },
        { upsert: true, new: true }
      );

      console.log('✅ Precios de entrenamientos actualizados:', {
        swingTrading,
        dowJones,
        updatedBy: session.user.email
      });

      return res.status(200).json({
        success: true,
        message: 'Precios actualizados correctamente',
        prices: { swingTrading, dowJones }
      });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ 
      success: false, 
      error: `Método ${req.method} no permitido` 
    });

  } catch (error) {
    console.error('Error en /api/admin/training-prices:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
}
