/**
 * API para editar alertas completas (solo administradores)
 * PUT: Editar una alerta existente
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import { createAlertNotification } from '@/lib/notificationUtils';

interface EditAlertRequest {
  alertId: string;
  symbol?: string;
  action?: 'BUY' | 'SELL';
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  analysis?: string;
  reason?: string;
}

interface AlertResponse {
  success?: boolean;
  alert?: any;
  error?: string;
  message?: string;
  changes?: any;
  currentStatus?: string;
  audit?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlertResponse>
) {
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

    // Obtener información del usuario y verificar que sea admin
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que sea administrador
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'Permisos insuficientes. Solo los administradores pueden editar alertas.'
      });
    }

    // Validar datos de entrada
    const { alertId, symbol, action, entryPrice, stopLoss, takeProfit, analysis, reason }: EditAlertRequest = req.body;

    if (!alertId) {
      return res.status(400).json({ error: 'alertId es requerido' });
    }

    // Buscar la alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que la alerta esté activa
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Solo se pueden editar alertas activas',
        currentStatus: alert.status
      });
    }

    // Registrar cambios para auditoría
    const changes: any = {};
    const oldValues: any = {};

    // Validar y registrar cambios
    if (symbol !== undefined && symbol !== alert.symbol) {
      if (!symbol.trim()) {
        return res.status(400).json({ error: 'El símbolo no puede estar vacío' });
      }
      oldValues.symbol = alert.symbol;
      changes.symbol = symbol.toUpperCase().trim();
    }

    if (action !== undefined && action !== alert.action) {
      if (!['BUY', 'SELL'].includes(action)) {
        return res.status(400).json({ error: 'Acción debe ser BUY o SELL' });
      }
      oldValues.action = alert.action;
      changes.action = action;
    }

    if (entryPrice !== undefined && entryPrice !== alert.entryPrice) {
      if (entryPrice <= 0) {
        return res.status(400).json({ error: 'El precio de entrada debe ser mayor a 0' });
      }
      oldValues.entryPrice = alert.entryPrice;
      changes.entryPrice = entryPrice;
      changes.currentPrice = entryPrice; // Actualizar precio actual también
    }

    if (stopLoss !== undefined && stopLoss !== alert.stopLoss) {
      if (stopLoss <= 0) {
        return res.status(400).json({ error: 'El stop loss debe ser mayor a 0' });
      }
      oldValues.stopLoss = alert.stopLoss;
      changes.stopLoss = stopLoss;
    }

    if (takeProfit !== undefined && takeProfit !== alert.takeProfit) {
      if (takeProfit <= 0) {
        return res.status(400).json({ error: 'El take profit debe ser mayor a 0' });
      }
      oldValues.takeProfit = alert.takeProfit;
      changes.takeProfit = takeProfit;
    }

    if (analysis !== undefined && analysis !== alert.analysis) {
      oldValues.analysis = alert.analysis;
      changes.analysis = analysis;
    }

    // Verificar que haya al menos un cambio
    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No se detectaron cambios en la alerta' });
    }

    // Obtener información del cliente para auditoría
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    console.log('🔧 Editando alerta completa:', {
      alertId,
      symbol: alert.symbol,
      changes,
      oldValues,
      adminUser: user.email,
      reason: reason || 'Edición por administrador',
      clientIP,
      userAgent
    });

    // Aplicar cambios a la alerta
    Object.assign(alert, changes);

    // Si cambió el precio de entrada, recalcular profit
    if (changes.entryPrice || changes.currentPrice) {
      alert.calculateProfit();
    }

    // Registrar el cambio en el historial si cambió el precio actual
    if (changes.currentPrice) {
      alert.recordPriceChange(
        user._id,
        changes.currentPrice,
        reason || 'Edición completa de alerta por administrador',
        clientIP.toString(),
        userAgent
      );
    }

    // Agregar registro de edición general (si no es solo cambio de precio)
    if (Object.keys(changes).some(key => key !== 'currentPrice')) {
      alert.priceChangeHistory.push({
        changedBy: user._id,
        changedAt: new Date(),
        oldPrice: alert.currentPrice,
        newPrice: alert.currentPrice, // No cambia el precio actual
        reason: `Edición general: ${Object.keys(changes).join(', ')}`,
        ipAddress: clientIP.toString(),
        userAgent
      });
    }

    // Guardar la alerta actualizada
    await alert.save();

    // Obtener la alerta actualizada con el historial
    const updatedAlert = await Alert.findById(alertId).populate('priceChangeHistory.changedBy', 'email name');

    console.log('✅ Alerta editada exitosamente:', {
      alertId,
      symbol: alert.symbol,
      changes: Object.keys(changes),
      adminUser: user.email,
      timestamp: new Date().toISOString()
    });

    // Formatear la respuesta para el frontend
    const alertResponse = {
      id: updatedAlert._id.toString(),
      symbol: updatedAlert.symbol,
      action: updatedAlert.action,
      entryPrice: `$${Number(updatedAlert.entryPrice || 0).toFixed(2)}`,
      currentPrice: `$${Number(updatedAlert.currentPrice || 0).toFixed(2)}`,
      stopLoss: `$${Number(updatedAlert.stopLoss || 0).toFixed(2)}`,
      takeProfit: `$${Number(updatedAlert.takeProfit || 0).toFixed(2)}`,
      profit: `${Number(updatedAlert.profit || 0) >= 0 ? '+' : ''}${Number(updatedAlert.profit || 0).toFixed(1)}%`,
      status: updatedAlert.status,
      date: updatedAlert.date ? updatedAlert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      analysis: updatedAlert.analysis || '',
      tipo: updatedAlert.tipo
    };

    return res.status(200).json({
      success: true,
      message: 'Alerta editada correctamente',
      alert: alertResponse,
      changes: {
        fields: Object.keys(changes),
        oldValues,
        newValues: changes,
        reason: reason || 'Edición por administrador'
      },
      audit: {
        editedBy: user.email,
        editedAt: new Date().toISOString(),
        reason: reason || 'Edición por administrador',
        clientIP: clientIP.toString(),
        userAgent
      }
    });

  } catch (error) {
    console.error('❌ Error al editar alerta:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo editar la alerta'
    });
  }
}
