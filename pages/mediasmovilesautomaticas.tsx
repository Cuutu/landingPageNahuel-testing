import { useState } from 'react';
import Head from 'next/head';
import { signIn, useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { usePricing } from '@/hooks/usePricing';
import styles from '@/styles/MediasMovilesAutomaticas.module.css';

export default function MediasMovilesAutomaticasPage() {
  const { data: session } = useSession();
  const { pricing, loading: pricingLoading, formatPrice } = usePricing();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleBuy = async () => {
    if (!session?.user?.email) {
      await signIn('google');
      return;
    }
    try {
      setIsProcessing(true);
      setErrorMessage('');
      const res = await fetch('/api/payments/mercadopago/create-indicator-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product: 'MediasMovilesAutomaticas'
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'No se pudo iniciar el checkout');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Medias móviles automáticas | Indicador TradingView</title>
        <meta
          name="description"
          content="Indicador avanzado para TradingView con medias móviles diarias/semanales automáticas, etiquetas y panel de contexto."
        />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles.heroContent}>
              <div className={styles.heroText}>
                <h1 className={styles.title}>Medias móviles automáticas</h1>
                <p className={styles.subtitle}>
                  Indicador para TradingView. El mismo que uso en Trader Call y Smart Money para
                  tomar decisiones reales de trading.
                </p>
                <div className={styles.heroCtas}>
                  <button className={styles.primaryButton} onClick={handleBuy} disabled={isProcessing}>
                    {isProcessing ? 'Procesando…' : 'Comprar ahora'}
                  </button>
                  <a href="#caracteristicas" className={styles.secondaryLink}>
                    Ver características
                  </a>
                </div>
                {errorMessage && <p className={styles.error}>{errorMessage}</p>}
                <p className={styles.note}>Pago único • Acceso vitalicio en TradingView</p>
              </div>
            </div>
          </div>
        </section>

        {/* Características */}
        <section id="caracteristicas" className={styles.features}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>¿Qué incluye?</h2>
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <h3>Medias móviles automáticas</h3>
                <p>
                  Detección del marco temporal (diario/semanal) y configuración automática de WMA, SMA y
                  EMA clave.
                </p>
                <ul>
                  <li>Diario: WMA 21, SMA 30, EMA 150, SMA 200</li>
                  <li>Semanal: WMA 10, WMA 30, WMA 50, SMA 200</li>
                </ul>
              </div>
              <div className={styles.featureCard}>
                <h3>Etiquetas y distancias</h3>
                <p>
                  Etiquetas junto a cada media y distancias porcentuales para identificar soportes y
                  resistencias dinámicos.
                </p>
              </div>
              <div className={styles.featureCard}>
                <h3>Panel de contexto</h3>
                <p>Beta vs. SPY, industria, país y métricas clave en un panel compacto.</p>
              </div>
              <div className={styles.featureCard}>
                <h3>Método probado</h3>
                <p>
                  Es la misma herramienta que uso en mis servicios de suscripción para análisis y señales.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Modo de acceso */}
        <section className={styles.steps}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Así obtendrás tu acceso en TradingView</h2>
            <ol className={styles.stepsList}>
              <li>Realizás el pago con MercadoPago</li>
              <li>Completás el formulario con tu usuario exacto de TradingView</li>
              <li>En menos de 24 h habilito tu acceso</li>
            </ol>
          </div>
        </section>

        {/* Precio */}
        <section className={styles.pricing}>
          <div className={styles.container}>
            <div className={styles.pricingCard}>
              <div className={styles.priceHeader}>
                <h3>Accede hoy mismo</h3>
                <p className={styles.priceTitle}>Pago único de</p>
                <p className={styles.priceAmount}>
                  {pricingLoading ? 'Cargando...' : formatPrice(pricing?.indicadores?.mediasMovilesAutomaticas?.price || 30000)}
                </p>
              </div>
              <button className={styles.primaryButton} onClick={handleBuy} disabled={isProcessing}>
                {isProcessing ? 'Procesando…' : 'Comprar ahora'}
              </button>
              <p className={styles.priceNote}>Acceso vitalicio. Sin suscripciones.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faq}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Preguntas frecuentes</h2>
            <div className={styles.faqList}>
              <details>
                <summary>¿Por cuánto tiempo tendré acceso?</summary>
                <p>Acceso vitalicio con tu usuario de TradingView.</p>
              </details>
              <details>
                <summary>¿Necesito TradingView Premium?</summary>
                <p>No. Funciona con cuenta gratuita.</p>
              </details>
              <details>
                <summary>¿Puedo usarlo en cualquier activo?</summary>
                <p>Sí. Acciones, índices, ETFs, futuros o cripto.</p>
              </details>
              <details>
                <summary>¿En cuánto tiempo recibiré el acceso?</summary>
                <p>Normalmente en menos de 24 h hábiles.</p>
              </details>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}


