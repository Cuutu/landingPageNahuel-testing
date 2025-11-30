import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/googleAuth";
import dbConnect from "@/lib/mongodb";
import Operation from "@/models/Operation";
import User from "@/models/User";
import Alert from "@/models/Alert";

interface CreateOperationRequest {
  alertId?: string; // ✅ NUEVO: Opcional para operaciones manuales
  ticker?: string; // ✅ NUEVO: Ticker para operaciones sin alerta
  operationType: 'COMPRA' | 'VENTA';
  quantity: number;
  price: number;
  system: 'TraderCall' | 'SmartMoney';
  date?: string; // ✅ NUEVO: Fecha opcional
  isPartialSale?: boolean;
  partialSalePercentage?: number;
  originalQuantity?: number;
  portfolioPercentage?: number; // ✅ NUEVO: Porcentaje de la cartera para compras
  liquidityData?: {
    allocatedAmount: number;
    shares: number;
    entryPrice: number;
    realizedProfit?: number;
  };
  notes?: string;
  isManual?: boolean; // ✅ NUEVO: Flag para operaciones manuales
}

interface CreateOperationResponse {
  success: boolean;
  operation?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateOperationResponse>
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
      alertId,
      operationType,
      quantity,
      price,
      system,
      date, // ✅ NUEVO: Fecha opcional para operaciones manuales
      isPartialSale = false,
      partialSalePercentage,
      originalQuantity,
      portfolioPercentage, // ✅ NUEVO: Porcentaje de la cartera para compras
      liquidityData,
      notes,
      isManual = false // ✅ NUEVO: Flag para operaciones manuales
    }: CreateOperationRequest & { date?: string; isManual?: boolean } = req.body;

    // Validaciones
    // ✅ CORREGIDO: quantity es opcional si se proporciona portfolioPercentage
    const hasQuantity = quantity !== undefined && quantity !== null && quantity > 0;
    const hasPortfolioPercentage = portfolioPercentage !== undefined && portfolioPercentage !== null && portfolioPercentage > 0;
    
    if (!operationType || !price || !system) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos requeridos: operationType, price, system"
      });
    }
    
    // Validar que al menos uno de quantity o portfolioPercentage esté presente
    if (!hasQuantity && !hasPortfolioPercentage) {
      return res.status(400).json({
        success: false,
        error: "Debes proporcionar quantity (cantidad de acciones) o portfolioPercentage (porcentaje del portfolio)"
      });
    }

    // ✅ NUEVO: Para operaciones manuales, alertId es opcional
    if (!isManual && !alertId) {
      return res.status(400).json({
        success: false,
        error: "alertId es requerido para operaciones automáticas"
      });
    }

    if (operationType !== 'COMPRA' && operationType !== 'VENTA') {
      return res.status(400).json({
        success: false,
        error: "operationType debe ser 'COMPRA' o 'VENTA'"
      });
    }

    if (system !== 'TraderCall' && system !== 'SmartMoney') {
      return res.status(400).json({
        success: false,
        error: "system debe ser 'TraderCall' o 'SmartMoney'"
      });
    }

    // ✅ NUEVO: Verificar alerta solo si se proporciona alertId
    let alert = null;
    let alertSymbol = '';
    
    if (alertId) {
      alert = await Alert.findById(alertId);
      if (!alert) {
        return res.status(404).json({ success: false, error: "Alerta no encontrada" });
      }

      // Verificar que la alerta pertenece al sistema correcto
      if (alert.tipo !== system) {
        return res.status(400).json({
          success: false,
          error: `La alerta pertenece al sistema ${alert.tipo}, no a ${system}`
        });
      }
      alertSymbol = alert.symbol;
    } else if (isManual) {
      // Para operaciones manuales sin alerta, usar el ticker como alertSymbol
      alertSymbol = req.body.ticker || '';
    }

    // Obtener el balance actual del usuario para este sistema
    const currentBalanceDoc = await Operation.findOne({ createdBy: user._id, system })
      .sort({ date: -1 })
      .select('balance');
    let currentBalance = currentBalanceDoc?.balance || 0;

    // ✅ CORREGIDO: Si no hay balance previo (primera operación), obtener liquidez inicial del sistema
    if (currentBalance === 0 && hasPortfolioPercentage) {
      const Liquidity = (await import('@/models/Liquidity')).default;
      const liquidityDoc = await Liquidity.findOne({ createdBy: user._id, pool: system });
      
      if (liquidityDoc && liquidityDoc.totalLiquidity > 0) {
        currentBalance = liquidityDoc.totalLiquidity;
        console.log('📊 [CREATE OPERATION] Usando liquidez total como balance inicial:', {
          system,
          totalLiquidity: currentBalance
        });
      } else {
        return res.status(400).json({
          success: false,
          error: `No hay liquidez configurada para el sistema ${system}. Por favor, configura la liquidez inicial primero.`
        });
      }
    }

    // ✅ CORREGIDO: Calcular quantity si se proporciona portfolioPercentage
    let finalQuantity: number;
    
    if (hasPortfolioPercentage && !hasQuantity) {
      // Calcular cantidad de acciones basado en el porcentaje del portfolio
      // Ejemplo: Portfolio = $10000, Porcentaje = 10%, Precio = $100
      // -> Monto = $1000, Cantidad = 10 acciones
      const portfolioAmount = (currentBalance * portfolioPercentage!) / 100;
      finalQuantity = Math.floor(portfolioAmount / price); // Redondear hacia abajo para no exceder el monto
      
      console.log('📊 [CREATE OPERATION] Calculando quantity desde portfolioPercentage:', {
        currentBalance,
        portfolioPercentage,
        portfolioAmount,
        price,
        calculatedQuantity: finalQuantity
      });
      
      // Validar que se pueda comprar al menos 1 acción
      if (finalQuantity < 1) {
        return res.status(400).json({
          success: false,
          error: `El porcentaje del portfolio (${portfolioPercentage}%) no alcanza para comprar al menos 1 acción al precio de $${price}. Monto disponible: $${portfolioAmount.toFixed(2)}`
        });
      }
    } else if (hasQuantity) {
      // Usar la cantidad proporcionada
      finalQuantity = quantity!;
    } else {
      // Esto no debería pasar por la validación anterior, pero por seguridad
      return res.status(400).json({
        success: false,
        error: "No se pudo determinar la cantidad de acciones"
      });
    }

    // Calcular el nuevo balance
    let newBalance: number;
    if (operationType === 'COMPRA') {
      newBalance = currentBalance - (finalQuantity * price); // Restar el gasto
    } else {
      newBalance = currentBalance + (finalQuantity * price); // Sumar la venta
    }

    // ✅ NUEVO: Usar ticker del body si es operación manual, sino usar el de la alerta
    const ticker = isManual && req.body.ticker ? req.body.ticker.toUpperCase() : (alert?.symbol || alertSymbol);
    
    // ✅ NUEVO: Usar fecha proporcionada o fecha actual
    const operationDate = date ? new Date(date) : new Date();

    // Crear la operación
    const operation = new Operation({
      ticker: ticker,
      operationType,
      quantity: operationType === 'VENTA' ? -Math.abs(finalQuantity) : Math.abs(finalQuantity), // Negativo para ventas
      price,
      amount: finalQuantity * price,
      date: operationDate,
      balance: newBalance,
      alertId: alert?._id || null, // ✅ NUEVO: Permitir null para operaciones sin alerta
      alertSymbol: alertSymbol || ticker,
      system,
      createdBy: user._id,
      isPartialSale,
      partialSalePercentage,
      originalQuantity,
      portfolioPercentage, // ✅ NUEVO: Porcentaje de la cartera para compras
      liquidityData,
      executedBy: session.user.email,
      executionMethod: isManual ? 'MANUAL' : 'ADMIN',
      notes: notes || (isManual ? 'Operación manual registrada' : '')
    });

    await operation.save();

    console.log(`✅ Operación ${operationType} creada:`, {
      ticker: operation.ticker,
      quantity: operation.quantity,
      price: operation.price,
      amount: operation.amount,
      system: operation.system,
      balance: operation.balance
    });

    return res.status(201).json({
      success: true,
      operation: {
        _id: operation._id,
        ticker: operation.ticker,
        operationType: operation.operationType,
        quantity: operation.quantity,
        price: operation.price,
        amount: operation.amount,
        date: operation.date,
        balance: operation.balance,
        alertId: operation.alertId,
        alertSymbol: operation.alertSymbol,
        system: operation.system,
        isPartialSale: operation.isPartialSale,
        partialSalePercentage: operation.partialSalePercentage,
        originalQuantity: operation.originalQuantity,
        portfolioPercentage: operation.portfolioPercentage, // ✅ NUEVO: Porcentaje de la cartera
        liquidityData: operation.liquidityData,
        executedBy: operation.executedBy,
        executionMethod: operation.executionMethod,
        notes: operation.notes,
        createdAt: operation.createdAt
      }
    });

  } catch (error) {
    console.error("Error al crear operación:", error);
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
}
