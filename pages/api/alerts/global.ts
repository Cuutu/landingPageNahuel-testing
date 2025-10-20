/**
 * API global para obtener alertas - todos los usuarios ven las mismas
 */
import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

interface GlobalAlertsResponse {
  success?: boolean;
  alerts?: any[];
  error?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GlobalAlertsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Conectar a la base de datos
    await dbConnect();

    // Extraer parámetros de query
    const { 
      tipo, 
      status = 'ACTIVE',
      availableForPurchase,
      limit = '50'
    } = req.query;

    // Construir filtros
    const filters: any = {};
    
    if (tipo) {
      filters.tipo = tipo;
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (availableForPurchase !== undefined) {
      filters.availableForPurchase = availableForPurchase === 'true';
    }

    // Obtener alertas globales (mismas para todos los usuarios)
    const alerts = await Alert.find(filters)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    console.log(`📊 [GLOBAL ALERTS] Obteniendo alertas globales:`, {
      tipo,
      status,
      availableForPurchase,
      total: alerts.length
    });

    return res.status(200).json({
      success: true,
      alerts,
      message: `Alertas globales obtenidas: ${alerts.length} alertas`
    });

  } catch (error) {
    console.error('❌ [GLOBAL ALERTS] Error al obtener alertas globales:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las alertas globales'
    });
  }
}
