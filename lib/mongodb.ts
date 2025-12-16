import mongoose from 'mongoose';

declare global {
  var mongoose: any; // This must be a `var` and not a `let / const`
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  // Validar MONGODB_URI solo en runtime
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('Por favor define la variable de entorno MONGODB_URI');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // ✅ OPTIMIZADO: 10s en vez de 30s - falla rápido si BD no responde
      socketTimeoutMS: 10000, // ✅ OPTIMIZADO: 10s en vez de 30s - operaciones fallan rápido
      connectTimeoutMS: 10000, // ✅ OPTIMIZADO: 10s en vez de 30s - conexión falla rápido
      maxIdleTimeMS: 30000, // Mantener conexiones abiertas por 30s
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      ssl: true,
      authSource: 'admin',
    };
    
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    }).catch((error) => {
      cached.promise = null;
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw new Error(`Error de conexión a MongoDB: ${(e as Error).message}`);
  }

  return cached.conn;
}

export default dbConnect; 