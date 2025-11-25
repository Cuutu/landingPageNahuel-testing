import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { createTrainingEnrollmentNotification, createTrainingScheduleNotification } from '@/lib/trainingNotifications';

/**
 * Endpoint de prueba para verificar el sistema de notificaciones de entrenamientos
 * Solo accesible por administradores
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar permisos de admin
    const adminCheck = await verifyAdminAccess({ req, res } as any);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }

    const { testType, userEmail, userName } = req.body;

    console.log('🧪 [TEST NOTIFICATIONS] Iniciando prueba de notificaciones:', { testType, userEmail, userName });

    if (testType === 'enrollment') {
      // Probar notificación de inscripción
      await createTrainingEnrollmentNotification(
        userEmail || 'test@example.com',
        userName || 'Usuario de Prueba',
        'SwingTrading',
        'Zero 2 Trader',
        497
      );

      console.log('✅ [TEST NOTIFICATIONS] Prueba de notificación de inscripción completada');
      
      return res.status(200).json({
        success: true,
        message: 'Prueba de notificación de inscripción completada exitosamente',
        testType: 'enrollment',
        details: {
          userEmail: userEmail || 'test@example.com',
          userName: userName || 'Usuario de Prueba',
          trainingType: 'SwingTrading',
          trainingName: 'Zero 2 Trader',
          price: 497
        }
      });

    } else if (testType === 'schedule') {
      // Probar notificación de nuevo horario
      await createTrainingScheduleNotification(
        'SwingTrading',
        'Zero 2 Trader',
        {
          dayOfWeek: 1, // Lunes
          hour: 19,
          minute: 0,
          duration: 90,
          price: 497
        }
      );

      console.log('✅ [TEST NOTIFICATIONS] Prueba de notificación de horario completada');
      
      return res.status(200).json({
        success: true,
        message: 'Prueba de notificación de horario completada exitosamente',
        testType: 'schedule',
        details: {
          trainingType: 'SwingTrading',
          trainingName: 'Zero 2 Trader',
          schedule: {
            dayOfWeek: 1,
            dayName: 'Lunes',
            hour: 19,
            minute: 0,
            timeString: '19:00',
            duration: 90,
            durationString: '1h 30min',
            price: 497
          }
        }
      });

    } else {
      return res.status(400).json({
        success: false,
        error: 'Tipo de prueba inválido. Usa "enrollment" o "schedule"',
        validTypes: ['enrollment', 'schedule']
      });
    }

  } catch (error) {
    console.error('❌ [TEST NOTIFICATIONS] Error en prueba de notificaciones:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Error al ejecutar prueba de notificaciones',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 