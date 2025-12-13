import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ✅ SIMPLIFICADO: Middleware de Next.js
 * 
 * IMPORTANTE: La protección de rutas admin se maneja SOLO con getServerSideProps
 * en cada página. Esto es más confiable porque:
 * - getServerSession funciona correctamente con las cookies de producción
 * - Evita problemas con el prefijo __Secure- de cookies en HTTPS
 * - Permite verificar el rol directamente desde la base de datos
 * 
 * Este middleware solo bloquea rutas sospechosas (bots/scanners)
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
  
  // ✅ NOTA: La protección de rutas /admin se maneja en getServerSideProps
  // de cada página usando verifyAdminAccess() que usa getServerSession
  // Esto es más confiable que usar getToken en el middleware
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Solo rutas sospechosas específicas (bots/scanners)
    '/.env',
    '/.env.local',
    '/.env.production',
    '/config',
    '/config.json',
    '/settings',
  ],
}; 