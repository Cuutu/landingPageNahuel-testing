import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import User from '@/models/User';

/**
 * Obtiene la lista de usuarios que compraron el servicio de indicadores
 * GET: Lista todos los usuarios con sus datos de compra y TradingView
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/admin/indicators/users`);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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

    await dbConnect();

    // Buscar todos los pagos del servicio de indicadores que estén aprobados
    const payments = await Payment.find({
      service: 'MediasMovilesAutomaticas',
      status: 'approved'
    }).sort({ transactionDate: -1 }).lean();

    console.log(`📊 Encontrados ${payments.length} pagos de indicadores`);

    // Obtener información de usuarios para cada pago
    const usersWithIndicatorData = await Promise.all(
      payments.map(async (payment: any) => {
        const paymentUser = await User.findOne({ email: payment.userEmail }).lean();
        
        return {
          _id: payment._id.toString(),
          userEmail: payment.userEmail,
          userName: (paymentUser as any)?.name || 'Usuario desconocido',
          amount: payment.amount,
          currency: payment.currency,
          transactionDate: payment.transactionDate,
          tradingViewUser: payment.metadata?.tradingViewUser || null,
          formSubmitted: payment.metadata?.formSubmitted || false,
          notificationSent: payment.metadata?.notificationSent || false,
          paymentId: payment._id.toString()
        };
      })
    );

    console.log(`✅ Datos de usuarios obtenidos exitosamente`);

    return res.status(200).json({
      success: true,
      users: usersWithIndicatorData,
      count: usersWithIndicatorData.length
    });

  } catch (error) {
    console.error('❌ Error en /api/admin/indicators/users:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}
