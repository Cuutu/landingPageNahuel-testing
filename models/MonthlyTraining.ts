import mongoose, { Schema, Document } from 'mongoose';

// Clase individual dentro del entrenamiento mensual
interface TrainingClass {
  date: Date; // Fecha específica de la clase
  startTime: string; // Hora de inicio (formato HH:MM)
  title: string; // Título de la clase
  meetingLink?: string; // Link de Google Meet (se genera automáticamente)
  status: 'scheduled' | 'completed' | 'cancelled';
}

// Estudiante inscrito al entrenamiento mensual
interface EnrolledStudent {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  enrolledAt: Date;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentId?: string; // ID de MercadoPago
  experienceLevel?: 'principiante' | 'intermedio' | 'avanzado';
  attendance: {
    classId: string; // ID de la clase
    attended: boolean;
    attendedAt?: Date;
  }[];
}

interface MonthlyTrainingDocument extends Document {
  // Información básica del entrenamiento
  type: 'swing-trading'; // Solo para Swing Trading por ahora
  title: string; // Ej: "Swing Trading - Noviembre 2024"
  description: string;
  
  // Fecha del entrenamiento (mes y año)
  month: number; // 1-12 (Enero = 1, Diciembre = 12)
  year: number;
  
  // Configuración
  maxStudents: number; // Máximo 10 estudiantes
  price: number; // Precio del pack mensual en pesos argentinos
  
  // Clases del mes
  classes: TrainingClass[];
  
  // Estudiantes inscritos
  students: EnrolledStudent[];
  
  // Estado del entrenamiento
  status: 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
  
  // Metadatos
  createdBy: string; // Email del admin que lo creó
  createdAt: Date;
  updatedAt: Date;
}

const trainingClassSchema = new Schema<TrainingClass>({
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // HH:MM
  title: { type: String, required: true },
  meetingLink: { type: String },
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled'], 
    default: 'scheduled' 
  }
});

const enrolledStudentSchema = new Schema<EnrolledStudent>({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  enrolledAt: { type: Date, default: Date.now },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  paymentId: { type: String },
  experienceLevel: { 
    type: String, 
    enum: ['principiante', 'intermedio', 'avanzado'] 
  },
  attendance: [{
    classId: { type: String, required: true },
    attended: { type: Boolean, default: false },
    attendedAt: { type: Date }
  }]
});

const monthlyTrainingSchema = new Schema<MonthlyTrainingDocument>({
  type: { 
    type: String, 
    required: true, 
    enum: ['swing-trading'],
    default: 'swing-trading'
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  
  // Fecha
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  
  // Configuración
  maxStudents: { type: Number, required: true, default: 10 },
  price: { type: Number, required: true },
  
  // Clases y estudiantes
  classes: [trainingClassSchema],
  students: [enrolledStudentSchema],
  
  // Estado
  status: { 
    type: String, 
    enum: ['open', 'full', 'in-progress', 'completed', 'cancelled'], 
    default: 'open' 
  },
  
  // Metadatos
  createdBy: { type: String, required: true }
}, {
  timestamps: true
});

// Índices para optimizar consultas
monthlyTrainingSchema.index({ month: 1, year: 1 });
monthlyTrainingSchema.index({ status: 1 });
monthlyTrainingSchema.index({ 'students.userId': 1 });
monthlyTrainingSchema.index({ 'students.email': 1 });

// Índice único para evitar duplicados del mismo mes/año
monthlyTrainingSchema.index({ month: 1, year: 1, type: 1 }, { unique: true });

export default mongoose.models.MonthlyTraining || mongoose.model<MonthlyTrainingDocument>('MonthlyTraining', monthlyTrainingSchema);
