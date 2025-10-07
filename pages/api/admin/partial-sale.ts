import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Alert from '../../../models/Alert';
import User from '../../../models/User';
import Liquidity from '../../../models/Liquidity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Verificar si el usuario es admin directamente desde la base de datos
  let user;
  try {
    user = await User.findOne({ email: session.user.email });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado - Se requieren permisos de administrador' });
    }
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ error: 'Error verificando permisos' });
  }

  const { alertId, percentage, priceRange, currentPrice, tipo, emailMessage, emailImageUrl } = req.body;

  // Validar parámetros requeridos
  if (!alertId || !percentage || !tipo) {
    return res.status(400).json({ error: 'Faltan datos requeridos: alertId, percentage, tipo' });
  }

  // Validar porcentaje
  if (percentage < 1 || percentage > 100) {
    return res.status(400).json({ error: 'Porcentaje debe estar entre 1 y 100' });
  }

  // Determinar el precio a usar para la venta
  let sellPrice: number;
  
  if (priceRange && priceRange.min && priceRange.max) {
    // Usar el precio máximo del rango para la venta
    sellPrice = parseFloat(priceRange.max);
    console.log(`💰 Usando precio de rango: $${priceRange.min} - $${priceRange.max}, precio de venta: $${sellPrice}`);
  } else if (currentPrice) {
    // Fallback al precio actual si no hay rango
    sellPrice = typeof currentPrice === 'string' 
      ? parseFloat(currentPrice.replace('$', '')) 
      : currentPrice;
    console.log(`💰 Usando precio actual: $${sellPrice}`);
  } else {
    return res.status(400).json({ error: 'Se requiere priceRange o currentPrice' });
  }

  // Validar que el precio es válido
  if (isNaN(sellPrice) || sellPrice <= 0) {
    return res.status(400).json({ error: 'Precio de venta inválido' });
  }

  try {
    console.log(`💰 Ejecutando venta parcial de ${percentage}% para alerta:`, alertId);

    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que la alerta esté activa
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'La alerta no está activa' });
    }

    // Calcular los valores de la venta parcial
    // Manejar diferentes formatos de precio de entrada
    let entryPrice: number;
    if (typeof alert.entryPrice === 'string') {
      entryPrice = parseFloat(alert.entryPrice.replace('$', ''));
    } else if (typeof alert.entryPrice === 'number') {
      entryPrice = alert.entryPrice;
    } else {
      return res.status(400).json({ error: 'Precio de entrada inválido' });
    }

    // Validar que los precios son números válidos
    if (isNaN(entryPrice) || isNaN(sellPrice)) {
      return res.status(400).json({ error: 'Precios inválidos para el cálculo' });
    }
    
    // Calcular ganancia/pérdida por acción
    const profitPerShare = sellPrice - entryPrice;
    
    // Obtener información de liquidez actual
    const liquidityData = alert.liquidityData || {};
    let allocatedAmount = liquidityData.allocatedAmount || 0;
    let shares = liquidityData.shares || 0;
    
    // Si no hay liquidez asignada, buscar directamente en la base de datos
    if (allocatedAmount === 0 && shares === 0) {
      try {
        console.log(`🔍 Buscando liquidez para alerta ${alertId} (${alert.symbol}) en pool ${tipo}`);
        
        // Buscar directamente en la base de datos sin fetch interno
        const liquidity = await Liquidity.findOne({ 
          createdBy: user._id, 
          pool: tipo 
        });
        
        if (liquidity && liquidity.distributions) {
          // Buscar la distribución específica para esta alerta
          const alertDistribution = liquidity.distributions.find(
            (d: any) => d.alertId.toString() === alertId.toString()
          );
          
          if (alertDistribution) {
            allocatedAmount = alertDistribution.allocatedAmount || 0;
            // ✅ USAR ACCIONES CON DECIMALES para evitar pérdidas
            shares = allocatedAmount / entryPrice; // Sin Math.floor()
            
            console.log(`📊 Liquidez encontrada para alerta ${alertId} (${alert.symbol}): $${allocatedAmount}, ${shares.toFixed(4)} acciones calculadas`);
            console.log(`🔢 Cálculo: $${allocatedAmount} ÷ $${entryPrice} = ${shares.toFixed(4)} acciones`);
          } else {
            console.log(`⚠️ No se encontró distribución de liquidez para alerta ${alertId} (${alert.symbol})`);
            console.log(`📋 Distribuciones disponibles:`, liquidity.distributions.map((d: any) => ({ alertId: d.alertId, symbol: d.symbol })));
          }
        } else {
          console.log(`⚠️ No se encontró documento de liquidez para usuario ${user._id} en pool ${tipo}`);
        }
      } catch (error) {
        console.log('⚠️ Error obteniendo liquidez de la base de datos:', error);
      }
      
      // Si aún no hay liquidez, usar un monto por defecto basado en el precio
      if (allocatedAmount === 0) {
        allocatedAmount = 1000; // $1000 por defecto
        shares = allocatedAmount / entryPrice; // Sin Math.floor()
        console.log(`💡 Usando liquidez por defecto: $${allocatedAmount}, ${shares.toFixed(4)} acciones`);
      }
    }
    
    console.log(`📊 Liquidez para cálculo: $${allocatedAmount}, ${shares} acciones, precio entrada: $${entryPrice}`);
    
    // Validar que tenemos datos suficientes para el cálculo
    if (shares === 0) {
      return res.status(400).json({ error: 'No hay acciones suficientes para realizar venta parcial' });
    }
    
    // Calcular valores de la venta parcial CON DECIMALES
    const sharesToSell = shares * (percentage / 100); // Sin Math.floor()
    const sharesRemaining = shares - sharesToSell;
    const liquidityReleased = sharesToSell * sellPrice;
    const realizedProfit = sharesToSell * profitPerShare;
    
    console.log(`💰 Venta parcial ${percentage}%:`);
    console.log(`📊 Acciones totales: ${shares.toFixed(4)}`);
    console.log(`🔄 Acciones a vender: ${sharesToSell.toFixed(4)} (${percentage}%)`);
    console.log(`📈 Acciones restantes: ${sharesRemaining.toFixed(4)} (${100-percentage}%)`);
    console.log(`💵 Liquidez liberada: $${liquidityReleased.toFixed(2)}`);
    
    // Actualizar la alerta con los nuevos valores
    const newAllocatedAmount = sharesRemaining * entryPrice;
    
    alert.liquidityData = {
      ...liquidityData,
      allocatedAmount: newAllocatedAmount,
      shares: sharesRemaining,
      // Guardar el monto original para referencia
      originalAllocatedAmount: liquidityData.originalAllocatedAmount || allocatedAmount,
      originalShares: liquidityData.originalShares || (liquidityData.shares || shares),
      partialSales: [
        ...(liquidityData.partialSales || []),
        {
          date: new Date(),
          percentage: percentage,
          sharesToSell: sharesToSell,
          sellPrice: sellPrice,
          liquidityReleased: liquidityReleased,
          realizedProfit: realizedProfit,
          executedBy: session.user.email,
          priceRange: priceRange || null,
          emailMessage: emailMessage || null,
          emailImageUrl: emailImageUrl || null
        }
      ]
    };

    // Si se vendió todo (100% o situación similar), cerrar la alerta
    if (sharesRemaining <= 0) {
      alert.status = 'CLOSED';
      alert.exitPrice = sellPrice; // Usar el valor numérico, no el string
      alert.closedAt = new Date();
      alert.closedBy = session.user.email;
      alert.closeReason = 'Venta parcial completa';
    }

    await alert.save();

    // ✅ ACTUALIZAR EL SISTEMA DE LIQUIDEZ DIRECTAMENTE
    try {
      console.log(`🔄 Actualizando sistema de liquidez para ${tipo}...`);
      
      // Buscar directamente en la base de datos
      const liquidity = await Liquidity.findOne({ 
        createdBy: user._id, 
        pool: tipo 
      });
      
      if (liquidity && liquidity.distributions) {
        // Encontrar y actualizar la distribución correspondiente
        const distributionIndex = liquidity.distributions.findIndex(
          (d: any) => d.alertId.toString() === alertId.toString()
        );
        
        if (distributionIndex !== -1) {
          console.log(`📝 Actualizando distribución en índice ${distributionIndex}`);
          
          // Actualizar la distribución existente
          liquidity.distributions[distributionIndex].allocatedAmount = newAllocatedAmount;
          liquidity.distributions[distributionIndex].shares = sharesRemaining;
          
          // Actualizar la liquidez total disponible PRIMERO
          liquidity.totalLiquidity += liquidityReleased;
          
          // ✅ RECALCULAR EL PORCENTAJE basándose en la nueva liquidez total
          const newPercentage = liquidity.totalLiquidity > 0 
            ? (newAllocatedAmount / liquidity.totalLiquidity) * 100 
            : 0;
          
          liquidity.distributions[distributionIndex].percentage = Math.round(newPercentage * 100) / 100; // Redondear a 2 decimales
          
          console.log(`📊 Porcentaje recalculado: ${liquidity.distributions[distributionIndex].percentage}%`);
          console.log(`🔢 Cálculo: $${newAllocatedAmount} ÷ $${liquidity.totalLiquidity} × 100 = ${newPercentage.toFixed(2)}%`);
          
          // Si se cerró completamente, marcar como cerrada
          if (sharesRemaining <= 0) {
            liquidity.distributions[distributionIndex].status = 'CLOSED';
            liquidity.distributions[distributionIndex].closedAt = new Date();
          }
          
          // Guardar cambios directamente en la base de datos
          await liquidity.save();
          
          console.log(`✅ Sistema de liquidez actualizado: +$${liquidityReleased.toFixed(2)} liberados`);
          console.log(`💰 Nueva liquidez total: $${liquidity.totalLiquidity.toFixed(2)}`);
        } else {
          console.log(`⚠️ No se encontró distribución para actualizar (alertId: ${alertId})`);
        }
      } else {
        console.log(`⚠️ No se encontró documento de liquidez para actualizar`);
      }
    } catch (error) {
      console.log('⚠️ Error sincronizando con sistema de liquidez:', error);
    }

    // ✅ ENVIAR NOTIFICACIÓN POR EMAIL SI SE ESPECIFICÓ
    if (emailMessage || emailImageUrl) {
      try {
        console.log(`📧 Enviando notificación de venta parcial para alerta ${alert.symbol}...`);
        
        // Construir el mensaje de notificación
        const notificationMessage = emailMessage || 
          `Alerta de venta para ${alert.symbol} en el rango de $${priceRange?.min || sellPrice} a $${priceRange?.max || sellPrice}. ` +
          `Se vendió el ${percentage}% de la posición.`;
        
        // Crear notificación en la base de datos
        const notificationData = {
          title: `Venta Parcial - ${alert.symbol}`,
          message: notificationMessage,
          type: 'PARTIAL_SALE',
          priority: 'HIGH',
          targetUsers: [user._id],
          metadata: {
            alertId: alertId,
            symbol: alert.symbol,
            percentage: percentage,
            priceRange: priceRange,
            sellPrice: sellPrice,
            sharesToSell: sharesToSell,
            liquidityReleased: liquidityReleased,
            realizedProfit: realizedProfit,
            sharesRemaining: sharesRemaining
          },
          imageUrl: emailImageUrl || null
        };

        // Enviar notificación (esto podría ser una llamada a un endpoint de notificaciones)
        console.log(`📧 Notificación preparada:`, notificationData);
        
      } catch (emailError) {
        console.log('⚠️ Error enviando notificación por email:', emailError);
        // No fallar la operación por un error de email
      }
    }

    console.log(`✅ Venta parcial de ${percentage}% ejecutada exitosamente`);
    console.log(`💰 Liquidez liberada: $${liquidityReleased.toFixed(2)}`);
    console.log(`📊 Acciones restantes: ${sharesRemaining}`);
    console.log(`💵 Ganancia realizada: $${realizedProfit.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      message: `Venta parcial de ${percentage}% ejecutada exitosamente`,
      liquidityReleased: liquidityReleased,
      realizedProfit: realizedProfit,
      sharesRemaining: sharesRemaining,
      sharesToSell: sharesToSell,
      newAllocatedAmount: newAllocatedAmount,
      alertStatus: alert.status,
      priceRange: priceRange,
      sellPrice: sellPrice
    });

  } catch (error) {
    console.error('❌ Error ejecutando venta parcial:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
