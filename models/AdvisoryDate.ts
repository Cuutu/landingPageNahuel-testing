import mongoose, { Document, Schema } from 'mongoose';

export interface IAdvisoryDate extends Document {
  advisoryType: string; // 'ConsultorioFinanciero', etc.
  date: Date; // Fecha específica de la asesoría
  time: string; // Hora en formato HH:MM
  title: string; // Título de la asesoría (ej: "Consultorio General", "Análisis de Portfolio")
  description?: string; // Descripción opcional
  isActive: boolean; // Si la fecha está activa
  isBooked: boolean; // Si ya fue reservado por un usuario
  tempReservationTimestamp?: Date; // Timestamp de cuando se hizo la reserva temporal
  tempReservationExpiresAt?: Date; // Cuándo expira la reserva temporal
  confirmedBooking?: boolean; // Si la reserva fue confirmada por pago
  createdBy: string; // Email del admin que creó la fecha
  createdAt: Date;
  updatedAt: Date;
}

const AdvisoryDateSchema: Schema = new Schema({
  advisoryType: {
    type: String,
    required: true,
    enum: ['ConsultorioFinanciero']
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ // Validar formato HH:MM
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isBooked: {
    type: Boolean,
    default: false
  },
  tempReservationTimestamp: {
    type: Date
  },
  tempReservationExpiresAt: {
    type: Date
  },
  confirmedBooking: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
AdvisoryDateSchema.index({ advisoryType: 1, date: 1 });
AdvisoryDateSchema.index({ advisoryType: 1, isActive: 1 });
AdvisoryDateSchema.index({ advisoryType: 1, isBooked: 1 });
AdvisoryDateSchema.index({ advisoryType: 1, date: 1, time: 1 }, { unique: true });

export default mongoose.models.AdvisoryDate || mongoose.model<IAdvisoryDate>('AdvisoryDate', AdvisoryDateSchema);
