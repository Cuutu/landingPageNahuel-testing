/**
 * API para crear nuevas alertas de trading
 * Solo los administradores pueden crear alertas
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';
import { createAlertNotification } from '@/lib/notificationUtils';

interface AlertRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice?: number; // Opcional para alertas de rango
  stopLoss: number;
  takeProfit: number;
  analysis: string;
  date: string;
  tipo?: 'TraderCall' | 'SmartMoney';
  // ✅ NUEVO: Campos para alertas de rango
  tipoAlerta?: 'precio' | 'rango';
  precioMinimo?: number;
  precioMaximo?: number;
  horarioCierre?: string;
  // ✅ NUEVO: Campos para liquidez
  liquidityPercentage?: number;
  liquidityAmount?: number;
  chartImage?: {
    public_id: string;
    url: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    caption?: string;
    order?: number;
  };
  images?: Array<{
    public_id: string;
    url: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    caption?: string;
    order?: number;
  }>;
}

interface AlertResponse {
  success?: boolean;
  alert?: any;
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlertResponse>
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

    // Obtener información del usuario y verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // NUEVA RESTRICCIÓN: Solo administradores pueden crear alertas
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Permisos insuficientes. Solo los administradores pueden crear alertas.' 
      });
    }

    // Validar datos de entrada
    const { 
      symbol, 
      action, 
      entryPrice, 
      stopLoss, 
      takeProfit, 
      analysis, 
      date, 
      tipo = 'TraderCall', 
      chartImage, 
      images,
      tipoAlerta = 'precio',
      precioMinimo,
      precioMaximo,
      horarioCierre = '17:30',
      emailMessage,
      emailImageUrl,
      liquidityPercentage = 0,
      liquidityAmount = 0
    }: AlertRequest & { emailMessage?: string; emailImageUrl?: string } = req.body;

    if (!symbol || !action || !stopLoss || !takeProfit) {
      return res.status(400).json({ error: 'Todos los campos básicos son requeridos' });
    }

    if (!['BUY', 'SELL'].includes(action)) {
      return res.status(400).json({ error: 'Acción debe ser BUY o SELL' });
    }

    if (!['precio', 'rango'].includes(tipoAlerta)) {
      return res.status(400).json({ error: 'Tipo de alerta debe ser precio o rango' });
    }

    // Validaciones específicas según el tipo de alerta
    if (tipoAlerta === 'precio') {
      if (!entryPrice || entryPrice <= 0) {
        return res.status(400).json({ error: 'Precio de entrada es requerido para alertas de precio específico' });
      }
    } else if (tipoAlerta === 'rango') {
      if (!precioMinimo || !precioMaximo || precioMinimo <= 0 || precioMaximo <= 0) {
        return res.status(400).json({ error: 'Precio mínimo y máximo son requeridos para alertas de rango' });
      }
      if (precioMinimo >= precioMaximo) {
        return res.status(400).json({ error: 'El precio mínimo debe ser menor al precio máximo' });
      }
    }

    if (stopLoss <= 0 || takeProfit <= 0) {
      return res.status(400).json({ error: 'Stop Loss y Take Profit deben ser mayores a 0' });
    }

    // ✅ NUEVO: Obtener precio actual del mercado para asignación de liquidez
    let currentMarketPrice = entryPrice; // Valor por defecto
    
    if (liquidityPercentage > 0 && liquidityAmount > 0) {
      try {
        console.log(`🔍 [DEBUG] Obteniendo precio actual del mercado para ${symbol.toUpperCase()}`);
        
        // Intentar obtener precio actual del mercado
        const marketPriceResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/stock-price?symbol=${symbol.toUpperCase()}`);
        if (marketPriceResponse.ok) {
          const marketData = await marketPriceResponse.json();
          if (marketData.price && marketData.price > 0) {
            currentMarketPrice = marketData.price;
            console.log(`✅ [DEBUG] Precio actual del mercado obtenido: $${currentMarketPrice} para ${symbol.toUpperCase()}`);
          } else {
            console.log(`⚠️ [DEBUG] Precio del mercado no válido, usando entryPrice: $${entryPrice}`);
          }
        } else {
          console.log(`⚠️ [DEBUG] Error obteniendo precio del mercado, usando entryPrice: $${entryPrice}`);
        }
      } catch (error) {
        console.log(`⚠️ [DEBUG] Error en fetch de precio del mercado, usando entryPrice: $${entryPrice}`, error);
      }
    }

    // Crear la nueva alerta en MongoDB
    const alertData: any = {
      symbol: symbol.toUpperCase(),
      action,
      stopLoss,
      takeProfit,
      status: 'ACTIVE',
      profit: 0, // Inicial en 0%
      date: date ? new Date(date) : new Date(),
      analysis: analysis || '',
      createdBy: user._id,
      tipo, // Recibido desde el frontend
      tipoAlerta,
      horarioCierre,
      chartImage: chartImage || null, // Imagen principal del gráfico
      images: images || [], // Imágenes adicionales
      // ✅ NUEVO: Inicializar porcentajes de participación
      participationPercentage: 100, // Comenzar con 100% de participación
      originalParticipationPercentage: 100 // Porcentaje original al crear
    };

    // Agregar campos específicos según el tipo de alerta
    if (tipoAlerta === 'precio') {
      alertData.entryPrice = entryPrice;
      alertData.currentPrice = currentMarketPrice; // ✅ CORREGIDO: Usar precio actual del mercado
    } else if (tipoAlerta === 'rango') {
      // ✅ CORREGIDO: Crear entryPriceRange para compatibilidad con el sistema
      alertData.entryPriceRange = {
        min: precioMinimo,
        max: precioMaximo
      };
      alertData.precioMinimo = precioMinimo; // Mantener para compatibilidad
      alertData.precioMaximo = precioMaximo; // Mantener para compatibilidad
      
      // ✅ CORREGIDO: Usar precio real del mercado o promedio del rango para P&L correcto
      // Si se obtuvo el precio actual del mercado y está dentro del rango, usarlo
      // Si no, usar el promedio del rango para un P&L más realista
      // Nota: precioMinimo y precioMaximo ya están validados en el if anterior (líneas 135-140)
      if (currentMarketPrice && precioMinimo && precioMaximo && currentMarketPrice > precioMinimo && currentMarketPrice < precioMaximo) {
        // Precio del mercado está dentro del rango, usarlo
        alertData.currentPrice = currentMarketPrice;
        console.log(`📊 Alerta de ${action} con rango creada para ${symbol}: rango $${precioMinimo}-$${precioMaximo}, precio inicial: $${currentMarketPrice} (precio real del mercado, P&L: 0%)`);
      } else {
        // Usar promedio del rango para un cálculo de P&L más justo
        const averagePrice = ((precioMinimo || 0) + (precioMaximo || 0)) / 2;
        alertData.currentPrice = averagePrice;
        console.log(`📊 Alerta de ${action} con rango creada para ${symbol}: rango $${precioMinimo}-$${precioMaximo}, precio inicial: $${averagePrice} (promedio del rango, P&L: 0%)`);
      }
      
      // ✅ NUEVO: Establecer horario de cierre por defecto a 17:30 para alertas de rango
      alertData.horarioCierre = '17:30';
    }

    const newAlert = await Alert.create(alertData);

    console.log('Nueva alerta creada por usuario:', user.name || user.email, newAlert._id);

    // ✅ DEBUG: Log de parámetros de liquidez recibidos
    console.log('🔍 [DEBUG] Parámetros de liquidez recibidos:', {
      liquidityPercentage,
      liquidityAmount,
      tipo,
      symbol: symbol.toUpperCase()
    });

    // ✅ NUEVO: Crear distribución de liquidez automáticamente si se asignó liquidez
    if (liquidityPercentage > 0 && liquidityAmount > 0) {
      try {
        console.log(`💰 Asignando liquidez automáticamente: ${liquidityPercentage}% ($${liquidityAmount}) para ${symbol}`);
        
        // Determinar el pool según el tipo de alerta
        const pool = tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        
        // Buscar o crear el documento de liquidez
        console.log(`🔍 [DEBUG] Buscando liquidez para usuario ${user._id} en pool ${pool}`);
        let liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
        console.log(`🔍 [DEBUG] Liquidez encontrada:`, liquidity ? 'SÍ' : 'NO');
        
        if (!liquidity) {
          // Si no existe, crear uno con liquidez por defecto
          liquidity = await Liquidity.create({
            totalLiquidity: liquidityAmount * (100 / liquidityPercentage), // Calcular total basado en el porcentaje
            availableLiquidity: 0, // Se calculará después
            distributedLiquidity: liquidityAmount,
            distributions: [],
            totalProfitLoss: 0,
            totalProfitLossPercentage: 0,
            createdBy: user._id,
            pool
          });
          console.log(`📊 Documento de liquidez creado para pool ${pool}: $${liquidity.totalLiquidity}`);
        }

        // Verificar si ya existe una distribución para esta alerta
        const existingDistribution = liquidity.distributions.find(
          (d: any) => d.alertId.toString() === newAlert._id.toString()
        );

        if (!existingDistribution) {
          // ✅ CORREGIDO: Usar siempre el precio actual para asignación de liquidez
          // Esto asegura que el precio de entrada sea consistente con el precio actual del mercado
          const priceForShares = newAlert.currentPrice;

          console.log(`🔍 [DEBUG] Precios para asignación de liquidez:`, {
            symbol: symbol.toUpperCase(),
            entryPrice: entryPrice,
            currentPrice: newAlert.currentPrice,
            currentMarketPrice: currentMarketPrice,
            precioMinimo: precioMinimo,
            priceForShares: priceForShares,
            liquidityAmount: liquidityAmount
          });

          const shares = Math.floor(liquidityAmount / priceForShares);

          // Crear nueva distribución
          const newDistribution = {
            alertId: newAlert._id,
            symbol: symbol.toUpperCase(),
            percentage: liquidityPercentage,
            allocatedAmount: liquidityAmount,
            entryPrice: priceForShares,
            currentPrice: priceForShares, // Inicialmente igual al precio de entrada
            shares: shares,
            profitLoss: 0, // Inicialmente 0
            profitLossPercentage: 0, // Inicialmente 0%
            realizedProfitLoss: 0,
            soldShares: 0,
            isActive: true,
            createdAt: new Date()
          };

          // ✅ NUEVO: Guardar información original en la alerta para ventas futuras
          newAlert.originalParticipationPercentage = 100;
          newAlert.participationPercentage = 100;
          newAlert.liquidityData = {
            allocatedAmount: liquidityAmount,
            shares: shares,
            originalAllocatedAmount: liquidityAmount,
            originalShares: shares,
            originalParticipationPercentage: 100
          };

          // ✅ NUEVO: Registrar operación de compra automáticamente
          try {
            const OperationModule = await import('@/models/Operation');
            const Operation = OperationModule.default;
            
            // ✅ CORREGIDO: Usar el ADMIN_EMAIL para asegurar que las operaciones se vean en la lista
            // Esto es importante porque list.ts busca operaciones por ADMIN_EMAIL
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
            const adminUser = await User.findOne({ email: ADMIN_EMAIL });
            
            if (!adminUser) {
              console.error('⚠️ No se encontró el usuario admin con email', ADMIN_EMAIL);
              throw new Error('Admin user not found');
            }
            
            // Obtener balance actual del admin para este sistema
            const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
              .sort({ date: -1 })
              .select('balance');
            const currentBalance = currentBalanceDoc?.balance || 0;
            const newBalance = currentBalance - liquidityAmount;

            const operation = new Operation({
              ticker: symbol.toUpperCase(),
              operationType: 'COMPRA',
              quantity: shares,
              price: priceForShares,
              amount: liquidityAmount,
              date: new Date(),
              balance: newBalance,
              alertId: newAlert._id,
              alertSymbol: symbol.toUpperCase(),
              system: pool,
              createdBy: adminUser._id, // ✅ CORREGIDO: Usar adminUser._id en lugar de user._id
              liquidityData: {
                allocatedAmount: liquidityAmount,
                shares: shares,
                entryPrice: priceForShares
              },
              executedBy: user.email,
              executionMethod: 'AUTOMATIC',
              notes: `Compra automática al crear alerta - ${liquidityPercentage}% de liquidez`
            });

            await operation.save();
            console.log(`✅ Operación de compra registrada: ${symbol} - ${shares} acciones por $${priceForShares}`);
          } catch (operationError) {
            console.error('⚠️ Error registrando operación de compra:', operationError);
            // No fallar la creación de la alerta por un error en la operación
          }

          // Agregar la distribución
          console.log(`🔍 [DEBUG] Agregando distribución:`, newDistribution);
          liquidity.distributions.push(newDistribution);

          // Actualizar totales
          liquidity.distributedLiquidity = liquidity.distributions
            .filter((d: any) => d.isActive)
            .reduce((sum: number, d: any) => sum + d.allocatedAmount, 0);
          
          liquidity.availableLiquidity = liquidity.totalLiquidity - liquidity.distributedLiquidity;

          console.log(`🔍 [DEBUG] Totales actualizados:`, {
            totalLiquidity: liquidity.totalLiquidity,
            distributedLiquidity: liquidity.distributedLiquidity,
            availableLiquidity: liquidity.availableLiquidity
          });

          // Guardar cambios
          await liquidity.save();
          console.log(`🔍 [DEBUG] Liquidez guardada exitosamente`);

          console.log(`✅ Distribución de liquidez creada automáticamente:`, {
            alertId: newAlert._id.toString(),
            symbol: symbol.toUpperCase(),
            percentage: liquidityPercentage,
            amount: liquidityAmount,
            shares: shares,
            pool: pool
          });
        } else {
          console.log(`⚠️ Ya existe una distribución para la alerta ${newAlert._id}`);
        }

      } catch (liquidityError) {
        console.error('❌ Error al crear distribución de liquidez automática:', liquidityError);
        // No fallar la creación de la alerta si la distribución de liquidez falla
        // Solo registrar el error
      }
    }

    // 🔔 Crear notificación automática (email a suscriptores)
    try {
      // Preparar parámetros para la notificación según el tipo de alerta
      const notificationParams: any = {
        message: emailMessage,
        imageUrl: emailImageUrl || newAlert?.chartImage?.secure_url || newAlert?.chartImage?.url || undefined
      };

      // Si es alerta de rango, pasar priceRange; si no, pasar price
      if (tipoAlerta === 'rango' && newAlert.entryPriceRange) {
        notificationParams.priceRange = {
          min: newAlert.entryPriceRange.min,
          max: newAlert.entryPriceRange.max
        };
      } else if (tipoAlerta === 'precio') {
        notificationParams.price = typeof newAlert.entryPrice === 'number' 
          ? newAlert.entryPrice 
          : (typeof newAlert.currentPrice === 'number' ? newAlert.currentPrice : undefined);
      }

      // ✅ NUEVO: Pasar el porcentaje de liquidez si está disponible (solo para alertas de compra)
      if (liquidityPercentage > 0 && newAlert.action === 'BUY') {
        notificationParams.liquidityPercentage = liquidityPercentage;
      }

      await createAlertNotification(newAlert, notificationParams);
      console.log('✅ Notificación automática enviada para alerta:', newAlert._id);
    } catch (notificationError) {
      console.error('❌ Error al enviar notificación automática:', notificationError);
      // No fallar la creación de la alerta si la notificación falla
    }

    // Formatear la respuesta para el frontend - con validación de números
    const alertResponse = {
      id: newAlert._id.toString(),
      symbol: newAlert.symbol,
      action: newAlert.action,
      entryPrice: newAlert.entryPrice ? `$${Number(newAlert.entryPrice).toFixed(2)}` : null,
      currentPrice: `$${Number(newAlert.currentPrice || 0).toFixed(2)}`,
      stopLoss: `$${Number(newAlert.stopLoss || 0).toFixed(2)}`,
      takeProfit: `$${Number(newAlert.takeProfit || 0).toFixed(2)}`,
      profit: `${Number(newAlert.profit || 0) >= 0 ? '+' : ''}${Number(newAlert.profit || 0).toFixed(1)}%`,
      status: newAlert.status,
      date: newAlert.date ? newAlert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      analysis: newAlert.analysis || '',
      // ✅ NUEVO: Campos para alertas de rango
      tipoAlerta: newAlert.tipoAlerta,
      precioMinimo: newAlert.precioMinimo ? `$${Number(newAlert.precioMinimo).toFixed(2)}` : null,
      precioMaximo: newAlert.precioMaximo ? `$${Number(newAlert.precioMaximo).toFixed(2)}` : null,
      horarioCierre: newAlert.horarioCierre
    };

    // TODO: Enviar notificación a todos los suscriptores (opcional)

    return res.status(201).json({
      success: true,
      message: 'Alerta creada exitosamente',
      alert: alertResponse
    });

  } catch (error) {
    console.error('Error al crear alerta:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudo crear la alerta'
    });
  }
}

/**
 * ✅ NUEVO: Obtener precio actual de una acción usando la API correcta (Yahoo Finance)
 */
