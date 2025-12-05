import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Alert from '../../../models/Alert';
import User from '../../../models/User';
import Operation from '../../../models/Operation';

/**
 * Endpoint temporal para crear operaciones de venta programada que faltan
 * DELETE después de usar
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  const { alertId } = req.body;

  if (!alertId) {
    return res.status(400).json({ error: 'alertId es requerido' });
  }

  try {
    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que tiene venta programada
    if (!alert.sellRangeMin || !alert.sellRangeMax) {
      return res.status(400).json({ error: 'La alerta no tiene rango de venta programado' });
    }

    // Verificar si ya existe una operación de venta para esta alerta
    const existingOperation = await Operation.findOne({
      alertId: alertId,
      operationType: 'VENTA'
    });

    if (existingOperation) {
      return res.status(400).json({ 
        error: 'Ya existe una operación de venta para esta alerta',
        operationId: existingOperation._id
      });
    }

    const tipo = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
    const entryPrice = alert.entryPrice || 0;
    const sellPrice = alert.currentPrice || ((alert.sellRangeMin + alert.sellRangeMax) / 2);
    
    // Obtener datos de liquidez
    const liquidityData = alert.liquidityData || {};
    const allocatedAmount = liquidityData.allocatedAmount || 50; // Default basado en logs
    const shares = allocatedAmount / entryPrice;
    
    // Calcular valores
    const lastPartialSale = liquidityData.partialSales?.[liquidityData.partialSales.length - 1];
    const percentage = lastPartialSale?.percentage || 100;
    const sharesToSell = lastPartialSale?.sharesToSell || shares;
    const liquidityReleased = sharesToSell * sellPrice;
    const realizedProfit = (sellPrice - entryPrice) * sharesToSell;

    // Buscar admin
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      return res.status(500).json({ error: 'No se encontró usuario admin' });
    }

    // Obtener balance actual
    const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: tipo })
      .sort({ date: -1 })
      .select('balance');
    const currentBalance = currentBalanceDoc?.balance || 0;

    // Crear la operación de venta programada
    const operation = new Operation({
      ticker: alert.symbol.toUpperCase(),
      operationType: 'VENTA',
      quantity: -sharesToSell,
      price: sellPrice,
      amount: liquidityReleased,
      date: lastPartialSale?.scheduledAt || new Date(),
      balance: currentBalance, // No modificar hasta que se ejecute
      alertId: alert._id,
      alertSymbol: alert.symbol.toUpperCase(),
      system: tipo,
      createdBy: adminUser._id,
      isPartialSale: percentage < 100,
      partialSalePercentage: percentage,
      originalQuantity: liquidityData.originalShares || shares,
      priceRange: {
        min: alert.sellRangeMin,
        max: alert.sellRangeMax
      },
      isPriceConfirmed: false, // A confirmar
      portfolioPercentage: 5, // Basado en los logs
      liquidityData: {
        allocatedAmount: allocatedAmount,
        shares: shares,
        entryPrice: entryPrice,
        realizedProfit: realizedProfit
      },
      executedBy: lastPartialSale?.executedBy || session.user.email,
      executionMethod: 'ADMIN',
      notes: `Venta programada (${percentage}%) - ${alert.symbol} - Rango: $${alert.sellRangeMin} - $${alert.sellRangeMax} [CREADA RETROACTIVAMENTE]`
    });

    await operation.save();

    console.log(`✅ Operación de venta programada creada retroactivamente: ${alert.symbol}`);

    return res.status(200).json({
      success: true,
      message: `Operación de venta programada creada para ${alert.symbol}`,
      operation: {
        _id: operation._id,
        ticker: operation.ticker,
        operationType: operation.operationType,
        price: operation.price,
        priceRange: operation.priceRange,
        isPriceConfirmed: operation.isPriceConfirmed
      }
    });

  } catch (error) {
    console.error('Error creando operación:', error);
    return res.status(500).json({ 
      error: 'Error interno',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
