import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Operation from "@/models/Operation";
import User from "@/models/User";

interface ChangeStatusRequest {
  operationId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING';
  notes?: string; // Notas opcionales del cambio de estado
}

interface ChangeStatusResponse {
  success: boolean;
  operation?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChangeStatusResponse>
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

    const {
      operationId,
      status,
      notes
    }: ChangeStatusRequest = req.body;

    // Validaciones
    if (!operationId) {
      return res.status(400).json({
        success: false,
        error: "operationId es requerido"
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "status es requerido"
      });
    }

    if (!['ACTIVE', 'COMPLETED', 'CANCELLED', 'PENDING'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "status debe ser 'ACTIVE', 'COMPLETED', 'CANCELLED' o 'PENDING'"
      });
    }

    // Buscar la operación
    const operation = await Operation.findById(operationId);
    if (!operation) {
      return res.status(404).json({ success: false, error: "Operación no encontrada" });
    }

    const previousStatus = operation.status || 'ACTIVE';

    // Actualizar estado
    const updateData: any = { status };
    
    // Si hay notas, agregarlas o concatenarlas
    if (notes) {
      const statusNote = `[${new Date().toLocaleString('es-ES')}] Estado cambiado de ${previousStatus} a ${status} por ${session.user.email}: ${notes}`;
      updateData.notes = operation.notes 
        ? `${operation.notes}\n${statusNote}`
        : statusNote;
    }

    const updatedOperation = await Operation.findByIdAndUpdate(
      operationId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    console.log(`✅ Estado de operación actualizado:`, {
      operationId,
      ticker: updatedOperation.ticker,
      previousStatus,
      newStatus: status,
      changedBy: session.user.email
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
        status: updatedOperation.status,
        notes: updatedOperation.notes,
        updatedAt: updatedOperation.updatedAt
      }
    });

  } catch (error) {
    console.error("Error al cambiar estado de operación:", error);
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
}
