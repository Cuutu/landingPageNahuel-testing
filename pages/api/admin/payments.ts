import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    // Verificar sesión y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar si es admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || adminUser.role !== 'admin') {
      console.log('❌ [PAYMENTS] Acceso denegado:', {
        email: session.user.email,
        userFound: !!adminUser,
        userRole: adminUser?.role,
        isAdmin: adminUser?.role === 'admin'
      });
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    console.log('✅ [PAYMENTS] Acceso de admin confirmado:', session.user.email);

    // Obtener solo pagos aprobados (completados)
    const payments = await Payment.find({ status: 'approved' })
      .populate('userId', 'name email phone cuit')
      .sort({ userEmail: 1, transactionDate: -1 })
      .limit(5000); // límite alto para exportaciones

    // Procesar pagos para el frontend
    const processedPayments = payments.map(payment => ({
      id: payment._id.toString(),
      userEmail: payment.userEmail,
      userName: (payment as any).userId?.name || 'Usuario',
      userPhone: (payment as any).userId?.phone || '',
      userCuit: (payment as any).userId?.cuit || (payment as any).userId?.cuil || '',
      service: payment.service,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status as 'approved' | 'pending' | 'rejected' | 'cancelled',
      transactionDate: payment.transactionDate,
      expiryDate: payment.expiryDate,
      paymentMethod: 'MercadoPago',
      mercadopagoPaymentId: payment.mercadopagoPaymentId,
      reason: payment.metadata?.reason || payment.metadata?.type || payment.service
    }));

    return res.status(200).json({
      success: true,
      payments: processedPayments,
      total: payments.length
    });

  } catch (error) {
    console.error('Error obteniendo pagos:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
}
