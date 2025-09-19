import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Payment from '@/models/Payment';
import { 
  createMercadoPagoPreference, 
  createSubscriptionPreference, 
  createTrainingPreference 
} from '@/lib/mercadopago';
import { z } from 'zod';

// Schema de validación
const checkoutSchema = z.object({
  service: z.enum(['TraderCall', 'SmartMoney', 'CashFlow', 'SwingTrading', 'DowJones']),
  amount: z.number().positive('El monto debe ser positivo'),
  currency: z.enum(['ARS']).default('ARS'),
  type: z.enum(['subscription', 'training']).default('subscription')
});

/**
 * API para crear checkout de MercadoPago
 * POST: Crear preferencia de pago y retornar URL de checkout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/payments/mercadopago/create-checkout`);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido' 
    });
  }

  try {
    await dbConnect();

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false,
        error: 'Debes iniciar sesión para realizar el pago' 
      });
    }

    // Validar datos de entrada
    const validatedData = checkoutSchema.parse(req.body);
    const { service, amount, currency, type } = validatedData;

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // Verificar si ya tiene suscripción activa (solo para suscripciones)
    if (type === 'subscription') {
      const hasActiveSubscription = user.hasServiceAccess(service);
      if (hasActiveSubscription) {
        return res.status(409).json({ 
          success: false,
          error: `Ya tienes una suscripción activa a ${service}` 
        });
      }
    }

    // Verificar si ya tiene entrenamiento activo (solo para entrenamientos)
    if (type === 'training') {
      const hasTraining = user.entrenamientos.some(
        (entrenamiento: any) => entrenamiento.tipo === service && entrenamiento.activo
      );
      if (hasTraining) {
        return res.status(409).json({ 
          success: false,
          error: `Ya tienes acceso al entrenamiento ${service}` 
        });
      }
    }

    // Crear URLs de retorno
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const externalReference = `${type}_${service}_${user._id}_${Date.now()}`;
    
    const successUrl = `${baseUrl}/payment/success?reference=${externalReference}`;
    const failureUrl = `${baseUrl}/payment/failure?reference=${externalReference}`;
    const pendingUrl = `${baseUrl}/payment/pending?reference=${externalReference}`;

    // Crear preferencia según el tipo
    console.log('🔧 Creando preferencia:', {
      type,
      service,
      amount,
      currency,
      externalReference,
      successUrl,
      failureUrl,
      pendingUrl
    });

    let preferenceResult;
    if (type === 'subscription') {
      preferenceResult = await createSubscriptionPreference(
        service,
        amount,
        currency,
        externalReference,
        successUrl,
        failureUrl,
        pendingUrl
      );
    } else {
      preferenceResult = await createTrainingPreference(
        service,
        amount,
        currency,
        externalReference,
        successUrl,
        failureUrl,
        pendingUrl
      );
    }

    console.log('📊 Resultado de preferencia:', preferenceResult);

    if (!preferenceResult.success) {
      return res.status(500).json({
        success: false,
        error: preferenceResult.error || 'Error creando preferencia de pago'
      });
    }

    const checkoutUrl = preferenceResult.initPoint;

    // ✅ IMPORTANTE: Crear el pago en la base de datos para que el webhook lo encuentre
    const payment = new Payment({
      userId: user._id,
      userEmail: user.email,
      service,
      amount,
      currency,
      status: 'pending',
      mercadopagoPaymentId: null, // Se actualizará en el webhook
      externalReference: externalReference,
      paymentMethodId: '',
      paymentTypeId: '',
      installments: 1,
      transactionDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: {
        type,
        preferenceId: preferenceResult.preferenceId,
        createdFromCheckout: true
      }
    });

    await payment.save();

    console.log('✅ Preferencia creada y pago guardado:', {
      preferenceId: preferenceResult.preferenceId,
      externalReference: externalReference,
      checkoutUrl: checkoutUrl,
      paymentId: payment._id
    });

    console.log('✅ Checkout creado exitosamente:', {
      user: user.email,
      service,
      type,
      amount,
      currency,
      externalReference: externalReference,
      paymentId: payment._id
    });

    return res.status(200).json({
      success: true,
      checkoutUrl,
      externalReference: externalReference,
      service,
      type,
      amount,
      currency,
      message: 'Checkout creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando checkout:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors
      });
    }

    // Log más detallado del error
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : 'No stack disponible';
    
    console.error('🔍 Error detallado:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });

    return res.status(500).json({
      success: false,
      error: `Error interno del servidor: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
} 