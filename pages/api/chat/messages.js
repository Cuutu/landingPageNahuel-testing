import dbConnect from '../../../lib/mongodb';
import ChatMessage from '../../../models/ChatMessage';
import User from '../../../models/User';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const { chatType = 'trader-call' } = req.query;
      
      // Obtener los últimos 50 mensajes del chat
      const messages = await ChatMessage.find({ chatType })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      // Invertir el orden para mostrar del más antiguo al más reciente
      const sortedMessages = messages.reverse();

      res.status(200).json({ 
        success: true, 
        messages: sortedMessages 
      });
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }
  }

  else if (req.method === 'POST') {
    try {
      const session = await getServerSession(req, res, authOptions);
      
      if (!session) {
        return res.status(401).json({ 
          success: false, 
          error: 'Debes estar logueado para enviar mensajes' 
        });
      }

      // Verificar permisos del usuario
      const user = await User.findOne({ email: session.user.email });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuario no encontrado' 
        });
      }

      // NUEVA RESTRICCIÓN: Solo suscriptores y administradores pueden enviar mensajes
      if (user.role !== 'suscriptor' && user.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Solo los suscriptores y administradores pueden enviar mensajes en el chat.' 
        });
      }

      console.log('🔍 Usuario autorizado para chat:', {
        name: user.name,
        email: user.email,
        role: user.role
      });

      const { message, chatType = 'trader-call', replyTo } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'El mensaje no puede estar vacío' 
        });
      }

      if (message.length > 200) {
        return res.status(400).json({ 
          success: false, 
          error: 'El mensaje no puede tener más de 200 caracteres' 
        });
      }

      // Determinar el tipo de usuario basado en su rol
      const userType = user.role;
      const messageType = user.role === 'admin' ? 'highlight' : 'normal';

      // Crear el nuevo mensaje
      const newMessageData = {
        userName: session.user.name,
        userEmail: session.user.email,
        userImage: session.user.image,
        userType,
        message: message.trim(),
        chatType,
        type: messageType,
        timestamp: new Date()
      };

      console.log('💾 Datos del mensaje a guardar:', {
        userName: newMessageData.userName,
        userEmail: newMessageData.userEmail,
        userType: newMessageData.userType,
        hasImage: !!newMessageData.userImage
      });

      // Si hay una respuesta, agregar la referencia
      if (replyTo) {
        newMessageData.replyTo = {
          messageId: replyTo.messageId,
          userName: replyTo.userName,
          message: replyTo.message
        };
      }

      const newMessage = new ChatMessage(newMessageData);

      await newMessage.save();

      console.log('✅ Mensaje guardado correctamente por', userType);

      res.status(201).json({ 
        success: true, 
        message: newMessage 
      });
    } catch (error) {
      console.error('Error guardando mensaje:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }
  }

  else if (req.method === 'DELETE') {
    try {
      const session = await getServerSession(req, res, authOptions);
      
      if (!session) {
        return res.status(401).json({ 
          success: false, 
          error: 'Debes estar logueado para borrar mensajes' 
        });
      }

      // Verificar que el usuario sea administrador
      const user = await User.findOne({ email: session.user.email });
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ 
          success: false, 
          error: 'Solo los administradores pueden borrar mensajes' 
        });
      }

      const { messageId } = req.query;

      if (!messageId) {
        return res.status(400).json({ 
          success: false, 
          error: 'ID de mensaje requerido' 
        });
      }

      // Borrar el mensaje
      await ChatMessage.findByIdAndDelete(messageId);

      console.log('✅ Mensaje eliminado por admin:', messageId);

      res.status(200).json({ 
        success: true, 
        message: 'Mensaje eliminado correctamente' 
      });
    } catch (error) {
      console.error('Error borrando mensaje:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error interno del servidor' 
      });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).json({ 
      success: false, 
      error: `Método ${req.method} no permitido` 
    });
  }
} 