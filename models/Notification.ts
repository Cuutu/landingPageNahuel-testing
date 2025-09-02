import mongoose from 'mongoose';

export interface INotification extends mongoose.Document {
  title: string;
  message: string;
  type: 'novedad' | 'actualizacion' | 'sistema' | 'promocion' | 'alerta';
  priority: 'alta' | 'media' | 'baja';
  targetUsers: 'todos' | 'suscriptores' | 'admin' | 'alertas_trader' | 'alertas_smart' | 'alertas_cashflow';
  isActive: boolean;
  createdBy: string; // Email del admin que creó la notificación
  createdAt: Date;
  expiresAt?: Date;
  icon?: string; // Emoji o ícono para la notificación
  actionUrl?: string; // URL a la que redirige si es necesario
  actionText?: string; // Texto del botón de acción
  // Nuevos campos para mejoras
  isAutomatic?: boolean; // Si es una notificación automática
  templateId?: string; // ID de plantilla utilizada
  relatedAlertId?: string; // ID de la alerta relacionada (si aplica)
  emailSent?: boolean; // Si se envió por email
  pushSent?: boolean; // Si se envió push notification
  readBy?: string[]; // Array de emails de usuarios que la leyeron
  dismissedBy?: string[]; // Array de emails de usuarios que ocultaron/descartaron la notificación
  totalReads?: number; // Contador de lecturas
  metadata?: {
    alertType?: string; // Tipo de alerta que generó la notificación
    alertSymbol?: string; // Símbolo de la alerta
    alertAction?: string; // Acción de la alerta (BUY/SELL)
    alertPrice?: number | null; // Precio de la alerta (opcional)
  };
}

const NotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxLength: 100
  },
  message: {
    type: String,
    required: true,
    maxLength: 500
  },
  type: {
    type: String,
    enum: ['novedad', 'actualizacion', 'sistema', 'promocion', 'alerta'],
    required: true,
    default: 'novedad'
  },
  priority: {
    type: String,
    enum: ['alta', 'media', 'baja'],
    required: true,
    default: 'media'
  },
  targetUsers: {
    type: String,
    enum: ['todos', 'suscriptores', 'admin', 'alertas_trader', 'alertas_smart', 'alertas_cashflow'],
    required: true,
    default: 'todos'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  icon: {
    type: String,
    default: '📢'
  },
  actionUrl: {
    type: String,
    default: null
  },
  actionText: {
    type: String,
    default: null
  },
  // Nuevos campos
  isAutomatic: {
    type: Boolean,
    default: false
  },
  templateId: {
    type: String,
    default: null
  },
  relatedAlertId: {
    type: String,
    default: null
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  pushSent: {
    type: Boolean,
    default: false
  },
  readBy: {
    type: [String],
    default: []
  },
  dismissedBy: {
    type: [String],
    default: []
  },
  totalReads: {
    type: Number,
    default: 0
  },
  metadata: {
    alertType: String,
    alertSymbol: String,
    alertAction: String,
    alertPrice: { type: Number, required: false, default: null }
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ targetUsers: 1, isActive: 1 });
NotificationSchema.index({ type: 1, isActive: 1 });
NotificationSchema.index({ readBy: 1 });
NotificationSchema.index({ relatedAlertId: 1 });
NotificationSchema.index({ dismissedBy: 1 });

// Método para marcar como leída por un usuario
NotificationSchema.methods.markAsRead = function(userEmail: string) {
  if (!this.readBy.includes(userEmail)) {
    this.readBy.push(userEmail);
    this.totalReads = this.readBy.length;
  }
  return this.save();
};

// Método para verificar si un usuario la leyó
NotificationSchema.methods.isReadBy = function(userEmail: string) {
  return this.readBy.includes(userEmail);
};

export default mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema); 