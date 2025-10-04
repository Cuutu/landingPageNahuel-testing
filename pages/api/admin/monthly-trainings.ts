import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import MonthlyTraining from '../../../models/MonthlyTraining';
import User from '../../../models/User';

// Helper function to create date in Argentina timezone (UTC-3)
function createArgentinaDate(dateString: string, timeString: string = '19:00'): Date {
  console.log('🔍 createArgentinaDate - Input dateString:', dateString, 'timeString:', timeString);
  
  // Parse the date string (YYYY-MM-DD) and create date in Argentina timezone
  const [year, month, day] = dateString.split('-').map(Number);
  console.log('🔍 Parsed date parts:', { year, month, day });
  
  // Parse the time string (HH:MM)
  const [hours, minutes] = timeString.split(':').map(Number);
  console.log('🔍 Parsed time parts:', { hours, minutes });
  
  // Create date in local timezone with the specific time of the class
  // This ensures the date represents the exact day and time selected
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  console.log('🔍 Created local date with time:', localDate);
  console.log('🔍 Local date ISO string:', localDate.toISOString());
  console.log('🔍 Local date local string:', localDate.toLocaleDateString('es-AR'));
  console.log('🔍 Local date local time:', localDate.toLocaleTimeString('es-AR'));
  
  return localDate;
}

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

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res, session.user.email);
    case 'PUT':
      return handlePut(req, res, session.user.email);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// GET - Obtener entrenamientos mensuales
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { month, year, status } = req.query;

    let filter: any = {};
    
    if (month) filter.month = parseInt(month as string);
    if (year) filter.year = parseInt(year as string);
    if (status) filter.status = status;

    const trainings = await MonthlyTraining.find(filter)
      .sort({ year: -1, month: -1 }) // Más recientes primero
      .lean();

    // Agregar información útil
    const trainingsWithInfo = trainings.map(training => ({
      ...training,
      availableSpots: training.maxStudents - training.students.length,
      totalClasses: training.classes.length,
      completedClasses: training.classes.filter((c: any) => c.status === 'completed').length,
      monthName: getMonthName(training.month),
      canEnroll: training.status === 'open' && training.students.length < training.maxStudents,
      isEnrolled: false // Se calculará en el frontend basado en el usuario logueado
    }));

    return res.status(200).json({
      success: true,
      data: trainingsWithInfo
    });
  } catch (error) {
    console.error('Error obteniendo entrenamientos mensuales:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST - Crear nuevo entrenamiento mensual
async function handlePost(req: NextApiRequest, res: NextApiResponse, adminEmail: string) {
  try {
    const {
      title,
      description,
      month,
      year,
      maxStudents = 10,
      price,
      classes
    } = req.body;

    // Validaciones básicas
    if (!title || !description || !month || !year || !price || !classes) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'El mes debe estar entre 1 y 12' });
    }

    if (classes.length === 0) {
      return res.status(400).json({ error: 'Debe definir al menos una clase' });
    }

    // Verificar que no exista ya un entrenamiento para ese mes/año
    const existingTraining = await MonthlyTraining.findOne({ month, year, type: 'swing-trading' });
    if (existingTraining) {
      return res.status(400).json({ error: `Ya existe un entrenamiento para ${getMonthName(month)} ${year}` });
    }

    // Crear el entrenamiento
    const newTraining = new MonthlyTraining({
      type: 'swing-trading',
      title,
      description,
      month,
      year,
      maxStudents,
      price,
      classes: classes.map((cls: any, index: number) => ({
        ...cls,
        _id: undefined, // Dejar que MongoDB genere el ID
        date: createArgentinaDate(cls.date, cls.startTime), // Convertir string a Date con hora específica
        status: 'scheduled'
      })),
      students: [],
      status: 'open',
      createdBy: adminEmail
    });

    await newTraining.save();

    return res.status(201).json({
      success: true,
      message: 'Entrenamiento mensual creado exitosamente',
      data: newTraining
    });
  } catch (error) {
    console.error('Error creando entrenamiento mensual:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT - Actualizar entrenamiento mensual
async function handlePut(req: NextApiRequest, res: NextApiResponse, adminEmail: string) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID requerido' });
    }

    const training = await MonthlyTraining.findById(id);
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // No permitir cambios si ya tiene estudiantes inscritos (excepto ciertos campos)
    if (training.students.length > 0) {
      const allowedFields = ['title', 'description', 'status', 'classes'];
      const hasRestrictedChanges = Object.keys(updateData).some(key => 
        !allowedFields.includes(key) && key !== 'id'
      );
      
      if (hasRestrictedChanges) {
        return res.status(400).json({ 
          error: 'No se pueden modificar ciertos campos cuando ya hay estudiantes inscritos' 
        });
      }
    }

    // Procesar fechas si se están actualizando las clases
    if (updateData.classes) {
      updateData.classes = updateData.classes.map((cls: any) => ({
        ...cls,
        date: createArgentinaDate(cls.date, cls.startTime) // Convertir string a Date con hora específica
      }));
    }

    const updatedTraining = await MonthlyTraining.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Entrenamiento actualizado exitosamente',
      data: updatedTraining
    });
  } catch (error) {
    console.error('Error actualizando entrenamiento mensual:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE - Eliminar entrenamiento mensual
async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'ID requerido' });
    }

    const training = await MonthlyTraining.findById(id);
    if (!training) {
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // No permitir eliminar si ya tiene estudiantes inscritos
    if (training.students.length > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar un entrenamiento con estudiantes inscritos' 
      });
    }

    await MonthlyTraining.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Entrenamiento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando entrenamiento mensual:', error);
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
