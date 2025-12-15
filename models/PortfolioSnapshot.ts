import mongoose, { Schema, Document } from 'mongoose';

export interface IPortfolioSnapshot extends Document {
  _id: string;
  pool: 'TraderCall' | 'SmartMoney';
  valorTotalCartera: number; // Valor guardado a las 16:30
  liquidezInicial: number;
  liquidezTotal: number;
  liquidezDisponible: number;
  liquidezDistribuida: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  snapshotDate: Date; // Fecha del snapshot (normalizada a las 16:30)
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioSnapshotSchema = new Schema({
  pool: {
    type: String,
    required: true,
    enum: ['TraderCall', 'SmartMoney']
    // ✅ NOTA: El índice en 'pool' se crea automáticamente con el índice compuesto { pool: 1, snapshotDate: -1 }
  },
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
  snapshotDate: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas eficientes por pool y fecha
// No hacer único para permitir múltiples snapshots del mismo día si es necesario
PortfolioSnapshotSchema.index({ pool: 1, snapshotDate: -1 });

export default mongoose.models.PortfolioSnapshot || mongoose.model<IPortfolioSnapshot>('PortfolioSnapshot', PortfolioSnapshotSchema);

