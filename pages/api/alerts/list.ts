/**
 * API para obtener la lista de alertas del usuario autenticado
 * Soporte para filtros por estado, tipo, etc.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

interface AlertsListResponse {
  success?: boolean;
  alerts?: any[];
  error?: string;
  message?: string;
  total?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlertsListResponse>
) {
  if (req.method !== 'GET') {
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

    // Extraer parámetros de query
    const { 
      status = 'ALL', 
      tipo = 'TraderCall',
      limit = '50',
      page = '1',
      availableForPurchase // ✅ NUEVO: Filtro para alertas disponibles para compra
    } = req.query;

    // Construir filtro - REMOVIDO el filtro por createdBy para que todos vean todas las alertas
    const filter: any = {
      tipo: tipo
    }; 

    if (status !== 'ALL') {
      filter.status = status;
    } else {
      // ✅ NUEVO: Para seguimiento, incluir alertas descartadas del día actual
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      
      filter.$or = [
        { status: { $ne: 'DESCARTADA' } }, // Todas las alertas que no están descartadas
        { 
          status: 'DESCARTADA',
          descartadaAt: { 
            $gte: startOfDay, 
            $lte: endOfDay 
          }
        } // Alertas descartadas solo del día actual
      ];
    }

    // ✅ NUEVO: Filtrar por disponibilidad para compra
    if (availableForPurchase !== undefined) {
      if (availableForPurchase === 'true') {
        filter.availableForPurchase = true;
      } else if (availableForPurchase === 'false') {
        // Para seguimiento, mostrar todas las alertas (tanto marcadas como desmarcadas)
        // No agregamos filtro, mostramos todas
      }
    }

    // Paginación
    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Obtener alertas con paginación
    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 }) // Más recientes primero
      .limit(limitNum)
      .skip(skip)
      .lean();

    // ✅ NUEVO: Actualizar precios en tiempo real para alertas activas
    if (alerts.length > 0) {
      console.log(`🔄 Actualizando precios para ${alerts.length} alertas antes de devolver datos...`);
      
      for (const alert of alerts) {
        if (alert.status === 'ACTIVE' && alert.symbol) {
          try {
            // Obtener precio actual usando la API interna
            const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stock-price?symbol=${alert.symbol}`, {
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            if (response.ok) {
              const priceData = await response.json();
              
              if (priceData.price && !priceData.isSimulated) {
                // Actualizar el precio en el objeto alert antes de formatear
                alert.currentPrice = priceData.price;
                
                // ✅ NUEVO: Recalcular P&L con el nuevo precio actual
                const entryPrice = alert.entryPriceRange?.min || alert.entryPrice;
                if (entryPrice) {
                  if (alert.action === 'BUY') {
                    alert.profit = ((priceData.price - entryPrice) / entryPrice) * 100;
                  } else { // SELL
                    alert.profit = ((entryPrice - priceData.price) / entryPrice) * 100;
                  }
                  console.log(`✅ Precio y P&L actualizados para ${alert.symbol}: $${priceData.price} (P&L: ${alert.profit.toFixed(2)}%)`);
                } else {
                  console.log(`✅ Precio actualizado para ${alert.symbol}: $${priceData.price} (sin P&L - no hay precio de entrada)`);
                }
              } else {
                console.log(`⚠️ Precio simulado o no disponible para ${alert.symbol}: $${priceData.price || 'N/A'}`);
              }
            }
          } catch (error) {
            console.error(`❌ Error actualizando precio para ${alert.symbol}:`, error);
          }
        }
      }
    }

    // Contar total de alertas
    const total = await Alert.countDocuments(filter);

    // Formatear alertas para el frontend - con validación de números
    const formattedAlerts = alerts.map((alert: any) => {
      // ✅ CORREGIDO: Formatear precio de entrada - priorizar entryPrice sobre rango
      let entryPriceDisplay = '';
      
      // ✅ CRÍTICO: Si es alerta de rango, mostrar siempre el rango
      if (alert.tipoAlerta === 'rango' && alert.precioMinimo && alert.precioMaximo) {
        entryPriceDisplay = `$${Number(alert.precioMinimo).toFixed(2)} / $${Number(alert.precioMaximo).toFixed(2)}`;
      }
      // ✅ Si hay entryPrice (precio fijo), usarlo (después del cierre de mercado)
      else if (alert.entryPrice && alert.entryPrice > 0) {
        entryPriceDisplay = `$${Number(alert.entryPrice).toFixed(2)}`;
      }
      // ✅ Si hay rango Y no hay entryPrice fijo, mostrar rango
      else if (alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max) {
        entryPriceDisplay = `$${Number(alert.entryPriceRange.min).toFixed(2)} / $${Number(alert.entryPriceRange.max).toFixed(2)}`;
      } 
      // ✅ Fallback a finalPrice si existe
      else if (alert.finalPrice) {
        entryPriceDisplay = `$${Number(alert.finalPrice).toFixed(2)}`;
      } 
      // ✅ Valor por defecto
      else {
        entryPriceDisplay = '$0.00';
      }

      return {
        id: alert._id.toString(),
        symbol: alert.symbol || '',
        action: alert.action || '',
        entryPrice: entryPriceDisplay, // ✅ MODIFICADO: Ahora muestra rangos correctamente
        currentPrice: `$${Number(alert.currentPrice || 0).toFixed(2)}`,
        stopLoss: `$${Number(alert.stopLoss || 0).toFixed(2)}`,
        takeProfit: `$${Number(alert.takeProfit || 0).toFixed(2)}`,
        profit: `${Number(alert.profit || 0) >= 0 ? '+' : ''}${Number(alert.profit || 0).toFixed(1)}%`,
        status: alert.status || 'ACTIVE',
        date: alert.date ? alert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        analysis: alert.analysis || '',
        createdAt: alert.createdAt,
        // ✅ NUEVO: Información adicional para debugging
        tipoAlerta: alert.tipoAlerta || 'precio', // 'precio' o 'rango'
        hasRange: !!(alert.entryPriceRange && alert.entryPriceRange.min && alert.entryPriceRange.max),
        hasFinalPrice: !!alert.finalPrice,
        // ✅ NUEVO: Campo para controlar disponibilidad para compra
        availableForPurchase: alert.availableForPurchase || false,
        // ✅ NUEVO: Sistema de porcentaje de participación
        participationPercentage: alert.participationPercentage || 100,
        originalParticipationPercentage: alert.originalParticipationPercentage || 100,
        // ✅ NUEVO: Campos para mostrar rangos originales - usar entryPriceRange como fallback
        precioMinimo: alert.precioMinimo ? Number(alert.precioMinimo).toFixed(2) : (alert.entryPriceRange?.min ? Number(alert.entryPriceRange.min).toFixed(2) : null),
        precioMaximo: alert.precioMaximo ? Number(alert.precioMaximo).toFixed(2) : (alert.entryPriceRange?.max ? Number(alert.entryPriceRange.max).toFixed(2) : null),
        // ✅ NUEVO: Campos para rango de venta parcial
        sellRangeMin: alert.sellRangeMin ? Number(alert.sellRangeMin).toFixed(2) : null,
        sellRangeMax: alert.sellRangeMax ? Number(alert.sellRangeMax).toFixed(2) : null,
        hasSellRange: !!(alert.sellRangeMin && alert.sellRangeMax),
        sellPrice: alert.sellPrice ? `$${Number(alert.sellPrice).toFixed(2)}` : null,
        hasSellPrice: !!alert.sellPrice,
        // Campos adicionales para mostrar si está cerrada
        exitPrice: alert.exitPrice ? `$${Number(alert.exitPrice).toFixed(2)}` : null,
        exitDate: alert.exitDate?.toISOString().split('T')[0] || null,
        exitReason: alert.exitReason || null,
        type: Number(alert.profit || 0) >= 0 ? 'WIN' : 'LOSS' // Para alertas cerradas
      };
    });

    return res.status(200).json({
      success: true,
      alerts: formattedAlerts,
      total,
      message: `Se encontraron ${formattedAlerts.length} alertas`
    });

  } catch (error) {
    console.error('Error al obtener alertas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las alertas'
    });
  }
} 