import React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import ToasterProvider from '@/components/ToasterProvider';
import LoginTracker from '@/components/LoginTracker';
import SecurityWarning from '@/components/SecurityWarning';
import { useSecurityProtection } from '@/hooks/useSecurityProtection';
import '@/styles/globals.css';

// Componente para proteger contra click derecho y otras acciones no deseadas
const SecurityProtection: React.FC = () => {
  useSecurityProtection();
  return null;
};

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <title>Nahuel Lozano | Trading y Mercados Financieros</title>
        <meta name="description" content="Especialista en trading y mercados financieros. Alertas, entrenamientos, asesorías y recursos profesionales." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/logos/logo-nahuel.png" />
        <link rel="apple-touch-icon" href="/logos/logo-nahuel.png" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100;200;300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Meta tags adicionales para protección */}
        <meta name="robots" content="noindex, nofollow" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </Head>
      <ToasterProvider>
        <SecurityProtection />
        <SecurityWarning />
        <LoginTracker />
        <Component {...pageProps} />
      </ToasterProvider>
    </SessionProvider>
  );
} 