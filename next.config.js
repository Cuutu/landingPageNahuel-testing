/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false, // 🔒 Deshabilitar el header X-Powered-By
  images: {
    domains: ['image.mux.com', 'lh3.googleusercontent.com'],
  },
  // Transpile react-hot-toast para solucionar problemas de ES modules
  transpilePackages: ['react-hot-toast'],
  experimental: {
    esmExternals: false, // Deshabilitar ES modules externos para compatibilidad
    webpackBuildWorker: true,
  },
  // ✅ MEJORADO: Build ID estático basado en commit o timestamp del deploy
  // Esto permite que el cache sea consistente entre deployments del mismo código
  generateBuildId: async () => {
    // Usar VERCEL_GIT_COMMIT_SHA si está disponible (Vercel), sino usar timestamp del deploy
    return process.env.VERCEL_GIT_COMMIT_SHA || 
           process.env.BUILD_ID || 
           `build-${Date.now()}`;
  },
  // ✅ MEJORADO: Headers inteligentes con caching diferenciado
  async headers() {
    // Headers de seguridad comunes para todas las rutas
    const securityHeaders = [
      // 🔒 Seguridad: Ocultar que usamos Next.js
      {
        key: 'X-Powered-By',
        value: '',
      },
      // 🛡️ Headers de seguridad
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      // 🔒 HSTS - Forzar HTTPS
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
      },
      // 🛡️ Content Security Policy
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://www.youtube.com https://www.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: https: blob:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' https://*.googleapis.com https://*.google.com https://api.mercadopago.com https://*.mux.com https://*.cloudinary.com wss://*.mux.com",
          "frame-src 'self' https://www.youtube.com https://www.google.com https://*.mercadopago.com",
          "media-src 'self' https://*.mux.com blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          "upgrade-insecure-requests"
        ].join('; ')
      },
      // 🛡️ Permissions Policy
      {
        key: 'Permissions-Policy',
        value: [
          'camera=()',
          'microphone=()',
          'geolocation=()',
          'interest-cohort=()',
          'payment=(self)',
          'usb=()',
          'magnetometer=()',
          'gyroscope=()',
          'accelerometer=()'
        ].join(', ')
      },
    ];

    return [
      // ✅ Assets estáticos (_next/static): Cache agresivo de 1 año (inmutables)
      {
        source: '/_next/static/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ✅ Imágenes optimizadas: Cache de 1 año
      {
        source: '/_next/image/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // ✅ Archivos públicos (logos, imágenes, videos): Cache de 1 semana con revalidación
      {
        source: '/logos/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/videos/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400',
          },
        ],
      },
      // ✅ Favicon y assets raíz: Cache de 1 día
      {
        source: '/favicon.ico',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600',
          },
        ],
      },
      // ✅ APIs: Sin cache (datos dinámicos y sensibles)
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      // ✅ Páginas de admin: Sin cache (contenido sensible)
      {
        source: '/admin/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      // ✅ Páginas de alertas: Cache corto con revalidación (datos semi-dinámicos)
      {
        source: '/alertas/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, must-revalidate',
          },
        ],
      },
      // ✅ Páginas de perfil: Sin cache (datos privados del usuario)
      {
        source: '/perfil/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, private',
          },
        ],
      },
      // ✅ Resto de páginas públicas: Cache moderado con stale-while-revalidate
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
  // Configuración adicional para manejar ES modules
  webpack: (config, { dev, isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/entrenamientos/day-trading',
        destination: '/entrenamientos',
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig 