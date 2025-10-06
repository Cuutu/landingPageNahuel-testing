import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import Pricing from '@/models/Pricing';
import { createMercadoPagoPreference } from '@/lib/mercadopago';

/**
 * Crea un checkout de MercadoPago para el indicador "MediasMovilesAutomaticas"
 * Cobro único, acceso vitalicio administrado manualmente en TradingView.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    await dbConnect();

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'Debes iniciar sesión' });
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    const product = 'MediasMovilesAutomaticas';
    
    // Obtener precio desde Pricing
    const pricing = await Pricing.findOne().sort({ createdAt: -1 });
    if (!pricing) {
      return res.status(500).json({ success: false, error: 'No hay configuración de precios' });
    }
    
    const amount = pricing.indicadores?.mediasMovilesAutomaticas?.price || 30000;
    const currency = pricing.indicadores?.mediasMovilesAutomaticas?.currency || 'ARS';

    const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
    const externalReference = `indicator_${product}_${user._id}_${Date.now()}`;

    const successUrl = `${baseUrl}/payment/indicator-success?reference=${externalReference}`;
    const failureUrl = `${baseUrl}/payment/failure?reference=${externalReference}`;
    const pendingUrl = `${baseUrl}/payment/pending?reference=${externalReference}`;

    const pref = await createMercadoPagoPreference(
      `Indicador ${product}`,
      amount,
      currency,
      externalReference,
      successUrl,
      failureUrl,
      pendingUrl
    );

    if (!pref.success) {
      return res.status(500).json({ success: false, error: pref.error || 'Error creando preferencia' });
    }

    const payment = new Payment({
      userId: user._id,
      userEmail: user.email,
      service: product,
      amount,
      currency,
      status: 'pending',
      mercadopagoPaymentId: null,
      externalReference,
      paymentMethodId: '',
      paymentTypeId: '',
      installments: 1,
      transactionDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      metadata: {
        type: 'one-time',
        category: 'indicator',
        preferenceId: pref.preferenceId
      }
    });

    await payment.save();

    return res.status(200).json({
      success: true,
      checkoutUrl: pref.initPoint,
      externalReference
    });
  } catch (error) {
    console.error('Error en create-indicator-checkout:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}


