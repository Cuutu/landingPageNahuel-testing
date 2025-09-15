import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

interface AutoConvertCronResponse {
  success: boolean;
  message: string;
  marketStatus: {
    isOpen: boolean;
    message: string;
  };
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
 * CRON JOB: Conversión automática de rangos al cierre del mercado
 * Se ejecuta automáticamente cada día a las 4:30 PM EST/EDT
 * Solo convierte rangos si el mercado está cerrado
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertCronResponse>) {
  // Solo permitir ejecución desde Vercel Cron o con token de seguridad
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado',
      marketStatus: { isOpen: false, message: 'No autorizado' },
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('🤖 CRON: Iniciando conversión automática de rangos...');
    
    await dbConnect();

    // Verificar estado del mercado
    const marketStatus = await getMarketStatus();
    console.log(`📊 CRON: Estado del mercado: ${marketStatus.isOpen ? 'ABIERTO' : 'CERRADO'} - ${marketStatus.message}`);

    // Si el mercado está abierto, no convertir
    if (marketStatus.isOpen) {
      console.log('⏰ CRON: Mercado abierto, no se ejecuta conversión');
      return res.status(200).json({
        success: true,
        message: 'Mercado abierto, no se ejecutó conversión',
        marketStatus,
        timestamp: new Date().toISOString()
      });
    }

    // Si el mercado está cerrado, proceder con la conversión
    console.log('🔄 CRON: Mercado cerrado, iniciando conversión automática de rangos...');

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
      marketStatus,
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
      marketStatus: { isOpen: false, message: 'Error interno' },
      timestamp: new Date().toISOString()
    });
  }
}

async function getMarketStatus(): Promise<{ isOpen: boolean; message: string }> {
  // Obtener hora actual en Nueva York (zona horaria del mercado)
  const now = new Date();
  const nyTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  const currentHour = nyTime.getHours();
  const currentMinute = nyTime.getMinutes();
  const currentDay = nyTime.getDay(); // 0 = Domingo, 6 = Sábado
  
  // Verificar si es fin de semana
  if (currentDay === 0 || currentDay === 6) {
    return {
      isOpen: false,
      message: 'Mercado cerrado (fin de semana)'
    };
  }
  
  // Horarios del mercado (9:30 AM - 4:00 PM EST/EDT)
  const marketOpenHour = 9;
  const marketOpenMinute = 30;
  const marketCloseHour = 16;
  const marketCloseMinute = 0;
  
  // Convertir a minutos para facilitar comparación
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const marketOpenInMinutes = marketOpenHour * 60 + marketOpenMinute;
  const marketCloseInMinutes = marketCloseHour * 60 + marketCloseMinute;
  
  const isOpen = currentTimeInMinutes >= marketOpenInMinutes && currentTimeInMinutes < marketCloseInMinutes;
  
  if (isOpen) {
    return {
      isOpen: true,
      message: 'Mercado abierto'
    };
  } else {
    return {
      isOpen: false,
      message: currentTimeInMinutes < marketOpenInMinutes 
        ? 'Mercado cerrado (antes del horario de apertura)'
        : 'Mercado cerrado (después del horario de cierre)'
    };
  }
}
