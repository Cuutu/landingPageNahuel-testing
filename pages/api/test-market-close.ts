import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';

/**
 * API para convertir rangos a precios fijos
 * Disponible para administradores en producción
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ✅ NUEVO: Verificar que el usuario sea admin
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea admin
    const userResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/users/role?email=${session.user.email}`);
    const userData = await userResponse.json();
    
    if (userData.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden usar esta función' });
    }

    await dbConnect();

    // Obtener alertas con rango
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      entryPriceRange: { $exists: true, $ne: null }
    });

    console.log(`🔍 Encontradas ${alertsWithRange.length} alertas con rango`);

    for (const alert of alertsWithRange) {
      console.log(`📊 Procesando ${alert.symbol}:`, {
        entryPriceRange: alert.entryPriceRange,
        entryPrice: alert.entryPrice,
        currentPrice: alert.currentPrice
      });

      // ✅ CRÍTICO: Usar el precio actual como precio de cierre
      const closePrice = alert.currentPrice || 100.00;
      
      console.log(`💰 ${alert.symbol}: Precio actual ${alert.currentPrice} -> Precio de cierre ${closePrice}`);

      // Actualizar entryPrice al precio de cierre
      alert.entryPrice = closePrice;

      // Eliminar campos de rango
      await Alert.updateOne(
        { _id: alert._id },
        { 
          $unset: { 
            entryPriceRange: 1,
            precioMinimo: 1,
            precioMaximo: 1
          }
        }
      );

      console.log(`✅ ${alert.symbol}: Rango convertido a precio fijo ${closePrice}`);
    }

    res.status(200).json({
      success: true,
      message: `✅ Conversión completada: ${alertsWithRange.length} alertas con rango convertidas a precios fijos`,
      processedCount: alertsWithRange.length,
      details: alertsWithRange.map(alert => ({
        symbol: alert.symbol,
        oldRange: `${alert.entryPriceRange?.min}-${alert.entryPriceRange?.max}`,
        newPrice: alert.currentPrice
      }))
    });

  } catch (error) {
    console.error('❌ Error en test de cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
