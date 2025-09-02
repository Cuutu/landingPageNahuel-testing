/**
 * API para actualizar precios actuales de alertas activas
 * Consulta precios en tiempo real y actualiza MongoDB
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

interface UpdatePricesResponse {
  success?: boolean;
  updated?: number;
  error?: string;
  message?: string;
  alerts?: any[];
}

// Función para obtener precio actual de una acción
async function fetchCurrentPrice(symbol: string): Promise<{ price: number; marketStatus: string; isSimulated: boolean } | null> {
  try {
    // Usar la misma API de stock-price que ya existe
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stock-price?symbol=${symbol}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 API Response para ${symbol}:`, {
        price: data.price,
        marketStatus: data.marketStatus,
        isSimulated: data.isSimulated
      });
      
      return {
        price: data.price,
        marketStatus: data.marketStatus || 'UNKNOWN',
        isSimulated: data.isSimulated || false
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error obteniendo precio para ${symbol}:`, error);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdatePricesResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Obtener información del usuario
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener todas las alertas activas - REMOVIDO filtro por createdBy para que se actualicen todas las alertas
    const activeAlerts = await Alert.find({
      status: 'ACTIVE',
      tipo: 'TraderCall' // Por ahora solo TraderCall
    });

    let updatedCount = 0;
    const updatedAlerts = [];

    // Actualizar precios para cada alerta activa
    for (const alert of activeAlerts) {
      console.log(`🔍 Procesando alerta ${alert.symbol}: Precio anterior: $${alert.currentPrice || 'N/A'}`);
      
      const priceData = await fetchCurrentPrice(alert.symbol);
      console.log(`💰 Precio obtenido para ${alert.symbol}: $${priceData?.price || 'N/A'}`);
      
      if (priceData && priceData.price) {
        const currentPrice = priceData.price;
        
        // Actualizar precio actual SIEMPRE que obtengamos un precio válido
        // (ya sea porque cambió o porque no teníamos precio anterior)
        const shouldUpdate = !alert.currentPrice || currentPrice !== alert.currentPrice;
        
        if (shouldUpdate) {
          console.log(`✅ Actualizando ${alert.symbol}: $${alert.currentPrice || 'N/A'} → $${currentPrice}`);
        } else {
          console.log(`ℹ️ ${alert.symbol}: Precio sin cambios $${currentPrice}, pero actualizando de todas formas`);
        }
        
        // Actualizar precio actual (siempre si tenemos precio válido)
        alert.currentPrice = currentPrice;
        
        // El profit se calcula automáticamente por el middleware pre('save')
        await alert.save();
        
        updatedCount++;
        
        // Formatear para respuesta - con validación de números y compatibilidad legacy
        const entryPrice = alert.entryPriceRange?.max || alert.entryPrice || 0;
        
        updatedAlerts.push({
          id: alert._id.toString(),
          symbol: alert.symbol || '',
          action: alert.action || '',
          entryPrice: `$${Number(entryPrice).toFixed(2)}`,
          currentPrice: `$${Number(alert.currentPrice || 0).toFixed(2)}`,
          stopLoss: `$${Number(alert.stopLoss || 0).toFixed(2)}`,
          takeProfit: `$${Number(alert.takeProfit || 0).toFixed(2)}`,
          profit: `${Number(alert.profit || 0) >= 0 ? '+' : ''}${Number(alert.profit || 0).toFixed(1)}%`,
          status: alert.status || 'ACTIVE',
          date: alert.date ? alert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          analysis: alert.analysis || '',
          priceChange: Number(currentPrice || 0) - Number(entryPrice),
          marketStatus: priceData.marketStatus,
          isSimulated: priceData.isSimulated
        });
      } else {
        console.log(`❌ No se pudo obtener precio para ${alert.symbol}`);
      }
    }

    console.log(`Precios actualizados: ${updatedCount} de ${activeAlerts.length} alertas`);

    return res.status(200).json({
      success: true,
      updated: updatedCount,
      alerts: updatedAlerts,
      message: `Se actualizaron ${updatedCount} alertas`
    });

  } catch (error) {
    console.error('Error al actualizar precios:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudieron actualizar los precios'
    });
  }
} 