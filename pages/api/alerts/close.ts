/**
 * API para cerrar posiciones de alertas de trading
 * Solo los administradores pueden cerrar posiciones
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';

interface ClosePositionRequest {
  alertId: string;
  currentPrice: number;
  reason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL';
  emailMessage?: string;
  emailImageUrl?: string;
}

interface ClosePositionResponse {
  success?: boolean;
  message?: string;
  error?: string;
  alert?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClosePositionResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación - CORREGIDO para Next.js 14
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      console.log('❌ No hay sesión válida');
      return res.status(401).json({ error: 'No autorizado - Sesión inválida' });
    }

    console.log('🔐 Usuario autenticado:', session.user.email);

    // Conectar a la base de datos
    await dbConnect();

    // Obtener información del usuario y verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      console.log('❌ Usuario no encontrado en BD:', session.user.email);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    console.log('👤 Usuario encontrado, rol:', user.role);

    // NUEVA RESTRICCIÓN: Solo administradores pueden cerrar posiciones
    if (user.role !== 'admin') {
      console.log('❌ Usuario no es admin:', session.user.email, 'Rol:', user.role);
      return res.status(403).json({ 
        error: 'Permisos insuficientes. Solo los administradores pueden cerrar posiciones.',
        message: 'No tienes permisos para cerrar posiciones'
      });
    }

    // Validar datos de entrada
    const { alertId, currentPrice, reason = 'MANUAL', emailMessage, emailImageUrl }: ClosePositionRequest = req.body;

    if (!alertId || !currentPrice) {
      console.log('❌ Datos inválidos:', { alertId, currentPrice });
      return res.status(400).json({ error: 'alertId y currentPrice son requeridos' });
    }

    if (currentPrice <= 0) {
      console.log('❌ Precio inválido:', currentPrice);
      return res.status(400).json({ error: 'El precio actual debe ser mayor a 0' });
    }

    console.log('🔍 Buscando alerta:', alertId);

    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    
    if (!alert) {
      console.log('❌ Alerta no encontrada:', alertId);
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    if (alert.status !== 'ACTIVE') {
      console.log('❌ Alerta no está activa:', alertId, 'Status:', alert.status);
      return res.status(400).json({ error: 'La alerta ya no está activa' });
    }

    console.log('✅ Alerta encontrada y válida:', {
      symbol: alert.symbol,
      action: alert.action,
      entryPrice: alert.entryPrice,
      currentPrice: alert.currentPrice
    });

    // Calcular profit final - CORREGIDO para manejar entryPrice undefined
    let finalProfit = 0;
    
    // ✅ CORREGIDO: Verificar que entryPrice sea válido antes de calcular
    if (alert.entryPrice && alert.entryPrice > 0) {
      if (alert.action === 'BUY') {
        finalProfit = ((currentPrice - alert.entryPrice) / alert.entryPrice) * 100;
      } else { // SELL
        finalProfit = ((alert.entryPrice - currentPrice) / alert.entryPrice) * 100;
      }
    } else {
      // Si no hay entryPrice válido, usar 0% de profit
      console.log('⚠️ EntryPrice no válido, usando 0% de profit:', {
        entryPrice: alert.entryPrice,
        currentPrice: currentPrice,
        symbol: alert.symbol
      });
      finalProfit = 0;
    }

    console.log('💰 Profit calculado:', finalProfit.toFixed(2) + '%');

    // Actualizar la alerta para cerrarla
    const updatedAlert = await Alert.findByIdAndUpdate(
      alertId,
      {
        status: 'CLOSED',
        currentPrice: currentPrice,
        exitPrice: currentPrice,
        exitDate: new Date(),
        exitReason: reason,
        profit: finalProfit
      },
      { new: true }
    );

    console.log('✅ Posición cerrada por usuario:', user.name || user.email, alertId);

    // ✅ NUEVO: Registrar operación de venta SIEMPRE, incluso sin liquidez
    try {
      const OperationModule = await import('@/models/Operation');
      const Operation = OperationModule.default;
      
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
      const adminUser = await User.findOne({ email: ADMIN_EMAIL });
      
      if (!adminUser) {
        console.error('⚠️ No se encontró el usuario admin con email', ADMIN_EMAIL);
      } else {
        const pool = updatedAlert?.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        
        // Buscar la operación de compra original
        const buyOperation = await Operation.findOne({ 
          alertId: alertId, 
          operationType: 'COMPRA',
          system: pool
        }).sort({ date: -1 });
        
        // Si hay liquidez, usar valores reales; si no, usar valores estimados de la compra original
        let operationQuantity = 0;
        let operationAmount = 0;
        let realizedProfit = 0;
        let entryPrice = updatedAlert?.entryPrice || currentPrice;
        
        if (buyOperation && buyOperation.quantity) {
          operationQuantity = Math.abs(buyOperation.quantity);
          operationAmount = operationQuantity * currentPrice;
          if (buyOperation.price) {
            realizedProfit = (currentPrice - buyOperation.price) * operationQuantity;
          }
          entryPrice = buyOperation.price || entryPrice;
        } else {
          // Si no hay operación de compra, usar valores estimados (1 acción)
          operationQuantity = 1;
          operationAmount = currentPrice;
          entryPrice = updatedAlert?.entryPrice || currentPrice;
        }
        
        // Obtener balance actual del admin para este sistema
        const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: pool })
          .sort({ date: -1 })
          .select('balance');
        const currentBalance = currentBalanceDoc?.balance || 0;
        const newBalance = currentBalance + operationAmount;

        const operation = new Operation({
          ticker: updatedAlert?.symbol.toUpperCase() || 'UNKNOWN',
          operationType: 'VENTA',
          quantity: -operationQuantity, // Negativo para ventas
          price: currentPrice,
          amount: operationAmount,
          date: new Date(),
          balance: newBalance,
          alertId: alertId,
          alertSymbol: updatedAlert?.symbol.toUpperCase() || 'UNKNOWN',
          system: pool,
          createdBy: adminUser._id,
          isPartialSale: false,
          portfolioPercentage: buyOperation?.portfolioPercentage,
          liquidityData: buyOperation?.liquidityData ? {
            allocatedAmount: 0,
            shares: 0,
            entryPrice: entryPrice,
            realizedProfit: realizedProfit
          } : undefined,
          executedBy: user.email,
          executionMethod: 'MANUAL',
          notes: `Cierre manual de alerta - ${updatedAlert?.symbol} - Razón: ${reason}`
        });

        await operation.save();
        console.log(`✅ Operación de cierre registrada: ${updatedAlert?.symbol} - ${operationQuantity} acciones por $${currentPrice}`);
      }
    } catch (operationError) {
      console.error('⚠️ Error registrando operación de cierre:', operationError);
      // No fallar el cierre por un error en la operación
    }

    // Integrar con Liquidez: vender acciones asignadas y devolver efectivo
    try {
      // ✅ CORREGIDO: Buscar liquidez por pool específico
      const pool = updatedAlert?.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
      const liquidity = await Liquidity.findOne({ 
        createdBy: user._id, 
        pool: pool 
      });
      
      if (liquidity) {
        const dist = liquidity.distributions.find((d: any) => d.alertId === alertId);
        if (dist && dist.shares > 0) {
          // ✅ CORREGIDO: Vender todas las acciones y devolver efectivo a liquidez disponible
          const { realized, returnedCash, remainingShares } = liquidity.sellShares(alertId, dist.shares, currentPrice);
          
          // ✅ CORREGIDO: Si se vendieron todas las acciones, remover la distribución
          if (remainingShares === 0) {
            liquidity.removeDistribution(alertId);
          }
          
          await liquidity.save();
          console.log('💧 Liquidez actualizada por cierre de alerta:', {
            alertId,
            symbol: updatedAlert?.symbol,
            pool: pool,
            sharesSold: dist.shares,
            returnedCash: returnedCash,
            realizedProfit: realized,
            remainingShares: remainingShares
          });
        } else {
          console.log('ℹ️ No hay distribución de liquidez para esta alerta:', alertId);
        }
      } else {
        console.log('ℹ️ No se encontró liquidez para el pool:', pool);
      }
    } catch (liqErr) {
      console.error('❌ Error actualizando liquidez al cerrar alerta:', liqErr);
    }

    // 🔔 Enviar notificación de cierre a suscriptores
    try {
      const { createAlertNotification } = await import('@/lib/notificationUtils');
      await createAlertNotification(updatedAlert as any, {
        message: emailMessage || `Cierre de posición en ${updatedAlert?.symbol} a $${currentPrice}. Resultado: ${finalProfit.toFixed(1)}%`,
        imageUrl: emailImageUrl,
        price: currentPrice,
        liquidityPercentage: updatedAlert?.liquidityPercentage || 0
      });
    } catch (notifyErr) {
      console.error('❌ Error enviando notificación de cierre:', notifyErr);
    }

    // Formatear la respuesta para el frontend - con validación de números
    const alertResponse = {
      id: updatedAlert._id.toString(),
      symbol: updatedAlert.symbol,
      action: updatedAlert.action,
      entryPrice: `$${Number(updatedAlert.entryPrice || 0).toFixed(2)}`,
      exitPrice: `$${Number(updatedAlert.exitPrice || 0).toFixed(2)}`,
      stopLoss: `$${Number(updatedAlert.stopLoss || 0).toFixed(2)}`,
      takeProfit: `$${Number(updatedAlert.takeProfit || 0).toFixed(2)}`,
      profit: `${Number(updatedAlert.profit || 0) >= 0 ? '+' : ''}${Number(updatedAlert.profit || 0).toFixed(1)}%`,
      status: updatedAlert.status,
      date: updatedAlert.date ? updatedAlert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      exitDate: updatedAlert.exitDate ? updatedAlert.exitDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      exitReason: updatedAlert.exitReason,
      analysis: updatedAlert.analysis || ''
    };

    // TODO: Enviar notificación a todos los suscriptores (opcional)

    return res.status(200).json({
      success: true,
      message: 'Posición cerrada exitosamente',
      alert: alertResponse
    });

  } catch (error) {
    console.error('❌ Error al cerrar posición:', error);
    
    // Log más detallado del error
    if (error instanceof Error) {
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudo cerrar la posición. Por favor, intenta nuevamente.'
    });
  }
} 