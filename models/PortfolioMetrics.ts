import mongoose, { Schema, Document } from 'mongoose';

export interface IPortfolioMetrics extends Document {
  _id: string;
  pool: 'TraderCall' | 'SmartMoney';
  
  // Valores de cartera actuales
  valorTotalCartera: number;
  liquidezInicial: number;
  liquidezTotal: number;
  liquidezDisponible: number;
  liquidezDistribuida: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  
  // Estadísticas de alertas
  totalAlerts: number;
  activeAlerts: number;
  closedAlerts: number;
  winRate: number;
  totalProfit: number;
  
  // Rendimientos por períodos (pre-calculados)
  returns: {
    '1d': number | null;
    '7d': number | null;
    '15d': number | null;
    '30d': number | null;
    '180d': number | null;
    '365d': number | null;
  };
  
  // Valores históricos para comparación
  historicalValues: {
    '1d': number | null;
    '7d': number | null;
    '15d': number | null;
    '30d': number | null;
    '180d': number | null;
    '365d': number | null;
  };
  
  // Datos de evolución del portfolio (últimos 30 días por defecto)
  evolutionData?: Array<{
    date: string;
    value: number;
    profit: number;
    alertsCount: number;
  }>;
  
  // Timestamp de última actualización
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioMetricsSchema = new Schema({
  pool: {
    type: String,
    required: true,
    enum: ['TraderCall', 'SmartMoney'],
    unique: true, // Solo un documento por pool
    index: true
  },
  
  // Valores de cartera
  valorTotalCartera: {
    type: Number,
    required: true,
    min: 0
  },
  liquidezInicial: {
    type: Number,
    required: true,
    min: 0
  },
  liquidezTotal: {
    type: Number,
    required: true,
    min: 0
  },
  liquidezDisponible: {
    type: Number,
    required: true,
    min: 0
  },
  liquidezDistribuida: {
    type: Number,
    required: true,
    min: 0
  },
  totalProfitLoss: {
    type: Number,
    default: 0
  },
  totalProfitLossPercentage: {
    type: Number,
    default: 0
  },
  
  // Estadísticas de alertas
  totalAlerts: {
    type: Number,
    default: 0
  },
  activeAlerts: {
    type: Number,
    default: 0
  },
  closedAlerts: {
    type: Number,
    default: 0
  },
  winRate: {
    type: Number,
    default: 0
  },
  totalProfit: {
    type: Number,
    default: 0
  },
  
  // Rendimientos por períodos
  returns: {
    '1d': { type: Number, default: null },
    '7d': { type: Number, default: null },
    '15d': { type: Number, default: null },
    '30d': { type: Number, default: null },
    '180d': { type: Number, default: null },
    '365d': { type: Number, default: null }
  },
  
  // Valores históricos
  historicalValues: {
    '1d': { type: Number, default: null },
    '7d': { type: Number, default: null },
    '15d': { type: Number, default: null },
    '30d': { type: Number, default: null },
    '180d': { type: Number, default: null },
    '365d': { type: Number, default: null }
  },
  
  // Datos de evolución (opcional, se puede calcular bajo demanda)
  evolutionData: [{
    date: String,
    value: Number,
    profit: Number,
    alertsCount: Number
  }],
  
  // Timestamp de última actualización
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Índice único por pool para búsquedas rápidas
PortfolioMetricsSchema.index({ pool: 1 }, { unique: true });

export default mongoose.models.PortfolioMetrics || mongoose.model<IPortfolioMetrics>('PortfolioMetrics', PortfolioMetricsSchema);

