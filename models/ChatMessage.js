import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userImage: {
    type: String,
    required: false // La imagen puede ser opcional por si no la tienen
  },
  userType: {
    type: String,
    enum: ['normal', 'suscriptor', 'premium', 'admin'],
    default: 'normal'
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  chatType: {
    type: String,
    required: true,
    enum: ['trader-call', 'smart-money']
  },
  type: {
    type: String,
    enum: ['normal', 'highlight'],
    default: 'normal'
  },
  // Referencia a mensaje que se está respondiendo
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatMessage'
    },
    userName: String,
    message: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice para optimizar consultas por tipo de chat y fecha
ChatMessageSchema.index({ chatType: 1, timestamp: -1 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema); 