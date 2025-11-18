import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Operation from "@/models/Operation";
import User from "@/models/User";

interface OperationsListResponse {
  success: boolean;
  operations?: any[];
  summary?: any;
  currentBalance?: number;
  total?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OperationsListResponse>
) {
  if (req.method !== "GET") {
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

    const { system, limit = 50, skip = 0 } = req.query;

    // Validar sistema
    if (!system || (system !== 'TraderCall' && system !== 'SmartMoney')) {
      return res.status(400).json({ 
        success: false, 
        error: "Sistema debe ser 'TraderCall' o 'SmartMoney'" 
      });
    }

    // ✅ CORREGIDO: Buscar el admin principal del sistema para obtener sus operaciones
    // Las operaciones son del pool global manejado por el admin, no individuales por usuario
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'franconahuelgomez2@gmail.com';
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });
    
    if (!adminUser) {
      console.warn(`⚠️ No se encontró el usuario admin con email ${ADMIN_EMAIL}`);
      // Si no hay admin, usar las operaciones del usuario actual (fallback)
      const operations = await Operation.find({ createdBy: user._id, system })
        .sort({ date: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string))
        .populate('alertId', 'symbol action status profit');

      return res.status(200).json({
        success: true,
        operations: [],
        summary: [],
        currentBalance: 0,
        total: 0
      });
    }

    // Obtener operaciones del admin (pool global)
    const operations = await Operation.find({ createdBy: adminUser._id, system })
      .sort({ date: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .populate('alertId', 'symbol action status profit availableForPurchase finalPriceSetAt descartadaAt date createdAt');

    // Obtener resumen
    const summary = await Operation.aggregate([
      { $match: { createdBy: adminUser._id, system } },
      {
        $group: {
          _id: '$ticker',
          totalOperations: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalAmount: { $sum: '$amount' },
          avgPrice: { $avg: '$price' },
          lastOperation: { $max: '$date' },
          firstOperation: { $min: '$date' }
        }
      },
      { $sort: { lastOperation: -1 } }
    ]);

    // Obtener balance actual
    const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system })
      .sort({ date: -1 })
      .select('balance');

    // Contar total de operaciones
    const total = await Operation.countDocuments({
      createdBy: adminUser._id,
      system
    });

    return res.status(200).json({
      success: true,
      operations: operations.map(op => ({
        _id: op._id,
        ticker: op.ticker,
        operationType: op.operationType,
        quantity: op.quantity,
        price: op.price,
        amount: op.amount,
        date: op.date,
        balance: op.balance,
        alertId: op.alertId,
        alertSymbol: op.alertSymbol,
        system: op.system,
        isPartialSale: op.isPartialSale,
        partialSalePercentage: op.partialSalePercentage,
        originalQuantity: op.originalQuantity,
        portfolioPercentage: op.portfolioPercentage, // ✅ Agregado: Porcentaje de la cartera
        liquidityData: op.liquidityData,
        executedBy: op.executedBy,
        executionMethod: op.executionMethod,
        notes: op.notes,
        createdAt: op.createdAt,
        // ✅ NUEVO: Información de la alerta para determinar el estado
        alert: op.alertId && typeof op.alertId === 'object' ? {
          status: op.alertId.status,
          availableForPurchase: op.alertId.availableForPurchase,
          finalPriceSetAt: op.alertId.finalPriceSetAt,
          descartadaAt: op.alertId.descartadaAt,
          date: op.alertId.date,
          createdAt: op.alertId.createdAt
        } : null
      })),
      summary,
      currentBalance: currentBalanceDoc?.balance || 0,
      total
    });

  } catch (error) {
    console.error("Error al obtener operaciones:", error);
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
}
