import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Endpoint de debugging completo para diagnosticar problemas de sesión
 * Muestra información de:
 * - Cookies recibidas
 * - Token JWT
 * - Sesión de NextAuth
 * - Usuario en BD
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nextauth_url: process.env.NEXTAUTH_URL || 'NO CONFIGURADO',
    nextauth_secret_exists: !!process.env.NEXTAUTH_SECRET,
  };

  try {
    // 1. Verificar cookies recibidas
    const cookies = req.cookies;
    debugInfo.cookies = {
      received: Object.keys(cookies),
      hasSessionToken: !!(cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token']),
      sessionTokenName: cookies['next-auth.session-token'] ? 'next-auth.session-token' : 
                        cookies['__Secure-next-auth.session-token'] ? '__Secure-next-auth.session-token' : 'NINGUNA'
    };

    // 2. Intentar obtener token JWT
    console.log('🔍 [DEBUG] Intentando obtener token JWT...');
    let token = null;
    let tokenError = null;
    
    try {
      token = await getToken({ 
        req, 
        secret: process.env.NEXTAUTH_SECRET 
      });
      console.log('🔍 [DEBUG] Token obtenido:', !!token);
    } catch (e: any) {
      tokenError = e.message;
      console.error('💥 [DEBUG] Error obteniendo token:', e);
    }
    
    debugInfo.jwt = {
      obtained: !!token,
      error: tokenError,
      email: token?.email || null,
      role: token?.role || null,
      id: token?.id || null,
      exp: token?.exp ? new Date(Number(token.exp) * 1000).toISOString() : null,
      iat: token?.iat ? new Date(Number(token.iat) * 1000).toISOString() : null,
    };

    // 3. Intentar obtener sesión del servidor
    console.log('🔍 [DEBUG] Intentando obtener sesión del servidor...');
    let session = null;
    let sessionError = null;
    
    try {
      session = await getServerSession(req, res, authOptions);
      console.log('🔍 [DEBUG] Sesión obtenida:', !!session);
    } catch (e: any) {
      sessionError = e.message;
      console.error('💥 [DEBUG] Error obteniendo sesión:', e);
    }
    
    debugInfo.session = {
      obtained: !!session,
      error: sessionError,
      hasUser: !!session?.user,
      email: session?.user?.email || null,
      role: session?.user?.role || null,
      id: session?.user?.id || null,
      name: session?.user?.name || null,
    };

    // 4. Si tenemos email, buscar en BD
    const email = session?.user?.email || token?.email;
    if (email) {
      console.log('🔍 [DEBUG] Buscando usuario en BD:', email);
      try {
        await dbConnect();
        const dbUser = await User.findOne({ email }).lean() as any;
        
        debugInfo.database = {
          connected: true,
          userFound: !!dbUser,
          email: dbUser?.email || null,
          role: dbUser?.role || null,
          id: dbUser?._id?.toString() || null,
          lastLogin: dbUser?.lastLogin || null,
          hasActiveSubscriptions: !!(dbUser?.activeSubscriptions?.length > 0),
          subscriptionsCount: dbUser?.activeSubscriptions?.length || 0,
        };
      } catch (dbError: any) {
        debugInfo.database = {
          connected: false,
          error: dbError.message
        };
      }
    } else {
      debugInfo.database = {
        skipped: true,
        reason: 'No hay email disponible para buscar'
      };
    }

    // 5. Diagnóstico
    const diagnosis: string[] = [];
    
    if (!debugInfo.cookies.hasSessionToken) {
      diagnosis.push('❌ NO HAY COOKIE DE SESIÓN - El usuario no está autenticado o las cookies no se envían');
    }
    
    if (!debugInfo.jwt.obtained) {
      diagnosis.push('❌ NO SE PUDO OBTENER JWT - Posible problema con NEXTAUTH_SECRET o cookie corrupta');
    }
    
    if (!debugInfo.session.obtained) {
      diagnosis.push('❌ NO HAY SESIÓN DEL SERVIDOR - getServerSession falló');
    }
    
    if (debugInfo.jwt.obtained && debugInfo.session.obtained) {
      if (debugInfo.jwt.role !== debugInfo.session.role) {
        diagnosis.push(`⚠️ ROLES NO COINCIDEN - JWT: ${debugInfo.jwt.role}, Sesión: ${debugInfo.session.role}`);
      }
    }
    
    if (debugInfo.database?.userFound && debugInfo.session?.role) {
      if (debugInfo.database.role !== debugInfo.session.role) {
        diagnosis.push(`⚠️ ROL BD VS SESIÓN - BD: ${debugInfo.database.role}, Sesión: ${debugInfo.session.role}`);
      }
    }
    
    if (diagnosis.length === 0) {
      diagnosis.push('✅ Todo parece estar configurado correctamente');
    }
    
    debugInfo.diagnosis = diagnosis;

    // Log completo en servidor
    console.log('📊 [DEBUG FULL] Resultado completo:', JSON.stringify(debugInfo, null, 2));

    return res.status(200).json(debugInfo);
    
  } catch (error: any) {
    console.error('💥 [DEBUG FULL] Error general:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      debugInfo
    });
  }
}

