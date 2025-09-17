import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Liquidity from '@/models/Liquidity';
import User from '@/models/User';
import Alert from '@/models/Alert';

interface SellLiquidityRequest {
  alertId: string;
  shares: number;
  price: number;
  emailMessage?: string;
  emailImageUrl?: string;
}

interface SellLiquidityResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: {
    alertId: string;
    symbol: string;
    realized: number;
    returnedCash: number;
    remainingShares: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SellLiquidityResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Permisos insuficientes. Solo administradores.' });
    }

    const { alertId, shares, price }: SellLiquidityRequest = req.body || {};
    const emailMessage: string | undefined = (req.body as any)?.emailMessage;
    const emailImageUrl: string | undefined = (req.body as any)?.emailImageUrl;

    if (!alertId || !shares || !price) {
      return res.status(400).json({ success: false, error: 'alertId, shares y price son requeridos' });
    }
    if (shares <= 0 || price <= 0) {
      return res.status(400).json({ success: false, error: 'shares y price deben ser > 0' });
    }

    // Validar alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alerta no encontrada' });
    }

    const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';

    // Buscar liquidez y distribución en el pool correcto
    let liquidity = await Liquidity.findOne({ createdBy: user._id, pool });
    if (!liquidity) {
      console.warn(`[LIQUIDITY] No se encontró liquidez para el admin actual en ${pool}. Intentando fallback por pool+alertId...`);
      liquidity = await Liquidity.findOne({ pool, 'distributions.alertId': alertId });
      if (!liquidity) {
        return res.status(404).json({ success: false, error: `No hay liquidez configurada para ${pool}` });
      }
    }

    let distribution = liquidity.distributions.find((d: any) => d.alertId === alertId);
    if (!distribution) {
      console.warn(`[LIQUIDITY] No se encontró distribución en la liquidez seleccionada. Intentando localizar por alertId en el pool...`);
      const liquidityWithDist = await Liquidity.findOne({ pool, 'distributions.alertId': alertId });
      if (liquidityWithDist) {
        liquidity = liquidityWithDist;
        distribution = liquidity.distributions.find((d: any) => d.alertId === alertId);
      }
    }
    if (!distribution) {
      return res.status(404).json({ success: false, error: 'No hay distribución para esta alerta' });
    }

    if (shares > distribution.shares) {
      return res.status(400).json({ success: false, error: 'No hay suficientes acciones para vender' });
    }

    const { realized, returnedCash, remainingShares } = liquidity.sellShares(alertId, shares, price);

    // Si ya no quedan acciones, eliminar distribución
    if (remainingShares === 0) {
      liquidity.removeDistribution(alertId);
    }

    await liquidity.save();

    // 🔔 Notificar a suscriptores (parcial o total)
    try {
      const { notifyAlertSubscribers } = await import('@/lib/notificationUtils');
      const isTotal = remainingShares === 0;
      const message = emailMessage || (isTotal
        ? `Cierre total en ${alert.symbol}: vendido 100% a $${price}.`
        : `Venta parcial en ${alert.symbol}: vendidos ${shares} shares a $${price}.`);
      const imageUrl = emailImageUrl || undefined;
      await notifyAlertSubscribers(alert as any, {
        message,
        imageUrl,
        price
      });
      console.log('✅ Notificación de venta enviada', { isTotal, image: !!imageUrl });
    } catch (notifyErr) {
      console.error('❌ Error enviando notificación de venta:', notifyErr);
    }

    return res.status(200).json({
      success: true,
      message: `Venta registrada en ${pool} y liquidez actualizada`,
      result: {
        alertId,
        symbol: alert.symbol,
        realized,
        returnedCash,
        remainingShares
      }
    });
  } catch (error) {
    console.error('Error en venta de liquidez:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
} 