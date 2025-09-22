import mongoose, { Schema, Document } from 'mongoose';

// Esquema para imágenes de Cloudinary (igual que en Report)
export interface CloudinaryImage {
  public_id: string;
  url: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  caption?: string;
  order?: number;
}

// Esquema para auditoría de cambios de precio
export interface PriceChangeAudit {
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  oldPrice: number;
  newPrice: number;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface IAlert extends Document {
  _id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  // ✅ CAMBIO: Precio de entrada ahora es un rango (mín-máx) - NO REQUERIDO para compatibilidad
  entryPriceRange?: {
    min: number;
    max: number;
  };
  // ✅ NUEVO: Campo legacy para compatibilidad con alertas existentes
  entryPrice?: number;
  // ✅ NUEVO: Valor final fijado al cierre del mercado
  finalPrice?: number;
  finalPriceSetAt?: Date;
  isFinalPriceFromLastAvailable?: boolean; // Si no hay cierre, usar último disponible
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  status: 'ACTIVE' | 'CLOSED' | 'STOPPED';
  profit: number; // Porcentaje de ganancia/pérdida
  analysis: string;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  tipo: 'TraderCall' | 'SmartMoney' | 'CashFlow';
  // ✅ NUEVO: Tipo de alerta (precio específico o rango)
  tipoAlerta: 'precio' | 'rango';
  // ✅ NUEVO: Campos para alertas de rango
  precioMinimo?: number;
  precioMaximo?: number;
  horarioCierre: string; // Por defecto "17:30"
  exitPrice?: number;
  exitDate?: Date;
  exitReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL';
  // ✅ NUEVO: Campos para emails automáticos
  emailsSent: {
    creation: boolean;
    marketClose: boolean;
  };
  // ✅ NUEVO: Auditoría de cambios de precio (solo admin)
  priceChangeHistory: PriceChangeAudit[];
  // ✅ NUEVO: Campos para el sistema de recomendaciones
  isRecommended: boolean; // Si es recomendada por Nahuel
  recommendedBy?: mongoose.Types.ObjectId;
  recommendedAt?: Date;
  // ✅ NUEVO: Campo para controlar disponibilidad para nuevos clientes
  availableForPurchase: boolean; // Si está disponible para que nuevos clientes la compren
  // Nuevos campos para imágenes
  chartImage?: CloudinaryImage; // Imagen principal del gráfico
  images?: CloudinaryImage[]; // Imágenes adicionales
  
  // ✅ NUEVO: Métodos del esquema
  calculateProfit(): number;
  setFinalPrice(price: number, isFromLastAvailable?: boolean): number;
  recordPriceChange(adminId: mongoose.Types.ObjectId, newPrice: number, reason?: string, ipAddress?: string, userAgent?: string): IAlert;
}

// Esquema para imágenes de Cloudinary
const CloudinaryImageSchema = new mongoose.Schema({
  public_id: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  secure_url: {
    type: String,
    required: true
  },
  width: Number,
  height: Number,
  format: String,
  bytes: Number,
  caption: String,
  order: {
    type: Number,
    default: 0
  }
});

// Esquema para auditoría de cambios de precio
const PriceChangeAuditSchema = new mongoose.Schema({
  changedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  oldPrice: {
    type: Number,
    required: true
  },
  newPrice: {
    type: Number,
    required: true
  },
  reason: String,
  ipAddress: String,
  userAgent: String
});

const AlertSchema: Schema = new Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  action: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  // ✅ CAMBIO: Precio de entrada ahora es un rango (mín-máx) - NO REQUERIDO para compatibilidad
  entryPriceRange: {
    min: {
      type: Number,
      required: false, // Cambiado a false para compatibilidad
      min: 0
    },
    max: {
      type: Number,
      required: false, // Cambiado a false para compatibilidad
      min: 0
    }
  },
  // ✅ NUEVO: Campo legacy para compatibilidad con alertas existentes
  entryPrice: {
    type: Number,
    required: false, // No requerido para compatibilidad
    min: 0
  },
  // ✅ NUEVO: Valor final fijado al cierre
  finalPrice: {
    type: Number,
    min: 0
  },
  finalPriceSetAt: Date,
  isFinalPriceFromLastAvailable: {
    type: Boolean,
    default: false
  },
  currentPrice: {
    type: Number,
    required: true,
    min: 0
  },
  stopLoss: {
    type: Number,
    required: true,
    min: 0
  },
  takeProfit: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['ACTIVE', 'CLOSED', 'STOPPED'],
    default: 'ACTIVE'
  },
  profit: {
    type: Number,
    default: 0
  },
  analysis: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['TraderCall', 'SmartMoney', 'CashFlow'],
    default: 'TraderCall'
  },
  // ✅ NUEVO: Tipo de alerta
  tipoAlerta: {
    type: String,
    required: true,
    enum: ['precio', 'rango'],
    default: 'precio'
  },
  // ✅ NUEVO: Campos para alertas de rango
  precioMinimo: {
    type: Number,
    min: 0
  },
  precioMaximo: {
    type: Number,
    min: 0
  },
  horarioCierre: {
    type: String,
    default: '17:30'
  },
  exitPrice: {
    type: Number,
    min: 0
  },
  exitDate: Date,
  exitReason: {
    type: String,
    enum: ['TAKE_PROFIT', 'STOP_LOSS', 'MANUAL']
  },
  // ✅ NUEVO: Control de emails automáticos
  emailsSent: {
    creation: {
      type: Boolean,
      default: false
    },
    marketClose: {
      type: Boolean,
      default: false
    }
  },
  // ✅ NUEVO: Auditoría de cambios de precio
  priceChangeHistory: [PriceChangeAuditSchema],
  // ✅ NUEVO: Sistema de recomendaciones
  isRecommended: {
    type: Boolean,
    default: false
  },
  recommendedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  recommendedAt: Date,
  // ✅ NUEVO: Campo para controlar disponibilidad para nuevos clientes
  availableForPurchase: {
    type: Boolean,
    default: true
  },
  // Nuevos campos para imágenes
  chartImage: CloudinaryImageSchema, // Imagen principal del gráfico
  images: [CloudinaryImageSchema] // Imágenes adicionales
}, {
  timestamps: true
});

