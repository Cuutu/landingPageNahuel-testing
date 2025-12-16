import mongoose, { Document, Schema } from "mongoose";

// Esquema para imágenes de Cloudinary (igual que en Alert)
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

export interface IOperation extends Document {
  _id: string;
  // Información básica de la operación
  ticker: string; // Símbolo de la acción (AAPL, GOOGL, etc.)
  operationType: 'COMPRA' | 'VENTA'; // Tipo de operación
  quantity: number; // Cantidad de acciones (positivo para compra, negativo para venta)
  price: number; // Precio por acción
  amount: number; // Monto total de la operación (quantity * price)
  date: Date; // Fecha de la operación
  balance: number; // Saldo de liquidez después de la operación
  
  // Información de la alerta relacionada
  alertId: mongoose.Types.ObjectId; // Referencia a la alerta original
  alertSymbol: string; // Símbolo de la alerta (para búsquedas rápidas)
  
  // Información del sistema
  system: 'TraderCall' | 'SmartMoney'; // Sistema al que pertenece
  createdBy: mongoose.Types.ObjectId; // Usuario que ejecutó la operación
  
  // Información adicional para ventas
  isPartialSale?: boolean; // Si es una venta parcial
  partialSalePercentage?: number; // Porcentaje vendido
  originalQuantity?: number; // Cantidad original antes de la venta parcial
  
  // Información adicional para compras
  portfolioPercentage?: number; // Porcentaje de la cartera usado para esta compra
  priceRange?: { // Rango de precio original (para mostrar mientras está "A confirmar")
    min: number;
    max: number;
  };
  isPriceConfirmed?: boolean; // Indica si el precio ya fue confirmado por el CRON
  
  // Información de liquidez
  liquidityData?: {
    allocatedAmount: number; // Monto asignado en liquidez
    shares: number; // Acciones en liquidez
    entryPrice: number; // Precio de entrada en liquidez
    realizedProfit?: number; // Ganancia realizada (para ventas)
  };
  
  // Metadatos
  createdAt: Date;
  updatedAt: Date;
  
  // Campos para auditoría
  executedBy?: string; // Email del usuario que ejecutó
  executionMethod?: 'MANUAL' | 'AUTOMATIC' | 'ADMIN'; // Cómo se ejecutó
  notes?: string; // Notas adicionales
  
  // ✅ NUEVO: Estado de la operación
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING'; // Estado de la operación
  
  // ✅ NUEVO: Imagen de la operación (para mostrar en "Ver Alerta")
  image?: CloudinaryImage;
}

// Esquema para imágenes de Cloudinary
const CloudinaryImageSchema = new Schema({
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
}, { _id: false });

const OperationSchema: Schema = new Schema({
  // Información básica
  ticker: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  operationType: {
    type: String,
    required: true,
    enum: ['COMPRA', 'VENTA']
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Información de la alerta
  alertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert',
    required: false // ✅ NUEVO: Opcional para operaciones manuales sin alerta
  },
  alertSymbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  
  // Información del sistema
  system: {
    type: String,
    required: true,
    enum: ['TraderCall', 'SmartMoney']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Información adicional para ventas
  isPartialSale: {
    type: Boolean,
    default: false
  },
  partialSalePercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  originalQuantity: {
    type: Number,
    min: 0
  },
  
  // Información adicional para compras
  portfolioPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  priceRange: {
    min: { type: Number, min: 0 },
    max: { type: Number, min: 0 }
  },
  isPriceConfirmed: {
    type: Boolean,
    default: false
  },
  
  // Información de liquidez
  liquidityData: {
    allocatedAmount: Number,
    shares: Number,
    entryPrice: Number,
    realizedProfit: Number
  },
  
  // Metadatos
  executedBy: {
    type: String,
    trim: true
  },
  executionMethod: {
    type: String,
    enum: ['MANUAL', 'AUTOMATIC', 'ADMIN'],
    default: 'MANUAL'
  },
  notes: {
    type: String,
    trim: true
  },
  
  // ✅ NUEVO: Estado de la operación
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'PENDING'],
    default: 'ACTIVE'
  },
  
  // ✅ NUEVO: Imagen de la operación (para mostrar en "Ver Alerta")
  image: CloudinaryImageSchema
}, { 
  timestamps: true 
});

// Índices para optimizar consultas
OperationSchema.index({ createdBy: 1, system: 1, date: -1 });
OperationSchema.index({ ticker: 1, system: 1 });
OperationSchema.index({ alertId: 1 });
OperationSchema.index({ operationType: 1, system: 1 });
OperationSchema.index({ date: -1 });

// Método para calcular el monto automáticamente
OperationSchema.pre('save', function(this: IOperation, next) {
  if (this.isModified('quantity') || this.isModified('price')) {
    this.amount = this.quantity * this.price;
  }
  next();
});

// Método estático para obtener operaciones por sistema y usuario
OperationSchema.statics.getOperationsBySystem = function(
  userId: string, 
  system: 'TraderCall' | 'SmartMoney',
  limit: number = 50,
  skip: number = 0
) {
  return this.find({ createdBy: userId, system })
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip)
    .populate('alertId', 'symbol action status profit');
};

// Método estático para obtener resumen de operaciones
OperationSchema.statics.getOperationsSummary = function(
  userId: string,
  system: 'TraderCall' | 'SmartMoney'
) {
  return this.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(userId), system } },
    {
      $group: {
        _id: '$ticker',
        totalOperations: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalAmount: { $sum: '$amount' },
        avgPrice: { $avg: '$price' },
        lastOperation: { $max: '$date' },
        firstOperation: { $min: '$date' }
      }
    },
    { $sort: { lastOperation: -1 } }
  ]);
};

// Método estático para obtener balance actual
OperationSchema.statics.getCurrentBalance = function(
  userId: string,
  system: 'TraderCall' | 'SmartMoney'
) {
  return this.findOne({ createdBy: userId, system })
    .sort({ date: -1 })
    .select('balance');
};

export default mongoose.models.Operation || mongoose.model<IOperation>('Operation', OperationSchema);
