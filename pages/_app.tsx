import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import ToasterProvider from '@/components/ToasterProvider';
import LoginTracker from '@/components/LoginTracker';
import SessionMonitor from '@/components/SessionMonitor';
import SecurityWarning from '@/components/SecurityWarning';
import GlobalSecurityProtection from '@/components/GlobalSecurityProtection';
import { ContactProvider } from '@/contexts/ContactContext';
import '@/styles/globals.css';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  // 🔍 DEBUG: Verificar si hay meta tags problemáticos en el DOM
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const problematicMeta = document.querySelector('meta[http-equiv="X-Frame-Options"]');
      if (problematicMeta) {
        console.error('❌ [DEBUG] Meta tag X-Frame-Options encontrado en el DOM:', problematicMeta);
        problematicMeta.remove();
        console.log('✅ [DEBUG] Meta tag removido del DOM');
      }
    }
  }, []);

  return (
    <SessionProvider 
      session={session}
      refetchInterval={60} // ✅ MEJORADO: Refrescar sesión cada 60 segundos (antes 5 minutos) para mantener sesión activa
      refetchOnWindowFocus={true} // Refrescar cuando la ventana recupera el foco
      basePath="/api/auth" // ✅ AGREGADO: Especificar basePath explícitamente
    >
      <Head>
        <title>Nahuel Lozano | Trading y Mercados Financieros</title>
        <meta name="description" content="Especialista en trading y mercados financieros. Alertas, entrenamientos, asesorías y recursos profesionales." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/logos/logo-nahuel.png" />
        <link rel="apple-touch-icon" href="/logos/logo-nahuel.png" />
        <meta name="theme-color" content="#3b82f6" />
        {/* ✅ OPTIMIZADO: Fuentes movidas a _document.tsx para no bloquear renderización */}
        {/* Meta tags adicionales para protección */}
        <meta name="robots" content="noindex, nofollow" />
        {/* ✅ REMOVIDO: X-Frame-Options y X-Content-Type-Options ya están configurados como headers HTTP en next.config.js */}
      </Head>
      <ToasterProvider>
        <ContactProvider>
          <GlobalSecurityProtection />
          <SecurityWarning />
          <LoginTracker />
          <SessionMonitor />
          <Component {...pageProps} />
        </ContactProvider>
      </ToasterProvider>
    </SessionProvider>
  );
} 