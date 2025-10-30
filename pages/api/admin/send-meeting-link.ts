import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { sendEmail, createEmailTemplate } from '@/lib/emailService';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Booking from '@/models/Booking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    await dbConnect();

    // Verificar que el usuario sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    const { bookingId, meetingLink, additionalMessage } = req.body;

    // Validaciones
    if (!bookingId || !meetingLink) {
      return res.status(400).json({ error: 'ID de reserva y link de reunión son requeridos' });
    }

    // Buscar la reserva
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    // Buscar el usuario de la reserva
    const bookingUser = await User.findOne({ email: booking.userEmail });
    if (!bookingUser) {
      return res.status(404).json({ error: 'Usuario de la reserva no encontrado' });
    }

    console.log(`📧 Enviando link de reunión a: ${booking.userEmail}`);

    // Formatear fecha y hora
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: (process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Montevideo')
      });
    };

    const formatTime = (date: Date) => {
      return new Date(date).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: (process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Montevideo')
      });
    };

    const sessionDate = formatDate(booking.startDate);
    const sessionTime = formatTime(booking.startDate);
    const sessionType = booking.type === 'training' ? 'Entrenamiento' : 'Asesoría';

    // Crear contenido del email
    const emailContent = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border-radius: 50px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
          🎯 Link de Reunión Disponible
        </div>
      </div>
      
      <p>Hola <strong>${bookingUser.name || 'Usuario'}</strong>,</p>
      
      <p>Tu sesión de <strong>${sessionType}</strong> está programada para pronto. Aquí tienes todos los detalles y el link de acceso:</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">📅 Detalles de la Sesión:</h3>
        <p style="margin: 8px 0;"><strong>👤 Participante:</strong> ${bookingUser.name || 'Usuario'}</p>
        <p style="margin: 8px 0;"><strong>📚 Tipo:</strong> ${sessionType}</p>
        <p style="margin: 8px 0;"><strong>🔧 Servicio:</strong> ${booking.serviceType}</p>
        <p style="margin: 8px 0;"><strong>📅 Fecha:</strong> ${sessionDate}</p>
        <p style="margin: 8px 0;"><strong>⏰ Hora:</strong> ${sessionTime}</p>
        <p style="margin: 8px 0;"><strong>⏱️ Duración:</strong> ${booking.duration} minutos</p>
      </div>
      
      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #00ff88; margin: 20px 0;">
        <h3 style="color: #1a1a1a; margin-top: 0;">🔗 Link de Acceso:</h3>
        <p style="margin: 0 0 15px 0; color: #333;">
          Haz clic en el botón de abajo para unirte a la reunión:
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${meetingLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
            🚀 Unirse a la Reunión
          </a>
        </div>
        <p style="margin: 0; color: #666; font-size: 14px; text-align: center;">
          <strong>Link directo:</strong> <a href="${meetingLink}" style="color: #3b82f6; word-break: break-all;">${meetingLink}</a>
        </p>
      </div>
      
      ${additionalMessage ? `
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
          <h3 style="color: #1e3a8a; margin-top: 0;">📝 Mensaje Adicional:</h3>
          <p style="margin: 0; color: #1e3a8a; font-style: italic;">
            "${additionalMessage}"
          </p>
        </div>
      ` : ''}
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <h3 style="color: #92400e; margin-top: 0;">⚠️ Importante:</h3>
        <ul style="color: #92400e; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Únete a la reunión 5 minutos antes del horario programado</li>
          <li>Asegúrate de tener una conexión estable a internet</li>
          <li>Ten a mano cualquier material que quieras revisar</li>
          <li>Si tienes problemas técnicos, contacta inmediatamente</li>
        </ul>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">🎯 Qué Esperar:</h3>
        <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
          ${booking.type === 'training' ? `
            <li>Análisis de estrategias de trading personalizadas</li>
            <li>Revisión de tu portafolio actual</li>
            <li>Técnicas de gestión de riesgo</li>
            <li>Sesión de preguntas y respuestas</li>
          ` : `
            <li>Evaluación completa de tu situación financiera</li>
            <li>Análisis de tu perfil de riesgo</li>
            <li>Recomendaciones específicas de inversión</li>
            <li>Plan de acción personalizado</li>
          `}
        </ul>
      </div>
    `;

    // Crear HTML del email
    const emailHtml = createEmailTemplate({
      title: `🎯 Link de Reunión - ${sessionType}`,
      content: emailContent,
      buttonText: 'Unirse a la Reunión',
      buttonUrl: meetingLink
    });

    // Enviar email con link de reunión
    console.log(`📧 Enviando link de reunión a: ${booking.userEmail}`);
    
    try {
      await sendEmail({
        to: booking.userEmail,
        subject: `🎥 Link de Reunión - ${sessionType} con Nahuel Lozano`,
        html: emailHtml
      });
      
      console.log('✅ Link de reunión enviado exitosamente');
      
      return res.status(200).json({
        success: true,
        message: 'Link de reunión enviado exitosamente',
        details: {
          to: booking.userEmail,
          tipo: sessionType,
          meetingLink: meetingLink,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (emailError) {
      console.error('❌ Error enviando link de reunión:', emailError);
      
      return res.status(500).json({
        success: false,
        error: 'Error enviando link de reunión',
        details: {
          message: emailError instanceof Error ? emailError.message : 'Error desconocido',
          to: booking.userEmail
        }
      });
    }

  } catch (error) {
    console.error('❌ Error enviando link de reunión:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
} 