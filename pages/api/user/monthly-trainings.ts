import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import connectToDatabase from '../../../lib/mongodb';
import MonthlyTraining from '../../../models/MonthlyTraining';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    await connectToDatabase();

    // Buscar todos los entrenamientos donde el usuario está inscrito
    const trainings = await MonthlyTraining.find({
      'students.email': session.user.email
    }).sort({ year: -1, month: -1 });

    // Procesar los datos para el estudiante
    const studentTrainings = trainings.map(training => {
      // Encontrar los datos del estudiante
      const studentData = training.students.find(
        (student: any) => student.email === session.user.email
      );

      if (!studentData) {
        return null;
      }

      // Calcular estadísticas de asistencia
      const totalClasses = training.classes.length;
      const attendedClasses = studentData.attendance.filter(
        (att: any) => att.attended
      ).length;
      const attendancePercentage = totalClasses > 0 
        ? Math.round((attendedClasses / totalClasses) * 100) 
        : 0;

      // Mapear las clases con información de asistencia
      const classesWithAttendance = training.classes.map((cls: any) => {
        const attendance = studentData.attendance.find(
          (att: any) => att.classId === cls._id.toString()
        );

        return {
          _id: cls._id,
          date: cls.date,
          startTime: cls.startTime,
          endTime: cls.endTime,
          title: cls.title,
          description: cls.description,
          status: cls.status,
          meetLink: cls.meetLink,
          attended: attendance?.attended || false,
          attendedAt: attendance?.attendedAt
        };
      });

      return {
        _id: training._id,
        title: training.title,
        description: training.description,
        month: training.month,
        year: training.year,
        monthName: getMonthName(training.month),
        price: training.price,
        status: training.status,
        classes: classesWithAttendance,
        enrolledAt: studentData.enrolledAt,
        paymentStatus: studentData.paymentStatus,
        paymentId: studentData.paymentId,
        experienceLevel: studentData.experienceLevel,
        totalClasses,
        attendedClasses,
        attendancePercentage
      };
    }).filter(Boolean); // Filtrar valores null

    return res.status(200).json({
      success: true,
      data: studentTrainings
    });

  } catch (error) {
    console.error('Error obteniendo entrenamientos del estudiante:', error);
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
