import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Liquidity from "@/models/Liquidity";
import Alert from "@/models/Alert";
import User from "@/models/User";

interface DistributeLiquidityRequest {
  alertId: string;
  percentage: number;
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

    const { alertId, percentage }: DistributeLiquidityRequest = req.body;

    if (!alertId || !percentage) {
      return res.status(400).json({ success: false, error: "AlertId y percentage son requeridos" });
    }

    if (percentage <= 0 || percentage > 100) {
      return res.status(400).json({ success: false, error: "El porcentaje debe estar entre 0 y 100" });
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

    const existingDistribution = liquidity.distributions.find((dist: any) => dist.alertId === alertId);
    if (existingDistribution) {
      return res.status(400).json({ success: false, error: "Esta alerta ya tiene liquidez asignada" });
    }

    const entryPrice = alert.entryPriceRange?.max || alert.entryPrice;
    if (!entryPrice) {
      return res.status(400).json({ success: false, error: "La alerta no tiene precio de entrada válido" });
    }

    const distribution = liquidity.addDistribution(alertId, alert.symbol, percentage, entryPrice);
    await liquidity.save();

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
      message: `Liquidez distribuida exitosamente en ${pool}: ${percentage}% para ${alert.symbol}`
    });

  } catch (error) {
    console.error("Error al distribuir liquidez:", error);
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message, message: "No se pudo distribuir la liquidez" });
    }
    return res.status(500).json({ success: false, error: "Error interno del servidor", message: "No se pudo distribuir la liquidez" });
  }
} 