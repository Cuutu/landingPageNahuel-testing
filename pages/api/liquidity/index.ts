import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Liquidity from "@/models/Liquidity";
import User from "@/models/User";

interface LiquidityResponse {
  success: boolean;
  liquidity?: any;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LiquidityResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
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
      return res.status(403).json({ success: false, error: "Permisos insuficientes. Solo los administradores pueden gestionar la liquidez." });
    }

    if (req.method === "GET") {
      const pool = (req.query.pool as string) as ("TraderCall" | "SmartMoney");
      if (!pool || !["TraderCall", "SmartMoney"].includes(pool)) {
        return res.status(400).json({ success: false, error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)" });
      }

      let liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
      if (!liquidity) {
        liquidity = await Liquidity.create({
          totalLiquidity: 0,
          availableLiquidity: 0,
          distributedLiquidity: 0,
          distributions: [],
          totalProfitLoss: 0,
          totalProfitLossPercentage: 0,
          createdBy: user._id,
          pool
        });
      }

      return res.status(200).json({
        success: true,
        liquidity: {
          id: liquidity._id.toString(),
          totalLiquidity: liquidity.totalLiquidity,
          availableLiquidity: liquidity.availableLiquidity,
          distributedLiquidity: liquidity.distributedLiquidity,
          distributions: liquidity.distributions,
          totalProfitLoss: liquidity.totalProfitLoss,
          totalProfitLossPercentage: liquidity.totalProfitLossPercentage,
          createdAt: liquidity.createdAt,
          updatedAt: liquidity.updatedAt,
          pool
        }
      });
    }

    if (req.method === "POST") {
      const { totalLiquidity, pool } = req.body || {};
      if (!pool || !["TraderCall", "SmartMoney"].includes(pool)) {
        return res.status(400).json({ success: false, error: "Parámetro 'pool' requerido (TraderCall|SmartMoney)" });
      }
      if (!totalLiquidity || totalLiquidity <= 0) {
        return res.status(400).json({ success: false, error: "La liquidez total debe ser mayor a 0" });
      }

      let liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
      if (liquidity) {
        // ✅ NUEVO: Cuando se actualiza el total desde admin, se PISA la liquidez inicial
        // El valor ingresado es la nueva liquidez inicial
        liquidity.initialLiquidity = totalLiquidity;
        
        // ✅ NUEVO: Recalcular totalLiquidity como inicial + ganancias/pérdidas actuales
        // Primero recalculamos las ganancias/pérdidas para tener el valor actualizado
        liquidity.recalculateDistributions();
        const currentProfitLoss = liquidity.totalProfitLoss || 0;
        
        // El total es la inicial más las ganancias/pérdidas
        liquidity.totalLiquidity = liquidity.initialLiquidity + currentProfitLoss;
        
        // Recalcular disponibilidad
        liquidity.availableLiquidity = liquidity.totalLiquidity - liquidity.distributedLiquidity;
        
        await liquidity.save();
      } else {
        liquidity = await Liquidity.create({
          initialLiquidity: totalLiquidity,  // ✅ NUEVO: Guardar liquidez inicial
          totalLiquidity,
          availableLiquidity: totalLiquidity,
          distributedLiquidity: 0,
          distributions: [],
          totalProfitLoss: 0,
          totalProfitLossPercentage: 0,
          createdBy: user._id,
          pool
        });
      }

      return res.status(200).json({
        success: true,
        liquidity: {
          id: liquidity._id.toString(),
          totalLiquidity: liquidity.totalLiquidity,
          availableLiquidity: liquidity.availableLiquidity,
          distributedLiquidity: liquidity.distributedLiquidity,
          distributions: liquidity.distributions,
          totalProfitLoss: liquidity.totalProfitLoss,
          totalProfitLossPercentage: liquidity.totalProfitLossPercentage,
          createdAt: liquidity.createdAt,
          updatedAt: liquidity.updatedAt,
          pool
        },
        message: "Liquidez actualizada exitosamente"
      });
    }
  } catch (error) {
    console.error("Error al gestionar liquidez:", error);
    return res.status(500).json({ success: false, error: "Error interno del servidor", message: "No se pudo gestionar la liquidez" });
  }
} 