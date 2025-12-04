import mongoose, { Document, Schema } from "mongoose";

export interface ILiquidityDistribution {
  alertId: string;
  symbol: string;
  percentage: number;
  allocatedAmount: number;
  entryPrice: number;
  currentPrice: number;
  shares: number;
  profitLoss: number;
  profitLossPercentage: number;
  realizedProfitLoss: number;
  soldShares: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILiquidity extends Document {
  _id: string;
  initialLiquidity: number;  // ✅ NUEVO: Liquidez inicial base asignada por el admin
  totalLiquidity: number;
  availableLiquidity: number;
  distributedLiquidity: number;
  distributions: ILiquidityDistribution[];
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  pool: "TraderCall" | "SmartMoney";

  addDistribution(alertId: string, symbol: string, percentage: number, entryPrice: number): ILiquidityDistribution;
  updateDistribution(alertId: string, currentPrice: number): void;
  sellShares(alertId: string, sharesToSell: number, sellPrice: number): { realized: number; returnedCash: number; remainingShares: number };
  removeDistribution(alertId: string): void;
  calculateTotalProfitLoss(): void;
  recalculateDistributions(): void;
}

const LiquidityDistributionSchema = new Schema({
  alertId: { type: String, required: true, ref: "Alert" },
  symbol: { type: String, required: true, uppercase: true },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  allocatedAmount: { type: Number, required: true, min: 0 },
  entryPrice: { type: Number, required: true, min: 0 },
  currentPrice: { type: Number, required: true, min: 0 },
  shares: { type: Number, required: true, min: 0 },
  profitLoss: { type: Number, default: 0 },
  profitLossPercentage: { type: Number, default: 0 },
  realizedProfitLoss: { type: Number, default: 0 },
  soldShares: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const LiquiditySchema = new Schema({
  initialLiquidity: { type: Number, default: 0, min: 0 },  // ✅ NUEVO: Liquidez inicial base
  totalLiquidity: { type: Number, required: true, min: 0 },
  availableLiquidity: { type: Number, required: true, min: 0 },
  distributedLiquidity: { type: Number, default: 0, min: 0 },
  distributions: [LiquidityDistributionSchema],
  totalProfitLoss: { type: Number, default: 0 },
  totalProfitLossPercentage: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  pool: { type: String, enum: ["TraderCall", "SmartMoney"], required: true }
}, { timestamps: true });

LiquiditySchema.methods.addDistribution = function(this: any, alertId: string, symbol: string, percentage: number, entryPrice: number): ILiquidityDistribution {
  // ✅ NUEVO: Calcular monto basado en liquidez TOTAL, no disponible
  const requiredAmount = (this.totalLiquidity * percentage) / 100;
  
  // ✅ NUEVO: Verificar que hay suficiente liquidez TOTAL disponible (no importa si ya está distribuida)
  if (requiredAmount > this.totalLiquidity) {
    throw new Error("No hay suficiente liquidez total para esta asignación");
  }
  
  // ✅ NUEVO: Permitir múltiples asignaciones sin restricción de 100% total
  // El sistema ahora permite asignar más del 100% si hay liquidez suficiente
  
  // ✅ CORREGIDO: Permitir shares fraccionarias (muchos brokers lo permiten)
  const shares = requiredAmount / entryPrice;
  const actualAllocatedAmount = shares * entryPrice;
  
  const distribution = {
    alertId,
    symbol: symbol.toUpperCase(),
    percentage,
    allocatedAmount: actualAllocatedAmount,
    entryPrice,
    currentPrice: entryPrice,
    shares,
    profitLoss: 0,
    profitLossPercentage: 0,
    realizedProfitLoss: 0,
    soldShares: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  } as ILiquidityDistribution;
  
  this.distributions.push(distribution);
  
  // ✅ NUEVO: Actualizar liquidez disponible basándose en la nueva distribución
  this.availableLiquidity -= actualAllocatedAmount;
  this.distributedLiquidity += actualAllocatedAmount;
  
  return distribution;
};

LiquiditySchema.methods.updateDistribution = function(this: any, alertId: string, currentPrice: number): void {
  const distribution = this.distributions.find((dist: ILiquidityDistribution) => dist.alertId === alertId) as ILiquidityDistribution | undefined;
  if (!distribution) {
    throw new Error("Distribución no encontrada");
  }
  distribution.currentPrice = currentPrice;
  
  // ✅ CORREGIDO: Calcular P&L porcentual primero
  distribution.profitLossPercentage = distribution.entryPrice > 0
    ? ((currentPrice - distribution.entryPrice) / distribution.entryPrice) * 100
    : 0;
  
  // ✅ CORREGIDO: Calcular P&L en dólares SIEMPRE basado en allocatedAmount y cambio porcentual
  // No usar shares porque pueden ser 0 cuando el monto es pequeño
  // P&L = (cambio porcentual / 100) × monto asignado
  if (distribution.allocatedAmount > 0) {
    distribution.profitLoss = (distribution.profitLossPercentage / 100) * distribution.allocatedAmount;
  } else {
    distribution.profitLoss = 0;
  }
  
  distribution.updatedAt = new Date();
  this.calculateTotalProfitLoss();
};

LiquiditySchema.methods.sellShares = function(this: any, alertId: string, sharesToSell: number, sellPrice: number) {
  const distribution = this.distributions.find((dist: ILiquidityDistribution) => dist.alertId === alertId) as ILiquidityDistribution | undefined;
  if (!distribution) {
    throw new Error("Distribución no encontrada");
  }
  if (sharesToSell <= 0) {
    throw new Error("La cantidad a vender debe ser mayor a 0");
  }
  if (sharesToSell > distribution.shares) {
    throw new Error("No hay suficientes acciones para vender");
  }

  const proceeds = sharesToSell * sellPrice;
  const costBasis = sharesToSell * distribution.entryPrice;
  const realized = proceeds - costBasis;

  distribution.shares -= sharesToSell;
  distribution.soldShares = (distribution.soldShares || 0) + sharesToSell;
  distribution.realizedProfitLoss = (distribution.realizedProfitLoss || 0) + realized;
  distribution.currentPrice = sellPrice;
  distribution.allocatedAmount = distribution.shares * distribution.entryPrice;
  distribution.profitLoss = (distribution.currentPrice - distribution.entryPrice) * distribution.shares;
  distribution.profitLossPercentage = distribution.entryPrice > 0 && distribution.shares > 0
    ? ((distribution.currentPrice - distribution.entryPrice) / distribution.entryPrice) * 100
    : 0;
  distribution.isActive = distribution.shares > 0;
  distribution.updatedAt = new Date();

  // ✅ CORREGIDO: No modificar totalLiquidity manualmente aquí
  // recalculateDistributions() ahora calcula todo correctamente usando la fórmula:
  // disponible = inicial - montosCompras + ventasParciales
  // totalLiquidity = inicial + ventasParciales
  // 
  // Las ventas ya están registradas en:
  // - distribution.soldShares (cantidad vendida)
  // - distribution.realizedProfitLoss (ganancia/pérdida de la venta)
  // - distribution.allocatedAmount reducido (shares restantes * entryPrice)
  
  this.recalculateDistributions();

  return { realized, returnedCash: proceeds, remainingShares: distribution.shares };
};

LiquiditySchema.methods.removeDistribution = function(this: any, alertId: string): void {
  const distributionIndex = this.distributions.findIndex((dist: ILiquidityDistribution) => dist.alertId === alertId);
  if (distributionIndex === -1) {
    throw new Error("Distribución no encontrada.");
  }
  const distribution = this.distributions[distributionIndex] as ILiquidityDistribution;
  // ✅ CORREGIDO: No sumar allocatedAmount manualmente aquí porque:
  // 1. Si ya se vendió todo, allocatedAmount es 0 (shares = 0)
  // 2. La liquidez ya fue liberada por sellShares() a través del aumento de totalLiquidity
  // 3. recalculateDistributions() recalculará correctamente availableLiquidity después de remover la distribución
  this.distributedLiquidity -= distribution.allocatedAmount;
  this.distributions.splice(distributionIndex, 1);
  this.recalculateDistributions(); // ✅ CORREGIDO: Usar recalculateDistributions() para recalcular todo correctamente
};

LiquiditySchema.methods.calculateTotalProfitLoss = function(): void {
  const unrealized = (this.distributions as ILiquidityDistribution[]).reduce((sum: number, dist: ILiquidityDistribution) => sum + (dist.profitLoss || 0), 0);
  const realized = (this.distributions as ILiquidityDistribution[]).reduce((sum: number, dist: ILiquidityDistribution) => sum + (dist.realizedProfitLoss || 0), 0);
  this.totalProfitLoss = unrealized + realized;
  this.totalProfitLossPercentage = this.distributedLiquidity > 0 
    ? (this.totalProfitLoss / this.distributedLiquidity) * 100 
    : 0;
};

LiquiditySchema.methods.recalculateDistributions = function(): void {
  // ✅ CORREGIDO: Nueva fórmula de liquidez
  // Disponible = Inicial - Distribuida + Ganancias Realizadas
  
  // 1. Calcular liquidez distribuida (allocatedAmount de distribuciones activas con shares > 0)
  // Representa el dinero actualmente invertido en alertas activas
  const montosDistribuidos = (this.distributions as ILiquidityDistribution[])
    .filter((dist: ILiquidityDistribution) => dist.isActive && dist.shares > 0)
    .reduce((sum: number, dist: ILiquidityDistribution) => sum + dist.allocatedAmount, 0);
  
  // 2. Calcular ganancias REALIZADAS (solo de ventas completadas)
  // Esto es el efectivo que volvió a la cuenta por ventas parciales o totales
  const gananciasRealizadas = (this.distributions as ILiquidityDistribution[])
    .reduce((sum: number, dist: ILiquidityDistribution) => sum + (dist.realizedProfitLoss || 0), 0);
  
  // 3. Calcular ganancias NO realizadas (paper gains/losses de posiciones activas)
  const gananciasNoRealizadas = (this.distributions as ILiquidityDistribution[])
    .filter((dist: ILiquidityDistribution) => dist.isActive && dist.shares > 0)
    .reduce((sum: number, dist: ILiquidityDistribution) => sum + (dist.profitLoss || 0), 0);
  
  // 4. Calcular liquidez distribuida (solo montos activos)
  this.distributedLiquidity = montosDistribuidos;
  
  // 5. Calcular liquidez total (inicial + ganancias totales)
  // El total incluye las ganancias realizadas Y no realizadas para reflejar el valor actual
  this.totalLiquidity = (this.initialLiquidity || 0) + gananciasRealizadas + gananciasNoRealizadas;
  
  // 6. ✅ FÓRMULA CORRECTA: Disponible = Inicial - Distribuida + Ganancias Realizadas
  // Solo las ganancias REALIZADAS vuelven al disponible (no las ganancias en papel)
  this.availableLiquidity = (this.initialLiquidity || 0) - montosDistribuidos + gananciasRealizadas;
  
  // 7. Recalcular ganancias/pérdidas totales
  this.calculateTotalProfitLoss();
};

LiquiditySchema.pre("save", function(this: any, next) {
  if (typeof this.recalculateDistributions === "function") {
    this.recalculateDistributions();
  }
  next();
});

LiquiditySchema.index({ createdBy: 1 });
LiquiditySchema.index({ "distributions.alertId": 1 });
LiquiditySchema.index({ "distributions.symbol": 1 });
LiquiditySchema.index({ createdBy: 1, pool: 1 }, { unique: true });

export default mongoose.models.Liquidity || mongoose.model("Liquidity", LiquiditySchema); 