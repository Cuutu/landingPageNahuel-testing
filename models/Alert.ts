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

// ✅ NUEVO: Esquema para ventas parciales históricas
export interface VentaParcial {
  fecha: Date;
  precio: number;
  porcentajeVendido: number;
  gananciaRealizada: number;
  sharesVendidos: number;
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
  status: 'ACTIVE' | 'CLOSED' | 'STOPPED' | 'DESESTIMADA' | 'DESCARTADA';
  profit: number; // Porcentaje de ganancia/pérdida
  analysis: string;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  tipo: 'TraderCall' | 'SmartMoney';
  // ✅ NUEVO: Tipo de alerta (precio específico o rango)
  tipoAlerta: 'precio' | 'rango';
  // ✅ NUEVO: Campos para alertas de rango
  precioMinimo?: number;
  precioMaximo?: number;
  horarioCierre: string; // Por defecto "17:30"
  exitPrice?: number;
  exitDate?: Date;
  exitReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'RANGE_BREAK';
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
  // ✅ NUEVO: Motivo de desestimación
  desestimacionMotivo?: string; // Motivo por el cual se desestimó la alerta
  // ✅ NUEVO: Campos para alertas descartadas
  descartadaAt?: Date; // Fecha y hora cuando se descartó la alerta
  descartadaMotivo?: string; // Motivo por el cual se descartó (ej: "Precio fuera de rango")
  descartadaPrecio?: number; // Precio al momento de ser descartada
  // Nuevos campos para imágenes
  chartImage?: CloudinaryImage; // Imagen principal del gráfico
  images?: CloudinaryImage[]; // Imágenes adicionales
  // ✅ NUEVO: Campos para rango de venta parcial
  sellRangeMin?: number; // Precio mínimo del rango de venta parcial
  sellRangeMax?: number; // Precio máximo del rango de venta parcial
  sellPrice?: number; // Precio de venta fijo (convertido desde rango)
  // ✅ NUEVO: Sistema de porcentaje de participación
  participationPercentage: number; // Porcentaje de participación actual (100% = posición completa)
  originalParticipationPercentage: number; // Porcentaje original al crear la alerta
  
  // ✅ NUEVO: Campos para operaciones históricas (posiciones existentes)
  esOperacionHistorica: boolean; // Si es una operación importada/preexistente
  fechaEntrada?: Date; // Fecha real de entrada (puede ser diferente a date)
  ventasParciales?: VentaParcial[]; // Historial de ventas parciales
  gananciaRealizada: number; // Ganancia total realizada de ventas parciales
  gananciaNoRealizada: number; // Ganancia no realizada (posición actual)
  
  // ✅ NUEVO: Campo para sistema de liquidez y ventas programadas
  liquidityData?: {
    allocatedAmount?: number; // Monto asignado actual
    shares?: number; // Acciones actuales
    originalAllocatedAmount?: number; // Monto original asignado
    originalShares?: number; // Acciones originales
    originalParticipationPercentage?: number; // Porcentaje original
    partialSales?: Array<{
      date: Date;
      percentage: number;
      sharesToSell: number;
      sellPrice: number;
      liquidityReleased: number;
      realizedProfit: number;
      executedBy: string;
      priceRange?: { min: number; max: number } | null;
      emailMessage?: string | null;
      emailImageUrl?: string | null;
      isCompleteSale: boolean;
      executed: boolean;
      scheduledAt?: Date;
      executedAt?: Date;
      discarded?: boolean;
      discardedAt?: Date;
      discardReason?: string;
    }>;
  };
  
