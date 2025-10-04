import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../lib/mongodb';
import MonthlyTraining from '../../../models/MonthlyTraining';
import User from '../../../models/User';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log('🔔 Webhook MercadoPago - Entrenamiento Mensual recibido:', req.body);

    const { type, data } = req.body;

    // Solo procesar notificaciones de pago
    if (type !== 'payment') {
      console.log('ℹ️ Tipo de notificación ignorado:', type);
      return res.status(200).json({ received: true });
    }

    await connectToDatabase();

    // Obtener información del pago desde MercadoPago
    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: data.id });

    console.log('💳 Información del pago:', {
      id: paymentInfo.id,
      status: paymentInfo.status,
      externalReference: paymentInfo.external_reference,
      amount: paymentInfo.transaction_amount
    });

    // Verificar que tenga external_reference
    if (!paymentInfo.external_reference) {
      console.log('⚠️ Pago sin external_reference, ignorando');
      return res.status(200).json({ received: true });
    }

    let externalRef;
    try {
      externalRef = JSON.parse(paymentInfo.external_reference);
    } catch (error) {
      console.log('⚠️ Error parseando external_reference:', paymentInfo.external_reference);
      return res.status(200).json({ received: true });
    }

    // Verificar que sea un pago de entrenamiento mensual
    if (externalRef.type !== 'monthly-training') {
      console.log('ℹ️ No es un pago de entrenamiento mensual, ignorando');
      return res.status(200).json({ received: true });
    }

    const { trainingId, userId, userEmail } = externalRef;

    // Buscar el entrenamiento
    const training = await MonthlyTraining.findById(trainingId);
    if (!training) {
      console.log('❌ Entrenamiento no encontrado:', trainingId);
      return res.status(404).json({ error: 'Entrenamiento no encontrado' });
    }

    // Buscar el usuario
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ Usuario no encontrado:', userId);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que el usuario no esté ya inscrito
    const existingStudent = training.students.find(
      (student: any) => student.userId === userId || student.email === userEmail
    );

    if (paymentInfo.status === 'approved') {
      if (!existingStudent) {
        // Agregar el estudiante al entrenamiento
        const newStudent = {
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          enrolledAt: new Date(),
          paymentStatus: 'completed',
          paymentId: paymentInfo.id?.toString() || '',
          experienceLevel: user.experienceLevel || 'principiante',
          attendance: training.classes.map((cls: any) => ({
            classId: cls._id.toString(),
            attended: false
          }))
        };

        training.students.push(newStudent);

        // Actualizar estado del entrenamiento si está lleno
        if (training.students.length >= training.maxStudents) {
          training.status = 'full';
        }

        await training.save();

        console.log('✅ Estudiante inscrito exitosamente:', {
          trainingId,
          studentName: user.name,
          studentEmail: user.email,
          paymentId: paymentInfo.id
        });

        // TODO: Enviar email de confirmación
        // TODO: Agregar al grupo de WhatsApp/Telegram si aplica

      } else if (existingStudent.paymentStatus === 'pending') {
        // Actualizar el estado del pago existente
        existingStudent.paymentStatus = 'completed';
        existingStudent.paymentId = paymentInfo.id?.toString() || '';
        await training.save();

        console.log('✅ Pago actualizado para estudiante existente:', {
          trainingId,
          studentEmail: userEmail,
          paymentId: paymentInfo.id
        });
      } else {
        console.log('ℹ️ Estudiante ya inscrito y pagado:', userEmail);
      }

    } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
      if (existingStudent && existingStudent.paymentStatus === 'pending') {
        // Marcar el pago como fallido
        existingStudent.paymentStatus = 'failed';
        await training.save();

        console.log('❌ Pago fallido para estudiante:', {
          trainingId,
          studentEmail: userEmail,
          paymentId: paymentInfo.id,
          status: paymentInfo.status
        });
      }

    } else if (paymentInfo.status === 'pending' || paymentInfo.status === 'in_process') {
      if (!existingStudent) {
        // Crear estudiante con pago pendiente
        const pendingStudent = {
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          enrolledAt: new Date(),
          paymentStatus: 'pending',
          paymentId: paymentInfo.id?.toString() || '',
          experienceLevel: user.experienceLevel || 'principiante',
          attendance: training.classes.map((cls: any) => ({
            classId: cls._id.toString(),
            attended: false
          }))
        };

        training.students.push(pendingStudent);
        await training.save();

        console.log('⏳ Estudiante agregado con pago pendiente:', {
          trainingId,
          studentEmail: userEmail,
          paymentId: paymentInfo.id
        });
      }
    }

    return res.status(200).json({ 
      success: true,
      processed: true,
      paymentStatus: paymentInfo.status
    });

  } catch (error) {
    console.error('❌ Error procesando webhook de entrenamiento mensual:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
}
