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
    return res.status(401).json({ error: 'Debe iniciar sesión' });
  }

  try {
    const { trainingId, paymentId } = req.body;

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

    // Verificar si el usuario ya está inscrito
    const existingStudentIndex = training.students.findIndex((s: any) => 
      s.userId === user._id.toString() || s.email === session.user.email
    );
    
    if (existingStudentIndex !== -1) {
      const existingStudent = training.students[existingStudentIndex];
      
      // Si ya está inscrito con pago completado, devolver éxito
      if (existingStudent.paymentStatus === 'completed') {
        return res.status(200).json({
          success: true,
          message: 'Usuario ya inscrito con pago completado',
          alreadyEnrolled: true,
          training: {
            title: training.title,
            month: training.month,
            year: training.year,
            paymentRange: training.paymentRange,
            currentStudents: training.students.filter((s: any) => s.paymentStatus === 'completed').length
          }
        });
      }
      
      // Si está inscrito pero con pago pendiente, actualizar a completado
      if (existingStudent.paymentStatus === 'pending') {
        training.students[existingStudentIndex] = {
          ...existingStudent,
          paymentStatus: 'completed',
          paymentId: paymentId || existingStudent.paymentId,
          paidMonth: training.month,
          paidYear: training.year
        };
        
        await training.save();
        
        const updatedPaidStudents = training.students.filter((s: any) => s.paymentStatus === 'completed');
        
        console.log('✅ Pago actualizado a completado:', {
          trainingId,
          userEmail: session.user.email,
          paymentId,
          currentPaidStudents: updatedPaidStudents.length
        });
        
        return res.status(200).json({
          success: true,
          message: 'Pago actualizado a completado',
          training: {
            title: training.title,
            month: training.month,
            year: training.year,
            paymentRange: training.paymentRange,
            currentStudents: updatedPaidStudents.length,
            maxStudents: training.maxStudents
          }
        });
      }
    }

    // Verificar cupos disponibles (solo contar estudiantes con pago completado)
    const paidStudents = training.students.filter((s: any) => s.paymentStatus === 'completed');
    if (paidStudents.length >= training.maxStudents) {
      return res.status(400).json({ error: 'No hay cupos disponibles' });
    }

    // Crear array de asistencia para todas las clases
    const attendance = training.classes.map((cls: any) => ({
      classId: cls._id.toString(),
      attended: false
    }));

    // Agregar estudiante con pago completado
    const newStudent = {
      userId: user._id.toString(),
      name: user.name || session.user.name || 'Usuario',
      email: session.user.email,
      phone: user.phone,
      enrolledAt: new Date(),
      paymentStatus: 'completed',
      paymentId: paymentId || '',
      experienceLevel: user.experienceLevel || 'principiante',
      paidMonth: training.month, // Mes del entrenamiento por el cual pagó
      paidYear: training.year, // Año del entrenamiento por el cual pagó
      attendance
    };

    training.students.push(newStudent);

    // Actualizar estado del entrenamiento si se llenó (solo contar estudiantes con pago completado)
    const updatedPaidStudents = training.students.filter((s: any) => s.paymentStatus === 'completed');
    if (updatedPaidStudents.length >= training.maxStudents) {
      training.status = 'full';
      console.log('🔴 Entrenamiento AGOTADO - Verificación de pago:', {
        trainingId,
        paymentRange: training.paymentRange,
        currentPaidStudents: updatedPaidStudents.length,
        maxStudents: training.maxStudents
      });
    }

    await training.save();

    console.log('✅ Usuario agregado por verificación de pago:', {
      trainingId,
      paymentRange: training.paymentRange,
      userEmail: session.user.email,
      paymentId,
      currentPaidStudents: updatedPaidStudents.length,
      maxStudents: training.maxStudents
    });

    return res.status(201).json({
      success: true,
      message: 'Usuario agregado exitosamente al entrenamiento',
      data: {
        training: {
          title: training.title,
          month: training.month,
          year: training.year,
          paymentRange: training.paymentRange,
          currentStudents: updatedPaidStudents.length,
          maxStudents: training.maxStudents,
          status: training.status
        },
        student: {
          name: newStudent.name,
          email: newStudent.email,
          enrolledAt: newStudent.enrolledAt
        }
      }
    });

  } catch (error) {
    console.error('Error verificando pago:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
