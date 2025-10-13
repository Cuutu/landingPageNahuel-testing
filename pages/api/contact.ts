import { NextApiRequest, NextApiResponse } from 'next';
import { sendAdminContactNotificationEmail, sendUserContactConfirmationEmail } from '@/lib/emailNotifications';

interface ContactFormData {
  nombre: string;
  apellido: string;
  email: string;
  mensaje: string;
  timestamp?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { nombre, apellido, email, mensaje, timestamp }: ContactFormData = req.body;

      // Validación básica
      if (!nombre || !apellido || !email || !mensaje) {
        return res.status(400).json({ 
          success: false, 
          message: 'Todos los campos requeridos deben ser completados' 
        });
      }

      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'El formato del email no es válido' 
        });
      }

      console.log('📧 Procesando mensaje de contacto de:', email);

      const contactDetails = {
        userEmail: email,
        userName: nombre,
        userLastName: apellido,
        message: mensaje,
        timestamp: timestamp || Date.now()
      };

      // Enviar email de confirmación al usuario
      await sendUserContactConfirmationEmail(contactDetails);
      console.log('✅ Email de confirmación enviado al usuario exitosamente');

      // Enviar notificación al admin
      await sendAdminContactNotificationEmail(contactDetails);
      console.log('✅ Notificación de contacto enviada al admin exitosamente');

      return res.status(200).json({
        success: true,
        message: 'Mensaje enviado exitosamente. Te responderemos a la brevedad.'
      });

    } catch (error) {
      console.error('❌ Error en el formulario de contacto:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor. Por favor intenta nuevamente.'
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      message: 'Método no permitido'
    });
  }
} 