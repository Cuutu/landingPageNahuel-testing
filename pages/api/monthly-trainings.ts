import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/googleAuth';
import dbConnect from '../../lib/mongodb';
import MonthlyTraining from '../../models/MonthlyTraining';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const { upcoming, year, month, id } = req.query;
    const session = await getServerSession(req, res, authOptions);

    let filter: any = {};

    // Si se especifica un ID, buscar ese entrenamiento específico
    if (id) {
      filter._id = id;
    } else {
      // Filtrar por año y mes si se especifica
      if (year) filter.year = parseInt(year as string);
      if (month) filter.month = parseInt(month as string);
    }

    // Si se pide solo próximos entrenamientos, incluir solo abiertos o llenos
    if (upcoming === 'true') {
      filter.status = { $in: ['open', 'full'] };
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      filter.$or = [
        { year: { $gt: currentYear } },
        { 
          year: currentYear, 
          month: { $gte: currentMonth }
        }
      ];
    } else {
      // Para navegación de meses, mostrar todos los entrenamientos (incluso draft para admins)
      if (!session || session.user.role !== 'admin') {
        filter.status = { $in: ['open', 'full', 'in-progress', 'completed'] };
      }
    }

    const trainings = await MonthlyTraining.find(filter)
      .select('-students.userId -students.paymentId') // No exponer datos sensibles
      .sort({ year: 1, month: 1 }) // Ordenar cronológicamente
      .lean();

    // Agregar información pública útil
    const publicTrainings = trainings.map(training => {
      const availableSpots = training.maxStudents - training.students.length;
      
      // Verificar si el usuario actual está inscrito
      let isEnrolled = false;
      if (session?.user?.email) {
        isEnrolled = training.students.some((student: any) => student.email === session.user.email);
      }

      return {
        _id: training._id,
        title: training.title,
        description: training.description,
        month: training.month,
        year: training.year,
        monthName: getMonthName(training.month),
        price: training.price,
        maxStudents: training.maxStudents,
        enrolledStudents: training.students.length,
        availableSpots,
        status: training.status,
        canEnroll: availableSpots > 0 && !isEnrolled && training.status === 'open',
        isEnrolled,
        classes: training.classes.map((cls: any) => ({
          _id: cls._id,
          date: cls.date,
          startTime: cls.startTime,
          title: cls.title,
          status: cls.status
        })),
        totalClasses: training.classes.length,
        createdAt: training.createdAt
      };
    });

    return res.status(200).json({
      success: true,
      data: publicTrainings,
      total: publicTrainings.length
    });
  } catch (error) {
    console.error('Error obteniendo entrenamientos mensuales:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
}

// Helper function para obtener nombre del mes
function getMonthName(month: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || 'Mes inválido';
}
