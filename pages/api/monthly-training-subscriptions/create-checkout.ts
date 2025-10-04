import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import MonthlyTrainingSubscription from '../../../models/MonthlyTrainingSubscription';
import Pricing from '../../../models/Pricing';
import { z } from 'zod';

// Validación de entrada
const createCheckoutSchema = z.object({
  trainingType: z.enum(['SwingTrading', 'DayTrading', 'DowJones']).default('SwingTrading'),
  subscriptionMonth: z.number().min(1).max(12),
  subscriptionYear: z.number().min(2024).max(2030)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!(session as any)?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Validar datos de entrada
    const validationResult = createCheckoutSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: validationResult.error.errors 
      });
    }

    const { trainingType, subscriptionMonth, subscriptionYear } = validationResult.data;

    // Verificar que el mes/año no sea en el pasado
    const now = new Date();
    const selectedDate = new Date(subscriptionYear, subscriptionMonth - 1, 1);
    if (selectedDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
      return res.status(400).json({ 
        error: 'No puedes suscribirte a un mes que ya pasó' 
      });
    }

    // Verificar si ya existe una suscripción para ese mes/año
    const existingSubscription = await MonthlyTrainingSubscription.findOne({
      userId: (session as any).user.id,
      trainingType,
      subscriptionMonth,
      subscriptionYear,
      paymentStatus: { $in: ['pending', 'completed'] }
    });

    if (existingSubscription) {
      return res.status(400).json({ 
        error: 'Ya tienes una suscripción para este mes' 
      });
    }

    // Verificar disponibilidad de cupos (máximo 10 suscriptores por mes)
    const availability = await (MonthlyTrainingSubscription as any).checkAvailability(
      trainingType, 
      subscriptionYear, 
      subscriptionMonth, 
      10
    );

    if (!availability.available) {
      return res.status(400).json({ 
        error: `No hay cupos disponibles para este mes. Actualmente hay ${availability.currentSubscribers}/10 suscriptores.` 
      });
    }

    // Obtener precio desde la base de datos
    const pricing = await Pricing.findOne().sort({ createdAt: -1 });
    if (!pricing) {
      return res.status(500).json({ error: 'No se pudo obtener el precio' });
    }

    let amount = 0;
    if (trainingType === 'SwingTrading') {
      amount = pricing.entrenamientos?.swingTrading?.monthly || 0;
    } else if (trainingType === 'DayTrading') {
      amount = pricing.entrenamientos?.dayTrading?.monthly || 0;
    } else if (trainingType === 'DowJones') {
      amount = pricing.entrenamientos?.dowJones?.monthly || 0;
    }

    if (amount <= 0) {
      return res.status(500).json({ error: 'Precio no configurado para este entrenamiento' });
    }

    // Configurar MercadoPago
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 }
    });

    const preference = new Preference(client);

    // Generar ID único para el pago
    const paymentId = `MTS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Crear suscripción en la base de datos (pendiente)
    const monthlySubscription = new MonthlyTrainingSubscription({
      userId: (session as any).user.id,
      userEmail: (session as any).user.email,
      userName: (session as any).user.name || (session as any).user.email,
      trainingType,
      subscriptionMonth,
      subscriptionYear,
      paymentId,
      paymentAmount: amount,
      paymentStatus: 'pending'
    });

    await monthlySubscription.save();

    // Crear preferencia de MercadoPago
    const preferenceData = {
      items: [
        {
          id: `monthly-training-${trainingType.toLowerCase()}`,
          title: `Entrenamiento ${trainingType === 'SwingTrading' ? 'Swing Trading' : trainingType} - ${subscriptionMonth}/${subscriptionYear}`,
          description: `Suscripción mensual para el entrenamiento de ${trainingType === 'SwingTrading' ? 'Swing Trading' : trainingType} del mes ${subscriptionMonth}/${subscriptionYear}`,
          quantity: 1,
          unit_price: amount,
          currency_id: 'ARS'
        }
      ],
      payer: {
        email: (session as any).user.email,
        name: (session as any).user.name || (session as any).user.email
      },
      external_reference: paymentId,
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/entrenamientos/${trainingType.toLowerCase()}/pago-exitoso`,
        failure: `${process.env.NEXTAUTH_URL}/entrenamientos/${trainingType.toLowerCase()}/pago-fallido`,
        pending: `${process.env.NEXTAUTH_URL}/entrenamientos/${trainingType.toLowerCase()}/pago-pendiente`
      },
      auto_return: 'approved',
      metadata: {
        type: 'monthly-training-subscription',
        trainingType,
        subscriptionMonth,
        subscriptionYear,
        userId: (session as any).user.id,
        paymentId
      }
    };

    const result = await preference.create({ body: preferenceData });

    return res.status(200).json({
      success: true,
      checkoutUrl: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
      paymentId,
      amount
    });

  } catch (error) {
    console.error('Error creating monthly training checkout:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
