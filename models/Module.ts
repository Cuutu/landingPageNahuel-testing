import mongoose, { Schema, Document } from 'mongoose';

// Interface para los temas
interface ModuleTopic {
  titulo: string;
  descripcion?: string;
}

// Interface principal del módulo
export interface IModule extends Document {
  _id: string;
  nombre: string;
  descripcion: string;
  roadmapId: string; // Referencia al roadmap padre
  tipoEntrenamiento: 'SwingTrading' | 'DayTrading' | 'DowJones' | 'General';
  duracion: string;
  lecciones: number;
  temas: ModuleTopic[];
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: string; // ID de otro módulo
  orden: number;
  activo: boolean;
  slug: string; // URL-friendly identifier
  metadatos: {
    autor: string;
    version: string;
    fechaCreacion: Date;
    fechaActualizacion: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Schema de Mongoose
const ModuleSchema = new Schema<IModule>({
  nombre: {
    type: String,
    required: [true, 'El nombre del módulo es obligatorio'],
    trim: true,
    maxlength: [200, 'El nombre no puede superar los 200 caracteres']
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true,
    maxlength: [1000, 'La descripción no puede superar los 1000 caracteres']
  },
  roadmapId: {
    type: String,
    required: [true, 'El ID del roadmap es obligatorio'],
    ref: 'Roadmap'
  },
  tipoEntrenamiento: {
    type: String,
    required: true,
    enum: ['SwingTrading', 'DayTrading', 'DowJones', 'General']
  },
  duracion: {
    type: String,
    required: [true, 'La duración es obligatoria'],
    trim: true
  },
  lecciones: {
    type: Number,
    required: true,
    min: [1, 'Debe haber al menos 1 lección'],
    max: [1000, 'No puede haber más de 1000 lecciones por módulo']
  },
  temas: [{
    titulo: {
      type: String,
      required: true,
      trim: true,
      maxlength: [300, 'El título del tema no puede superar los 300 caracteres']
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: [500, 'La descripción del tema no puede superar los 500 caracteres']
    }
  }],
  dificultad: {
    type: String,
    required: true,
    enum: ['Básico', 'Intermedio', 'Avanzado']
  },
  prerequisito: {
    type: String,
    ref: 'Module',
    default: null
  },
  orden: {
    type: Number,
    required: true,
    min: [1, 'El orden debe ser mayor a 0']
  },
  activo: {
    type: Boolean,
    default: true
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: [100, 'El slug no puede superar los 100 caracteres']
  },
  metadatos: {
    autor: {
      type: String,
      required: true
    },
    version: {
      type: String,
      default: '1.0'
    },
    fechaCreacion: {
      type: Date,
      default: Date.now
    },
    fechaActualizacion: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
ModuleSchema.index({ roadmapId: 1, orden: 1 });
ModuleSchema.index({ tipoEntrenamiento: 1, activo: 1 });
ModuleSchema.index({ slug: 1 }, { unique: true });

// Middleware para actualizar fechaActualizacion
ModuleSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.metadatos.fechaActualizacion = new Date();
  }
  next();
});

// Método para generar slug automáticamente ANTES de la validación
ModuleSchema.pre('validate', function(next) {
  if (!this.slug || this.isModified('nombre') || this.isNew) {
    const baseSlug = this.nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
      .replace(/\s+/g, '-') // Espacios a guiones
      .trim();
    
    // Agregar timestamp para garantizar unicidad
    this.slug = `${baseSlug}-${Date.now()}`;
  }
  next();
});

// Virtual para obtener lecciones relacionadas
ModuleSchema.virtual('leccionesRelacionadas', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'moduleId'
});

// Método para obtener la URL del módulo
ModuleSchema.methods.getUrl = function() {
  return `/entrenamientos/${this.tipoEntrenamiento}/modulos/${this.slug}`;
};

// Método estático para obtener módulos por roadmap
ModuleSchema.statics.getByRoadmap = function(roadmapId: string) {
  return this.find({ roadmapId, activo: true }).sort({ orden: 1 });
};

// Método estático para obtener módulos por tipo
ModuleSchema.statics.getByType = function(tipoEntrenamiento: string) {
  return this.find({ tipoEntrenamiento, activo: true }).sort({ orden: 1 });
};

const Module = mongoose.models.Module || mongoose.model<IModule>('Module', ModuleSchema);

export default Module; 