  // ✅ NUEVO: Métodos del esquema
  calculateProfit(): number;
  setFinalPrice(price: number, isFromLastAvailable?: boolean): number;
  recordPriceChange(adminId: mongoose.Types.ObjectId, newPrice: number, reason?: string, ipAddress?: string, userAgent?: string): IAlert;
  checkRangeBreak(currentPrice: number): { isBroken: boolean; reason?: string };
  discardAlert(motivo: string, precioActual: number): IAlert;
  sellPartial(percentageSold: number, sellPrice: number): IAlert;
  calculateTotalProfit(): { realizada: number; noRealizada: number; total: number; porcentaje: number };
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
    enum: ['ACTIVE', 'CLOSED', 'STOPPED', 'DESESTIMADA', 'DESCARTADA'],
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
    enum: ['TraderCall', 'SmartMoney'],
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
    enum: ['TAKE_PROFIT', 'STOP_LOSS', 'MANUAL', 'RANGE_BREAK']
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
  // ✅ NUEVO: Motivo de desestimación
  desestimacionMotivo: {
    type: String
  },
  // ✅ NUEVO: Campos para alertas descartadas
  descartadaAt: {
    type: Date
  },
  descartadaMotivo: {
    type: String
  },
  descartadaPrecio: {
    type: Number,
    min: 0
  },
  // Nuevos campos para imágenes
  chartImage: CloudinaryImageSchema, // Imagen principal del gráfico
  images: [CloudinaryImageSchema], // Imágenes adicionales
  // ✅ NUEVO: Campos para rango de venta parcial
  sellRangeMin: {
    type: Number,
    min: 0
  },
  sellRangeMax: {
    type: Number,
    min: 0
  },
  sellPrice: {
    type: Number,
    min: 0
  },
  // ✅ NUEVO: Sistema de porcentaje de participación
  participationPercentage: {
    type: Number,
    required: true,
    default: 100,
    min: 0,
    max: 100
  },
  originalParticipationPercentage: {
    type: Number,
    required: true,
    default: 100,
    min: 0,
    max: 100
  },
  // ✅ NUEVO: Campos para operaciones históricas (posiciones existentes)
  esOperacionHistorica: {
    type: Boolean,
    default: false
  },
  fechaEntrada: {
    type: Date
  },
  ventasParciales: [{
    fecha: {
      type: Date,
      required: true
    },
    precio: {
      type: Number,
      required: true,
      min: 0
    },
    porcentajeVendido: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    gananciaRealizada: {
      type: Number,
      default: 0
    },
    sharesVendidos: {
      type: Number,
      default: 0
    }
  }],
  gananciaRealizada: {
    type: Number,
    default: 0
  },
  gananciaNoRealizada: {
    type: Number,
    default: 0
  },
  // ✅ NUEVO: Campo para sistema de liquidez y ventas programadas
  liquidityData: {
    allocatedAmount: {
      type: Number,
      min: 0
    },
    shares: {
      type: Number,
      min: 0
    },
    originalAllocatedAmount: {
      type: Number,
      min: 0
    },
    originalShares: {
      type: Number,
      min: 0
    },
    originalParticipationPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    partialSales: [{
      date: {
        type: Date,
        default: Date.now
      },
      percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      },
      sharesToSell: {
        type: Number,
        default: 0
      },
      sellPrice: {
        type: Number,
        min: 0
      },
      liquidityReleased: {
        type: Number,
        default: 0
      },
      realizedProfit: {
        type: Number,
        default: 0
      },
      executedBy: {
        type: String
      },
      priceRange: {
        min: {
          type: Number,
          min: 0
        },
        max: {
          type: Number,
          min: 0
        }
      },
      emailMessage: {
        type: String
      },
      emailImageUrl: {
        type: String
      },
      isCompleteSale: {
        type: Boolean,
        default: false
      },
      executed: {
        type: Boolean,
        default: false
      },
      scheduledAt: {
        type: Date
      },
      executedAt: {
        type: Date
      },
      discarded: {
        type: Boolean,
        default: false
      },
      discardedAt: {
        type: Date
      },
      discardReason: {
        type: String
      }
    }]
  }
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
  // Usar el precio mínimo del rango para cálculos más favorables
  const entryPrice = this.entryPriceRange?.min || this.entryPrice; // Usar el nuevo campo o el antiguo
  
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
    const entryPrice = this.entryPriceRange.min; // Usar precio mínimo del rango
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

