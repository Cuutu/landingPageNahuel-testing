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
  // Deshabilitar cache para evitar problemas en producción
  generateBuildId: () => {
    return Math.random().toString(36).substring(2, 15);
  },
  // Headers para deshabilitar cache y ocultar Next.js
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // 🔒 Seguridad: Ocultar que usamos Next.js
          {
            key: 'X-Powered-By',
            value: '', // Eliminar el header X-Powered-By: Next.js
          },
          // 🛡️ Headers de seguridad adicionales
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Prevenir clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevenir MIME sniffing
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block', // Protección XSS
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin', // Control de referrer
          },
          // 🛡️ Content Security Policy - Protección contra XSS
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
          // 🛡️ Permissions Policy - Control de features del navegador
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