import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';

/**
 * API para verificar pagos pendientes del usuario
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/check-pending-payments`);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();
    console.log('✅ Conectado a MongoDB');

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      console.log('❌ No hay sesión activa');
      return res.status(401).json({ 
        success: false,
        error: 'Debes iniciar sesión' 
      });
    }

    console.log('✅ Verificando pagos para:', session.user.email);

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Buscar todos los pagos del usuario
    const allPayments = await Payment.find({ userEmail: session.user.email }).sort({ createdAt: -1 });
    
    // Filtrar por estado
    const pendingPayments = allPayments.filter(p => p.status === 'pending');
    const approvedPayments = allPayments.filter(p => p.status === 'approved');
    const traderCallPayments = allPayments.filter(p => p.service === 'TraderCall');

    console.log('🔍 Estado de pagos:', {
      email: user.email,
      totalPayments: allPayments.length,
      pendingCount: pendingPayments.length,
      approvedCount: approvedPayments.length,
      traderCallCount: traderCallPayments.length
    });

    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        role: user.role
      },
      payments: {
        total: allPayments.length,
        pending: pendingPayments,
        approved: approvedPayments,
        traderCall: traderCallPayments,
        latest: allPayments.slice(0, 5) // Los 5 más recientes
      },
      summary: {
        hasPendingTraderCall: pendingPayments.some(p => p.service === 'TraderCall'),
        hasApprovedTraderCall: approvedPayments.some(p => p.service === 'TraderCall'),
        latestTraderCall: traderCallPayments[0] || null
      }
    });

  } catch (error) {
    console.error('❌ Error verificando pagos:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
