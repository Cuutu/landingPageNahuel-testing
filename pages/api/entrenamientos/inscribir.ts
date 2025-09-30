import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import connectDB from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import { z } from 'zod';
import { createTrainingEnrollmentNotification } from '@/lib/trainingNotifications';
import Training from '@/models/Training'; // Added import for Training model

// Schema de validación para inscripción
const inscripcionSchema = z.object({
  tipo: z.enum(['SwingTrading', 'DowJones']),
  nombre: z.string().min(1, 'Nombre es requerido'),
  email: z.string().email('Email inválido'),
  telefono: z.string().optional(),
  experienciaTrading: z.string().optional(),
  objetivos: z.string().min(1, 'Objetivos son requeridos'),
  nivelExperiencia: z.enum(['principiante', 'intermedio', 'avanzado']).optional(),
  consulta: z.string().optional(),
  // Datos simulados de pago
  precio: z.number().optional(),
  metodoPago: z.string().optional().default('simulado')
});

/**
 * API para inscribir usuarios a entrenamientos
 * POST: Procesar inscripción y asignar entrenamiento al usuario
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Método ${req.method} no permitido`
    });
  }

  await connectDB();

  try {
    console.log('🎓 Procesando inscripción a entrenamiento');

    // Verificar sesión
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado. Debes iniciar sesión.'
      });
    }

    // Validar datos de entrada
    const datosValidados = inscripcionSchema.parse(req.body);

    // Buscar usuario en la base de datos
    let usuario = await User.findOne({ email: session.user.email });
    
    if (!usuario) {
      // Crear usuario si no existe
      usuario = new User({
        googleId: (session.user as any).id || session.user.email,
        name: session.user.name || datosValidados.nombre,
        email: session.user.email,
        picture: session.user.image,
        entrenamientos: []
      });
      await usuario.save();
      console.log('✅ Usuario creado automáticamente:', usuario.email);
    }

    // Verificar si ya tiene el entrenamiento
    const tieneEntrenamiento = usuario.entrenamientos.some((entrenamiento: any) => 
      entrenamiento.tipo === datosValidados.tipo && entrenamiento.activo
    );

    if (tieneEntrenamiento) {
      return res.status(409).json({
        success: false,
        error: `Ya estás inscrito en el entrenamiento ${datosValidados.tipo}`
      });
    }

    // Determinar precio desde la base de datos del entrenamiento
    const trainingForPrice = await Training.findOne({ tipo: datosValidados.tipo });
    const precio = datosValidados.precio || trainingForPrice?.precio || 0;

    // Simular proceso de pago exitoso
    const transactionId = `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('💳 Simulando pago exitoso para:', {
      usuario: usuario.email,
      tipo: datosValidados.tipo,
      precio: precio,
      transactionId
    });

    // Agregar entrenamiento al usuario
    const nuevoEntrenamiento = {
      tipo: datosValidados.tipo,
      fechaInscripcion: new Date(),
      progreso: 0,
      activo: true,
      precio: precio,
      metodoPago: datosValidados.metodoPago,
      transactionId: transactionId
    };

    usuario.entrenamientos.push(nuevoEntrenamiento);
    if (usuario.role !== 'admin' && usuario.role !== 'suscriptor') {
      usuario.role = 'suscriptor';
    }

    // Actualizar información adicional del usuario si se proporcionó
    if (datosValidados.telefono && !usuario.phone) {
      usuario.phone = datosValidados.telefono;
    }
    if (datosValidados.nivelExperiencia && !usuario.educacionFinanciera) {
      usuario.educacionFinanciera = datosValidados.nivelExperiencia;
    }

    await usuario.save();

    console.log('✅ Entrenamiento asignado exitosamente:', {
      usuario: usuario.email,
      tipo: datosValidados.tipo,
      transactionId
    });

    // ✅ NUEVO: Crear notificaciones de inscripción
    try {
      const trainingName = datosValidados.tipo === 'SwingTrading' ? 'Swing Trading' : 'Dow Jones Advanced';
      
      await createTrainingEnrollmentNotification(
        usuario.email,
        usuario.name || datosValidados.nombre,
        datosValidados.tipo,
        trainingName,
        precio
      );

      console.log('✅ Notificaciones de inscripción creadas exitosamente');
    } catch (notificationError) {
      console.error('❌ Error al crear notificaciones de inscripción:', notificationError);
      // No fallar la inscripción si las notificaciones fallan
    }

    // Respuesta exitosa
    return res.status(200).json({
      success: true,
      message: `¡Inscripción exitosa! Ya tienes acceso al entrenamiento ${datosValidados.tipo}`,
      data: {
        entrenamiento: nuevoEntrenamiento,
        transactionId,
        redirectUrl: `/entrenamientos/swing-trading`
      }
    });

  } catch (error) {
    console.error('❌ Error al procesar inscripción:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Inténtalo nuevamente.'
    });
  }
} 