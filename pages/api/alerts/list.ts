/**
 * API para obtener la lista de alertas del usuario autenticado
 * Soporte para filtros por estado, tipo, etc.
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';

interface AlertsListResponse {
  success?: boolean;
  alerts?: any[];
  error?: string;
  message?: string;
  total?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AlertsListResponse>
) {
  if (req.method !== 'GET') {
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

    // Obtener información del usuario
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Extraer parámetros de query
    const { 
      status = 'ALL', 
      tipo = 'TraderCall',
      limit = '50',
      page = '1'
    } = req.query;

    // Construir filtro - REMOVIDO el filtro por createdBy para que todos vean todas las alertas
    const filter: any = {
      tipo: tipo
    }; 

    if (status !== 'ALL') {
      filter.status = status;
    }

    // Paginación
    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Obtener alertas con paginación
    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 }) // Más recientes primero
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Contar total de alertas
    const total = await Alert.countDocuments(filter);

    // Formatear alertas para el frontend - con validación de números
    const formattedAlerts = alerts.map((alert: any) => ({
      id: alert._id.toString(),
      symbol: alert.symbol || '',
      action: alert.action || '',
      entryPrice: `$${Number(alert.entryPrice || 0).toFixed(2)}`,
      currentPrice: `$${Number(alert.currentPrice || 0).toFixed(2)}`,
      stopLoss: `$${Number(alert.stopLoss || 0).toFixed(2)}`,
      takeProfit: `$${Number(alert.takeProfit || 0).toFixed(2)}`,
      profit: `${Number(alert.profit || 0) >= 0 ? '+' : ''}${Number(alert.profit || 0).toFixed(1)}%`,
      status: alert.status || 'ACTIVE',
      date: alert.date ? alert.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      analysis: alert.analysis || '',
      createdAt: alert.createdAt,
      // Campos adicionales para mostrar si está cerrada
      exitPrice: alert.exitPrice ? `$${Number(alert.exitPrice).toFixed(2)}` : null,
      exitDate: alert.exitDate?.toISOString().split('T')[0] || null,
      exitReason: alert.exitReason || null,
      type: Number(alert.profit || 0) >= 0 ? 'WIN' : 'LOSS' // Para alertas cerradas
    }));

    return res.status(200).json({
      success: true,
      alerts: formattedAlerts,
      total,
      message: `Se encontraron ${formattedAlerts.length} alertas`
    });

  } catch (error) {
    console.error('Error al obtener alertas:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las alertas'
    });
  }
} 