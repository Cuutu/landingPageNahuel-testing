import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/googleAuth';
import dbConnect from '../../../../../lib/mongodb';
import MonthlyTraining from '../../../../../models/MonthlyTraining';
import User from '../../../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Verificar que el usuario sea admin
  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado - Se requieren permisos de administrador' });
  }

  const { trainingId } = req.query;

  if (!trainingId) {
    return res.status(400).json({ error: 'ID de entrenamiento requerido' });
  }

  switch (req.method) {
    case 'GET':
      return handleGetStudents(req, res, trainingId as string);
    case 'POST':
      return handleAddStudent(req, res, trainingId as string);
    case 'PUT':
      return handleUpdateStudent(req, res, trainingId as string);
    case 'DELETE':
      return handleRemoveStudent(req, res, trainingId as string);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// GET - Obtener estudiantes de un entrenamiento
async function handleGetStudents(req: NextApiRequest, res: NextApiResponse, trainingId: string) {
  try {
    const training = await MonthlyTraining.findById(trainingId);
    
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    return res.status(200).json({
      success: true,
      data: {
        students: training.students,
        totalStudents: training.students.length,
        availableSpots: training.maxStudents - training.students.length,
        maxStudents: training.maxStudents
      }
    });
  } catch (error) {
    console.error('Error obteniendo estudiantes:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST - Agregar estudiante manualmente (para admin)
async function handleAddStudent(req: NextApiRequest, res: NextApiResponse, trainingId: string) {
  try {
    const {
      userId,
      name,
      email,
      phone,
      experienceLevel,
      paymentStatus = 'completed',
      paymentId
    } = req.body;

    if (!userId || !name || !email) {
      return res.status(400).json({ error: 'Faltan campos requeridos: userId, name, email' });
    }

    const training = await MonthlyTraining.findById(trainingId);
    
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // Verificar cupos disponibles
    if (training.students.length >= training.maxStudents) {
      return res.status(400).json({ error: 'No hay cupos disponibles' });
    }

    // Verificar que el estudiante no esté ya inscrito
    const existingStudent = training.students.find((s: any) => s.userId === userId || s.email === email);
    if (existingStudent) {
      return res.status(400).json({ error: 'El estudiante ya está inscrito en este entrenamiento' });
    }

    // Crear array de asistencia para todas las clases
    const attendance = training.classes.map((cls: any) => ({
      classId: cls._id.toString(),
      attended: false
    }));

    // Agregar estudiante
    const newStudent = {
      userId,
      name,
      email,
      phone,
      enrolledAt: new Date(),
      paymentStatus,
      paymentId,
      experienceLevel,
      attendance
    };

    training.students.push(newStudent);

    // Actualizar estado del entrenamiento si se llenó
    if (training.students.length >= training.maxStudents) {
      training.status = 'full';
    }

    await training.save();

    return res.status(201).json({
      success: true,
      message: 'Estudiante agregado exitosamente',
      data: newStudent
    });
  } catch (error) {
    console.error('Error agregando estudiante:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT - Actualizar información de estudiante
async function handleUpdateStudent(req: NextApiRequest, res: NextApiResponse, trainingId: string) {
  try {
    const { studentId } = req.query;
    const updateData = req.body;

    if (!studentId) {
      return res.status(400).json({ error: 'ID de estudiante requerido' });
    }

    const training = await MonthlyTraining.findById(trainingId);
    
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    const studentIndex = training.students.findIndex((s: any) => s._id.toString() === studentId);
    
    if (studentIndex === -1) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Actualizar datos del estudiante
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && updateData[key] !== undefined) {
        training.students[studentIndex][key] = updateData[key];
      }
    });

    await training.save();

    return res.status(200).json({
      success: true,
      message: 'Estudiante actualizado exitosamente',
      data: training.students[studentIndex]
    });
  } catch (error) {
    console.error('Error actualizando estudiante:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE - Remover estudiante
async function handleRemoveStudent(req: NextApiRequest, res: NextApiResponse, trainingId: string) {
  try {
    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({ error: 'ID de estudiante requerido' });
    }

    const training = await MonthlyTraining.findById(trainingId);
    
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    const studentIndex = training.students.findIndex((s: any) => s._id.toString() === studentId);
    
    if (studentIndex === -1) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Remover estudiante
    training.students.splice(studentIndex, 1);

    // Actualizar estado del entrenamiento si ya no está lleno
    if (training.status === 'full' && training.students.length < training.maxStudents) {
      training.status = 'open';
    }

    await training.save();

    return res.status(200).json({
      success: true,
      message: 'Estudiante removido exitosamente'
    });
  } catch (error) {
    console.error('Error removiendo estudiante:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
