/**
 * API para editar alertas completas (solo administradores)
 * PUT: Editar una alerta existente
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';
import { createAlertNotification } from '@/lib/notificationUtils';

interface EditAlertRequest {
  alertId: string;
  symbol?: string;
  action?: 'BUY' | 'SELL';
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  analysis?: string;
  availableForPurchase?: boolean;
  reason?: string;
  // ✅ NUEVO: Campos para liquidez y venta rápida
  liquidityPercentage?: number;
  liquidityAmount?: number;
  quickSellPercentage?: number;
}

interface AlertResponse {
  success?: boolean;
  alert?: any;
  error?: string;
  message?: string;
  changes?: any;
  currentStatus?: string;
  audit?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlertResponse>
) {
  if (req.method !== 'PUT') {
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

    // Verificar que sea administrador
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Permisos insuficientes. Solo los administradores pueden editar alertas.'
      });
    }

    // Validar datos de entrada
    const { 
      alertId, 
      symbol, 
      action, 
      entryPrice, 
      stopLoss, 
      takeProfit, 
      analysis, 
      availableForPurchase, 
      reason,
      // ✅ NUEVO: Parámetros de liquidez y venta rápida
      liquidityPercentage,
      liquidityAmount,
      quickSellPercentage
    }: EditAlertRequest = req.body;

    if (!alertId) {
      return res.status(400).json({ error: 'alertId es requerido' });
    }

    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que la alerta esté activa
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Solo se pueden editar alertas activas',
        currentStatus: alert.status
      });
    }

    // Registrar cambios para auditoría
    const changes: any = {};
    const oldValues: any = {};

    // Validar y registrar cambios
    if (symbol !== undefined && symbol !== alert.symbol) {
      if (!symbol.trim()) {
        return res.status(400).json({ error: 'El símbolo no puede estar vacío' });
      }
      oldValues.symbol = alert.symbol;
      changes.symbol = symbol.toUpperCase().trim();
    }

    if (action !== undefined && action !== alert.action) {
      if (!['BUY', 'SELL'].includes(action)) {
        return res.status(400).json({ error: 'Acción debe ser BUY o SELL' });
      }
      oldValues.action = alert.action;
      changes.action = action;
    }

    // ✅ CORREGIDO: Para alertas de rango, entryPrice es opcional
    // Solo validar entryPrice si la alerta NO es de tipo rango, o si se está enviando explícitamente
    const isRangeAlert = alert.tipoAlerta === 'rango' || alert.precioMinimo || alert.precioMaximo;
    
    if (entryPrice !== undefined && entryPrice !== alert.entryPrice) {
      // Para alertas de rango, entryPrice puede ser opcional o 0
      if (!isRangeAlert && (isNaN(entryPrice) || entryPrice <= 0)) {
        return res.status(400).json({ error: 'El precio de entrada debe ser mayor a 0' });
      }
      
      // Si es alerta de rango y entryPrice es válido o 0, permitir el cambio
      if (isRangeAlert && (isNaN(entryPrice) || entryPrice < 0)) {
        return res.status(400).json({ error: 'El precio de entrada no puede ser negativo' });
      }
      
      // Solo actualizar si el valor es válido
      if (!isNaN(entryPrice) && entryPrice >= 0) {
        oldValues.entryPrice = alert.entryPrice;
        changes.entryPrice = entryPrice;
        // Solo actualizar currentPrice si entryPrice es mayor a 0
        if (entryPrice > 0) {
          changes.currentPrice = entryPrice; // Actualizar precio actual también
        }
      }
    }

    if (stopLoss !== undefined && stopLoss !== alert.stopLoss) {
      if (stopLoss <= 0) {
        return res.status(400).json({ error: 'El stop loss debe ser mayor a 0' });
      }
      oldValues.stopLoss = alert.stopLoss;
      changes.stopLoss = stopLoss;
    }

    if (takeProfit !== undefined && takeProfit !== alert.takeProfit) {
      if (takeProfit <= 0) {
        return res.status(400).json({ error: 'El take profit debe ser mayor a 0' });
      }
      oldValues.takeProfit = alert.takeProfit;
      changes.takeProfit = takeProfit;
    }

    if (analysis !== undefined && analysis !== alert.analysis) {
      oldValues.analysis = alert.analysis;
      changes.analysis = analysis;
    }

    if (availableForPurchase !== undefined && availableForPurchase !== alert.availableForPurchase) {
      oldValues.availableForPurchase = alert.availableForPurchase;
      changes.availableForPurchase = availableForPurchase;
    }

    // Verificar que haya al menos un cambio
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No se detectaron cambios en la alerta' });
    }

    // Obtener información del cliente para auditoría
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log('🔧 Editando alerta completa:', {
      alertId,
      symbol: alert.symbol,
      changes,
      oldValues,
      adminUser: user.email,
      reason: reason || 'Edición por administrador',
      clientIP,
      userAgent
    });

    // Aplicar cambios a la alerta
    Object.assign(alert, changes);

    // Si cambió el precio de entrada, recalcular profit
    if (changes.entryPrice || changes.currentPrice) {
      alert.calculateProfit();
    }

    // Registrar el cambio en el historial si cambió el precio actual
    if (changes.currentPrice) {
      alert.recordPriceChange(
        user._id,
        changes.currentPrice,
        reason || 'Edición completa de alerta por administrador',
        clientIP.toString(),
        userAgent
      );
    }

    // Agregar registro de edición general (si no es solo cambio de precio)
    if (Object.keys(changes).some(key => key !== 'currentPrice')) {
      alert.priceChangeHistory.push({
        changedBy: user._id,
        changedAt: new Date(),
        oldPrice: alert.currentPrice,
        newPrice: alert.currentPrice, // No cambia el precio actual
        reason: `Edición general: ${Object.keys(changes).join(', ')}`,
        ipAddress: clientIP.toString(),
        userAgent
      });
    }

    // Guardar la alerta actualizada
    await alert.save();

    // ✅ NUEVO: Manejar asignación de liquidez
    if (liquidityPercentage !== undefined && liquidityPercentage > 0 && liquidityAmount && liquidityAmount > 0) {
      try {
        console.log(`💰 Asignando liquidez en edición: ${liquidityPercentage}% ($${liquidityAmount}) para ${alert.symbol}`);
        
        // Determinar el pool según el tipo de alerta
        const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        
        // Buscar liquidez existente
        let liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
        if (!liquidity) {
          // Si no existe, crear uno con liquidez por defecto
          liquidity = await Liquidity.create({
            totalLiquidity: liquidityAmount * (100 / liquidityPercentage),
            availableLiquidity: 0,
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
          (d: any) => d.alertId.toString() === alertId.toString()
        );

        if (!existingDistribution) {
          // ✅ CORREGIDO: Usar siempre el precio actual para asignación de liquidez
          // Esto asegura que el precio de entrada sea consistente con el precio actual del mercado
          const priceForShares = alert.currentPrice;
          
          console.log(`🔍 [DEBUG] Precios para asignación de liquidez en edición:`, {
            symbol: alert.symbol,
            entryPrice: alert.entryPrice,
            currentPrice: alert.currentPrice,
            priceForShares: priceForShares,
            liquidityAmount: liquidityAmount
          });
          
          const shares = Math.floor(liquidityAmount / priceForShares);

          const newDistribution = {
            alertId: alert._id,
            symbol: alert.symbol.toUpperCase(),
            percentage: liquidityPercentage,
            allocatedAmount: liquidityAmount,
            entryPrice: priceForShares,
            currentPrice: priceForShares,
            shares: shares,
            profitLoss: 0,
            profitLossPercentage: 0,
            realizedProfitLoss: 0,
            soldShares: 0,
            isActive: true,
            createdAt: new Date()
          };

          liquidity.distributions.push(newDistribution);
          liquidity.distributedLiquidity = liquidity.distributions
            .filter((d: any) => d.isActive)
            .reduce((sum: number, d: any) => sum + d.allocatedAmount, 0);
          liquidity.availableLiquidity = liquidity.totalLiquidity - liquidity.distributedLiquidity;

          await liquidity.save();
          console.log(`✅ Distribución de liquidez creada en edición:`, newDistribution);
        } else {
          console.log(`⚠️ Ya existe una distribución para la alerta ${alertId}`);
        }
      } catch (liquidityError) {
        console.error('❌ Error al asignar liquidez en edición:', liquidityError);
      }
    }

    // ✅ NUEVO: Manejar venta rápida
    if (quickSellPercentage !== undefined && quickSellPercentage > 0) {
      try {
        console.log(`⚡ Ejecutando venta rápida: ${quickSellPercentage}% para ${alert.symbol}`);
        
        const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        const liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
        
        if (liquidity) {
          const distribution = liquidity.distributions.find((d: any) => d.alertId.toString() === alertId.toString());
          
          if (distribution && distribution.shares > 0) {
            const sharesToSell = Math.floor(distribution.shares * (quickSellPercentage / 100));
            // ✅ CORREGIDO: Usar precio actual para venta rápida (no precio de entrada)
            const currentPrice = alert.currentPrice || alert.entryPrice;
            
            if (sharesToSell > 0) {
              // ✅ CORREGIDO: Para venta rápida, usar precio actual como precio de venta
              // Esto asegura que el P&L sea realista basado en el precio actual del mercado
              const { realized, returnedCash, remainingShares } = liquidity.sellShares(alertId, sharesToSell, currentPrice);
              
              if (remainingShares === 0) {
                liquidity.removeDistribution(alertId);
              }
              
              await liquidity.save();
              
              // ✅ CORREGIDO: Actualizar el precio actual de la alerta para reflejar el precio de venta
              // Esto asegura que el gráfico de torta muestre el precio correcto para el P&L
              alert.currentPrice = currentPrice;
              await alert.save();
              
              console.log(`✅ Venta rápida ejecutada:`, {
                alertId,
                symbol: alert.symbol,
                sharesSold: sharesToSell,
                returnedCash,
                realizedProfit: realized,
                remainingShares,
                updatedCurrentPrice: currentPrice
              });
            }
          } else {
            console.log(`⚠️ No hay distribución de liquidez para venta rápida en alerta ${alertId}`);
          }
        } else {
          console.log(`⚠️ No se encontró liquidez para venta rápida en pool ${pool}`);
        }
      } catch (quickSellError) {
        console.error('❌ Error en venta rápida:', quickSellError);
      }
    }

    // Obtener la alerta actualizada con el historial
    const updatedAlert = await Alert.findById(alertId).populate('priceChangeHistory.changedBy', 'email name');

    console.log('✅ Alerta editada exitosamente:', {
      alertId,
      symbol: alert.symbol,
      changes: Object.keys(changes),
      adminUser: user.email,
      timestamp: new Date().toISOString()
    });

    // Formatear la respuesta para el frontend
    const alertResponse = {
      id: updatedAlert._id.toString(),
      symbol: updatedAlert.symbol,
      action: updatedAlert.action,
      entryPrice: `$${Number(updatedAlert.entryPrice || 0).toFixed(2)}`,
      currentPrice: `$${Number(updatedAlert.currentPrice || 0).toFixed(2)}`,
      stopLoss: `$${Number(updatedAlert.stopLoss || 0).toFixed(2)}`,
      takeProfit: `$${Number(updatedAlert.takeProfit || 0).toFixed(2)}`,
      profit: `${Number(updatedAlert.profit || 0) >= 0 ? '+' : ''}${Number(updatedAlert.profit || 0).toFixed(1)}%`,
      status: updatedAlert.status,
      date: updatedAlert.date ? updatedAlert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      analysis: updatedAlert.analysis || '',
      availableForPurchase: updatedAlert.availableForPurchase || false,
      tipo: updatedAlert.tipo
    };

    return res.status(200).json({
      success: true,
      message: 'Alerta editada correctamente',
      alert: alertResponse,
      changes: {
        fields: Object.keys(changes),
        oldValues,
        newValues: changes,
        reason: reason || 'Edición por administrador'
      },
      audit: {
        editedBy: user.email,
        editedAt: new Date().toISOString(),
        reason: reason || 'Edición por administrador',
        clientIP: clientIP.toString(),
        userAgent
      }
    });

  } catch (error) {
    console.error('❌ Error al editar alerta:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo editar la alerta'
    });
  }
}
