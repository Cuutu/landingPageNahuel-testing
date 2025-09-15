import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

interface TestCronResponse {
  success: boolean;
  message: string;
  conversion?: {
    processed: number;
    details: Array<{
      symbol: string;
      oldRange: string;
      newPrice: number;
    }>;
  };
  timestamp: string;
}

/**
 * ENDPOINT DE PRUEBA: Simula el cron job de conversión automática
 * Solo administradores pueden ejecutar esta acción
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<TestCronResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Método no permitido',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false,
        message: 'No autorizado',
        timestamp: new Date().toISOString()
      });
    }

    await dbConnect();

    // Verificar que sea admin
    const user = await User.findOne({ email: session.user.email }).select('role');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado',
        timestamp: new Date().toISOString()
      });
    }
    
    if (user.role !== 'admin') {
      console.log(`❌ Usuario ${session.user.email} intentó usar función admin. Rol actual: ${user.role}`);
      return res.status(403).json({ 
        success: false,
        message: 'Solo administradores pueden usar esta función',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ Usuario admin ${session.user.email} ejecutando prueba de cron job`);

    // Simular el cron job de conversión automática
    console.log('🔄 PRUEBA CRON: Iniciando conversión automática de rangos...');

    // Obtener alertas con rango que necesitan conversión
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { tipoAlerta: 'rango' },
        { precioMinimo: { $exists: true, $ne: null } }
      ]
    });

    console.log(`🔍 PRUEBA CRON: Encontradas ${alertsWithRange.length} alertas con rango para convertir`);

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      console.log(`📊 PRUEBA CRON: Procesando ${alert.symbol}:`, {
        entryPriceRange: alert.entryPriceRange,
        entryPrice: alert.entryPrice,
        currentPrice: alert.currentPrice,
        precioMinimo: alert.precioMinimo,
        precioMaximo: alert.precioMaximo,
        tipoAlerta: alert.tipoAlerta
      });

      // Usar el precio actual como precio de entrada fijo
      const closePrice = alert.currentPrice;
      
      if (!closePrice || closePrice <= 0) {
        console.warn(`⚠️ PRUEBA CRON: ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
        continue;
      }
      
      console.log(`💰 PRUEBA CRON: ${alert.symbol}: Precio actual ${closePrice} -> Precio de entrada fijo`);

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

      console.log(`✅ PRUEBA CRON: ${alert.symbol}: Rango ${oldRange} convertido a precio fijo $${closePrice}`);
    }

    console.log(`🎉 PRUEBA CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`);

    return res.status(200).json({
      success: true,
      message: `PRUEBA CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`,
      conversion: {
        processed: conversionDetails.length,
        details: conversionDetails
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ PRUEBA CRON: Error en conversión automática:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
}
