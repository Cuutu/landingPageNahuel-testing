import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

interface AutoConvertResponse {
  success: boolean;
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
  error?: string;
}

/**
 * API para verificar el estado del mercado y convertir rangos automáticamente si está cerrado
 * Solo administradores pueden ejecutar esta acción
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<AutoConvertResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      marketStatus: { isOpen: false, message: 'Método no permitido' },
      error: 'Método no permitido' 
    });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false,
        marketStatus: { isOpen: false, message: 'No autorizado' },
        error: 'No autorizado' 
      });
    }

    await dbConnect();

    // Verificar que sea admin
    const user = await User.findOne({ email: session.user.email }).select('role');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        marketStatus: { isOpen: false, message: 'Usuario no encontrado' },
        error: 'Usuario no encontrado' 
      });
    }
    
    if (user.role !== 'admin') {
      console.log(`❌ Usuario ${session.user.email} intentó usar función admin. Rol actual: ${user.role}`);
      return res.status(403).json({ 
        success: false,
        marketStatus: { isOpen: false, message: 'Solo administradores pueden usar esta función' },
        error: 'Solo administradores pueden usar esta función' 
      });
    }

    console.log(`✅ Usuario admin ${session.user.email} ejecutando conversión automática`);

    // Verificar estado del mercado
    const marketStatus = await getMarketStatus();
    console.log(`📊 Estado del mercado: ${marketStatus.isOpen ? 'ABIERTO' : 'CERRADO'} - ${marketStatus.message}`);

    // Si el mercado está abierto, no convertir
    if (marketStatus.isOpen) {
      return res.status(200).json({
        success: true,
        marketStatus: {
          isOpen: true,
          message: marketStatus.message
        }
      });
    }

    // Si el mercado está cerrado, proceder con la conversión
    console.log('🔄 Mercado cerrado, iniciando conversión automática de rangos...');

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

      // Usar el precio actual como precio de entrada fijo
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

    console.log(`🎉 Conversión automática completada: ${conversionDetails.length} alertas procesadas`);

    return res.status(200).json({
      success: true,
      marketStatus: {
        isOpen: false,
        message: marketStatus.message
      },
      conversion: {
        processed: conversionDetails.length,
        details: conversionDetails
      }
    });

  } catch (error) {
    console.error('❌ Error en conversión automática:', error);
    return res.status(500).json({ 
      success: false,
      marketStatus: { isOpen: false, message: 'Error interno' },
      error: 'Error interno del servidor' 
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
