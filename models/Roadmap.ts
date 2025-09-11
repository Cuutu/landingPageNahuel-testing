import mongoose, { Schema, Document } from 'mongoose';

// Interface para temas/topics de un módulo
interface RoadmapTopic {
  titulo: string;
  descripcion?: string;
}

// Interface para un módulo del roadmap
interface RoadmapModule {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string; // ej: "3 horas"
  lecciones: number;
  temas: RoadmapTopic[];
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: number;
  orden: number;
  activo: boolean;
}

// Interface principal del documento Roadmap
interface RoadmapDocument extends Document {
  nombre: string; // ej: "Trading Fundamentals", "Dow Jones Advanced"
  descripcion: string;
  tipoEntrenamiento: 'SwingTrading' | 'DayTrading' | 'DowJones' | 'General';
  modulos: RoadmapModule[];
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  orden: number; // Para ordenar múltiples roadmaps
  metadatos: {
    totalLecciones: number;
    totalHoras: number;
    autor: string;
    version: string;
  };
}

// Schema para topics
const roadmapTopicSchema = new Schema<RoadmapTopic>({
  titulo: { type: String, required: true },
  descripcion: { type: String }
}, { _id: false });

// Schema para módulos
const roadmapModuleSchema = new Schema<RoadmapModule>({
  id: { type: Number, required: true },
  titulo: { type: String, required: true },
  descripcion: { type: String, required: true },
  duracion: { type: String, required: true },
  lecciones: { type: Number, required: true, min: 0 },
  temas: [roadmapTopicSchema],
  dificultad: { 
    type: String, 
    required: true, 
    enum: ['Básico', 'Intermedio', 'Avanzado'] 
  },
  prerequisito: { type: Number },
  orden: { type: Number, required: true },
  activo: { type: Boolean, default: true }
}, { _id: false });

// Schema principal del roadmap
const roadmapSchema = new Schema<RoadmapDocument>({
  nombre: { type: String, required: true, unique: true },
  descripcion: { type: String, required: true },
  tipoEntrenamiento: { 
    type: String, 
    required: true, 
    enum: ['SwingTrading', 'DayTrading', 'DowJones', 'General'] 
  },
  modulos: [roadmapModuleSchema],
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 1 },
  metadatos: {
    totalLecciones: { type: Number, default: 0 },
    totalHoras: { type: Number, default: 0 },
    autor: { type: String, default: 'Admin' },
    version: { type: String, default: '1.0' }
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
roadmapSchema.index({ tipoEntrenamiento: 1, activo: 1 });
roadmapSchema.index({ orden: 1 });

// Middleware para calcular metadatos automáticamente
roadmapSchema.pre('save', function(this: RoadmapDocument) {
  if (this.modulos && this.modulos.length > 0) {
    this.metadatos.totalLecciones = this.modulos.reduce((total, modulo) => total + modulo.lecciones, 0);
    
    // Calcular total de horas (extraer número de la string "X horas")
    this.metadatos.totalHoras = this.modulos.reduce((total, modulo) => {
      const horas = parseInt(modulo.duracion.split(' ')[0]) || 0;
      return total + horas;
    }, 0);
  }
});

// Método para obtener estadísticas
roadmapSchema.methods.getEstadisticas = function() {
  return {
    totalModulos: this.modulos.length,
    totalLecciones: this.metadatos.totalLecciones,
    totalHoras: this.metadatos.totalHoras,
    modulosPorDificultad: {
      basico: this.modulos.filter((m: RoadmapModule) => m.dificultad === 'Básico').length,
      intermedio: this.modulos.filter((m: RoadmapModule) => m.dificultad === 'Intermedio').length,
      avanzado: this.modulos.filter((m: RoadmapModule) => m.dificultad === 'Avanzado').length
    }
  };
};

// Método para validar estructura de prerequisitos
roadmapSchema.methods.validarPrerequisitos = function() {
  const errores: string[] = [];
  
  this.modulos.forEach((modulo: RoadmapModule) => {
    if (modulo.prerequisito) {
      const prerequisitoExiste = this.modulos.some((m: RoadmapModule) => m.id === modulo.prerequisito);
      if (!prerequisitoExiste) {
        errores.push(`Módulo ${modulo.id} tiene prerequisito ${modulo.prerequisito} que no existe`);
      }
      
      // Verificar que el prerequisito tenga ID menor (orden lógico)
      if (modulo.prerequisito >= modulo.id) {
        errores.push(`Módulo ${modulo.id} no puede tener prerequisito ${modulo.prerequisito} (debe ser menor)`);
      }
    }
  });
  
  return errores;
};

export type { RoadmapDocument, RoadmapModule, RoadmapTopic };

const Roadmap = mongoose.models.Roadmap || mongoose.model<RoadmapDocument>('Roadmap', roadmapSchema);

export default Roadmap; 