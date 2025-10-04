import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import MonthlyTraining from '../../../models/MonthlyTraining';
import User from '../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Debe iniciar sesión para inscribirse' });
  }

  try {
    const {
      trainingId,
      phone,
      experienceLevel
    } = req.body;

    if (!trainingId) {
      return res.status(400).json({ error: 'ID de entrenamiento requerido' });
    }

    // Obtener información del usuario
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Obtener el entrenamiento
    const training = await MonthlyTraining.findById(trainingId);
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // Validaciones
    const now = new Date();
    const registrationOpen = new Date(training.registrationOpenDate) <= now;
    const registrationClosed = new Date(training.registrationCloseDate) <= now;

    if (!registrationOpen) {
      return res.status(400).json({ 
        error: 'Las inscripciones aún no están abiertas',
        openDate: training.registrationOpenDate
      });
    }

    if (registrationClosed) {
      return res.status(400).json({ 
        error: 'Las inscripciones ya cerraron',
        closeDate: training.registrationCloseDate
      });
    }

    if (training.status !== 'open') {
      return res.status(400).json({ error: 'Este entrenamiento no está disponible para inscripciones' });
    }

    // Verificar cupos disponibles
    if (training.students.length >= training.maxStudents) {
      return res.status(400).json({ error: 'No hay cupos disponibles' });
    }

    // Verificar que el usuario no esté ya inscrito
    const existingStudent = training.students.find((s: any) => 
      s.userId === user._id.toString() || s.email === session.user.email
    );
    
    if (existingStudent) {
      return res.status(400).json({ error: 'Ya estás inscrito en este entrenamiento' });
    }

    // Crear array de asistencia para todas las clases
    const attendance = training.classes.map((cls: any) => ({
      classId: cls._id.toString(),
      attended: false
    }));

    // Agregar estudiante con estado de pago pendiente
    const newStudent = {
      userId: user._id.toString(),
      name: user.name || session.user.name || 'Usuario',
      email: session.user.email,
      phone: phone || user.phone,
      enrolledAt: new Date(),
      paymentStatus: 'pending', // Se actualizará cuando se complete el pago
      experienceLevel: experienceLevel || 'principiante',
      attendance
    };

    training.students.push(newStudent);

    // Actualizar estado del entrenamiento si se llenó
    if (training.students.length >= training.maxStudents) {
      training.status = 'full';
    }

    await training.save();

    // Respuesta con información para proceder al pago
    return res.status(201).json({
      success: true,
      message: 'Pre-inscripción realizada exitosamente. Proceda al pago para confirmar.',
      data: {
        trainingId: training._id,
        studentId: newStudent.userId,
        training: {
          title: training.title,
          month: training.month,
          year: training.year,
          monthName: getMonthName(training.month),
          price: training.price,
          classes: training.classes.map((cls: any) => ({
            date: cls.date,
            startTime: cls.startTime,
            endTime: cls.endTime,
            title: cls.title
          }))
        },
        student: {
          name: newStudent.name,
          email: newStudent.email,
          enrolledAt: newStudent.enrolledAt
        },
        paymentRequired: true,
        paymentAmount: training.price
      }
    });
  } catch (error) {
    console.error('Error en inscripción:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
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
