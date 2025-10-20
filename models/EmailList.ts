import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailList extends Document {
  email: string;
  source: 'manual' | 'registration' | 'import'; // Cómo se agregó el email
  addedAt: Date;
  isActive: boolean;
  lastUsed?: Date; // Última vez que se usó para envío masivo
  tags?: string[]; // Tags opcionales para categorizar emails
  notes?: string; // Notas opcionales
}

const EmailListSchema = new Schema<IEmailList>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido']
  },
  source: {
    type: String,
    enum: ['manual', 'registration', 'import'],
    required: true,
    default: 'manual'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
EmailListSchema.index({ email: 1 });
EmailListSchema.index({ source: 1 });
EmailListSchema.index({ isActive: 1 });
EmailListSchema.index({ addedAt: -1 });

// Método estático para agregar email si no existe
EmailListSchema.statics.addEmailIfNotExists = async function(
  email: string, 
  source: 'manual' | 'registration' | 'import' = 'registration',
  tags?: string[],
  notes?: string
) {
  try {
    // Verificar si el email ya existe
    const existingEmail = await this.findOne({ email: email.toLowerCase().trim() });
    
    if (existingEmail) {
      // Si existe pero está inactivo, reactivarlo
      if (!existingEmail.isActive) {
        existingEmail.isActive = true;
        existingEmail.source = source;
        if (tags) existingEmail.tags = tags;
        if (notes) existingEmail.notes = notes;
        await existingEmail.save();
        return { email: existingEmail, wasAdded: false, wasReactivated: true };
      }
      return { email: existingEmail, wasAdded: false, wasReactivated: false };
    }

    // Crear nuevo email
    const newEmail = new this({
      email: email.toLowerCase().trim(),
      source,
      tags,
      notes
    });

    await newEmail.save();
    return { email: newEmail, wasAdded: true, wasReactivated: false };
  } catch (error) {
    console.error('Error agregando email a la lista:', error);
    throw error;
  }
};

// Método estático para obtener emails activos
EmailListSchema.statics.getActiveEmails = async function(tags?: string[]) {
  const query: any = { isActive: true };
  
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  
  return await this.find(query, 'email source addedAt tags notes').sort({ addedAt: -1 });
};

// Método estático para marcar emails como usados
EmailListSchema.statics.markAsUsed = async function(emails: string[]) {
  return await this.updateMany(
    { email: { $in: emails } },
    { lastUsed: new Date() }
  );
};

// Método estático para obtener estadísticas
EmailListSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: ['$isActive', 1, 0] }
        }
      }
    }
  ]);

  const total = await this.countDocuments();
  const active = await this.countDocuments({ isActive: true });

  return {
    total,
    active,
    inactive: total - active,
    bySource: stats.reduce((acc, stat) => {
      acc[stat._id] = {
        total: stat.count,
        active: stat.activeCount
      };
      return acc;
    }, {})
  };
};

export default mongoose.models.EmailList || mongoose.model<IEmailList>('EmailList', EmailListSchema);
