import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  name: string;
  email: string;
  picture?: string;
  role: 'normal' | 'suscriptor' | 'admin';
  phone?: string;
  address?: string;
  tarjetas: Array<{
    numero: string;
    nombre: string;
    vencimiento: string;
    tipo: string;
  }>;
  compras: Array<{
    fecha: Date;
    monto: number;
    concepto: string;
    estado: 'pendiente' | 'completada' | 'cancelada';
  }>;
  suscripciones: Array<{
    servicio: 'TraderCall' | 'SmartMoney' | 'CashFlow';
    fechaInicio: Date;
    fechaVencimiento: Date;
    activa: boolean;
  }>;
  subscriptions: Array<{
    tipo: 'TraderCall' | 'SmartMoney' | 'CashFlow';
    precio: number;
    fechaInicio: Date;
    fechaFin?: Date;
    activa: boolean;
  }>;
  // Nuevos campos para MercadoPago
  subscriptionExpiry?: Date; // Fecha de expiración de suscripción (30 días desde último pago)
  lastPaymentDate?: Date; // Fecha del último pago exitoso
  mercadopagoCustomerId?: string; // ID de cliente en MercadoPago
  activeSubscriptions: Array<{
    service: 'TraderCall' | 'SmartMoney' | 'CashFlow';
    startDate: Date;
    expiryDate: Date;
    isActive: boolean;
    mercadopagoPaymentId?: string;
    amount: number;
    currency: string;
  }>;
  entrenamientos: Array<{
    tipo: 'SwingTrading' | 'DowJones';
    fechaInscripcion: Date;
    fechaCompletado?: Date;
    progreso: number; // 0-100
    activo: boolean;
    precio?: number;
    metodoPago?: string;
    transactionId?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive?: boolean;
  fullName?: string;
  cuitCuil?: string;
  educacionFinanciera?: string;
  brokerPreferencia?: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
}

const UserSchema: Schema = new Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  picture: {
    type: String
  },
  role: {
    type: String,
    enum: ['normal', 'suscriptor', 'admin'],
    default: 'normal'
  },
  phone: String,
  address: String,
  tarjetas: [{
    numero: String,
    nombre: String,
    vencimiento: String,
    tipo: String
  }],
  compras: [{
    fecha: Date,
    monto: Number,
    concepto: String,
    estado: {
      type: String,
      enum: ['pendiente', 'completada', 'cancelada'],
      default: 'pendiente'
    }
  }],
  suscripciones: [{
    servicio: {
      type: String,
      enum: ['TraderCall', 'SmartMoney', 'CashFlow']
    },
    fechaInicio: Date,
    fechaVencimiento: Date,
    activa: {
      type: Boolean,
      default: true
    }
  }],
  subscriptions: [{
    tipo: {
      type: String,
      enum: ['TraderCall', 'SmartMoney', 'CashFlow'],
      required: true
    },
    precio: {
      type: Number,
      required: true,
      default: 99
    },
    fechaInicio: {
      type: Date,
      required: true,
      default: Date.now
    },
    fechaFin: {
      type: Date
    },
    activa: {
      type: Boolean,
      default: true
    }
  }],
  // Nuevos campos para MercadoPago
  subscriptionExpiry: {
    type: Date,
    default: null
  },
  lastPaymentDate: {
    type: Date,
    default: null
  },
  mercadopagoCustomerId: {
    type: String,
    default: null
  },
  activeSubscriptions: [{
    service: {
      type: String,
      enum: ['TraderCall', 'SmartMoney', 'CashFlow'],
      required: true
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    mercadopagoPaymentId: {
      type: String
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'ARS'
    }
  }],
  entrenamientos: [{
    tipo: {
      type: String,
      enum: ['SwingTrading', 'DowJones'],
      required: true
    },
    fechaInscripcion: {
      type: Date,
      default: Date.now
    },
    fechaCompletado: {
      type: Date
    },
    progreso: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    activo: {
      type: Boolean,
      default: true
    },
    precio: {
      type: Number
    },
    metodoPago: {
      type: String
    },
    transactionId: {
      type: String
    }
  }],
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fullName: {
    type: String,
    default: null,
  },
  cuitCuil: {
    type: String,
    default: null,
  },
  educacionFinanciera: {
    type: String,
    enum: ['principiante', 'intermedio', 'avanzado', 'experto'],
    default: null,
  },
  brokerPreferencia: {
    type: String,
    enum: ['bull-market', 'iol', 'portfolio-personal', 'cocos-capital', 'eco-valores', 'otros'],
    default: null,
  },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleTokenExpiry: { type: Number }
}, {
  timestamps: true
});

