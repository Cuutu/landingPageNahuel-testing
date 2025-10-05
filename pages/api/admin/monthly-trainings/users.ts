import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/googleAuth';
import dbConnect from '../../../../lib/mongodb';
import MonthlyTraining from '../../../../models/MonthlyTraining';
import MonthlyTrainingSubscription from '../../../../models/MonthlyTrainingSubscription';
import User from '../../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Conectar a la base de datos primero
    await dbConnect();

    // Verificar autenticación y permisos de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Obtener todos los entrenamientos del modelo viejo
    const trainings = await MonthlyTraining.find({
      'students.paymentStatus': 'completed'
    })
    .sort({ year: -1, month: -1 })
    .lean();

    // Obtener todas las suscripciones mensuales completadas
    const monthlySubscriptions = await MonthlyTrainingSubscription.find({
      paymentStatus: 'completed',
      isActive: true
    })
    .sort({ subscriptionYear: -1, subscriptionMonth: -1 })
    .lean();

    // Agrupar suscripciones por mes/año/tipo
    const subscriptionsByMonthYear = monthlySubscriptions.reduce((acc: any, sub) => {
      const key = `${sub.trainingType}_${sub.subscriptionYear}_${sub.subscriptionMonth}`;
      if (!acc[key]) {
        acc[key] = {
          trainingType: sub.trainingType,
          month: sub.subscriptionMonth,
          year: sub.subscriptionYear,
          subscriptions: []
        };
      }
      acc[key].subscriptions.push(sub);
      return acc;
    }, {});

    // Procesar entrenamientos del modelo viejo
    const trainingUsers = trainings.map(training => {
      const paidStudents = training.students.filter((s: any) => s.paymentStatus === 'completed');
      
      // Buscar suscripciones del nuevo sistema para este mes/año
      const key = `SwingTrading_${training.year}_${training.month}`;
      const newSubscriptions = subscriptionsByMonthYear[key]?.subscriptions || [];
      
      // Combinar estudiantes de ambos sistemas
      const newSystemStudents = newSubscriptions.map((sub: any) => ({
        userId: sub.userId,
        name: sub.userName,
        email: sub.userEmail,
        phone: '',
        enrolledAt: sub.createdAt,
        paymentId: sub.paymentId,
        experienceLevel: 'No especificado',
        paidMonth: sub.subscriptionMonth,
        paidYear: sub.subscriptionYear,
        attendance: [],
        source: 'monthly-subscription' // Indicador de origen
      }));

      const allStudents = [
        ...paidStudents.map((s: any) => ({
          userId: s.userId,
          name: s.name,
          email: s.email,
          phone: s.phone,
          enrolledAt: s.enrolledAt,
          paymentId: s.paymentId,
          experienceLevel: s.experienceLevel,
          paidMonth: s.paidMonth,
          paidYear: s.paidYear,
          attendance: s.attendance,
          source: 'legacy' // Indicador de origen
        })),
        ...newSystemStudents
      ];
      
      return {
        trainingId: training._id,
        title: training.title,
        month: training.month,
        year: training.year,
        monthName: getMonthName(training.month),
        price: training.price,
        maxStudents: training.maxStudents,
        totalPaidStudents: allStudents.length,
        students: allStudents
      };
    });

    // Agregar entrenamientos que solo existen en el nuevo sistema (sin modelo viejo)
    Object.values(subscriptionsByMonthYear).forEach((group: any) => {
      // Verificar si ya existe un entrenamiento para este mes/año
      const exists = trainings.some(t => 
        t.month === group.month && 
        t.year === group.year
      );

      if (!exists && group.subscriptions.length > 0) {
        const firstSub = group.subscriptions[0];
        trainingUsers.push({
          trainingId: `new_${group.trainingType}_${group.year}_${group.month}`,
          title: `${group.trainingType} - ${getMonthName(group.month)} ${group.year}`,
          month: group.month,
          year: group.year,
          monthName: getMonthName(group.month),
          price: firstSub.paymentAmount,
          maxStudents: 10,
          totalPaidStudents: group.subscriptions.length,
          students: group.subscriptions.map((sub: any) => ({
            userId: sub.userId,
            name: sub.userName,
            email: sub.userEmail,
            phone: '',
            enrolledAt: sub.createdAt,
            paymentId: sub.paymentId,
            experienceLevel: 'No especificado',
            paidMonth: sub.subscriptionMonth,
            paidYear: sub.subscriptionYear,
            attendance: [],
            source: 'monthly-subscription'
          }))
        });
      }
    });

    // Ordenar por año y mes (más recientes primero)
    trainingUsers.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    // Obtener estadísticas generales
    const totalTrainings = trainingUsers.length;
    const totalStudents = trainingUsers.reduce((sum, training) => 
      sum + training.totalPaidStudents, 0
    );
    const totalRevenue = trainingUsers.reduce((sum, training) => 
      sum + (training.totalPaidStudents * training.price), 0
    );

    return res.status(200).json({
      success: true,
      data: {
        trainings: trainingUsers,
        stats: {
          totalTrainings,
          totalStudents,
          totalRevenue
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuarios de entrenamientos:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}

function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || 'Mes Desconocido';
}
