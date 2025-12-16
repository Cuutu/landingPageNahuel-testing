import mongoose, { Document, Schema } from 'mongoose';

export type CronNotificationJobStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
export type CronNotificationJobType = 'AUTO_CONVERT_RANGES_SUMMARY';

export interface ICronNotificationJob extends Document {
  type: CronNotificationJobType;
  status: CronNotificationJobStatus;

  // Payload JSON serializable
  payload: {
    acciones?: any[]; // AccionResumen[] (guardado como JSON)
    sendNoOperations?: boolean;
    source?: string;
    runId?: string;
  };

  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;

  lockedAt?: Date | null;
  lockId?: string | null;

  lastError?: string | null;
  sentAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const CronNotificationJobSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['AUTO_CONVERT_RANGES_SUMMARY'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
      max: 20,
    },
    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockId: {
      type: String,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index compuesto para “claim” rápido
CronNotificationJobSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

export default mongoose.models.CronNotificationJob ||
  mongoose.model<ICronNotificationJob>('CronNotificationJob', CronNotificationJobSchema);

