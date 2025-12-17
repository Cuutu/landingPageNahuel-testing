import mongoose, { Document, Schema } from 'mongoose';

export interface IApiCache extends Document {
  key: string; // hash
  keyParts?: {
    path?: string;
    query?: Record<string, any>;
    scope?: string;
  };
  payload: any; // JSON serializable
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiCacheSchema = new Schema<IApiCache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    keyParts: { type: Schema.Types.Mixed, default: {} },
    payload: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// TTL: Mongo eliminará automáticamente documentos expirados
ApiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ApiCache || mongoose.model<IApiCache>('ApiCache', ApiCacheSchema);