async function fetchCorrectStockPrice(symbol: string): Promise<number | null> {
  try {
    // Usar la misma API que funciona correctamente en /api/stock-price
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Error al obtener datos de Yahoo Finance');
    }

    const data = await response.json();

    if (data.chart?.result?.[0]?.meta?.regularMarketPrice) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      console.log(`✅ Yahoo Finance - ${symbol}: $${price}`);
      return price;
    } else {
      // Si Yahoo Finance falla, usar precio simulado
      console.log(`⚠️ Yahoo Finance no disponible para ${symbol}, usando precio simulado`);
      return generateSimulatedPrice(symbol);
    }

  } catch (error: any) {
    console.error(`❌ Error obteniendo precio desde Yahoo Finance para ${symbol}:`, error.message);
    // Fallback a precio simulado si Yahoo Finance falla
    console.log(`🔄 Usando precio simulado para ${symbol}`);
    return generateSimulatedPrice(symbol);
  }
}

/**
 * ✅ NUEVO: Obtener precio actual de una acción desde Google Finance (DEPRECATED - usar fetchCorrectStockPrice)
 */
async function fetchCurrentStockPrice(symbol: string): Promise<number | null> {
  try {
    // Usar Google Finance API
    const googleFinanceUrl = `https://www.google.com/finance/quote/${symbol}`;
    
    // Intentar obtener precio desde Google Finance
    const response = await fetch(googleFinanceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extraer precio del HTML de Google Finance
      const priceMatch = html.match(/"price":\s*"([^"]+)"/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ''));
        return isNaN(price) ? null : price;
      }
      
      // Fallback - buscar en diferentes formatos de Google Finance
      const alternativePriceMatch = html.match(/(\d+\.?\d*)\s*USD/);
      if (alternativePriceMatch) {
        const price = parseFloat(alternativePriceMatch[1]);
        return isNaN(price) ? null : price;
      }
    }
    
    // Si Google Finance falla, usar precio simulado como fallback
    console.log(`🔄 Google Finance no disponible para ${symbol}, usando precio simulado`);
    return generateSimulatedPrice(symbol);

  } catch (error: any) {
    console.error(`❌ Error obteniendo precio desde Google Finance para ${symbol}:`, error.message);
    
    // Fallback a precio simulado si Google Finance falla
    console.log(`🔄 Usando precio simulado para ${symbol}`);
    return generateSimulatedPrice(symbol);
  }
}

/**
 * ✅ NUEVO: Generar precio simulado para testing/fallback
 */
function generateSimulatedPrice(symbol: string): number {
  // Generar precio realista basado en el símbolo
  const basePrice = symbol.charCodeAt(0) * 10 + symbol.charCodeAt(1);
  const variation = (Math.random() - 0.5) * 0.1; // ±5% variación
  return Math.round((basePrice * (1 + variation)) * 100) / 100;
} 