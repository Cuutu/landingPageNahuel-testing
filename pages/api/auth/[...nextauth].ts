import NextAuth from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import type { NextApiRequest, NextApiResponse } from 'next';

// NextAuth usará automáticamente NEXTAUTH_URL si está configurado en las variables de entorno
// La redirección en vercel.json maneja las solicitudes desde .vercel.app al dominio personalizado
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Log para debugging en producción
  if (process.env.NODE_ENV === 'production' && req.query.error) {
    console.error('❌ [NEXTAUTH] Error en callback:', {
      error: req.query.error,
      errorDescription: req.query.error_description,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      host: req.headers.host,
      referer: req.headers.referer
    });
  }
  
  return NextAuth(req, res, authOptions);
} 