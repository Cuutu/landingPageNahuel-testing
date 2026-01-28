import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import User from '@/models/User';

/**
 * API endpoint para manejo de alertas de trading
 * GET: Obtener alertas (todas las alertas visibles para el usuario)
 * POST: Crear nueva alerta (solo admin)
 * PUT: Actualizar alerta (solo admin)
 * DELETE: Eliminar alerta (solo admin)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/alerts`);

  try {
    await dbConnect();

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('❌ Error en /api/alerts:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * GET /api/alerts
 * Obtiene alertas según filtros y permisos del usuario
 */
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req });
    const { tipo, status, limit = '10', page = '1' } = req.query;

    // Construir filtros - TODAS las alertas son visibles para todos
    const filters: any = {};
    
    if (tipo && typeof tipo === 'string') {
      filters.tipo = tipo;
    }
    
    if (status && typeof status === 'string') {
      filters.status = status;
    }

    // Si el usuario no está autenticado, solo mostrar alertas básicas
    let projection = {};
    if (!session) {
      projection = {
        symbol: 1,
        action: 1,
        entryPrice: 1,
        currentPrice: 1,
        status: 1,
        profit: 1,
        date: 1,
        tipo: 1,
        createdAt: 1
      };
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const alerts = await Alert.find(filters, projection)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean();

    const total = await Alert.countDocuments(filters);

    return res.status(200).json({
      success: true,
      data: alerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('❌ Error en GET alerts:', error);
    return res.status(500).json({ error: 'Error obteniendo alertas' });
  }
}

/**
 * POST /api/alerts
 * Crea una nueva alerta (solo admin)
 */
async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que el usuario es admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    const {
      symbol,
      action,
      entryPrice,
      stopLoss,
      takeProfit,
      analysis,
      tipo
    } = req.body;

    // Validaciones básicas
    if (!symbol || !action || !entryPrice || !stopLoss || !takeProfit || !tipo) {
      return res.status(400).json({ 
        error: 'Symbol, action, entryPrice, stopLoss, takeProfit y tipo son obligatorios' 
      });
    }

    const tiposValidos = ['TraderCall', 'SmartMoney', 'CashFlow'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ 
        error: 'Tipo de alerta inválido' 
      });
    }

    const nuevaAlerta = await Alert.create({
      symbol: symbol.toUpperCase(),
      action,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss,
      takeProfit,
      analysis: analysis || '',
      tipo,
      createdBy: user._id,
      status: 'ACTIVE',
      profit: 0
    });

    console.log('✅ Alerta creada:', nuevaAlerta._id);

    return res.status(201).json({
      success: true,
      data: nuevaAlerta,
      message: 'Alerta creada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando alerta:', error);
    return res.status(500).json({ error: 'Error creando alerta' });
  }
}

/**
 * PUT /api/alerts
 * Actualiza una alerta existente (solo admin)
 */
async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID de alerta requerido' });
    }

    const alertaActualizada = await Alert.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!alertaActualizada) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    console.log('✅ Alerta actualizada:', alertaActualizada._id);

    return res.status(200).json({
      success: true,
      data: alertaActualizada,
      message: 'Alerta actualizada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando alerta:', error);
    return res.status(500).json({ error: 'Error actualizando alerta' });
  }
}

/**
 * DELETE /api/alerts
 * Elimina una alerta (solo admin)
 */
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession({ req });
    
    if (!session) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID de alerta requerido' });
    }

    // ✅ CORREGIDO: Buscar la alerta primero para obtener el tipo (pool)
    const alert = await Alert.findById(id);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // ✅ NUEVO: Liberar la liquidez ANTES de eliminar la alerta
    try {
      const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
      const Liquidity = (await import('@/models/Liquidity')).default;
      
      const liquidity = await Liquidity.findOne({ 
        pool,
        'distributions.alertId': id.toString()
      });
      
      if (liquidity) {
        const distribution = liquidity.distributions.find((d: any) => 
          d.alertId && d.alertId.toString() === id.toString()
        );
        
        if (distribution) {
          console.log(`💰 Liberando liquidez antes de eliminar alerta ${alert.symbol}: $${distribution.allocatedAmount?.toFixed(2) || 0}`);
          liquidity.removeDistribution(id.toString());
          await liquidity.save();
          console.log(`✅ Liquidez liberada para ${alert.symbol}`);
        }
      }
    } catch (liquidityError) {
      console.error(`⚠️ Error liberando liquidez para alerta ${id}:`, liquidityError);
      // Continuar con la eliminación aunque falle la liberación de liquidez
    }

    // ✅ NUEVO: También eliminar las operaciones asociadas (opcional, para limpieza)
    try {
      const Operation = (await import('@/models/Operation')).default;
      await Operation.deleteMany({ alertId: id });
      console.log(`🗑️ Operaciones asociadas eliminadas para alerta ${id}`);
    } catch (opError) {
      console.error(`⚠️ Error eliminando operaciones para alerta ${id}:`, opError);
    }

    const alertaEliminada = await Alert.findByIdAndDelete(id);

    console.log('✅ Alerta eliminada:', alertaEliminada?._id, alert.symbol);

    return res.status(200).json({
      success: true,
      message: 'Alerta eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando alerta:', error);
    return res.status(500).json({ error: 'Error eliminando alerta' });
  }
} 