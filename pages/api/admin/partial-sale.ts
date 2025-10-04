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
    // Manejar diferentes formatos de precio de entrada
    let entryPrice: number;
    if (typeof alert.entryPrice === 'string') {
      entryPrice = parseFloat(alert.entryPrice.replace('$', ''));
    } else if (typeof alert.entryPrice === 'number') {
      entryPrice = alert.entryPrice;
    } else {
      return res.status(400).json({ error: 'Precio de entrada inválido' });
    }

    // Manejar precio actual
    let current: number;
    if (typeof currentPrice === 'string') {
      current = parseFloat(currentPrice.replace('$', ''));
    } else if (typeof currentPrice === 'number') {
      current = currentPrice;
    } else {
      return res.status(400).json({ error: 'Precio actual inválido' });
    }

    // Validar que los precios son números válidos
    if (isNaN(entryPrice) || isNaN(current)) {
      return res.status(400).json({ error: 'Precios inválidos para el cálculo' });
    }
    
    // Calcular ganancia/pérdida por acción
    const profitPerShare = current - entryPrice;
    
    // Obtener información de liquidez actual
    const liquidityData = alert.liquidityData || {};
    let allocatedAmount = liquidityData.allocatedAmount || 0;
    let shares = liquidityData.shares || 0;
    
    // Si no hay liquidez asignada, calcular basándose en un monto por defecto
    if (allocatedAmount === 0 && shares === 0) {
      // Buscar si hay liquidez asignada en el pool para esta alerta específica
      try {
        const liquidityResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/liquidity?pool=${tipo}`);
        if (liquidityResponse.ok) {
          const liquidityJson = await liquidityResponse.json();
          // CORREGIDO: Buscar por alertId en lugar de symbol
          const alertDistribution = liquidityJson.liquidity?.distributions?.find((d: any) => d.alertId.toString() === alertId.toString());
          
          if (alertDistribution) {
            allocatedAmount = alertDistribution.allocatedAmount || 0;
            shares = alertDistribution.shares || Math.floor(allocatedAmount / entryPrice);
            
            console.log(`📊 Liquidez encontrada para alerta ${alertId} (${alert.symbol}): $${allocatedAmount}, ${shares} acciones`);
          } else {
            console.log(`⚠️ No se encontró distribución de liquidez para alerta ${alertId} (${alert.symbol})`);
          }
        }
      } catch (error) {
        console.log('⚠️ No se pudo obtener liquidez del pool, usando valores por defecto');
      }
      
      // Si aún no hay liquidez, usar un monto por defecto basado en el precio
      if (allocatedAmount === 0) {
        allocatedAmount = 1000; // $1000 por defecto
        shares = Math.floor(allocatedAmount / entryPrice);
        console.log(`💡 Usando liquidez por defecto: $${allocatedAmount}, ${shares} acciones`);
      }
    }
    
    console.log(`📊 Liquidez para cálculo: $${allocatedAmount}, ${shares} acciones, precio entrada: $${entryPrice}`);
    
    // Validar que tenemos datos suficientes para el cálculo
    if (shares === 0) {
      return res.status(400).json({ error: 'No hay acciones suficientes para realizar venta parcial' });
    }
    
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
      // Guardar el monto original para referencia
      originalAllocatedAmount: liquidityData.originalAllocatedAmount || allocatedAmount,
      originalShares: liquidityData.originalShares || (liquidityData.shares || shares),
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
      alert.exitPrice = current; // Usar el valor numérico, no el string
      alert.closedAt = new Date();
      alert.closedBy = session.user.email;
      alert.closeReason = 'Venta parcial completa';
    }

    await alert.save();

    // ✅ ACTUALIZAR EL SISTEMA DE LIQUIDEZ
    try {
      const liquidityResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/liquidity?pool=${tipo}`);
      if (liquidityResponse.ok) {
        const liquidityJson = await liquidityResponse.json();
        const liquidity = liquidityJson.liquidity;
        
        if (liquidity && liquidity.distributions) {
          // Encontrar y actualizar la distribución correspondiente
          const distributionIndex = liquidity.distributions.findIndex((d: any) => d.alertId.toString() === alertId.toString());
          
          if (distributionIndex !== -1) {
            // Actualizar la distribución existente
            liquidity.distributions[distributionIndex].allocatedAmount = newAllocatedAmount;
            liquidity.distributions[distributionIndex].shares = sharesRemaining;
            
            // Si se cerró completamente, marcar como cerrada
            if (sharesRemaining <= 0) {
              liquidity.distributions[distributionIndex].status = 'CLOSED';
              liquidity.distributions[distributionIndex].closedAt = new Date();
            }
            
            // Actualizar la liquidez total disponible
            liquidity.totalLiquidity += liquidityReleased;
            
            // Guardar cambios en el sistema de liquidez
            const updateResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/liquidity`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pool: tipo,
                totalLiquidity: liquidity.totalLiquidity,
                distributions: liquidity.distributions
              })
            });
            
            if (updateResponse.ok) {
              console.log(`✅ Sistema de liquidez actualizado: +$${liquidityReleased.toFixed(2)} liberados`);
            } else {
              console.log('⚠️ Error actualizando sistema de liquidez');
            }
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Error sincronizando con sistema de liquidez:', error);
    }

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
