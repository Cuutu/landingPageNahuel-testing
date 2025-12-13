import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';

interface UpdatePricesResponse {
  success?: boolean;
  error?: string;
  message?: string;
  updated?: number;
  alerts?: any[];
  marketStatus?: string;
  isSimulated?: boolean;
  executionTime?: number;
  errors?: string[];
}

/**
 * API para actualizar precios de alertas manualmente (llamada desde el frontend)
 */
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

    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      console.log('✅ Usuario autorizado - Iniciando actualización manual de precios...');
    }
    
    const startTime = Date.now();
    
    await dbConnect();

    // Obtener todas las alertas activas
    const activeAlerts = await Alert.find({ 
      status: 'ACTIVE',
      tipo: { $in: ['TraderCall', 'SmartMoney'] }
    });

    if (activeAlerts.length === 0) {
      if (isDev) {
        console.log('ℹ️ No hay alertas activas para actualizar');
      }
      return res.status(200).json({ 
        success: true, 
        message: 'No hay alertas activas',
        updated: 0
      });
    }

    if (isDev) {
      console.log(`📊 Actualizando ${activeAlerts.length} alertas activas...`);
    }

    // ✅ OPTIMIZADO: Agrupar alertas por símbolo único para reducir llamadas
    const alertsBySymbol = new Map<string, typeof activeAlerts>();
    for (const alert of activeAlerts) {
      const symbol = alert.symbol.toUpperCase();
      if (!alertsBySymbol.has(symbol)) {
        alertsBySymbol.set(symbol, []);
      }
      alertsBySymbol.get(symbol)!.push(alert);
    }

    const uniqueSymbols = Array.from(alertsBySymbol.keys());
    
    if (isDev) {
      console.log(`🔍 Símbolos únicos: ${uniqueSymbols.length} (de ${activeAlerts.length} alertas)`);
    }

    // ✅ OPTIMIZADO: Obtener precios en paralelo para símbolos únicos (con caché, esto será muy rápido)
    const pricePromises = uniqueSymbols.map(symbol => 
      fetchCurrentPrice(symbol).then(priceData => ({ symbol, priceData }))
    );
    
    const priceResults = await Promise.all(pricePromises);
    
    // ✅ Crear mapa de precios por símbolo
    const pricesBySymbol = new Map<string, { price: number; marketStatus: string; isSimulated: boolean }>();
    for (const { symbol, priceData } of priceResults) {
      if (priceData && priceData.price && !priceData.isSimulated) {
        pricesBySymbol.set(symbol, priceData);
      }
    }

    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    let marketStatus = 'UNKNOWN';
    let isSimulated = false;

    // ✅ OPTIMIZADO: Procesar todas las alertas usando precios obtenidos
    for (const [symbol, alerts] of Array.from(alertsBySymbol.entries())) {
      const priceData = pricesBySymbol.get(symbol);
      
      if (!priceData) {
        errorCount += alerts.length;
        errors.push(`No se pudo obtener precio REAL para ${symbol} (${alerts.length} alertas)`);
        if (isDev) {
          console.error(`❌ No se pudo obtener precio REAL para ${symbol} (${alerts.length} alertas)`);
        }
        continue;
      }

      const currentPrice = priceData.price;
      
      // ✅ Aplicar precio a todas las alertas con este símbolo
      for (const alert of alerts) {
        try {
          // Actualizar precio actual SIEMPRE que obtengamos un precio válido REAL
          const shouldUpdate = !alert.currentPrice || currentPrice !== alert.currentPrice;
          
          if (shouldUpdate) {
            if (isDev) {
              console.log(`✅ Actualizando ${alert.symbol}: $${alert.currentPrice || 'N/A'} → $${currentPrice}`);
            }
            
            // Actualizar precio actual
            alert.currentPrice = currentPrice;
            
            // Recalcular profit automáticamente
            alert.calculateProfit();
            
            await alert.save();
            
            // ✅ Actualizar distribuciones de liquidez para esta alerta
            try {
              const liquidityDocs = await Liquidity.find({
                'distributions.alertId': alert._id.toString()
              });
              
              for (const liquidityDoc of liquidityDocs) {
                const distribution = liquidityDoc.distributions.find(
                  (d: any) => d.alertId.toString() === alert._id.toString()
                );
                
                if (distribution && distribution.isActive) {
                  // Actualizar precio y P&L de la distribución
                  liquidityDoc.updateDistribution(alert._id.toString(), currentPrice);
                  await liquidityDoc.save();
                  if (isDev) {
                    console.log(`✅ Distribución actualizada para ${alert.symbol} en pool ${liquidityDoc.pool}`);
                  }
                }
              }
            } catch (liquidityError) {
              if (isDev) {
                console.error(`⚠️ Error actualizando distribución para ${alert.symbol}:`, liquidityError);
              }
              // Continuar aunque falle la actualización de liquidez
            }
            
            updatedCount++;
            
            // Capturar estado del mercado de la primera alerta actualizada
            if (updatedCount === 1) {
              marketStatus = priceData.marketStatus || 'UNKNOWN';
              isSimulated = false; // Precio real
            }
          } else {
            if (isDev) {
              console.log(`ℹ️ ${alert.symbol}: Precio sin cambios $${currentPrice}`);
            }
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = `Error actualizando ${alert.symbol}: ${error.message}`;
          errors.push(errorMsg);
          if (isDev) {
            console.error(errorMsg);
          }
        }
      }
    }

    const executionTime = Date.now() - startTime;
    
    if (isDev) {
      console.log(`✅ Actualización manual completada en ${executionTime}ms`);
      console.log(`📊 Resumen: ${updatedCount} actualizadas, ${errorCount} errores`);
      console.log(`⚡ Optimización: ${uniqueSymbols.length} llamadas a API (vs ${activeAlerts.length} sin optimización)`);
    }

    return res.status(200).json({
      success: true,
      message: `Precios actualizados correctamente`,
      updated: updatedCount,
      marketStatus,
      isSimulated,
      executionTime,
      errors: errors.slice(0, 3) // Solo primeros 3 errores
    });

  } catch (error: any) {
    console.error('❌ Error en actualización manual de precios:', error);
    
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error.message
    });
  }
}

/**
 * Obtener precio actual de una acción usando la API interna
 */
async function fetchCurrentPrice(symbol: string): Promise<{ price: number; marketStatus: string; isSimulated: boolean } | null> {
  try {
    // ✅ Usar la misma API de stock-price que ya tiene caché inteligente
    // El caché reducirá las llamadas reales a Yahoo Finance en ~97%
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stock-price?symbol=${symbol}`);
    
    if (response.ok) {
      const data = await response.json();
      
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        console.log(`📊 API Response para ${symbol}:`, {
          price: data.price,
          marketStatus: data.marketStatus,
          isSimulated: data.isSimulated
        });
      }
      
      return {
        price: data.price,
        marketStatus: data.marketStatus || 'UNKNOWN',
        isSimulated: data.isSimulated || false
      };
    }
    
    return null;
  } catch (error) {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.error(`Error obteniendo precio para ${symbol}:`, error);
    }
    return null;
  }
}
