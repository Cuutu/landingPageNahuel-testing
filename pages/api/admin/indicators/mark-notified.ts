import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import User from '@/models/User';
import { z } from 'zod';

// Schema de validación
const markNotifiedSchema = z.object({
  paymentId: z.string().min(1, 'ID de pago es requerido')
});

/**
 * Marca un pago como notificado sin enviar email
 * POST: Marca el pago como notificado manualmente
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/admin/indicators/mark-notified`);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    // Verificar acceso de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acceso denegado' });
    }

    // Validar datos de entrada
    const validatedData = markNotifiedSchema.parse(req.body);
    const { paymentId } = validatedData;

    await dbConnect();

    // Buscar el pago
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Pago no encontrado' });
    }

    // Verificar que el pago sea del servicio de indicadores
    if (payment.service !== 'MediasMovilesAutomaticas') {
      return res.status(400).json({ 
        success: false, 
        error: 'El pago no corresponde al servicio de indicadores' 
      });
    }

    // Marcar como notificado sin enviar email
    if (!payment.metadata) {
      payment.metadata = {};
    }
    payment.metadata.notificationSent = true;
    payment.metadata.notificationSentAt = new Date();
    payment.metadata.notificationSentBy = session.user.email;
    payment.metadata.markedAsNotifiedManually = true; // ✅ Flag para indicar que fue marcado manualmente

    await payment.save();

    // ✅ DEBUG: Verificar que se guardó correctamente
    const savedPayment = await Payment.findById(paymentId);
    console.log('✅ Pago marcado como notificado manualmente:', {
      paymentId,
      userEmail: payment.userEmail,
      metadataAfterSave: savedPayment?.metadata,
      notificationSentValue: savedPayment?.metadata?.notificationSent,
      notificationSentType: typeof savedPayment?.metadata?.notificationSent
    });

    return res.status(200).json({
      success: true,
      message: 'Usuario marcado como notificado (sin enviar email)'
    });

  } catch (error) {
    console.error('❌ Error en /api/admin/indicators/mark-notified:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

