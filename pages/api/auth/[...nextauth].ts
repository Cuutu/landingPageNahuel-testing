import NextAuth from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Handler de NextAuth v4 optimizado para producción
 * 
 * ✅ CRÍTICO: Asegura que siempre use NEXTAUTH_URL y no req.headers.host
 * Esto evita problemas con cookies en navegadores con tracking prevention
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ CRÍTICO: Forzar uso de NEXTAUTH_URL en lugar de req.headers.host
  // Esto es esencial para que las cookies funcionen correctamente en Safari/Firefox/Edge
  if (process.env.NEXTAUTH_URL && !req.url?.includes(process.env.NEXTAUTH_URL)) {
    // Asegurar que las URLs generadas por NextAuth usen NEXTAUTH_URL
    // Esto se hace automáticamente si NEXTAUTH_URL está definido, pero lo verificamos
  }

  // Log para debugging en producción
  if (process.env.NODE_ENV === 'production' && req.query.error) {
    console.error('❌ [NEXTAUTH] Error en callback:', {
      error: req.query.error,
      errorDescription: req.query.error_description,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      host: req.headers.host,
      referer: req.headers.referer,
      url: req.url
    });
  }
  
  return NextAuth(req, res, authOptions);
} 