import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

interface AutoConvertCronResponse {
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
 * CRON JOB: Conversión automática de rangos
 * Se ejecuta automáticamente cada día a las 6:30 PM EST/EDT (lunes a viernes)
 * Convierte TODOS los rangos a precios fijos sin importar el estado del mercado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertCronResponse>) {
  // Solo permitir POST para cron jobs
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido',
      timestamp: new Date().toISOString()
    });
  }

  // Verificar token de seguridad para cron jobs (opcional)
  const cronToken = req.headers.authorization?.replace('Bearer ', '');
  const expectedToken = process.env.CRON_SECRET_TOKEN;
  
  if (expectedToken && cronToken !== expectedToken) {
    console.log('❌ [CRON] Token de autorización inválido');
    return res.status(401).json({
      success: false,
      message: 'No autorizado',
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('🤖 CRON: Iniciando conversión automática de rangos...');
    
    await dbConnect();

    // ✅ FORZAR CONVERSIÓN: Siempre convertir rangos sin importar el estado del mercado
    console.log('🔄 CRON: Iniciando conversión automática de rangos (forzada)...');

    // Obtener alertas con rango que necesitan conversión
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { tipoAlerta: 'rango' },
        { precioMinimo: { $exists: true, $ne: null } }
      ]
    });

    console.log(`🔍 CRON: Encontradas ${alertsWithRange.length} alertas con rango para convertir`);

    const conversionDetails = [];

    for (const alert of alertsWithRange) {
      console.log(`📊 CRON: Procesando ${alert.symbol}:`, {
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
        console.warn(`⚠️ CRON: ${alert.symbol}: Precio actual inválido (${closePrice}), saltando...`);
        continue;
      }
      
      console.log(`💰 CRON: ${alert.symbol}: Precio actual ${closePrice} -> Precio de entrada fijo`);

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

      console.log(`✅ CRON: ${alert.symbol}: Rango ${oldRange} convertido a precio fijo $${closePrice}`);
    }

    console.log(`🎉 CRON: Conversión automática completada: ${conversionDetails.length} alertas procesadas`);

    return res.status(200).json({
      success: true,
      message: `Conversión automática completada: ${conversionDetails.length} alertas procesadas`,
      conversion: {
        processed: conversionDetails.length,
        details: conversionDetails
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ CRON: Error en conversión automática:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      timestamp: new Date().toISOString()
    });
  }
}

