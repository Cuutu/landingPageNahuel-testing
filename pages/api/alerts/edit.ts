import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import User from '@/models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Verificar que el usuario sea administrador
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes. Solo los administradores pueden editar alertas.' });
    }

    const { alertId, updates } = req.body;

    if (!alertId) {
      return res.status(400).json({ error: 'ID de alerta requerido' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que la alerta esté activa (opcional, se puede editar alertas cerradas)
    if (alert.status === 'CLOSED') {
      console.log('⚠️ Editando alerta cerrada:', alertId);
    }

    // Campos permitidos para edición
    const allowedFields = [
      'currentPrice', 'stopLoss', 'takeProfit', 'analysis', 
      'entryPrice', 'entryPriceRange', 'status'
    ];

    // Filtrar solo campos permitidos
    const filteredUpdates: any = {};
    let hasPriceChange = false;
    let oldCurrentPrice = alert.currentPrice;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
        
        // Si se está cambiando el precio actual, registrar el cambio
        if (key === 'currentPrice' && typeof value === 'number' && value !== alert.currentPrice) {
          hasPriceChange = true;
        }
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    // Agregar timestamp de actualización
    filteredUpdates.updatedAt = new Date();

    // Si hay cambio de precio, registrar en el historial
    if (hasPriceChange && oldCurrentPrice !== filteredUpdates.currentPrice) {
      const priceChangeAudit = {
        changedBy: user._id,
        changedAt: new Date(),
        oldPrice: oldCurrentPrice,
        newPrice: filteredUpdates.currentPrice,
        reason: updates.reason || 'Edición manual por administrador',
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      // Agregar al historial de cambios de precio
      if (!filteredUpdates.priceChangeHistory) {
        filteredUpdates.priceChangeHistory = [];
      }
      filteredUpdates.priceChangeHistory.push(priceChangeAudit);
    }

    // Actualizar la alerta
    const updatedAlert = await Alert.findByIdAndUpdate(
      alertId,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    );

    if (!updatedAlert) {
      return res.status(500).json({ error: 'Error al actualizar la alerta' });
    }

    // Recalcular el profit si se cambió algún precio
    if (hasPriceChange || updates.stopLoss || updates.takeProfit) {
      updatedAlert.calculateProfit();
      await updatedAlert.save();
    }

    console.log('✅ Alerta editada exitosamente:', {
      alertId,
      editedBy: user.email,
      changes: Object.keys(filteredUpdates),
      hasPriceChange
    });

    return res.status(200).json({
      success: true,
      message: 'Alerta actualizada exitosamente',
      alert: updatedAlert,
      changes: Object.keys(filteredUpdates)
    });

  } catch (error) {
    console.error('❌ Error al editar alerta:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
} 