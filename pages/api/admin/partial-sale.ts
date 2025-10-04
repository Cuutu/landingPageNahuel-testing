import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Alert from '../../../models/Alert';
import User from '../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Verificar si el usuario es admin directamente desde la base de datos
  try {
    const user = await User.findOne({ email: session.user.email });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado - Se requieren permisos de administrador' });
    }
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ error: 'Error verificando permisos' });
  }

  const { alertId, percentage, currentPrice, tipo } = req.body;

  if (!alertId || !percentage || !currentPrice || !tipo) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  if (percentage !== 25 && percentage !== 50) {
    return res.status(400).json({ error: 'Porcentaje debe ser 25 o 50' });
  }

  try {
    console.log(`💰 Ejecutando venta parcial de ${percentage}% para alerta:`, alertId);

    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que la alerta esté activa
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'La alerta no está activa' });
    }

    // Calcular los valores de la venta parcial
    const entryPrice = parseFloat(alert.entryPrice.replace('$', ''));
    const current = parseFloat(currentPrice.replace('$', ''));
    
    // Calcular ganancia/pérdida por acción
    const profitPerShare = current - entryPrice;
    
    // Obtener información de liquidez actual
    const liquidityData = alert.liquidityData || {};
    const allocatedAmount = liquidityData.allocatedAmount || 0;
    const shares = liquidityData.shares || Math.floor(allocatedAmount / entryPrice);
    
    // Calcular valores de la venta parcial
    const sharesToSell = Math.floor(shares * (percentage / 100));
    const sharesRemaining = shares - sharesToSell;
    const liquidityReleased = sharesToSell * current;
    const realizedProfit = sharesToSell * profitPerShare;
    
    // Actualizar la alerta con los nuevos valores
    const newAllocatedAmount = sharesRemaining * entryPrice;
    
    alert.liquidityData = {
      ...liquidityData,
      allocatedAmount: newAllocatedAmount,
      shares: sharesRemaining,
      partialSales: [
        ...(liquidityData.partialSales || []),
        {
          date: new Date(),
          percentage: percentage,
          sharesToSell: sharesToSell,
          sellPrice: current,
          liquidityReleased: liquidityReleased,
          realizedProfit: realizedProfit,
          executedBy: session.user.email
        }
      ]
    };

    // Si se vendió todo (50% dos veces o situación similar), cerrar la alerta
    if (sharesRemaining <= 0) {
      alert.status = 'CLOSED';
      alert.exitPrice = currentPrice;
      alert.closedAt = new Date();
      alert.closedBy = session.user.email;
      alert.closeReason = 'Venta parcial completa';
    }

    await alert.save();

    console.log(`✅ Venta parcial de ${percentage}% ejecutada exitosamente`);
    console.log(`💰 Liquidez liberada: $${liquidityReleased.toFixed(2)}`);
    console.log(`📊 Acciones restantes: ${sharesRemaining}`);
    console.log(`💵 Ganancia realizada: $${realizedProfit.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      message: `Venta parcial de ${percentage}% ejecutada exitosamente`,
      liquidityReleased: liquidityReleased,
      realizedProfit: realizedProfit,
      sharesRemaining: sharesRemaining,
      sharesToSell: sharesToSell,
      newAllocatedAmount: newAllocatedAmount,
      alertStatus: alert.status
    });

  } catch (error) {
    console.error('❌ Error ejecutando venta parcial:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