// ✅ NUEVO: Método para verificar si el precio rompe el rango
AlertSchema.methods.checkRangeBreak = function(this: IAlert, currentPrice: number) {
  // Solo verificar si es una alerta de rango y está activa
  if (this.tipoAlerta !== 'rango' || this.status !== 'ACTIVE') {
    return { isBroken: false };
  }

  // Verificar si tiene rangos definidos
  if (!this.entryPriceRange || !this.entryPriceRange.min || !this.entryPriceRange.max) {
    return { isBroken: false };
  }

  const { min, max } = this.entryPriceRange;
  
  // ✅ MODIFICADO: Lógica diferente para alertas de compra vs venta
  if (this.action === 'BUY') {
    // Para alertas de COMPRA: desestimar si se sale del rango
    if (currentPrice < min) {
      return { 
        isBroken: true, 
        reason: `Precio ${currentPrice} por debajo del rango mínimo ${min}` 
      };
    }
    
    if (currentPrice > max) {
      return { 
        isBroken: true, 
        reason: `Precio ${currentPrice} por encima del rango máximo ${max}` 
      };
    }
  } else if (this.action === 'SELL') {
    // ✅ NUEVO: Para alertas de VENTA: desestimar si se sale del rango
    if (currentPrice < min) {
      return { 
        isBroken: true, 
        reason: `Precio ${currentPrice} por debajo del rango mínimo ${min}` 
      };
    }
    
    if (currentPrice > max) {
      return { 
        isBroken: true, 
        reason: `Precio ${currentPrice} por encima del rango máximo ${max}` 
      };
    }
  }
  
  return { isBroken: false };
};

// ✅ NUEVO: Método para descartar alertas
AlertSchema.methods.discardAlert = function(this: IAlert, motivo: string, precioActual: number) {
  this.status = 'DESCARTADA';
  this.descartadaAt = new Date();
  this.descartadaMotivo = motivo;
  this.descartadaPrecio = precioActual;
  
  return this;
};

// ✅ NUEVO: Método para ventas parciales
AlertSchema.methods.sellPartial = function(this: IAlert, percentageSold: number, sellPrice: number) {
  // Validar que el porcentaje a vender no exceda el porcentaje actual
  if (percentageSold > this.participationPercentage) {
    throw new Error(`No se puede vender ${percentageSold}% cuando solo se tiene ${this.participationPercentage}%`);
  }
  
  // Reducir el porcentaje de participación
  this.participationPercentage = Math.max(0, this.participationPercentage - percentageSold);
  
  // Si se vendió todo, marcar como cerrada
  if (this.participationPercentage === 0) {
    this.status = 'CLOSED';
    this.exitPrice = sellPrice;
    this.exitDate = new Date();
    this.exitReason = 'MANUAL';
  }
  
  return this;
};

// ✅ NUEVO: Método para calcular ganancia total (realizada + no realizada)
AlertSchema.methods.calculateTotalProfit = function(this: IAlert) {
  const entryPrice = this.entryPriceRange?.min || this.entryPrice || 0;
  const currentPrice = this.currentPrice || 0;
  
  // ✅ CORREGIDO: Ganancia realizada = promedio de ganancias porcentuales de ventas parciales
  // Cada venta parcial tiene su ganancia porcentual simple: (precioVenta - precioEntrada) / precioEntrada * 100
  let gananciaRealizada = 0;
  if (this.ventasParciales && this.ventasParciales.length > 0) {
    const sumaGanancias = this.ventasParciales.reduce((sum, venta) => sum + (venta.gananciaRealizada || 0), 0);
    gananciaRealizada = sumaGanancias / this.ventasParciales.length; // Promedio
  }
  
  // Ganancia no realizada (posición actual)
  // Calculada como: (precioActual - precioEntrada) / precioEntrada * porcentajeRestante
  let gananciaNoRealizada = 0;
  if (entryPrice > 0 && this.participationPercentage > 0) {
    const cambioPorc = ((currentPrice - entryPrice) / entryPrice) * 100;
    // Ajustar por el porcentaje de participación restante
    gananciaNoRealizada = cambioPorc * (this.participationPercentage / 100);
  }
  
  // Actualizar campos
  this.gananciaRealizada = gananciaRealizada;
  this.gananciaNoRealizada = gananciaNoRealizada;
  
  // Ganancia total
  const total = gananciaRealizada + gananciaNoRealizada;
  
  // Porcentaje total basado en inversión original
  const porcentaje = total;
  
  return {
    realizada: gananciaRealizada,
    noRealizada: gananciaNoRealizada,
    total,
    porcentaje
  };
};

// Middleware para calcular profit antes de guardar
AlertSchema.pre('save', function(this: IAlert, next) {
  if (this.isModified('currentPrice') || this.isModified('entryPriceRange') || this.isModified('entryPrice')) {
    (this as any).calculateProfit();
  }
  next();
});

export default mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema); 