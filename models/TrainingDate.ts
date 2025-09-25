import mongoose, { Document, Schema } from 'mongoose';

export interface ITrainingDate extends Document {
  trainingType: string; // 'SwingTrading', 'DowJones', etc.
  date: Date; // Fecha específica de la clase
  time: string; // Hora en formato HH:MM
  title: string; // Título de la clase (ej: "Clase 1", "Clase Especial")
  description?: string; // Descripción opcional
  isActive: boolean; // Si la fecha está activa
  createdBy: string; // Email del admin que creó la fecha
  googleEventId?: string; // ID del evento en Google Calendar
  meetLink?: string; // Link de Google Meet generado
  createdAt: Date;
  updatedAt: Date;
}

const TrainingDateSchema: Schema = new Schema({
  trainingType: {
    type: String,
    required: true,
    enum: ['SwingTrading', 'DowJones', 'General']
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
  createdBy: {
    type: String,
    required: true
  },
  googleEventId: {
    type: String
  },
  meetLink: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
TrainingDateSchema.index({ trainingType: 1, date: 1 });
TrainingDateSchema.index({ trainingType: 1, isActive: 1 });

export default mongoose.models.TrainingDate || mongoose.model<ITrainingDate>('TrainingDate', TrainingDateSchema);
