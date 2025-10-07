import mongoose, { Schema, Document } from 'mongoose';

interface LessonContent {
  id: string;
  type: 'youtube' | 'pdf' | 'image' | 'text' | 'html';
  orden: number;
  title?: string;
  content: {
    // Para YouTube
    youtubeId?: string;
    youtubeTitle?: string;
    youtubeDuration?: string;
    
    // Para PDFs (campos legacy)
    pdfUrl?: string;
    pdfTitle?: string;
    pdfSize?: string;
    
    // Para PDFs de Cloudinary (deprecado)
    cloudinaryPdf?: {
      publicId: string;
      originalFileName?: string;
      fileSize?: number;
    };
    
    // Para PDFs almacenados en base de datos (nuevo)
    databasePdf?: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      uploadDate: Date;
      pdfId: string; // ObjectId como string para referenciar el documento PDF
    };
    
    // Para imágenes
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    
    // Para texto/HTML
    text?: string;
    html?: string;
    
    // Configuraciones generales
    description?: string;
    notes?: string;
  };
}

interface LessonDocument extends Document {
  titulo: string;
  descripcion: string;
  modulo: number; // Correspondiente al roadmap (1-10)
  numeroLeccion: number; // Número dentro del módulo
  duracionEstimada: number; // En minutos
  contenido: LessonContent[];
  objetivos: string[]; // Objetivos de aprendizaje
  recursos: {
    titulo: string;
    url: string;
    tipo: 'enlace' | 'descarga' | 'referencia';
  }[];
  tipoEntrenamiento: 'SwingTrading';
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  esGratuita: boolean;
  requiereSuscripcion: boolean;
  orden: number; // Orden global de la lección
  activa: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  estadisticas: {
    visualizaciones: number;
    completados: number;
    tiempoPromedioVisualizacion: number;
  };
}

const lessonContentSchema = new Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['youtube', 'pdf', 'image', 'text', 'html'] 
  },
  orden: { type: Number, required: true },
  title: { type: String },
  content: {
    // YouTube
    youtubeId: { type: String },
    youtubeTitle: { type: String },
    youtubeDuration: { type: String },
    
    // PDF (campos legacy)
    pdfUrl: { type: String },
    pdfTitle: { type: String },
    pdfSize: { type: String },
    
    // PDF de Cloudinary (deprecado)
    cloudinaryPdf: {
      publicId: { type: String },
      originalFileName: { type: String },
      fileSize: { type: Number }
    },
    
    // PDF de base de datos (nuevo)
    databasePdf: {
      fileName: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
      uploadDate: { type: Date },
      pdfId: { type: String } // ObjectId como string
    },
    
    // Imagen
    imageUrl: { type: String },
    imageAlt: { type: String },
    imageCaption: { type: String },
    
    // Texto/HTML
    text: { type: String },
    html: { type: String },
    
    // General
    description: { type: String },
    notes: { type: String }
  }
});

const recursoSchema = new Schema({
  titulo: { type: String, required: true },
  url: { type: String, required: true },
  tipo: { 
    type: String, 
    required: true, 
    enum: ['enlace', 'descarga', 'referencia'] 
  }
});

const lessonSchema = new Schema<LessonDocument>({
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  modulo: { type: Number, required: true, min: 1, max: 10 },
  numeroLeccion: { type: Number, required: true },
  duracionEstimada: { type: Number, default: 0 }, // En minutos
  contenido: [lessonContentSchema],
  objetivos: [{ type: String }],
  recursos: [recursoSchema],
  tipoEntrenamiento: { 
    type: String, 
    required: true, 
    enum: ['SwingTrading'] 
  },
  dificultad: { 
    type: String, 
    required: true, 
    enum: ['Básico', 'Intermedio', 'Avanzado'],
    default: 'Básico'
  },
  esGratuita: { type: Boolean, default: false },
  requiereSuscripcion: { type: Boolean, default: true },
  orden: { type: Number, required: true },
  activa: { type: Boolean, default: true },
  estadisticas: {
    visualizaciones: { type: Number, default: 0 },
    completados: { type: Number, default: 0 },
    tiempoPromedioVisualizacion: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
lessonSchema.index({ tipoEntrenamiento: 1, modulo: 1, orden: 1 });
lessonSchema.index({ activa: 1, requiereSuscripcion: 1 });
lessonSchema.index({ modulo: 1, numeroLeccion: 1 });

// Middleware para actualizar fechaActualizacion
lessonSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.set({ fechaActualizacion: new Date() });
  }
  next();
});

export default mongoose.models.Lesson || mongoose.model<LessonDocument>('Lesson', lessonSchema); 