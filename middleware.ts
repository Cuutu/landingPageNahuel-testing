import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * ✅ OPTIMIZADO: Middleware de Next.js
 * - Solo se ejecuta en rutas que realmente lo necesitan (admin + rutas sospechosas)
 * - Eliminados console.logs innecesarios para mejorar rendimiento
 * - Token solo se obtiene para rutas /admin (evita llamadas innecesarias)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // ✅ SEGURIDAD: Filtrar rutas sospechosas (bots/scanners)
  // Devuelve 404 silencioso sin pasar por _error.tsx
  const suspiciousPaths = [
    '/.env',
    '/.env.local',
    '/.env.development',
    '/.env.production',
    '/.env.bak',
    '/.env.example',
    '/config',
    '/config.json',
    '/config.js',
    '/config.yml',
    '/config.yaml',
    '/config.ini',
    '/settings',
    '/settings.json',
    '/app.config.js',
    '/configuration',
    '/sitemap_index.xml',
    '/.git/config',
    '/env',
    '/env.json',
    '/env.yml',
    '/env.yaml',
    '/estrategiaymetododetrading',
  ];
  
  // Bloquear rutas sospechosas inmediatamente
  if (suspiciousPaths.some(path => pathname === path || pathname.startsWith(path))) {
    return new NextResponse(null, { status: 404 });
  }
  
  // ✅ PROTECCIÓN DE RUTAS ADMIN
  // Solo obtener token cuando es necesario (mejora rendimiento)
  if (pathname.startsWith('/admin')) {
    try {
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      });
      
      // Si no hay token, redirigir a login
      if (!token) {
        return NextResponse.redirect(new URL('/api/auth/signin', request.url));
      }
      
      // Si no es admin, redirigir a home
      if (token.role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
      
      // ✅ Acceso permitido - continuar
    } catch (error) {
      // Solo loguear errores reales (no info de debug)
      console.error('[MIDDLEWARE] Error verificando token admin:', error);
      return NextResponse.redirect(new URL('/api/auth/signin', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * ✅ OPTIMIZADO: Solo ejecutar middleware en rutas necesarias
     * - /admin/* (protección de rutas administrativas)
     * - Rutas sospechosas se manejan arriba con la lista
     * 
     * Excluir:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logos, videos (archivos estáticos)
     */
    '/admin/:path*',
    // Incluir rutas raíz para filtrar bots (pero saldrá rápido si no es sospechosa)
    '/((?!api|_next/static|_next/image|favicon.ico|logos|videos).*)',
  ],
}; 