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
import { createAlertNotification } from '@/lib/notificationUtils';

interface UpdatePricesResponse {
  success?: boolean;
  updated?: number;
  desestimadas?: number;
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
    // Verificar autenticación (sesión, token de cron, o público con token)
    const authHeader = req.headers.authorization;
    const isCronCall = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const isPublicCall = authHeader === `Bearer cron_mp_2024_xyz_789_abc_def_ghi_jkl_mno_pqr_stu_vwx_yz`;
    
    let userEmail = null;
    
    if (isCronCall) {
      // Llamada desde cron job interno
      userEmail = 'cron@system';
      console.log('🔄 Llamada desde cron job interno detectada');
    } else if (isPublicCall) {
      // Llamada pública desde cron job externo
      userEmail = 'public@cron';
      console.log('🌐 Llamada pública desde cron job externo detectada');
    } else {
      // Llamada normal con sesión
      const session = await getServerSession(req, res, authOptions);
      
      if (!session?.user?.email) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      
      userEmail = session.user.email;
    }

    // Conectar a la base de datos
    await dbConnect();

    // Obtener información del usuario (solo si no es cron)
    let user = null;
    if (!isCronCall && !isPublicCall) {
      user = await User.findOne({ email: userEmail });
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
    }

    // Obtener todas las alertas activas - REMOVIDO filtro por createdBy para que se actualicen todas las alertas
    const activeAlerts = await Alert.find({
      status: 'ACTIVE'
      // Removido filtro por tipo para incluir todas las alertas (TraderCall, SmartMoney, etc.)
    });

    let updatedCount = 0;
    let desestimadasCount = 0;
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
        
        // ✅ NUEVO: Verificar si es una alerta de rango y si rompe el rango
        if (alert.tipoAlerta === 'rango') {
          const { isBroken, reason } = alert.checkRangeBreak(currentPrice);

          if (isBroken) {
            console.log(`❌ Alerta ${alert.symbol} (ID: ${alert._id}) ha roto el rango. Cerrando...`);

            alert.status = 'DESESTIMADA';
            alert.exitDate = new Date();
            alert.exitReason = 'RANGE_BREAK';
            alert.desestimacionMotivo = reason;
            alert.profit = 0; // Desestimada, no hay profit/loss real de la operación
            desestimadasCount++;

            // Enviar notificación de alerta desestimada
            try {
              await createAlertNotification(alert, {
                message: `🚫 Alerta desestimada: ${alert.symbol} - El precio rompió el rango de entrada. Motivo: ${reason}. Precio actual: $${currentPrice}`,
                price: currentPrice
              });
              console.log(`✅ Notificación de alerta desestimada enviada para ${alert.symbol}`);
            } catch (notificationError) {
              console.error(`⚠️ Error enviando notificación para ${alert.symbol}:`, notificationError);
            }

            console.log(`✅ Alerta ${alert.symbol} desestimada automáticamente.`);
          }
        }
        
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

    console.log(`Precios actualizados: ${updatedCount} de ${activeAlerts.length} alertas. Desestimadas: ${desestimadasCount}`);

    return res.status(200).json({
      success: true,
      updated: updatedCount,
      desestimadas: desestimadasCount,
      alerts: updatedAlerts,
      message: `Se actualizaron ${updatedCount} alertas${desestimadasCount > 0 ? ` y se desestimaron ${desestimadasCount} alertas de rango` : ''}`
    });

  } catch (error) {
    console.error('Error al actualizar precios:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudieron actualizar los precios'
    });
  }
} 