// Middleware para actualizar updatedAt antes de guardar
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

UserSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Método para verificar si el usuario tiene acceso activo a un servicio
UserSchema.methods.hasActiveSubscription = function(service: string): boolean {
  if (!this.subscriptionExpiry) return false;
  return new Date() < this.subscriptionExpiry;
};

// Método para verificar si el usuario tiene acceso a un servicio específico
UserSchema.methods.hasServiceAccess = function(service: string): boolean {
  const activeSub = this.activeSubscriptions.find(
    (sub: any) => sub.service === service && sub.isActive && new Date() < sub.expiryDate
  );
  return !!activeSub;
};

// Método para agregar una suscripción activa
UserSchema.methods.addActiveSubscription = function(
  service: string,
  amount: number,
  currency: string = 'ARS',
  mercadopagoPaymentId?: string
) {
  const startDate = new Date();
  const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 días
  
  this.activeSubscriptions.push({
    service,
    startDate,
    expiryDate,
    isActive: true,
    mercadopagoPaymentId,
    amount,
    currency
  });
  
  // Actualizar fecha de expiración general
  this.subscriptionExpiry = expiryDate;
  this.lastPaymentDate = startDate;
  
  // ✅ IMPORTANTE: Actualizar el rol del usuario a 'suscriptor'
  if (this.role === 'normal') {
    this.role = 'suscriptor';
    console.log('✅ Rol del usuario actualizado a suscriptor:', this.email);
  }
  
  return this.save();
};

// Método para renovar suscripción
UserSchema.methods.renewSubscription = function(
  service: string,
  amount: number,
  currency: string = 'ARS',
  mercadopagoPaymentId?: string
) {
  // Encontrar suscripción existente
  const existingSub = this.activeSubscriptions.find(
    (sub: any) => sub.service === service
  );
  
  if (existingSub) {
    // Renovar suscripción existente
    existingSub.startDate = new Date();
    existingSub.expiryDate = new Date(existingSub.startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    existingSub.isActive = true;
    existingSub.mercadopagoPaymentId = mercadopagoPaymentId;
    existingSub.amount = amount;
    existingSub.currency = currency;
  } else {
    // Agregar nueva suscripción SIN GUARDAR (evitar guardado paralelo)
    const startDate = new Date();
    const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    this.activeSubscriptions.push({
      service,
      startDate,
      expiryDate,
      isActive: true,
      mercadopagoPaymentId,
      amount,
      currency
    });
  }
  
  // Actualizar fechas generales
  this.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  this.lastPaymentDate = new Date();
  
  // ✅ IMPORTANTE: Actualizar el rol SOLO si es 'normal' (NO cambiar admin)
  if (this.role === 'normal') {
    this.role = 'suscriptor';
    console.log('✅ Rol del usuario actualizado a suscriptor:', this.email);
  } else if (this.role === 'admin') {
    console.log('✅ Usuario admin mantiene su rol, suscripción agregada:', this.email);
  }
  
  // Solo hacer UN save() al final
  return this.save();
};

// Índices para optimizar búsquedas (sin duplicar los unique: true)
UserSchema.index({ role: 1 });
UserSchema.index({ 'subscriptions.tipo': 1, 'subscriptions.activa': 1 });
UserSchema.index({ 'entrenamientos.tipo': 1, 'entrenamientos.activo': 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastLogin: -1 });
UserSchema.index({ subscriptionExpiry: 1 });
UserSchema.index({ 'activeSubscriptions.service': 1, 'activeSubscriptions.isActive': 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 