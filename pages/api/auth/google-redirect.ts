import { NextApiRequest, NextApiResponse } from 'next';
import { getCsrfToken } from 'next-auth/react';

/**
 * Endpoint que redirige directamente a Google OAuth
 * Evita el problema del botón que no funciona en algunos navegadores
 * 
 * GET /api/auth/google-redirect?callbackUrl=/reports/123
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Obtener callbackUrl de la query
    let callbackUrl = req.query.callbackUrl as string || '/';
    
    // Decodificar si está codificado
    try {
      callbackUrl = decodeURIComponent(callbackUrl);
    } catch {
      // Si falla, usar el valor original
    }
    
    // Evitar loops
    if (callbackUrl.includes('/auth/signin') || callbackUrl.includes('/api/auth/signin')) {
      callbackUrl = '/';
    }

    // Construir la URL del signin de NextAuth con el provider google
    // Esto hace un GET que inicia el flujo OAuth directamente
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const signInUrl = `${baseUrl}/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    
    console.log('🚀 [GOOGLE-REDIRECT] Redirigiendo a:', signInUrl);
    
    // Redirigir al endpoint de signin de Google
    res.redirect(302, signInUrl);
  } catch (error) {
    console.error('❌ [GOOGLE-REDIRECT] Error:', error);
    res.redirect(302, '/api/auth/signin');
  }
}

