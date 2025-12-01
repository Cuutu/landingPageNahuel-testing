import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Operation from "@/models/Operation";
import User from "@/models/User";
import Alert from "@/models/Alert";

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

    // ✅ MEJORADO: Buscar operaciones por sistema/pool directamente
    // No dependemos de un usuario admin específico, solo del pool
    console.log(`🔍 [OPERATIONS LIST] Buscando operaciones para system: ${system}`);
    const operations = await Operation.find({ system })
      .sort({ date: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .populate('alertId', 'symbol action status profit availableForPurchase finalPriceSetAt descartadaAt date createdAt');
    console.log(`📊 [OPERATIONS LIST] Encontradas ${operations.length} operaciones para system: ${system}`);
    if (operations.length > 0) {
      console.log(`🔍 [OPERATIONS LIST] Primera operación:`, {
        _id: operations[0]._id,
        ticker: operations[0].ticker,
        system: operations[0].system,
        date: operations[0].date,
        operationType: operations[0].operationType
      });
    }

    // ✅ MEJORADO: Obtener información de alertas que no se populan correctamente
    // Esto puede pasar si la alerta fue eliminada o si el populate falla
    const operationsWithAlerts = await Promise.all(
      operations.map(async (op) => {
        let alertData = null;

        // Si el populate funcionó y alertId es un objeto
        if (op.alertId && typeof op.alertId === 'object' && op.alertId._id) {
          alertData = {
            status: op.alertId.status,
            availableForPurchase: op.alertId.availableForPurchase,
            finalPriceSetAt: op.alertId.finalPriceSetAt,
            descartadaAt: op.alertId.descartadaAt,
            date: op.alertId.date,
            createdAt: op.alertId.createdAt
          };
        } 
        // Si alertId es un string (ObjectId), intentar buscar la alerta manualmente
        else if (op.alertId) {
          try {
            const alertIdString = typeof op.alertId === 'string' ? op.alertId : op.alertId.toString();
            const alert = await Alert.findById(alertIdString).select('status availableForPurchase finalPriceSetAt descartadaAt date createdAt');
            
            if (alert) {
              alertData = {
                status: alert.status,
                availableForPurchase: alert.availableForPurchase,
                finalPriceSetAt: alert.finalPriceSetAt,
                descartadaAt: alert.descartadaAt,
                date: alert.date,
                createdAt: alert.createdAt
              };
            } else {
              console.warn(`⚠️ Alerta no encontrada para operación ${op._id}, alertId: ${alertIdString}`);
            }
          } catch (error) {
            console.error(`❌ Error buscando alerta para operación ${op._id}:`, error);
          }
        }

        return {
          operation: op,
          alertData
        };
      })
    );

    // ✅ MEJORADO: Obtener resumen por sistema/pool
    const summary = await Operation.aggregate([
      { $match: { system } },
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

    // ✅ MEJORADO: Obtener balance actual del sistema/pool
    const currentBalanceDoc = await Operation.findOne({ system })
      .sort({ date: -1 })
      .select('balance');

    // ✅ MEJORADO: Contar total de operaciones del sistema/pool
    const total = await Operation.countDocuments({ system });

    return res.status(200).json({
      success: true,
      operations: operationsWithAlerts.map(({ operation: op, alertData }) => ({
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
        status: op.status, // ✅ NUEVO: Estado de la operación
        createdAt: op.createdAt,
        // ✅ MEJORADO: Información de la alerta para determinar el estado
        alert: alertData
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
