import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAPI } from '@/lib/adminAuth';

/**
 * Endpoint wrapper para ejecutar expulsión de Telegram desde el panel de admin
 * Este endpoint verifica que el usuario sea admin y luego llama al endpoint de cron
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar que sea admin
    const { isAdmin, error } = await verifyAdminAPI(req, res);
    
    if (!isAdmin) {
      return res.status(error === 'No autorizado' ? 401 : 403).json({ 
        error: error || 'Acceso denegado. Solo administradores.' 
      });
    }

    // Obtener parámetros
    const dryRun = req.query.dryRun === 'true';
    const verbose = req.query.verbose === 'true';
    
    // Construir URL del endpoint de cron (usar localhost en desarrollo, NEXTAUTH_URL en producción)
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.NEXTAUTH_URL || `https://${process.env.VERCEL_URL}`)
      : 'http://localhost:3000';
    
    const params = new URLSearchParams();
    if (dryRun) params.append('dryRun', 'true');
    if (verbose) params.append('verbose', 'true');
    
    const cronUrl = `${baseUrl}/api/cron/telegram-expulsion?${params.toString()}`;
    const cronSecret = process.env.CRON_SECRET;
    
    // Llamar al endpoint de cron con el secret
    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    });

    if (!cronResponse.ok) {
      const error = await cronResponse.json();
      return res.status(cronResponse.status).json(error);
    }

    const data = await cronResponse.json();
    return res.status(200).json(data);

  } catch (error: any) {
    console.error('❌ [ADMIN TELEGRAM EXPULSION] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error ejecutando expulsión',
      details: error.message
    });
  }
}
