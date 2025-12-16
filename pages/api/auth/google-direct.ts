import { NextApiRequest, NextApiResponse } from 'next';
import { encode } from 'querystring';
import crypto from 'crypto';

/**
 * Endpoint que redirige directamente a Google OAuth sin pasar por la página de signin
 * Esto permite que el usuario vaya directo a seleccionar su cuenta de Google
 * 
 * ✅ Construye la URL de OAuth de Google directamente usando los mismos parámetros que NextAuth
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const nextAuthUrl = process.env.NEXTAUTH_URL || 'https://lozanonahuel.com';
    const callbackUrl = decodeURIComponent((req.query.callbackUrl as string) || '/');

    if (!clientId) {
      console.error('❌ [GOOGLE-DIRECT] GOOGLE_CLIENT_ID no configurado');
      return res.status(500).json({ error: 'Configuración de autenticación no disponible' });
    }

    if (!nextAuthSecret) {
      console.error('❌ [GOOGLE-DIRECT] NEXTAUTH_SECRET no configurado');
      return res.status(500).json({ error: 'Configuración de autenticación no disponible' });
    }

    // Construir la URL de callback de NextAuth (debe coincidir exactamente con la configurada)
    const redirectUri = `${nextAuthUrl}/api/auth/callback/google`;

    // Generar state compatible con NextAuth
    // NextAuth espera: { origin, action, providerId, callbackUrl }
    const stateData = {
      origin: nextAuthUrl,
      action: 'callback',
      providerId: 'google',
      callbackUrl: callbackUrl
    };

    // NextAuth usa base64 del JSON directamente
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

    // Parámetros para OAuth de Google (igual que NextAuth configura)
    const params = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account', // Mostrar selector de cuentas
      state: state,
    };

    // Construir URL de autorización de Google
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${encode(params)}`;

    // Redirigir directamente a Google
    return res.redirect(googleAuthUrl);

  } catch (error: any) {
    console.error('❌ [GOOGLE-DIRECT] Error:', error);
    return res.status(500).json({ 
      error: 'Error al iniciar sesión con Google',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

