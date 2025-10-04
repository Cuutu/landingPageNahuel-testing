import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/googleAuth';
import connectToDatabase from '../../../../lib/mongodb';
import MonthlyTraining from '../../../../models/MonthlyTraining';
import User from '../../../../models/User';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    await connectToDatabase();

    const { trainingId } = req.body;

    if (!trainingId) {
      return res.status(400).json({ error: 'ID del entrenamiento requerido' });
    }

    // Buscar el entrenamiento
    const training = await MonthlyTraining.findById(trainingId);
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // Verificar que el entrenamiento esté disponible
    if (training.status !== 'open') {
      return res.status(400).json({ error: 'Entrenamiento no disponible para inscripción' });
    }

    // Verificar cupos disponibles
    if (training.students.length >= training.maxStudents) {
      return res.status(400).json({ error: 'No hay cupos disponibles' });
    }

    // Verificar que las inscripciones estén abiertas
    const now = new Date();
    const registrationOpen = new Date(training.registrationOpenDate);
    const registrationClose = new Date(training.registrationCloseDate);

    if (now < registrationOpen) {
      return res.status(400).json({ error: 'Las inscripciones aún no han abierto' });
    }

    if (now > registrationClose) {
      return res.status(400).json({ error: 'Las inscripciones han cerrado' });
    }

    // Verificar que el usuario no esté ya inscrito
    const isAlreadyEnrolled = training.students.some(
      (student: any) => student.email === session.user.email
    );

    if (isAlreadyEnrolled) {
      return res.status(400).json({ error: 'Ya estás inscrito en este entrenamiento' });
    }

    // Buscar información del usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Crear preferencia de MercadoPago
    const preference = new Preference(client);

    const preferenceData = {
      items: [
        {
          id: `monthly-training-${training._id}`,
          title: `${training.title} - Entrenamiento Mensual`,
          description: `Swing Trading - ${training.monthName} ${training.year}`,
          quantity: 1,
          unit_price: training.price,
          currency_id: 'USD'
        }
      ],
      payer: {
        name: user.name || session.user.name || 'Usuario',
        email: session.user.email,
        identification: {
          type: 'Email',
          number: session.user.email
        }
      },
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/payment/monthly-training/success?training_id=${training._id}`,
        failure: `${process.env.NEXTAUTH_URL}/payment/monthly-training/failure?training_id=${training._id}`,
        pending: `${process.env.NEXTAUTH_URL}/payment/monthly-training/pending?training_id=${training._id}`
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago-monthly-training`,
      external_reference: JSON.stringify({
        trainingId: training._id.toString(),
        userId: user._id.toString(),
        userEmail: session.user.email,
        type: 'monthly-training'
      }),
      statement_descriptor: 'SWING TRADING',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      metadata: {
        training_id: training._id.toString(),
        user_id: user._id.toString(),
        user_email: session.user.email,
        training_title: training.title,
        training_month: training.month,
        training_year: training.year
      }
    };

    const result = await preference.create({ body: preferenceData });

    console.log('✅ Preferencia de MercadoPago creada:', {
      preferenceId: result.id,
      trainingId: training._id,
      userEmail: session.user.email,
      amount: training.price
    });

    return res.status(200).json({
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
      training: {
        id: training._id,
        title: training.title,
        price: training.price,
        month: training.monthName,
        year: training.year
      }
    });

  } catch (error) {
    console.error('Error creando checkout de MercadoPago:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}
