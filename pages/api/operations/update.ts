import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Operation from "@/models/Operation";
import User from "@/models/User";
import { validateOriginMiddleware } from "@/lib/securityValidation";

interface UpdateOperationRequest {
  operationId: string;
  ticker?: string;
  operationType?: 'COMPRA' | 'VENTA';
  quantity?: number;
  price?: number;
  date?: string;
  notes?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING';
}

interface UpdateOperationResponse {
  success: boolean;
  operation?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateOperationResponse>
) {
  if (req.method !== "PUT" && req.method !== "PATCH") {
    return res.status(405).json({ success: false, error: "Método no permitido" });
  }

  // 🔒 SEGURIDAD: Validar origen de la request
  if (!validateOriginMiddleware(req, res)) return;

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

    // 🔒 SEGURIDAD: Solo administradores pueden actualizar operaciones
    if (user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: "Permisos insuficientes. Solo los administradores pueden actualizar operaciones." 
      });
    }

    const {
      operationId,
      ticker,
      operationType,
      quantity,
      price,
      date,
      notes,
      status
    }: UpdateOperationRequest = req.body;

    // Validaciones
    if (!operationId) {
      return res.status(400).json({
        success: false,
        error: "operationId es requerido"
      });
    }

    // Buscar la operación
    const operation = await Operation.findById(operationId);
    if (!operation) {
      return res.status(404).json({ success: false, error: "Operación no encontrada" });
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: any = {};
    
    if (ticker !== undefined) updateData.ticker = ticker.toUpperCase();
    if (operationType !== undefined) {
      if (operationType !== 'COMPRA' && operationType !== 'VENTA') {
        return res.status(400).json({
          success: false,
          error: "operationType debe ser 'COMPRA' o 'VENTA'"
        });
      }
      updateData.operationType = operationType;
    }
    if (quantity !== undefined) {
      updateData.quantity = operationType === 'VENTA' 
        ? -Math.abs(quantity) 
        : Math.abs(quantity);
    }
    if (price !== undefined) updateData.price = price;
    if (date !== undefined) updateData.date = new Date(date);
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) {
      if (!['ACTIVE', 'COMPLETED', 'CANCELLED', 'PENDING'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "status debe ser 'ACTIVE', 'COMPLETED', 'CANCELLED' o 'PENDING'"
        });
      }
      updateData.status = status;
    }

    // Recalcular amount si se actualizó quantity o price
    if (quantity !== undefined || price !== undefined) {
      const finalQuantity = quantity !== undefined ? Math.abs(quantity) : Math.abs(operation.quantity);
      const finalPrice = price !== undefined ? price : operation.price;
      updateData.amount = finalQuantity * finalPrice;
    }

    // Actualizar la operación
    const updatedOperation = await Operation.findByIdAndUpdate(
      operationId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(`✅ Operación actualizada:`, {
      operationId,
      ticker: updatedOperation.ticker,
      status: updatedOperation.status,
      updatedFields: Object.keys(updateData)
    });

    return res.status(200).json({
      success: true,
      operation: {
        _id: updatedOperation._id,
        ticker: updatedOperation.ticker,
        operationType: updatedOperation.operationType,
        quantity: updatedOperation.quantity,
        price: updatedOperation.price,
        amount: updatedOperation.amount,
        date: updatedOperation.date,
        balance: updatedOperation.balance,
        alertId: updatedOperation.alertId,
        alertSymbol: updatedOperation.alertSymbol,
        system: updatedOperation.system,
        status: updatedOperation.status,
        notes: updatedOperation.notes,
        updatedAt: updatedOperation.updatedAt
      }
    });

  } catch (error) {
    console.error("Error al actualizar operación:", error);
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
}
