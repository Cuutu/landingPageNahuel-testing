import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/googleAuth';
import dbConnect from '../../../../lib/mongodb';
import MonthlyTraining from '../../../../models/MonthlyTraining';
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

    // Obtener todos los entrenamientos con estudiantes pagados
    const trainings = await MonthlyTraining.find({
      'students.paymentStatus': 'completed'
    })
    .sort({ year: -1, month: -1 })
    .lean();

    // Procesar los datos para mostrar usuarios por entrenamiento
    const trainingUsers = trainings.map(training => {
      const paidStudents = training.students.filter((s: any) => s.paymentStatus === 'completed');
      
      return {
        trainingId: training._id,
        title: training.title,
        month: training.month,
        year: training.year,
        monthName: getMonthName(training.month),
        price: training.price,
        maxStudents: training.maxStudents,
        totalPaidStudents: paidStudents.length,
        students: paidStudents.map((student: any) => ({
          userId: student.userId,
          name: student.name,
          email: student.email,
          phone: student.phone,
          enrolledAt: student.enrolledAt,
          paymentId: student.paymentId,
          experienceLevel: student.experienceLevel,
          paidMonth: student.paidMonth,
          paidYear: student.paidYear,
          attendance: student.attendance
        }))
      };
    });

    // Obtener estadísticas generales
    const totalTrainings = trainings.length;
    const totalStudents = trainings.reduce((sum, training) => 
      sum + training.students.filter((s: any) => s.paymentStatus === 'completed').length, 0
    );
    const totalRevenue = trainings.reduce((sum, training) => 
      sum + (training.students.filter((s: any) => s.paymentStatus === 'completed').length * training.price), 0
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
