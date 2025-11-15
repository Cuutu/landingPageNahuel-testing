import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Liquidity from "@/models/Liquidity";
import Alert from "@/models/Alert";
import User from "@/models/User";

interface DistributeLiquidityRequest {
  alertId: string;
  percentage?: number;
  amount?: number;
  emailMessage?: string;
  emailImageUrl?: string;
}

interface DistributeLiquidityResponse {
  success: boolean;
  distribution?: any;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DistributeLiquidityResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ success: false, error: "Permisos insuficientes. Solo los administradores pueden distribuir liquidez." });
    }

    const { alertId, percentage, amount }: DistributeLiquidityRequest = req.body;

    if (!alertId) {
      return res.status(400).json({ success: false, error: "alertId es requerido" });
    }

    // ✅ CORREGIDO: Convertir alertId a string para asegurar consistencia
    const alertIdString = alertId.toString();

    if ((!percentage && !amount) || (percentage && percentage <= 0) || (amount && amount <= 0)) {
      return res.status(400).json({ success: false, error: "Debe especificar un porcentaje (>0) o un monto (>0)" });
    }

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, error: "Alerta no encontrada" });
    }

    if (alert.status !== "ACTIVE") {
      return res.status(400).json({ success: false, error: "Solo se puede distribuir liquidez en alertas activas" });
    }

    const pool = alert.tipo === "SmartMoney" ? "SmartMoney" : "TraderCall";

    let liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
    if (!liquidity) {
      return res.status(400).json({ success: false, error: `No hay liquidez configurada para el pool ${pool}. Configure la liquidez total primero.` });
    }

    const existingDistribution = liquidity.distributions.find((dist: any) => dist.alertId?.toString() === alertIdString);

    const entryPrice = alert.entryPriceRange?.max || alert.entryPrice;
    if (!entryPrice) {
      return res.status(400).json({ success: false, error: "La alerta no tiene precio de entrada válido" });
    }

    // ✅ NUEVO: Calcular porcentaje objetivo basado en liquidez TOTAL
    const targetPercentage = typeof amount === 'number' && amount > 0
      ? (amount / liquidity.totalLiquidity) * 100
      : (percentage as number);

    if (targetPercentage <= 0 || targetPercentage > 100) {
      return res.status(400).json({ success: false, error: "El porcentaje debe estar entre 0 y 100" });
    }

    if (existingDistribution) {
      // ✅ NUEVO: Verificar contra liquidez total, no disponible
      const requiredAmount = (liquidity.totalLiquidity * targetPercentage) / 100;
      if (requiredAmount > liquidity.totalLiquidity) {
        return res.status(400).json({ success: false, error: "No hay suficiente liquidez total para esta asignación" });
      }
      
      // ✅ NUEVO: Remover restricción de 100% total - permitir múltiples asignaciones
      const additionalShares = Math.floor(requiredAmount / entryPrice);
      const actualAllocatedAmount = additionalShares * entryPrice;

      existingDistribution.percentage += targetPercentage;
      existingDistribution.shares += additionalShares;
      existingDistribution.allocatedAmount += actualAllocatedAmount;
      existingDistribution.currentPrice = entryPrice;
      existingDistribution.isActive = true;
      existingDistribution.updatedAt = new Date();

      liquidity.availableLiquidity -= actualAllocatedAmount;
      liquidity.distributedLiquidity += actualAllocatedAmount;
      liquidity.recalculateDistributions();
      await liquidity.save();

      // ✅ NUEVO: Crear operación de compra cuando se incrementa una distribución existente
      try {
        const Operation = (await import('@/models/Operation')).default;
        
        // Obtener el balance actual del usuario para este sistema
        const currentBalanceDoc = await Operation.findOne({ createdBy: user._id, system: pool })
          .sort({ date: -1 })
          .select('balance');
        const currentBalance = currentBalanceDoc?.balance || 0;
        
        // Calcular el nuevo balance (restar el gasto de la compra adicional)
        const newBalance = currentBalance - actualAllocatedAmount;
        
        const operation = new Operation({
          ticker: alert.symbol,
          operationType: 'COMPRA',
          quantity: additionalShares,
          price: entryPrice,
          amount: actualAllocatedAmount,
          date: new Date(),
          balance: newBalance,
          alertId: alert._id,
          alertSymbol: alert.symbol,
          system: pool,
          createdBy: user._id,
          portfolioPercentage: targetPercentage, // ✅ NUEVO: Guardar el porcentaje de la cartera
          liquidityData: {
            allocatedAmount: actualAllocatedAmount,
            shares: additionalShares,
            entryPrice: entryPrice
          },
          executedBy: user.email,
          executionMethod: 'ADMIN',
          notes: `Compra adicional asignada - +${targetPercentage.toFixed(2)}% de la cartera`
        });
        
        await operation.save();
        console.log(`✅ Operación de compra adicional creada: ${alert.symbol} - ${additionalShares} acciones (+${targetPercentage.toFixed(2)}% de la cartera)`);
      } catch (operationError) {
        console.error('⚠️ Error creando operación de compra adicional:', operationError);
        // No fallar la distribución por un error en la operación
      }

      // 🔔 Notificar compra adicional/asignación incrementada a suscriptores
      try {
        const { notifyAlertSubscribers } = await import('@/lib/notificationUtils');
        const message = req.body?.emailMessage || `Compra adicional asignada en ${alert.symbol}: +${additionalShares} shares a $${entryPrice} (+${targetPercentage.toFixed(2)}% de la cartera, monto: $${actualAllocatedAmount.toFixed(2)}).`;
        const imageUrl = req.body?.emailImageUrl || undefined;
        await notifyAlertSubscribers(alert as any, { 
          message, 
          imageUrl, 
          price: entryPrice,
          action: 'BUY',
          liquidityPercentage: targetPercentage // ✅ NUEVO: Pasar el porcentaje de compra adicional
        });
        console.log('✅ Notificación de asignación incrementada enviada');
      } catch (notifyErr) {
        console.error('❌ Error enviando notificación de asignación incrementada:', notifyErr);
      }

      return res.status(200).json({
        success: true,
        distribution: {
          alertId: existingDistribution.alertId,
          symbol: existingDistribution.symbol,
          percentage: existingDistribution.percentage,
          allocatedAmount: existingDistribution.allocatedAmount,
          entryPrice: existingDistribution.entryPrice,
          shares: existingDistribution.shares,
          profitLoss: existingDistribution.profitLoss,
          profitLossPercentage: existingDistribution.profitLossPercentage,
          isActive: existingDistribution.isActive,
          createdAt: existingDistribution.createdAt
        },
        message: `Liquidez incrementada: +${targetPercentage.toFixed(2)}% de la cartera para ${alert.symbol}`
      });
    }

    const distribution = liquidity.addDistribution(alertIdString, alert.symbol, targetPercentage, entryPrice);
    await liquidity.save();

    // ✅ NUEVO: Crear operación de compra con el porcentaje de la cartera
    try {
      const Operation = (await import('@/models/Operation')).default;
      
      // Obtener el balance actual del usuario para este sistema
      const currentBalanceDoc = await Operation.findOne({ createdBy: user._id, system: pool })
        .sort({ date: -1 })
        .select('balance');
      const currentBalance = currentBalanceDoc?.balance || 0;
      
      // Calcular el nuevo balance (restar el gasto de la compra)
      const newBalance = currentBalance - distribution.allocatedAmount;
      
      const operation = new Operation({
        ticker: alert.symbol,
        operationType: 'COMPRA',
        quantity: distribution.shares,
        price: entryPrice,
        amount: distribution.allocatedAmount,
        date: new Date(),
        balance: newBalance,
        alertId: alert._id,
        alertSymbol: alert.symbol,
        system: pool,
        createdBy: user._id,
        portfolioPercentage: targetPercentage, // ✅ NUEVO: Guardar el porcentaje de la cartera
        liquidityData: {
          allocatedAmount: distribution.allocatedAmount,
          shares: distribution.shares,
          entryPrice: entryPrice
        },
        executedBy: user.email,
        executionMethod: 'ADMIN',
        notes: `Compra asignada - ${targetPercentage.toFixed(2)}% de la cartera`
      });
      
      await operation.save();
      console.log(`✅ Operación de compra creada: ${alert.symbol} - ${distribution.shares} acciones (${targetPercentage.toFixed(2)}% de la cartera)`);
    } catch (operationError) {
      console.error('⚠️ Error creando operación de compra:', operationError);
      // No fallar la distribución por un error en la operación
    }

    // 🔔 Notificar compra/asignación a suscriptores
    try {
      const { notifyAlertSubscribers } = await import('@/lib/notificationUtils');
      const allocatedAmount = distribution.allocatedAmount;
      const shares = distribution.shares;
      const message = req.body?.emailMessage || `Compra asignada en ${alert.symbol}: ${shares} shares a $${entryPrice} (${targetPercentage.toFixed(2)}% de la cartera, monto: $${allocatedAmount.toFixed(2)}).`;
      const imageUrl = req.body?.emailImageUrl || undefined;
      await notifyAlertSubscribers(alert as any, { 
        message, 
        imageUrl, 
        price: entryPrice,
        action: 'BUY',
        liquidityPercentage: targetPercentage // ✅ NUEVO: Pasar el porcentaje de compra
      });
      console.log('✅ Notificación de asignación enviada');
    } catch (notifyErr) {
      console.error('❌ Error enviando notificación de asignación:', notifyErr);
    }

    return res.status(200).json({
      success: true,
      distribution: {
        alertId: distribution.alertId,
        symbol: distribution.symbol,
        percentage: distribution.percentage,
        allocatedAmount: distribution.allocatedAmount,
        entryPrice: distribution.entryPrice,
        shares: distribution.shares,
        profitLoss: distribution.profitLoss,
        profitLossPercentage: distribution.profitLossPercentage,
        isActive: distribution.isActive,
        createdAt: distribution.createdAt
      },
      message: `Liquidez distribuida exitosamente: ${targetPercentage.toFixed(2)}% de la cartera para ${alert.symbol}`
    });

  } catch (error) {
    console.error("Error al distribuir liquidez:", error);
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message, message: "No se pudo distribuir la liquidez" });
    }
    return res.status(500).json({ success: false, error: "Error interno del servidor", message: "No se pudo distribuir la liquidez" });
  }
} 