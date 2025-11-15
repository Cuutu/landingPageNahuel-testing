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
    alertPrice?: number | string | null; // Precio de la alerta (opcional) - puede ser número o rango string
    imageUrl?: string; // URL de imagen opcional para emails/notificaciones
    priceRange?: { min: number; max: number } | null; // Rango de precios completo
    alertService?: string; // Servicio de la alerta (TraderCall, SmartMoney, etc.)
    automatic?: boolean; // Si la notificación es automática
    participationPercentage?: number; // Porcentaje de participación en la cartera
    liquidityPercentage?: number; // Porcentaje de liquidez asignado
    soldPercentage?: number; // Porcentaje vendido (para ventas parciales)
    // Campos para informes
    reportTitle?: string;
    reportType?: string;
    reportCategory?: string;
    serviceType?: string;
    // Campos para pagos
    paymentId?: string;
    service?: string;
    amount?: number;
    currency?: string;
    userEmail?: string;
    transactionDate?: Date;
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
    alertPrice: { type: mongoose.Schema.Types.Mixed, required: false, default: null }, // Puede ser Number o String
    imageUrl: { type: String, required: false, default: null },
    priceRange: {
      min: { type: Number, required: false },
      max: { type: Number, required: false }
    },
    alertService: { type: String, required: false },
    automatic: { type: Boolean, required: false },
    participationPercentage: { type: Number, required: false },
    liquidityPercentage: { type: Number, required: false },
    soldPercentage: { type: Number, required: false },
    // Campos para informes
    reportTitle: { type: String, required: false },
    reportType: { type: String, required: false },
    reportCategory: { type: String, required: false },
    serviceType: { type: String, required: false },
    // Campos para pagos
    paymentId: { type: String, required: false },
    service: { type: String, required: false },
    amount: { type: Number, required: false },
    currency: { type: String, required: false },
    userEmail: { type: String, required: false },
    transactionDate: { type: Date, required: false }
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