import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { createBookingPreference } from '@/lib/mercadopago';
import { z } from 'zod';
import AdvisoryDate from '@/models/AdvisoryDate';

// Schema de validación para reservas
const bookingCheckoutSchema = z.object({
  serviceType: z.enum(['ConsultorioFinanciero', 'CuentaAsesorada', 'SwingTrading', 'AdvancedStrategies']),
  amount: z.number().positive('El monto debe ser positivo'),
  currency: z.enum(['ARS']).default('ARS'),
  reservationData: z.object({
    type: z.enum(['training', 'advisory']),
    serviceType: z.string(),
    startDate: z.string(),
    duration: z.number(),
    price: z.number(),
    notes: z.string(),
    userEmail: z.string(),
    userName: z.string(),
    advisoryDateId: z.string().optional()
  })
});

/**
 * API para crear checkout de MercadoPago para reservas
 * POST: Crear preferencia de pago y retornar URL de checkout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`📡 ${req.method} /api/payments/mercadopago/create-booking-checkout`);

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
    const validatedData = bookingCheckoutSchema.parse(req.body);
    const { serviceType, amount, currency, reservationData } = validatedData;

    // Buscar usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'Usuario no encontrado' 
      });
    }

    // 🔒 HOLD ATÓMICO DEL TURNO (solo para asesorías con advisoryDateId)
    let heldAdvisory: any = null;
    if (reservationData.type === 'advisory' && reservationData.serviceType === 'ConsultorioFinanciero') {
      const now = new Date();
      const holdUntil = new Date(now.getTime() + 15 * 60 * 1000);

      if (reservationData.advisoryDateId) {
        heldAdvisory = await AdvisoryDate.findOneAndUpdate(
          {
            _id: reservationData.advisoryDateId,
            advisoryType: 'ConsultorioFinanciero',
            isActive: true,
            $or: [
              { isBooked: false },
              { isBooked: true, confirmedBooking: false, tempReservationExpiresAt: { $lte: now } }
            ]
          },
          {
            $set: {
              isBooked: true,
              tempReservationTimestamp: now,
              tempReservationExpiresAt: holdUntil
            }
          },
          { new: true }
        );

        if (!heldAdvisory) {
          return res.status(409).json({
            success: false,
            error: 'La fecha seleccionada ya no está disponible',
          });
        }
      } else {
        console.warn('⚠️ advisoryDateId no enviado en reservationData. Se continuará sin hold atómico.');
      }
    }

    // Crear URLs de retorno
    const rawBase = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const baseUrl = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
    const externalReference = `booking_${serviceType}_${user._id}_${Date.now()}`;
    
    const successUrl = `${baseUrl}/payment/success?reference=${externalReference}&type=booking`;
    const failureUrl = `${baseUrl}/payment/failure?reference=${externalReference}&type=booking`;
    const pendingUrl = `${baseUrl}/payment/pending?reference=${externalReference}&type=booking`;

    // Guardar los datos de reserva en la base de datos para que el webhook los pueda recuperar
    const { default: Payment } = await import('@/models/Payment');
    
    const tempPayment = new Payment({
      userId: user._id,
      userEmail: user.email,
      service: serviceType,
      amount: amount,
      currency: currency,
      status: 'pending',
      mercadopagoPaymentId: null,
      externalReference: externalReference,
      paymentMethodId: '',
      paymentTypeId: '',
      installments: 1,
      transactionDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: {
        reservationData: {
          ...reservationData,
          advisoryDateId: reservationData.advisoryDateId || heldAdvisory?._id?.toString()
        },
        createdFromCheckout: true
      }
    });
    
    await tempPayment.save();
    
    console.log('✅ Datos de reserva guardados temporalmente:', {
      paymentId: tempPayment._id,
      externalReference: externalReference,
      reservationData: tempPayment.metadata?.reservationData
    });

    // Crear preferencia de reserva
    console.log('🔧 Creando preferencia de reserva:', {
      serviceType,
      amount,
      currency,
      externalReference,
      reservationData: tempPayment.metadata?.reservationData,
      successUrl,
      failureUrl,
      pendingUrl
    });

    const preferenceResult = await createBookingPreference(
      serviceType,
      amount,
      currency,
      externalReference,
      successUrl,
      failureUrl,
      pendingUrl
    );

    console.log('📊 Resultado de preferencia de reserva:', preferenceResult);

    if (!preferenceResult.success) {
      return res.status(500).json({
        success: false,
        error: preferenceResult.error || 'Error creando preferencia de pago'
      });
    }

    const checkoutUrl = preferenceResult.initPoint;

    console.log('✅ Checkout de reserva creado exitosamente:', {
      user: user.email,
      serviceType,
      amount,
      currency,
      externalReference: externalReference,
      reservationData: tempPayment.metadata?.reservationData
    });

    return res.status(200).json({
      success: true,
      checkoutUrl,
      externalReference: externalReference,
      serviceType,
      amount,
      currency,
      reservationData: tempPayment.metadata?.reservationData,
      message: 'Checkout de reserva creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando checkout de reserva:', error);

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