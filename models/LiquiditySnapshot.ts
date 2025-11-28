import mongoose, { Document, Schema } from "mongoose";

export interface ILiquiditySnapshot extends Document {
  _id: string;
  date: Date;
  pool: "TraderCall" | "SmartMoney";
  totalLiquidity: number;
  availableLiquidity: number;
  distributedLiquidity: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  createdAt: Date;
}

const LiquiditySnapshotSchema = new Schema({
  date: { type: Date, required: true },
  pool: { type: String, enum: ["TraderCall", "SmartMoney"], required: true },
  totalLiquidity: { type: Number, required: true, min: 0 },
  availableLiquidity: { type: Number, required: true, min: 0 },
  distributedLiquidity: { type: Number, default: 0, min: 0 },
  totalProfitLoss: { type: Number, default: 0 },
  totalProfitLossPercentage: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

LiquiditySnapshotSchema.index({ date: 1, pool: 1 }, { unique: true });
LiquiditySnapshotSchema.index({ pool: 1, date: -1 });

export default mongoose.models.LiquiditySnapshot || mongoose.model("LiquiditySnapshot", LiquiditySnapshotSchema);
