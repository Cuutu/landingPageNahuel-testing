import mongoose, { Document, Schema } from 'mongoose';

export interface IMonthlyTrainingSubscription extends Document {
  userId: string;
  userEmail: string;
  userName: string;
  trainingType: 'SwingTrading' | 'DayTrading' | 'DowJones';
  classId?: string; // Opcional: id de clase específica (para reservas por clase)
  subscriptionMonth: number; // 1-12
  subscriptionYear: number; // 2024, 2025, etc.
  startDate: Date; // Primer día del mes
  endDate: Date; // Último día del mes
  paymentId: string;
  paymentAmount: number;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  mercadopagoPaymentId?: string;
  isActive: boolean;
  accessGranted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyTrainingSubscriptionSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User'
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
  trainingType: {
    type: String,
    required: true,
    enum: ['SwingTrading', 'DayTrading', 'DowJones'],
    default: 'SwingTrading'
  },
  classId: {
    type: String,
    required: false,
    index: true
  },
  subscriptionMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  subscriptionYear: {
    type: Number,
    required: true,
    min: 2024
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  paymentId: {
    type: String,
    required: true,
    index: true // Cambiado de unique a index para permitir reintentos
  },
  paymentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  mercadopagoPaymentId: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  accessGranted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
MonthlyTrainingSubscriptionSchema.index({ userId: 1, trainingType: 1 });
MonthlyTrainingSubscriptionSchema.index({ subscriptionMonth: 1, subscriptionYear: 1 });
MonthlyTrainingSubscriptionSchema.index({ paymentStatus: 1, isActive: 1 });
MonthlyTrainingSubscriptionSchema.index({ endDate: 1 }); // Para limpieza automática
// Unicidad por pack mensual (solo cuando NO es por clase concreta)
MonthlyTrainingSubscriptionSchema.index(
  { userId: 1, trainingType: 1, subscriptionMonth: 1, subscriptionYear: 1, paymentStatus: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentStatus: 'completed', classId: { $exists: false } }
  }
);
// Unicidad por clase específica (permite múltiples fechas dentro del mismo mes si classId difiere)
MonthlyTrainingSubscriptionSchema.index(
  { userId: 1, trainingType: 1, classId: 1, paymentStatus: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentStatus: 'completed', classId: { $exists: true } }
  }
);

// Middleware para calcular fechas automáticamente
MonthlyTrainingSubscriptionSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('subscriptionMonth') || this.isModified('subscriptionYear')) {
    // Calcular primer día del mes
    this.startDate = new Date(this.subscriptionYear as number, (this.subscriptionMonth as number) - 1, 1);
    
    // Calcular último día del mes
    this.endDate = new Date(this.subscriptionYear as number, this.subscriptionMonth as number, 0);
    
    // Establecer hora al final del día para el endDate
    (this.endDate as Date).setHours(23, 59, 59, 999);
  }
  next();
});

// Método para verificar si la suscripción está activa y vigente
MonthlyTrainingSubscriptionSchema.methods.isCurrentlyActive = function(): boolean {
  const now = new Date();
  return this.isActive && 
         this.paymentStatus === 'completed' && 
         this.accessGranted &&
         now >= this.startDate && 
         now <= this.endDate;
};

// Método para verificar si la suscripción ha expirado
MonthlyTrainingSubscriptionSchema.methods.hasExpired = function(): boolean {
  const now = new Date();
  return now > this.endDate;
};

// Método estático para obtener suscripciones activas de un usuario
MonthlyTrainingSubscriptionSchema.statics.getActiveSubscriptions = function(userId: string, trainingType?: string) {
  const query: any = {
    userId,
    isActive: true,
    paymentStatus: 'completed',
    accessGranted: true,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  };
  
  if (trainingType) {
    query.trainingType = trainingType;
  }
  
  return this.find(query).sort({ subscriptionYear: -1, subscriptionMonth: -1 });
};

// Método estático para limpiar suscripciones expiradas
MonthlyTrainingSubscriptionSchema.statics.cleanupExpiredSubscriptions = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      endDate: { $lt: now },
      isActive: true
    },
    {
      $set: { isActive: false }
    }
  );
  
  console.log(`🧹 Limpieza automática: ${(result as any).modifiedCount} suscripciones expiradas desactivadas`);
  return result;
};

// Método estático para obtener estadísticas de suscripciones por mes
MonthlyTrainingSubscriptionSchema.statics.getMonthlyStats = function(year: number, month: number) {
  return this.aggregate([
    {
      $match: {
        subscriptionYear: year,
        subscriptionMonth: month,
        paymentStatus: 'completed'
      }
    },
    {
      $group: {
        _id: '$trainingType',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$paymentAmount' }
      }
    }
  ]);
};

// Método estático para verificar disponibilidad de cupos por mes
MonthlyTrainingSubscriptionSchema.statics.checkAvailability = async function(
  trainingType: string, 
  year: number, 
  month: number, 
  maxSubscribers: number = 10
) {
  const count = await this.countDocuments({
    trainingType,
    subscriptionYear: year,
    subscriptionMonth: month,
    paymentStatus: 'completed',
    isActive: true
  });
  
  return {
    available: count < maxSubscribers,
    currentSubscribers: count,
    maxSubscribers,
    remainingSlots: Math.max(0, maxSubscribers - count)
  };
};

const MonthlyTrainingSubscription = mongoose.models.MonthlyTrainingSubscription || 
  mongoose.model<IMonthlyTrainingSubscription>('MonthlyTrainingSubscription', MonthlyTrainingSubscriptionSchema);

export default MonthlyTrainingSubscription;
