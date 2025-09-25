/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
  // Headers para deshabilitar cache
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