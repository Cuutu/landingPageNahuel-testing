import React from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Star, CheckCircle, ArrowRight, Users, TrendingUp, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import YouTubePlayer from '@/components/YouTubePlayer';
import BackgroundVideo from '@/components/BackgroundVideo';
import styles from '@/styles/Alertas.module.css';

interface AlertServiceProps {
  title: string;
  description: string;
  features: string[];
  href: string;
  backgroundColor: string;
  buttonTextColor: string;
  tag: string;
  videoId: string;
}

const AlertService: React.FC<AlertServiceProps> = ({ 
  title, 
  description, 
  features, 
  href, 
  backgroundColor, 
  buttonTextColor,
  tag,
  videoId
}) => {
  const router = useRouter();

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Usar router.push como método principal
    router.push(href).catch(() => {
      // Fallback a window.location si router.push falla
      window.location.href = href;
    });
  };

  return (
    <motion.div 
      className={styles.serviceCard}
      style={{ backgroundColor }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.3 }}
    >
      {/* Video Player */}
      <div className={styles.videoPlayerContainer}>
        <YouTubePlayer
          videoId={videoId}
          title={`${title} - Introducción`}
          autoplay={false}
          muted={true}
          loop={false}
          className={styles.videoPlayer}
        />
      </div>

      {/* Main Content */}
      <div className={styles.serviceContent}>
        <div className={styles.serviceHeader}>
          <h3 className={styles.serviceTitle}>{title}</h3>
          <span className={styles.serviceTag}>{tag}</span>
        </div>
        
        <p className={styles.serviceDescription}>{description}</p>
        
        <ul className={styles.featureList}>
          {features.map((feature, index) => (
            <li key={index} className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              {feature}
            </li>
          ))}
        </ul>
        
        <div className={styles.trialOffer}>
          <span className={styles.checkmark}>✓</span>
          30 días de prueba gratis
        </div>
        
        <div className={styles.buttonContainer}>
          <button 
            className={styles.serviceButton}
            onClick={handleButtonClick}
            type="button"
            style={{ color: buttonTextColor }}
          >
            Quiero saber más &gt;
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const AlertasPage: React.FC = () => {
  const router = useRouter();
  const alertServices = [
    {
      title: 'Trader Call',
      description: 'Servicio de alertas de compra y venta con estrategia de corto plazo, informes detallados y seguimiento activo, para que puedas invertir en CEDEARs y acciones de forma simple y estratégica. Ideal para quienes buscan grandes rendimientos.',
      features: [
        'Estrategia de corto plazo que busca obtener resultados entre unos días y hasta 3 meses',
        'Inversión en instrumentos de renta variable como CEDEARS, ETFs y acciones locales',
        'Informes de mercado todos los días',
        'Alertas fundamentadas en el análisis técnico, delineando salidas con Stop Loss y Take Profit'
      ],
      href: '/alertas/trader-call',
      backgroundColor: '#0f766e',
      buttonTextColor: '#10b981',
      tag: 'Corto Plazo',
      videoId: 'dQw4w9WgXcQ'
    },
    {
      title: 'Smart Money',
      description: 'Servicio de alertas de compra con visión de mediano y largo plazo, pensado para construir carteras sólidas, con foco en crecimiento sostenido y bajo riesgo. Ideal para quienes buscan invertir con estrategia sin estar pendientes del día a día.',
      features: [
        'Estrategia de inversión de varios meses a años, ideal para acumular capital',
        'Selección de activos con fundamentos sólidos tanto de renta fija como de renta variable',
        'Informes de mercado y seguimiento semanal',
        'Alertas del análisis técnicos y fundamental, con revisiones periódicas y constantes'
      ],
      href: '/alertas/smart-money',
      backgroundColor: '#7f1d1d',
      buttonTextColor: '#dc2626',
      tag: 'Mediano y Largo Plazo',
      videoId: 'dQw4w9WgXcQ'
    },

  ];

  return (
    <>
      <Head>
        <title>Alertas de Trading - Nahuel Lozano</title>
        <meta name="description" content="Servicios de alertas profesionales: Trader Call, Smart Money y CashFlow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />
      
      <main className={styles.main}>
        {/* Hero Section - Nuevo diseño con video */}
        <section className={styles.hero}>
          {/* Video de fondo */}
          <BackgroundVideo
            videoSrc="/logos/DiseñoWeb-LozanoNahuel-Alertas-TraderCall.mp4"
            className={styles.heroVideoBackground}
            autoPlay={true}
            muted={true}
            loop={true}
            showControls={false}
          />
          
          <div className={styles.container}>
            <motion.div 
              className={styles.heroContent}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  Servicio de Alertas
                </h1>
                <p className={styles.heroDescription}>
                  Accedé a señales precisas y actualizaciones periódicas para operar en los mercados. 
                  Elegí la estrategia que mejor se ajuste a tus objetivos y mejorá tus probabilidades de éxito.
                </p>
                <button 
                  className={styles.heroButton}
                  onClick={() => {
                    const servicesSection = document.querySelector(`.${styles.services}`);
                    if (servicesSection) {
                      servicesSection.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                      });
                    }
                  }}
                >
                  Empezá Ahora &gt;
                </button>
              </div>
              
              <div className={styles.heroVideo}>
                <div className={styles.videoPlayer}>
                  <YouTubePlayer
                    videoId="dQw4w9WgXcQ"
                    title="Alertas de Trading - Introducción"
                    autoplay={false}
                    muted={true}
                    loop={false}
                    className={styles.videoPlayer}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Services Section */}
        <section className={styles.services}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Nuestros Servicios de Alertas
            </motion.h2>
            <p className={styles.sectionSubtitle}>
              Estas son las alertas que pueden comprar
            </p>
            
            <div className={styles.servicesGrid}>
              {alertServices.map((service, index) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  <AlertService {...service} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.stats}>
          <div className={styles.statsGrid}>
            <motion.div 
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h3 className={styles.statNumber}>+2900</h3>
              <p className={styles.statLabel}>Suscriptores</p>
            </motion.div>
            
            <motion.div 
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className={styles.statNumber}>+790</h3>
              <p className={styles.statLabel}>Alertas</p>
            </motion.div>
            
            <motion.div 
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h3 className={styles.statNumber}>+800</h3>
              <p className={styles.statLabel}>Informes</p>
            </motion.div>
            
            <motion.div 
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h3 className={styles.statNumber}>98%</h3>
              <p className={styles.statLabel}>Satisfacción</p>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <div className={styles.ctaContent}>
            <motion.h2 
              className={styles.ctaTitle}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              ¿Listo para llevar tus inversiones al siguiente nivel?
            </motion.h2>
            <motion.p 
              className={styles.ctaDescription}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              Únete a nuestra comunidad y comienza a construir tu libertad financiera
            </motion.p>
            <motion.div 
              className={styles.ctaButtons}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link href="/alertas/trader-call" className={styles.ctaButton}>
                Trader Call &gt;
              </Link>
              <Link href="/alertas/smart-money" className={styles.ctaButton}>
                Smart Money &gt;
              </Link>

            </motion.div>
          </div>
        </section>

        {/* YouTube Community Banner */}
        <section className={styles.youtubeBanner}>
          <button className={styles.navArrow} aria-label="Anterior">
            <span className={styles.arrowIcon}>‹</span>
          </button>
          
          <div className={styles.bannerContent}>
            <div className={styles.bannerText}>
              <motion.h2 
                className={styles.bannerTitle}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                ¡Sumate a nuestra comunidad
              </motion.h2>
              <motion.h3 
                className={styles.bannerSubtitle}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                en YouTube!
              </motion.h3>
              <motion.p 
                className={styles.bannerDescription}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                No te pierdas nuestros <em>últimos videos</em>
              </motion.p>
            </div>
            
            <div className={styles.bannerVideo}>
              <div className={styles.videoPlayer}>
                <YouTubePlayer
                  videoId="dQw4w9WgXcQ"
                  title="Comunidad de YouTube - Alertas"
                  autoplay={false}
                  muted={true}
                  loop={false}
                  className={styles.videoPlayer}
                />
              </div>
            </div>
          </div>
          
          <button className={styles.navArrow} aria-label="Siguiente">
            <span className={styles.arrowIcon}>›</span>
          </button>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default AlertasPage; 