import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Operation from "@/models/Operation";
import User from "@/models/User";
import Alert from "@/models/Alert";
import { validateOriginMiddleware } from "@/lib/securityValidation";
import { formatOperationNotes } from "@/lib/telegramBot";
import { getGlobalTimezone } from "@/lib/timeConfig";

interface CloudinaryImage {
  public_id: string;
  url: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  caption?: string;
  order?: number;
}

interface UpdateOperationRequest {
  operationId: string;
  ticker?: string;
  operationType?: 'COMPRA' | 'VENTA';
  quantity?: number;
  price?: number;
  date?: string;
  notes?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING';
  image?: CloudinaryImage | null;
  priceRange?: { min: number; max: number } | null;
  isPriceConfirmed?: boolean;
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
      status,
      image,
      priceRange,
      isPriceConfirmed
    }: UpdateOperationRequest = req.body;

    // Validaciones
    if (!operationId) {
      return res.status(400).json({
        success: false,
        error: "operationId es requerido"
      });
    }

    // Buscar la operación
    const operation = await Operation.findById(operationId).populate('alertId');
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
    if (date !== undefined) {
      // ✅ CORREGIDO: Crear fecha usando la zona horaria de la variable de entorno
      const nuevaFecha = (() => {
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const timezone = getGlobalTimezone();
          const [year, month, day] = date.split('-').map(Number);
          
          // Crear fecha a las 00:00:00 en la zona horaria configurada
          const yyyy = year;
          const mm = String(month).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          
          // Calcular offset de la TZ para esa fecha/hora
          const anchorUtc = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
          const utc = new Date(anchorUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
          const local = new Date(anchorUtc.toLocaleString('en-US', { timeZone: timezone }));
          const diffMinutes = Math.round((local.getTime() - utc.getTime()) / 60000);
          const sign = diffMinutes >= 0 ? '+' : '-';
          const abs = Math.abs(diffMinutes);
          const offH = String(Math.floor(abs / 60)).padStart(2, '0');
          const offM = String(abs % 60).padStart(2, '0');
          const offset = `${sign}${offH}:${offM}`;
          
          return new Date(`${yyyy}-${mm}-${dd}T00:00:00${offset}`);
        }
        return new Date(date);
      })();
      updateData.date = nuevaFecha;
    }
    
    // ✅ NUEVO: Si hay alerta asociada y no se proporcionaron notas personalizadas, regenerar automáticamente
    if (notes !== undefined) {
      updateData.notes = notes;
    } else if (operation.alertId && typeof operation.alertId === 'object') {
      // Si hay alerta y no se están actualizando las notas manualmente, regenerarlas
      const alert = operation.alertId as any;
      try {
        const finalPrice = price !== undefined ? price : operation.price;
        const finalPriceRange = priceRange !== undefined ? priceRange : operation.priceRange;
        const finalOperationType = operationType !== undefined ? operationType : operation.operationType;
        const finalPartialSalePercentage = operation.partialSalePercentage;
        
        updateData.notes = formatOperationNotes(alert, {
          price: finalPrice,
          priceRange: finalPriceRange,
          action: finalOperationType === 'COMPRA' ? 'BUY' : 'SELL',
          liquidityPercentage: operation.portfolioPercentage,
          soldPercentage: finalPartialSalePercentage,
          isExecutedSale: false,
          isCompleteSale: finalPartialSalePercentage ? (finalPartialSalePercentage >= 100) : false
        });
      } catch (error) {
        console.error('❌ Error regenerando notas automáticas:', error);
        // Si falla, mantener las notas existentes
      }
    }
    if (status !== undefined) {
      if (!['ACTIVE', 'COMPLETED', 'CANCELLED', 'PENDING'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "status debe ser 'ACTIVE', 'COMPLETED', 'CANCELLED' o 'PENDING'"
        });
      }
      updateData.status = status;
    }
    if (image !== undefined) {
      // Si image es null o undefined, eliminar la imagen; si es un objeto válido, actualizarla
      if (image === null || image === undefined) {
        // Usar $unset para eliminar el campo completamente
        if (!updateData.$unset) {
          updateData.$unset = {};
        }
        updateData.$unset.image = '';
      } else if (image && typeof image === 'object' && image.public_id && image.secure_url) {
        // Solo actualizar si es un objeto válido de Cloudinary
        updateData.image = image;
      }
    }
    if (priceRange !== undefined) {
      if (priceRange === null) {
        updateData.priceRange = null;
      } else {
        updateData.priceRange = priceRange;
      }
    }
    if (isPriceConfirmed !== undefined) {
      updateData.isPriceConfirmed = isPriceConfirmed;
    }

    // Recalcular amount si se actualizó quantity o price
    if (quantity !== undefined || price !== undefined) {
      const finalQuantity = quantity !== undefined ? Math.abs(quantity) : Math.abs(operation.quantity);
      const finalPrice = price !== undefined ? price : operation.price;
      updateData.amount = finalQuantity * finalPrice;
    }

    // Separar $unset del resto de campos
    const setData: any = {};
    const unsetData: any = {};
    
    Object.keys(updateData).forEach(key => {
      if (key === '$unset') {
        Object.assign(unsetData, updateData[key]);
      } else {
        setData[key] = updateData[key];
      }
    });

    // Construir el objeto de actualización
    const updateQuery: any = {};
    if (Object.keys(setData).length > 0) {
      updateQuery.$set = setData;
    }
    if (Object.keys(unsetData).length > 0) {
      updateQuery.$unset = unsetData;
    }

    // Actualizar la operación
    const updatedOperation = await Operation.findByIdAndUpdate(
      operationId,
      updateQuery,
      { new: true, runValidators: true }
    );

    console.log(`✅ Operación actualizada:`, {
      operationId,
      ticker: updatedOperation.ticker,
      status: updatedOperation.status,
      updatedFields: Object.keys(updateData),
      hasImage: !!updatedOperation.image,
      imagePublicId: updatedOperation.image?.public_id || 'N/A'
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
        image: updatedOperation.image,
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
