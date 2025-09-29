import mongoose, { Document, Schema } from 'mongoose';

export interface IBooking extends Document {
  userId: string;
  userEmail: string;
  userName: string;
  type: 'training' | 'advisory';
  serviceType?: 'ConsultorioFinanciero' | 'CuentaAsesorada' | 'SwingTrading' | 'AdvancedStrategies';
  startDate: Date;
  endDate: Date;
  duration: number; // en minutos
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  googleEventId?: string; // Solo evento del admin
  price?: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  meetingLink?: string; // Link de reunión (Zoom, Meet, etc.)
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // ✅ Flags de recordatorio por email
  reminder24hSent?: boolean;
  reminder1hSent?: boolean;
}

const BookingSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['training', 'advisory'],
    required: true,
    index: true
  },
  serviceType: {
    type: String,
    enum: ['ConsultorioFinanciero', 'CuentaAsesorada', 'SwingTrading', 'AdvancedStrategies']
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    default: 90 // 90 minutos por defecto
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  googleEventId: {
    type: String // Solo ID del evento en el calendario del admin
  },
  price: {
    type: Number,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  meetingLink: {
    type: String,
    maxlength: 500
  },
  notes: {
    type: String,
    maxlength: 500
  },
  // ✅ Nuevos flags para evitar duplicidad de recordatorios
  reminder24hSent: {
    type: Boolean,
    default: false,
    index: true
  },
  reminder1hSent: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

// Índices compuestos para optimizar consultas
BookingSchema.index({ startDate: 1, endDate: 1 });
BookingSchema.index({ type: 1, status: 1 });
BookingSchema.index({ userId: 1, startDate: -1 });

export default mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema); 