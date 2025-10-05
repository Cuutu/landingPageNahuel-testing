import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import authOptions from '../auth/[...nextauth]';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import MonthlyTrainingSubscription from '../../../models/MonthlyTrainingSubscription';
import Pricing from '../../../models/Pricing';
import { z } from 'zod';
import dbConnect from '../../../lib/mongodb';

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
    console.log('🔍 Monthly Training Checkout - Iniciando proceso');
    console.log('📝 Request body:', req.body);
    
    // Conectar a la base de datos
    await dbConnect();
    console.log('✅ Conectado a la base de datos');
    
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    console.log('👤 Session:', session ? 'Autenticado' : 'No autenticado');
    
    if (!(session as any)?.user?.email) {
      console.log('❌ No autorizado - sin sesión');
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Validar datos de entrada
    const validationResult = createCheckoutSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log('❌ Validación fallida:', validationResult.error.errors);
      return res.status(400).json({ 
        error: 'Datos inválidos', 
        details: validationResult.error.errors 
      });
    }

    const { trainingType, subscriptionMonth, subscriptionYear } = validationResult.data;
    console.log('✅ Datos validados:', { trainingType, subscriptionMonth, subscriptionYear });

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
    console.log('💰 Obteniendo precio desde la base de datos...');
    const pricing = await Pricing.findOne().sort({ createdAt: -1 });
    if (!pricing) {
      console.log('❌ No se encontró pricing en la base de datos');
      return res.status(500).json({ error: 'No se pudo obtener el precio' });
    }

    console.log('📊 Pricing encontrado:', pricing);

    let amount = 0;
    let currency = 'ARS'; // Por defecto ARS
    
    if (trainingType === 'SwingTrading') {
      amount = pricing.entrenamientos?.swingTrading?.price || 0;
      currency = pricing.entrenamientos?.swingTrading?.currency || pricing.currency || 'ARS';
    } else if (trainingType === 'DayTrading') {
      amount = pricing.entrenamientos?.dayTrading?.price || 0;
      currency = pricing.entrenamientos?.dayTrading?.currency || pricing.currency || 'ARS';
    } else if (trainingType === 'DowJones') {
      amount = pricing.entrenamientos?.advanced?.price || 0; // DowJones usa advanced
      currency = pricing.entrenamientos?.advanced?.currency || pricing.currency || 'ARS';
    }

    console.log('💵 Monto calculado:', amount, 'Currency:', currency);
    
    // Si el precio está en USD pero necesitamos ARS, hacer conversión
    if (currency === 'USD' && pricing.currency === 'ARS') {
      // Asumir que el precio ya está en ARS pero el campo currency está mal
      console.log('⚠️ Precio marcado como USD pero base de datos en ARS, usando precio tal como está');
    }

    if (amount <= 0) {
      console.log('❌ Precio no configurado o es 0');
      return res.status(500).json({ error: 'Precio no configurado para este entrenamiento' });
    }

    // Configurar MercadoPago
    console.log('🔧 Configurando MercadoPago...');
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.log('❌ MERCADOPAGO_ACCESS_TOKEN no configurado');
      return res.status(500).json({ error: 'Configuración de MercadoPago no encontrada' });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      options: { timeout: 5000 }
    });

    const preference = new Preference(client);
    console.log('✅ MercadoPago configurado correctamente');

    // Generar ID único para el pago (incluye email del usuario para mayor unicidad)
    const emailPrefix = (session as any).user.email.split('@')[0].slice(0, 5);
    const paymentId = `MTS_${emailPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Crear suscripción en la base de datos (pendiente)
    console.log('💾 Creando suscripción en la base de datos...');
    
    // Debug: Verificar datos de la sesión
    console.log('🔍 Session user data:', {
      id: (session as any).user?.id,
      email: (session as any).user?.email,
      name: (session as any).user?.name
    });
    
    // Calcular fechas de inicio y fin del mes
    const startDate = new Date(subscriptionYear, subscriptionMonth - 1, 1);
    const endDate = new Date(subscriptionYear, subscriptionMonth, 0, 23, 59, 59, 999);
    
    console.log('📅 Fechas calculadas:', { startDate, endDate });
    
    const subscriptionData = {
      userId: (session as any).user.id || (session as any).user.email, // Usar email como fallback si no hay ID
      userEmail: (session as any).user.email,
      userName: (session as any).user.name || (session as any).user.email,
      trainingType,
      subscriptionMonth,
      subscriptionYear,
      startDate,
      endDate,
      paymentId,
      paymentAmount: amount,
      paymentStatus: 'pending'
    };
    
    console.log('📝 Datos de suscripción:', subscriptionData);
    
    const monthlySubscription = new MonthlyTrainingSubscription(subscriptionData);
    console.log('📋 Objeto de suscripción creado:', {
      _id: monthlySubscription._id,
      userEmail: monthlySubscription.userEmail,
      trainingType: monthlySubscription.trainingType
    });

    try {
      await monthlySubscription.save();
      console.log('✅ Suscripción guardada exitosamente con ID:', monthlySubscription._id);
    } catch (saveError: any) {
      console.error('❌ Error guardando suscripción:', saveError);
      
      // Verificar si es un error de duplicado
      if (saveError.code === 11000) {
        console.error('❌ Error de duplicado detectado:', saveError.keyPattern);
        return res.status(400).json({ 
          error: 'Ya existe una suscripción con estos datos', 
          details: 'Puede que ya tengas una suscripción pendiente o completada para este mes. Verifica tu perfil o contacta soporte.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Error guardando suscripción', 
        details: saveError instanceof Error ? saveError.message : 'Error desconocido' 
      });
    }

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
        success: `${process.env.NEXTAUTH_URL}/entrenamientos/swing-trading/pago-exitoso`,
        failure: `${process.env.NEXTAUTH_URL}/entrenamientos/swing-trading/pago-fallido`,
        pending: `${process.env.NEXTAUTH_URL}/entrenamientos/swing-trading/pago-pendiente`
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

    console.log('🛒 Creando preferencia de MercadoPago...');
    const result = await preference.create({ body: preferenceData });
    console.log('✅ Preferencia creada:', result.id);

    // Verificar que la suscripción se guardó correctamente
    try {
      const savedSubscription = await MonthlyTrainingSubscription.findById(monthlySubscription._id);
      if (savedSubscription) {
        console.log('✅ Verificación: Suscripción encontrada en BD:', {
          id: savedSubscription._id,
          userEmail: savedSubscription.userEmail,
          paymentStatus: savedSubscription.paymentStatus
        });
      } else {
        console.error('❌ Verificación: Suscripción NO encontrada en BD después del guardado');
      }
    } catch (verifyError) {
      console.error('❌ Error verificando suscripción guardada:', verifyError);
    }

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