// Índices para optimizar consultas
AlertSchema.index({ createdBy: 1, status: 1 });
AlertSchema.index({ symbol: 1, status: 1 });
AlertSchema.index({ tipo: 1, status: 1 });
AlertSchema.index({ date: -1 });
AlertSchema.index({ isRecommended: 1, status: 1 }); // ✅ NUEVO: Para alertas recomendadas
AlertSchema.index({ finalPriceSetAt: 1 }); // ✅ NUEVO: Para búsquedas por fecha de cierre

// ✅ NUEVO: Método para calcular el profit usando el rango de entrada
AlertSchema.methods.calculateProfit = function(this: IAlert) {
  const currentPrice = this.currentPrice;
  // Usar el precio máximo del rango para cálculos conservadores
  const entryPrice = this.entryPriceRange?.max || this.entryPrice; // Usar el nuevo campo o el antiguo
  
  if (this.action === 'BUY') {
    this.profit = ((currentPrice - entryPrice!) / entryPrice!) * 100; // Usar el nuevo campo o el antiguo
  } else { // SELL
    this.profit = ((entryPrice! - currentPrice) / entryPrice!) * 100; // Usar el nuevo campo o el antiguo
  }
  
  return this.profit;
};

// ✅ NUEVO: Método para fijar precio final al cierre
AlertSchema.methods.setFinalPrice = function(this: IAlert, price: number, isFromLastAvailable: boolean = false) {
  this.finalPrice = price;
  this.finalPriceSetAt = new Date();
  this.isFinalPriceFromLastAvailable = isFromLastAvailable;
  
  // Recalcular profit con el precio final
  if (this.entryPriceRange) {
    const entryPrice = this.entryPriceRange.max;
    if (this.action === 'BUY') {
      this.profit = ((price - entryPrice) / entryPrice) * 100;
    } else { // SELL
      this.profit = ((entryPrice - price) / entryPrice) * 100;
    }
  } else if (this.entryPrice) {
    if (this.action === 'BUY') {
      this.profit = ((price - this.entryPrice) / this.entryPrice) * 100;
    } else { // SELL
      this.profit = ((this.entryPrice - price) / this.entryPrice) * 100;
    }
  }
  
  return this.profit;
};

// ✅ NUEVO: Método para registrar cambio de precio (solo admin)
AlertSchema.methods.recordPriceChange = function(this: IAlert, adminId: mongoose.Types.ObjectId, newPrice: number, reason?: string, ipAddress?: string, userAgent?: string) {
  const oldPrice = this.currentPrice;
  
  this.priceChangeHistory.push({
    changedBy: adminId,
    changedAt: new Date(),
    oldPrice,
    newPrice,
    reason,
    ipAddress,
    userAgent
  });
  
  this.currentPrice = newPrice;
  this.calculateProfit();
  
  return this;
};

// Middleware para calcular profit antes de guardar
AlertSchema.pre('save', function(this: IAlert, next) {
  if (this.isModified('currentPrice') || this.isModified('entryPriceRange') || this.isModified('entryPrice')) {
    (this as any).calculateProfit();
  }
  next();
});

export default mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema); 