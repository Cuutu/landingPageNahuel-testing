import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import User from '@/models/User';
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

    await dbConnect();

    // Verificar que sea admin directamente desde la base de datos
    const user = await User.findOne({ email: session.user.email }).select('role');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (user.role !== 'admin') {
      console.log(`❌ Usuario ${session.user.email} intentó usar función admin. Rol actual: ${user.role}`);
      return res.status(403).json({ error: 'Solo administradores pueden usar esta función' });
    }

    console.log(`✅ Usuario admin ${session.user.email} usando función de conversión`);

    // Obtener alertas con rango que necesitan conversión
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { tipoAlerta: 'rango' },
        { precioMinimo: { $exists: true, $ne: null } }
      ]
    });

    console.log(`🔍 Encontradas ${alertsWithRange.length} alertas con rango para convertir`);

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      console.log(`📊 Procesando ${alert.symbol}:`, {
        entryPriceRange: alert.entryPriceRange,
        entryPrice: alert.entryPrice,
        currentPrice: alert.currentPrice,
        precioMinimo: alert.precioMinimo,
        precioMaximo: alert.precioMaximo,
        tipoAlerta: alert.tipoAlerta
      });

      // ✅ CRÍTICO: Usar el precio actual como precio de entrada fijo
      const closePrice = alert.currentPrice;
      
      if (!closePrice || closePrice <= 0) {
        console.warn(`⚠️ ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
        continue;
      }
      
      console.log(`💰 ${alert.symbol}: Precio actual ${closePrice} -> Precio de entrada fijo`);

      // Determinar el rango anterior para el log
      let oldRange = 'N/A';
      if (alert.entryPriceRange) {
        oldRange = `$${alert.entryPriceRange.min}-$${alert.entryPriceRange.max}`;
      } else if (alert.precioMinimo && alert.precioMaximo) {
        oldRange = `$${alert.precioMinimo}-$${alert.precioMaximo}`;
      }

      // Actualizar entryPrice al precio actual Y eliminar campos de rango en una sola operación
      await Alert.updateOne(
        { _id: alert._id },
        { 
          $set: { 
            entryPrice: closePrice,
            tipoAlerta: 'precio' // Cambiar a tipo precio fijo
          },
          $unset: { 
            entryPriceRange: 1,
            precioMinimo: 1,
            precioMaximo: 1
          }
        }
      );

      conversionDetails.push({
        symbol: alert.symbol,
        oldRange: oldRange,
        newPrice: closePrice
      });

      console.log(`✅ ${alert.symbol}: Rango ${oldRange} convertido a precio fijo $${closePrice}`);
    }

    res.status(200).json({
      success: true,
      message: `✅ Conversión completada: ${conversionDetails.length} alertas con rango convertidas a precios fijos`,
      processedCount: conversionDetails.length,
      details: conversionDetails
    });

  } catch (error) {
    console.error('❌ Error en test de cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
