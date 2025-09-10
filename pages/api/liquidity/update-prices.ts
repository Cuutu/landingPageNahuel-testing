import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Liquidity from "@/models/Liquidity";
import User from "@/models/User";

interface UpdatePricesResponse {
  success: boolean;
  updatedDistributions?: any[];
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdatePricesResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: "No autorizado" });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Obtener información del usuario y verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ 
        success: false,
        error: "Permisos insuficientes. Solo los administradores pueden actualizar precios." 
      });
    }

    // Buscar liquidez del admin
    const liquidity = await Liquidity.findOne({ createdBy: user._id });
    
    if (!liquidity) {
      return res.status(404).json({ success: false, error: "No hay liquidez configurada" });
    }

    if (liquidity.distributions.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No hay distribuciones para actualizar",
        updatedDistributions: []
      });
    }

    // Actualizar precios de todas las distribuciones activas
    const updatedDistributions = [];
    
    for (const distribution of liquidity.distributions) {
      if (distribution.isActive) {
        try {
          // Aquí podrías integrar con una API de precios en tiempo real
          // Por ahora, simulamos que el precio actual es el mismo que el de entrada
          // En una implementación real, obtendrías el precio actual de la API de mercado
          const currentPrice = distribution.currentPrice; // Mantener precio actual por ahora
          
          liquidity.updateDistribution(distribution.alertId, currentPrice);
          updatedDistributions.push({
            alertId: distribution.alertId,
            symbol: distribution.symbol,
            currentPrice: distribution.currentPrice,
            profitLoss: distribution.profitLoss,
            profitLossPercentage: distribution.profitLossPercentage
          });
        } catch (error) {
          console.error(`Error actualizando distribución ${distribution.alertId}:`, error);
        }
      }
    }

    // Guardar cambios
    await liquidity.save();

    console.log(`✅ Precios actualizados para ${updatedDistributions.length} distribuciones`);

    return res.status(200).json({
      success: true,
      updatedDistributions,
      message: `Precios actualizados para ${updatedDistributions.length} distribuciones`
    });

  } catch (error) {
    console.error("Error al actualizar precios:", error);
    return res.status(500).json({ 
      success: false,
      error: "Error interno del servidor",
      message: "No se pudo actualizar los precios"
    });
  }
}
