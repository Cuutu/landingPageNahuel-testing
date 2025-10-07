import mongoose, { Schema, Document } from 'mongoose';

interface TrainingSolicitud {
  userId?: string;
  nombre: string;
  email: string;
  telefono?: string;
  experienciaTrading?: string;
  objetivos: string;
  horariosDisponibles?: string[];
  consulta?: string;
  fecha: Date;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  fechaEntrenamiento?: Date;
  nivelExperiencia?: 'principiante' | 'intermedio' | 'avanzado';
  metodoPago?: string;
  montoAbonado?: number;
}

interface TrainingHorario {
  dia: number; // 0 = Domingo, 1 = Lunes, etc.
  hora: string; // Formato HH:MM
  cuposDisponibles: number;
  activo: boolean;
}

interface TrainingDocument extends Document {
  tipo: 'SwingTrading';
  nombre: string;
  descripcion: string;
  videoMux?: string;
  precio: number;
  duracion: number; // duración en horas
  metricas: {
    rentabilidad: number;
    estudiantesActivos: number;
    entrenamientosRealizados: number;
    satisfaccion: number;
  };
  solicitudes: TrainingSolicitud[];
  horarios: TrainingHorario[];
  contenido: {
    modulos: number;
    lecciones: number;
    certificacion: boolean;
    nivelAcceso: string;
  };
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trainingSolicitudSchema = new Schema({
  userId: { type: String },
  nombre: { type: String, required: true },
  email: { type: String, required: true },
  telefono: { type: String },
  experienciaTrading: { type: String },
  objetivos: { type: String, required: true },
  horariosDisponibles: [{ type: String }],
  consulta: { type: String },
  fecha: { type: Date, default: Date.now },
  estado: { 
    type: String, 
    enum: ['pendiente', 'confirmada', 'completada', 'cancelada'], 
    default: 'pendiente' 
  },
  fechaEntrenamiento: { type: Date },
  nivelExperiencia: { 
    type: String, 
    enum: ['principiante', 'intermedio', 'avanzado'] 
  },
  metodoPago: { type: String },
  montoAbonado: { type: Number }
});

const trainingHorarioSchema = new Schema({
  dia: { type: Number, required: true, min: 0, max: 6 },
  hora: { type: String, required: true },
  cuposDisponibles: { type: Number, default: 20 },
  activo: { type: Boolean, default: true }
});

const trainingSchema = new Schema<TrainingDocument>({
  tipo: { 
    type: String, 
    required: true, 
    enum: ['SwingTrading'],
    unique: true 
  },
  nombre: { type: String, required: true },
  descripcion: { type: String, required: true },
  videoMux: { type: String },
  precio: { type: Number, required: true },
  duracion: { type: Number, required: true }, // en horas
  metricas: {
    rentabilidad: { type: Number, default: 0 },
    estudiantesActivos: { type: Number, default: 0 },
    entrenamientosRealizados: { type: Number, default: 0 },
    satisfaccion: { type: Number, default: 5.0 }
  },
  solicitudes: [trainingSolicitudSchema],
  horarios: [trainingHorarioSchema],
  contenido: {
    modulos: { type: Number, default: 0 },
    lecciones: { type: Number, default: 0 },
    certificacion: { type: Boolean, default: true },
    nivelAcceso: { type: String, default: 'Básico' }
  },
  activo: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Índices para optimizar consultas
trainingSchema.index({ activo: 1 });
trainingSchema.index({ 'solicitudes.email': 1 });
trainingSchema.index({ 'solicitudes.estado': 1 });

export default mongoose.models.Training || mongoose.model<TrainingDocument>('Training', trainingSchema); 