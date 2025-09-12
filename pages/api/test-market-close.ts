import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

/**
 * API de prueba para simular cierre de mercado
 * Solo para desarrollo y testing
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Solo disponible en desarrollo' });
  }

  try {
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
      message: `Procesadas ${alertsWithRange.length} alertas con rango`,
      processedCount: alertsWithRange.length
    });

  } catch (error) {
    console.error('❌ Error en test de cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
