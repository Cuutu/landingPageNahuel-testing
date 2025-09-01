import mongoose from 'mongoose';

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

// Esquema para artículos del informe
const ArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ReportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  // Nuevo campo para artículos
  articles: [ArticleSchema],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    default: 'text'
  },
  category: {
    type: String,
    enum: ['smart-money', 'trader-call', 'general'],
    default: 'general'
  },
  muxAssetId: String,
  playbackId: String,
  thumbnailUrl: String,
  // Imágenes adicionales usando Cloudinary
  images: [CloudinaryImageSchema],
  // Campos legacy de Mux (mantener para compatibilidad)
  imageMuxId: String,
  imageUrl: String,
  views: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export default mongoose.models.Report || mongoose.model('Report', ReportSchema); 