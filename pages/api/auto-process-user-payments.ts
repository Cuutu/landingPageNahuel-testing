import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { processUserPendingPayments, shouldProcessUserPayments } from '@/lib/autoPaymentProcessor';

/**
 * API para procesar automáticamente los pagos pendientes de un usuario
 * Se ejecuta cuando el usuario navega por la aplicación
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    // Verificar autenticación (sesión o token interno)
    let userEmail: string | null = null;

    // Opción 1: Verificar sesión de usuario
    const session = await getServerSession(req, res, authOptions);
    if (session?.user?.email) {
      userEmail = session.user.email;
    }

    // Opción 2: Verificar si viene del middleware con token interno
    const { userEmail: bodyUserEmail } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!userEmail && bodyUserEmail && authHeader === `Bearer ${process.env.NEXTAUTH_SECRET}`) {
      userEmail = bodyUserEmail;
    }

    if (!userEmail) {
      return res.status(401).json({ 
        success: false,
        error: 'No autorizado' 
      });
    }

    console.log(`🔄 [AUTO-PROCESSOR] Iniciando verificación para: ${userEmail}`);

    // Verificar si el usuario necesita procesamiento
    const needsProcessing = await shouldProcessUserPayments(userEmail);
    
    if (!needsProcessing) {
      console.log(`✅ [AUTO-PROCESSOR] No hay pagos pendientes para: ${userEmail}`);
      return res.status(200).json({
        success: true,
        message: 'No hay pagos pendientes para procesar',
        processed: 0
      });
    }

    // Procesar pagos pendientes del usuario
    const result = await processUserPendingPayments(userEmail);

    if (result.success && result.processed > 0) {
      console.log(`🎉 [AUTO-PROCESSOR] ${result.processed} pagos procesados para: ${userEmail}`);
    }

    return res.status(200).json({
      success: result.success,
      message: `Procesamiento automático completado`,
      processed: result.processed,
      errors: result.errors
    });

  } catch (error) {
    console.error('❌ [AUTO-PROCESSOR] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
