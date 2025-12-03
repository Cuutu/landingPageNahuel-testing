import { GetServerSideProps } from 'next';
import { getSession, signIn, useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, TrendingUp, Users, Shield, Star, X, BookOpen, Clock, Award, ChevronLeft, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Carousel from '@/components/Carousel';
import YouTubePlayer from '@/components/YouTubePlayer';
import { usePopupFrequency } from '@/hooks/usePopupFrequency';
import { usePricing } from '@/hooks/usePricing';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import { verifyAdminAccess } from '@/lib/adminAuth';
import styles from '@/styles/Home.module.css';

interface Training {
  _id: string;
  tipo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion: number;
  contenido: {
    modulos: number; 
    lecciones: number;
    certificacion: boolean;
    nivelAcceso: string;
  };
  metricas: {
    rentabilidad: number;
    estudiantesActivos: number;
    entrenamientosRealizados: number;
    satisfaccion: number;
  };
  activo: boolean;
}

interface CourseCard {
  _id: string;
  titulo: string;
  descripcion: string;
  precio: string;
  urlDestino: string;
  imagen?: string;
  destacado: boolean;
  activo: boolean;
  orden: number;
  categoria?: string;
  fechaCreacion: string;
  fechaActualizacion: string;
}

interface SiteConfig {
  heroVideo: {
    youtubeId: string;
    title: string;
    description: string;
    thumbnail?: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
  servicios: {
    orden: number;
    visible: boolean;
  };
  cursos: {
    orden: number;
    visible: boolean;
    destacados: Training[];
  };
  learningVideo: {
    youtubeId: string;
    title: string;
    description: string;
    thumbnail?: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
  statistics?: {
    visible: boolean;
    backgroundColor: string;
    textColor: string;
    stats: {
      id: string;
      number: string;
      label: string;
      icon?: React.ReactNode;
      color: string;
      order: number;
    }[];
  };
  serviciosVideos?: {
    alertas?: {
      youtubeId: string;
      title: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
    entrenamientos?: {
      youtubeId: string;
      title: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
    asesorias?: {
      youtubeId: string;
      title: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
  };
}

interface HomeProps {
  /** @param session - Sesión del usuario autenticado */
  session: any;
  siteConfig: SiteConfig;
  entrenamientos: Training[];
  courseCards: CourseCard[];
  initialPricing?: any;
  /** @param isAdmin - Indica si el usuario es administrador */
  isAdmin: boolean;
}

/**
 * Componente de carousel automático para videos de YouTube
 */
const YouTubeAutoCarousel: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState(0);
  
  const videos = [
    {
      id: '0NpdClGWaY8',
      title: 'Video 1'
    },
    {
      id: 'jl3lUCIluAs',
      title: 'Video 2'
    },
    {
      id: '_AMDVmj9_jw',
      title: 'Video 3'
    },
    {
      id: 'sUktp76givU',
      title: 'Video 4'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideo((prev) => (prev + 1) % videos.length);
    }, 5000); // Cambia cada 5 segundos

    return () => clearInterval(interval);
  }, [videos.length]);

  const goToPrevious = () => {
    setCurrentVideo((prev) => (prev - 1 + videos.length) % videos.length);
  };

  const goToNext = () => {
    setCurrentVideo((prev) => (prev + 1) % videos.length);
  };

  return (
    <div className={styles.youtubeAutoCarousel}>
      <button 
        onClick={goToPrevious}
        className={styles.youtubeArrowLeft}
        aria-label="Video anterior"
      >
        <ChevronLeft size={24} />
      </button>
      
      <div className={styles.youtubeVideoFrame}>
        <iframe
          src={`https://www.youtube.com/embed/${videos[currentVideo].id}`}
          title={videos[currentVideo].title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={styles.youtubeVideoPlayer}
        />
      </div>
      
      <button 
        onClick={goToNext}
        className={styles.youtubeArrowRight}
        aria-label="Siguiente video"
      >
        <ChevronRight size={24} />
      </button>

      <div className={styles.youtubeIndicators}>
        {videos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentVideo(index)}
            className={`${styles.youtubeIndicator} ${
              index === currentVideo ? styles.youtubeIndicatorActive : ''
            }`}
            aria-label={`Ver video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Página principal del sitio web de Nahuel Lozano
 */
export default function Home({ session: serverSession, siteConfig, entrenamientos, courseCards, initialPricing, isAdmin }: HomeProps) {
  // console.log('🏠 Renderizando página principal');
  // console.log('🔧 siteConfig:', siteConfig);
  // console.log('🎯 servicios visible:', siteConfig?.servicios?.visible);
  // console.log('📚 cursos visible:', siteConfig?.cursos?.visible);
  // console.log('🎓 entrenamientos:', entrenamientos);
  
  const router = useRouter();
  const { data: session } = useSession(); // Hook del cliente para detectar cambios en tiempo real
  const { pricing, loading: pricingLoading, formatPrice: uiFormatPrice } = usePricing();
  const resolvedPricing = pricing || initialPricing;
  const { isFeatureEnabled } = useSiteConfig();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const [currentDestacadoIndex, setCurrentDestacadoIndex] = useState(0);
  const [currentTestimonialGroupIndex, setCurrentTestimonialGroupIndex] = useState(0);

  // Función para manejar el clic del botón "Empezá Ahora"
  const handleStartNowClick = () => {
    // console.log('🔍 Debug handleStartNowClick:', {
    //   session: !!session,
    //   sessionUser: session?.user?.email,
    //   sessionStatus: session ? 'authenticated' : 'not authenticated'
    // });
    
    if (session) {
      // Si el usuario está autenticado, redirigir a /alertas
      // console.log('✅ Usuario autenticado, redirigiendo a /alertas');
      router.push('/alertas');
    } else {
      // Si no está autenticado, iniciar sesión con Google
      // console.log('❌ Usuario no autenticado, iniciando sesión');
      signIn('google');
    }
  };

  // TODO: V2.0 - Sistema de códigos de descuento
  // Hook para manejar la frecuencia del popup - DESACTIVADO PARA V2.0
  const ENABLE_DISCOUNT_POPUP = false; // Cambiar a true en V2.0 cuando esté listo el sistema de descuentos
  
  const { isVisible: showPopup, closePopupExtended } = usePopupFrequency({
    frequencyDays: 7, // Mostrar cada semana (cambiar a 30 para mensual)
    manualCloseExtraDays: 14, // Si cierra manualmente, no mostrar por 2 semanas más
    delayMs: 3000, // Delay de 3 segundos
    isAuthenticated: !!session || !ENABLE_DISCOUNT_POPUP // Siempre desactivado hasta V2.0
  });

  const handlePopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSubmitMessage('¡Perfecto! Revisa tu email para confirmar tu suscripción y recibir tu curso gratuito.');
        setEmail('');
        setTimeout(() => closePopupExtended(), 3000);
      } else {
        setSubmitMessage('Error al suscribirse. Por favor intenta nuevamente.');
      }
    } catch (error) {
      setSubmitMessage('Error al suscribirse. Por favor intenta nuevamente.');
    }

    setIsSubmitting(false);
  };

  const handleMercadoPagoCheckout = async (type: 'subscription' | 'training', service: string, amount: number, currency: string) => {
    if (!session) {
      toast.error('Debes iniciar sesión primero');
      signIn('google');
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          type,
          service,
          amount,
          currency
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error || 'Error al procesar el pago');
      }
    } catch (error) {
      // console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al procesar el pago: ${errorMessage}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };
  


  const testimonios = [
    {
      nombre: 'Carlos Mendoza',
      texto: 'Las alertas de Nahuel me han ayudado a incrementar mi cartera un 45% en los últimos 6 meses.',
      calificacion: 5,
      foto: '/testimonios/carlos.jpg'
    },
    {
      nombre: 'María García',
      texto: 'El entrenamiento de trading cambió completamente mi forma de invertir. Excelente contenido.',
      calificacion: 5,
      foto: '/testimonios/maria.jpg'
    },
    {
      nombre: 'Roberto Silva',
      texto: 'Smart Money es increíble. Las señales son precisas y muy fáciles de seguir.',
      calificacion: 5,
      foto: '/testimonios/roberto.jpg'
    }
  ];

  // Testimonios específicos para el nuevo carrusel (idénticos a la imagen)
  const testimoniosNuevos = [
    {
      nombre: 'Carlos Mendoza',
      texto: 'Las alertas de Nahuel me han ayudado a incrementar mi cartera un 25% en los últimos 6 meses.',
      calificacion: 4,
      avatarColor: '#6366f1' // Azul
    },
    {
      nombre: 'Ana Laura Quiroga',
      texto: 'Los cursos de análisis técnico son realmente muy buenos y didácticos. 100% recomendables!',
      calificacion: 5,
      avatarColor: '#ef4444' // Rojo
    },
    {
      nombre: 'Tamara Rodríguez',
      texto: 'Las recomendaciones que brindan en las asesorías 1 a 1 son muy buenas. Estoy muy conforme',
      calificacion: 4,
      avatarColor: '#22c55e' // Verde
    }
  ];

  // Función para obtener colores de avatar según el índice
  const getAvatarColor = (index: number) => {
    const colors = ['#6366f1', '#ef4444', '#22c55e']; // Azul, Rojo, Verde
    return colors[index % colors.length];
  };

  // Testimonios unificados para el slider
  const testimoniosUnificados = [
    {
      id: 'carlos-mendoza-1',
      nombre: 'Carlos Mendoza',
      texto: 'Las alertas de Nahuel me han ayudado a incrementar mi cartera un 45% en los últimos 6 meses.',
      calificacion: 5,
      avatarColor: '#3b82f6'
    },
    {
      id: 'maria-garcia',
      nombre: 'María García',
      texto: 'El entrenamiento de trading cambió completamente mi forma de invertir. Excelente contenido.',
      calificacion: 5,
      avatarColor: '#ef4444'
    },
    {
      id: 'roberto-silva',
      nombre: 'Roberto Silva',
      texto: 'Smart Money es increíble. Las señales son precisas y muy fáciles de seguir.',
      calificacion: 5,
      avatarColor: '#10b981'
    },
    {
      id: 'carlos-mendoza-2',
      nombre: 'Carlos Mendoza',
      texto: 'Las alertas de Nahuel me han ayudado a incrementar mi cartera un 25% en los últimos 6 meses.',
      calificacion: 4,
      avatarColor: '#6366f1'
    },
    {
      id: 'ana-laura-quiroga',
      nombre: 'Ana Laura Quiroga',
      texto: 'Los cursos de análisis técnico son realmente muy buenos y didácticos. 100% recomendables!',
      calificacion: 5,
      avatarColor: '#ef4444'
    },
    {
      id: 'tamara-rodriguez',
      nombre: 'Tamara Rodríguez',
      texto: 'Las recomendaciones que brindan en las asesorías 1 a 1 son muy buenas. Estoy muy conforme',
      calificacion: 4,
      avatarColor: '#22c55e'
    }
  ];

  // Calcular el número de grupos para testimonios (cada grupo tiene 3 elementos)
  const testimoniosPerGroup = 3;
  const totalTestimonialGroups = Math.ceil(testimoniosUnificados.length / testimoniosPerGroup);

  // Formateo consistente con el resto del sitio
  const traderCallPriceStr = resolvedPricing?.alertas?.traderCall?.monthly
    ? `${uiFormatPrice(resolvedPricing.alertas.traderCall.monthly, resolvedPricing.currency)} /mes`
    : '$15.000 ARS /mes';
  const swingPriceStr = resolvedPricing?.entrenamientos?.swingTrading?.price
    ? `${uiFormatPrice(resolvedPricing.entrenamientos.swingTrading.price, resolvedPricing.currency)}`
    : '$279.000 ARS';
  const consultorioPriceStr = resolvedPricing?.asesorias?.consultorioFinanciero?.price
    ? `${uiFormatPrice(resolvedPricing.asesorias.consultorioFinanciero.price, resolvedPricing.currency)} /sesión`
    : '$30.000 ARS /sesión';

  // Datos de elementos destacados unificados (sin Pack AT ni Medias Móviles)
  const destacadosItems = [
    {
      id: 'trader-call',
      titulo: 'Trader Call',
      descripcion: 'Comenzá a recibir señales precisas de compra y venta fundamentadas en una estrategia de corto plazo y herramientas avanzadas de análisis técnico',
      tag: 'Alertas',
      tagClass: 'tagAlertas',
      rating: '4,7',
      precio: traderCallPriceStr,
      href: '/alertas/trader-call',
      external: false,
      separator: false,
      rocketIcon: false
    },
    {
      id: 'swing-trading',
      titulo: 'Zero 2 Trader',
      descripcion: 'Experiencia de entrenamiento integral para llevarte de cero a operar con independencia total. Aprendés a analizar el mercado como un profesional, aplicás una estrategia de trading probada y operás en un entorno real con acompañamiento en cada paso.',
      tag: 'Entrenamientos',
      tagClass: 'tagEntrenamientos',
      rating: '4,8',
      precio: swingPriceStr,
      href: '/entrenamientos/zero2trader',
      external: false,
      separator: false,
      rocketIcon: false,
      proximamente: true
    },
    {
      id: 'consultorio-financiero',
      titulo: 'Consultorio Financiero',
      descripcion: 'Consulta individual personalizada de 45 minutos para analizar tu situación financiera y diseñar una estrategia de inversión según tu perfil de riesgo',
      tag: 'Asesorías',
      tagClass: 'tagAsesorias',
      rating: '4,5',
      precio: consultorioPriceStr,
      href: '/asesorias/consultorio-financiero',
      external: false,
      separator: true,
      rocketIcon: false,
      proximamente: true
    },
    {
      id: 'lista-wall-street',
      titulo: 'Lista de Seguimiento Wall Street',
      descripcion: 'Lista de seguimiento organizada con los principales activos de Wall Street para monitorear oportunidades y optimizar decisiones de inversión',
      tag: 'Recursos',
      tagClass: 'tagRecursos',
      rating: '4,9',
      precio: 'Gratis',
      href: '/recursos#recursos-lista',
      external: false,
      separator: false,
      rocketIcon: false
    }
  ];

  // Calcular el número de grupos (cada grupo tiene 2 elementos)
  const itemsPerGroup = 2;
  const totalGroups = Math.ceil(destacadosItems.length / itemsPerGroup);

  const servicios = [
    {
      titulo: 'Alertas de Trading',
      descripcion: 'Recibe señales precisas en tiempo real para maximizar tus inversiones',
      icono: <TrendingUp className={styles.serviceIcon} />,
      href: '/alertas',
      precio: resolvedPricing?.alertas?.traderCall?.monthly ? `${uiFormatPrice(resolvedPricing.alertas.traderCall.monthly, resolvedPricing.currency)} /mes` : '',
      external: false
    },
    {
      titulo: 'Entrenamientos',
      descripcion: 'Aprende las estrategias más efectivas del mercado financiero',
      icono: <Users className={styles.serviceIcon} />,
      href: '/entrenamientos',
      precio: resolvedPricing?.entrenamientos?.swingTrading?.price ? `${uiFormatPrice(resolvedPricing.entrenamientos.swingTrading.price, resolvedPricing.currency)}` : '',
      external: false
    },
    {
      titulo: 'Asesorías',
      descripcion: 'Consultoría personalizada para optimizar tu portafolio',
      icono: <Shield className={styles.serviceIcon} />,
      href: '/asesorias',
      precio: resolvedPricing?.asesorias?.consultorioFinanciero?.price ? `${uiFormatPrice(resolvedPricing.asesorias.consultorioFinanciero.price, resolvedPricing.currency)} /sesión` : '',
      external: false
    },
    {
      titulo: 'Cursos',
      descripcion: 'Accede a nuestra plataforma completa de cursos especializados',
      icono: <BookOpen className={styles.serviceIcon} />,
      href: 'https://plataformacursos.lozanonahuel.com/',
      precio: 'Ver precios',
      external: true
    }
  ];

  return (
    <>
      <Head>
        <title>Nahuel Lozano - Trading & Inversiones</title>
        <meta name="description" content="Experto en trading y análisis financiero. Alertas, entrenamientos y asesorías para maximizar tus inversiones." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      {/* TODO: V2.0 - Popup de Descuentos y Alertas - DESACTIVADO */}
      {/* Sistema de códigos de descuento pendiente de desarrollo */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            className={styles.popupOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePopupExtended}
          >
            <motion.div
              className={styles.popupContent}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={styles.popupClose}
                onClick={closePopupExtended}
              >
                <X size={24} />
              </button>
              
              <div className={styles.popupHeader}>
                <h2>🎁 ¡Oferta Especial!</h2>
                <p>Recibí Códigos de Descuento y Alertas de Lanzamiento</p>
              </div>

              <form onSubmit={handlePopupSubmit} className={styles.popupForm}>
                <input
                  type="email"
                  placeholder="Ingresa tu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={styles.popupInput}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.popupButton}
                >
                  {isSubmitting ? 'Enviando...' : 'Quiero mi curso gratuito'}
                </button>
              </form>

              {submitMessage && (
                <p className={styles.popupMessage}>{submitMessage}</p>
              )}

              <div className={styles.popupBenefits}>
                <p>✅ Curso gratuito de introducción al trading</p>
                <p>✅ Descuentos exclusivos en todos nuestros servicios</p>
                <p>✅ Alertas de lanzamiento de nuevos productos</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={styles.main}>
        {/* Hero Section */}
              <section className={styles.hero}>
        {/* Video Background */}
        <video
          className={styles.heroVideoBackground}
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/logos/Home.mp4" type="video/mp4" />
        </video>
        
        <div className="container">
          <motion.div
            className={styles.heroContent}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  Comenzá a invertir<br />
                  como un profesional
                </h1>
                <p className={styles.heroDescription}>
                  Unite a la comunidad y descubrí las estrategias más efectivas para ganar dinero en los mercados financieros
                </p>
                
                <div className={styles.heroActions}>
                  <button onClick={handleStartNowClick} className={styles.heroButton}>
                    Empezá Ahora &gt;
                  </button>
                </div>
              </div>

              {/* Video de Presentación con YouTube */}
              <div className={styles.heroVideo}>
                <YouTubePlayer
                  videoId={siteConfig.heroVideo.youtubeId}
                  title={siteConfig.heroVideo.title}
                  autoplay={siteConfig.heroVideo.autoplay}
                  muted={siteConfig.heroVideo.muted}
                  loop={siteConfig.heroVideo.loop}
                  className={styles.heroVideoPlayer}
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Nueva Sección: Aprende a invertir desde cero - Condicional */}
        {isFeatureEnabled('mentoring') && (
          <section className={styles.learningSection}>
          <div className="container">
            <motion.div
              className={styles.learningContent}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className={styles.learningText}>
                <div className={styles.learningLogo}>
                  <img 
                    src="/logos/LOGOTIPO NARANJA SIN FONDO.png" 
                    alt="Mentoring" 
                    className={styles.learningLogoImage}
                  />
                </div>
                <p className={styles.learningDescription}>
                  Aprende a invertir en bolsa con nuestros cursos especializados. Comienza hoy mismo tu camino hacia la libertad financiera.
                </p>
                
                <div className={styles.learningActions}>
                  <a 
                    href="https://plataformacursos.lozanonahuel.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.learningButton}
                  >
                    Ir a Mentoring
                    <span className={styles.learningRocketIcon}>🚀</span>
                    <ChevronRight size={20} />
                  </a>
                </div>
              </div>

              {/* Video de Cursos */}
              <div className={styles.learningVideo}>
                <YouTubePlayer
                  videoId={siteConfig.learningVideo.youtubeId}
                  title={siteConfig.learningVideo.title}
                  autoplay={siteConfig.learningVideo.autoplay}
                  muted={siteConfig.learningVideo.muted}
                  loop={siteConfig.learningVideo.loop}
                  className={styles.learningVideoPlayer}
                />
              </div>
            </motion.div>
          </div>
        </section>
        )}

        {/* Nueva Sección: Estadísticas */}
        {(siteConfig?.statistics?.visible !== false) && (
          <section 
            className={styles.statisticsSection}
            style={{
              backgroundColor: siteConfig?.statistics?.backgroundColor || '#7c3aed',
              color: siteConfig?.statistics?.textColor || '#ffffff'
            }}
          >
            <div className="container">
              <motion.div
                className={styles.statisticsContent}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className={styles.statisticsGrid}>
                  {siteConfig?.statistics?.stats
                    ?.sort((a, b) => a.order - b.order)
                    .map((stat, index) => (
                      <motion.div
                        key={stat.id}
                        className={styles.statisticItem}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        viewport={{ once: true }}
                      >
                        <h3 
                          className={styles.statisticNumber}
                          style={{ color: stat.color }}
                        >
                          {stat.number}
                        </h3>
                        <p className={styles.statisticLabel}>
                          {stat.label}
                        </p>
                      </motion.div>
                    ))}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Servicios Section con Videos */}
        {(siteConfig?.servicios?.visible !== false) && (
          <section className={styles.serviciosSection}>
            <div className="container">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className={styles.sectionHeader}>
                  <h2>Servicios</h2>
                </div>

                <div className={styles.serviciosGrid}>
                  {/* Alertas de Trading */}
                  <motion.div
                    className={styles.servicioCard}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className={styles.servicioContent}>
                      <h3 className={styles.servicioTitle}>Alertas</h3>
                      <p className={styles.servicioDescription}>
                        Recibí las mejores señales de compra y venta para potenciar tus inversiones en el mercado
                      </p>
                      
                      <div className={styles.servicioVideo}>
                        <YouTubePlayer
                          videoId={siteConfig?.serviciosVideos?.alertas?.youtubeId || 'dQw4w9WgXcQ'}
                          title={siteConfig?.serviciosVideos?.alertas?.title || 'Video de Alertas'}
                          autoplay={siteConfig?.serviciosVideos?.alertas?.autoplay || false}
                          muted={siteConfig?.serviciosVideos?.alertas?.muted || true}
                          loop={siteConfig?.serviciosVideos?.alertas?.loop || false}
                          className={styles.servicioVideoPlayer}
                        />
                      </div>
                      
                      <Link href="/alertas" className={styles.servicioButton}>
                        Quiero saber más &gt;
                      </Link>
                    </div>
                  </motion.div>

                  {/* Entrenamientos - Oculto temporalmente */}
                  {/* <motion.div
                    className={styles.servicioCard}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                  >
                    <div className={styles.servicioContent}>
                      <h3 className={styles.servicioTitle}>Entrenamientos</h3>
                      <p className={styles.servicioDescription}>
                        Experiencia premium y personalizada de educación financiera integral
                      </p>
                      
                      <div className={styles.servicioVideo}>
                        <YouTubePlayer
                          videoId={siteConfig?.serviciosVideos?.entrenamientos?.youtubeId || 'dQw4w9WgXcQ'}
                          title={siteConfig?.serviciosVideos?.entrenamientos?.title || 'Video de Entrenamientos'}
                          autoplay={siteConfig?.serviciosVideos?.entrenamientos?.autoplay || false}
                          muted={siteConfig?.serviciosVideos?.entrenamientos?.muted || true}
                          loop={siteConfig?.serviciosVideos?.entrenamientos?.loop || false}
                          className={styles.servicioVideoPlayer}
                        />
                      </div>
                      
                      <Link href="/entrenamientos" className={styles.servicioButton}>
                        Quiero saber más &gt;
                      </Link>
                    </div>
                  </motion.div> */}

                  {/* Asesorías - Oculto temporalmente */}
                  {/* <motion.div
                    className={styles.servicioCard}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                  >
                    <div className={styles.servicioContent}>
                      <h3 className={styles.servicioTitle}>Asesorías</h3>
                      <p className={styles.servicioDescription}>
                        Reuniones 1 a 1 con asesores profesionales para la correcta gestión de tu portafolio
                      </p>
                      
                      <div className={styles.servicioVideo}>
                        <YouTubePlayer
                          videoId={siteConfig?.serviciosVideos?.asesorias?.youtubeId || 'dQw4w9WgXcQ'}
                          title={siteConfig?.serviciosVideos?.asesorias?.title || 'Video de Asesorías'}
                          autoplay={siteConfig?.serviciosVideos?.asesorias?.autoplay || false}
                          muted={siteConfig?.serviciosVideos?.asesorias?.muted || true}
                          loop={siteConfig?.serviciosVideos?.asesorias?.loop || false}
                          className={styles.servicioVideoPlayer}
                        />
                      </div>
                      
                      <Link href="/asesorias" className={styles.servicioButton}>
                        Quiero saber más &gt;
                      </Link>
                    </div>
                  </motion.div> */}
                </div>
              </motion.div>
            </div>
          </section>
        )}

        {/* Sección de Empresas que confiaron en mi */}
        <section className={styles.empresasSection}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={styles.empresasContent}>
                <h2 className={styles.empresasTitle}>Empresas que confiaron en nosotros</h2>
                
                <div className={styles.empresasGrid}>
                  {/*
                  <motion.a
                    href="https://www.inviu.com.ar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.empresaLogo}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <img 
                      src="/logos/logoinviu.png" 
                      alt="Inviu" 
                      width={156} 
                      height={52}
                    />
                  </motion.a>
                  */}

                  <motion.a
                    href="https://www.tradingview.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.empresaLogo}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <img 
                      src="/logos/tradingviewlogo.png" 
                      alt="TradingView" 
                      width={156} 
                      height={52}
                    />
                  </motion.a>

                  <motion.a
                    href="https://www.bullmarketbrokers.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.empresaLogo}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <img 
                      src="/logos/bullmarketlogo.png" 
                      alt="BullMarket" 
                      width={156} 
                      height={52}
                    />
                  </motion.a>

                  <motion.a
                    href="https://dolarhoy.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.empresaLogo}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <img 
                      src="/logos/dolarhoylogo.png" 
                      alt="DolarHoy.com" 
                      width={156} 
                      height={52}
                    />
                  </motion.a>

                  {/*<motion.a
                    href="https://balanz.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.empresaLogo}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    viewport={{ once: true }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <img 
                      src="/logos/balanzlogo.png" 
                      alt="BALANZ" 
                      width={156} 
                      height={52}
                    />
                  </motion.a>*/}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Sección Acerca de nosotros */}
        <section className={styles.aboutSection}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={styles.aboutContent}>
                <h2 className={styles.aboutMainTitle}>Acerca de nosotros</h2>
                
                {/* Tres preguntas principales */}
                <div className={styles.aboutQuestions}>
                  <motion.div
                    className={styles.aboutQuestion}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    viewport={{ once: true }}
                  >
                    <h3 className={styles.questionTitle}>¿Quienes Somos?</h3>
                    <p className={styles.questionText}>
                      Somos una plataforma educativa que transforma la manera en que las personas invierten y gestionan su dinero, brindando acompañamiento profesional para lograr libertad y tranquilidad financiera.
                    </p>
                  </motion.div>

                  <motion.div
                    className={styles.aboutQuestion}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    viewport={{ once: true }}
                  >
                    <h3 className={styles.questionTitle}>¿Que hacemos?</h3>
                    <p className={styles.questionText}>
                      Enseñamos y acompañamos a nuestra comunidad a la hora de invertir, brindando asesorías y herramientas prácticas para que mejoren su economía, protejan su capital y alcancen sus metas financieras.
                    </p>
                  </motion.div>

                  <motion.div
                    className={styles.aboutQuestion}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                  >
                    <h3 className={styles.questionTitle}>¿Por qué lo hacemos?</h3>
                    <p className={styles.questionText}>
                      Porque creemos que todos merecen manejar su dinero con libertad. Buscamos brindar conocimiento y herramientas para que cada persona construya estabilidad y un futuro financiero más auspicioso.
                    </p>
                  </motion.div>
                </div>

                {/* Sección de Nahuel Lozano - Solo imagen */}
                <motion.div
                  className={styles.nahuelSection}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  viewport={{ once: true }}
                >
                  <div className={styles.nahuelImageContainer}>
                    <img 
                      src="/logos/nahuelsobremi.png" 
                      alt="Nahuel Lozano" 
                      className={styles.nahuelImage}
                    />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Sección de Estadísticas */}
        <section className={styles.statsSection}>
          <div className="container">
            <motion.div
              className={styles.statsContent}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <motion.div
                className={styles.statItem}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
              >
                <div className={styles.statNumber}>8</div>
                <div className={styles.statLabel}>Años de experiencia</div>
              </motion.div>

              <motion.div
                className={styles.statItem}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <div className={styles.statNumber}>+1500</div>
                <div className={styles.statLabel}>Inversores confiaron en nosotros</div>
              </motion.div>

              <motion.div
                className={styles.statItem}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
              >
                <div className={styles.statNumber}>97%</div>
                <div className={styles.statLabel}>Satisfacción</div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Destacados Section - SLIDER UNIFICADO */}
        <section className={styles.destacadosUnificados}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={styles.destacadosUnificadosHeader}>
                <h2>Destacados</h2>
              </div>

              <div className={styles.destacadosUnificadosCarousel}>
                {/* Flecha izquierda */}
                <button 
                  className={styles.carouselArrowUnificado} 
                  onClick={() => setCurrentDestacadoIndex(prev => prev === 0 ? totalGroups - 1 : prev - 1)}
                >
                  <ChevronLeft size={24} />
                </button>

                <div className={styles.destacadosUnificadosCards}>
                  {destacadosItems
                    .slice(currentDestacadoIndex * itemsPerGroup, (currentDestacadoIndex + 1) * itemsPerGroup)
                    .map((item, index) => (
                    <motion.div
                      key={item.id}
                      className={styles.destacadoUnificadoCard}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      style={{ position: 'relative', overflow: 'hidden' }}
                    >
                      {/* Línea amarilla con "PROXIMAMENTE" */}
                      {item.proximamente && (
                        <div className={styles.proximamenteOverlay}>
                          <div className={styles.proximamenteLine}></div>
                          <span className={styles.proximamenteText}>PROXIMAMENTE</span>
                        </div>
                      )}
                      
                      <div className={styles.destacadoUnificadoCardHeader}>
                        <h3>{item.titulo}</h3>
                        <div className={styles.destacadoUnificadoCardMeta}>
                          <span className={`${styles.destacadoUnificadoTag} ${styles[item.tagClass]}`}>
                            {item.tag}
                            {item.rocketIcon && <span className={styles.rocketIcon}>🚀</span>}
                          </span>
                          <span className={styles.destacadoUnificadoRating}>
                            <Star size={16} fill="currentColor" />
                            {item.rating}
                          </span>
                        </div>
                      </div>
                      
                      <p className={styles.destacadoUnificadoDescription}>
                        {item.descripcion}
                      </p>
                      
                      {item.separator && <div className={styles.destacadoUnificadoSeparator}></div>}
                      
                      <div className={`${styles.destacadoUnificadoFooter} ${item.proximamente ? styles.proximamenteFooter : ''}`}>
                        {!item.proximamente && (
                          <div className={styles.destacadoUnificadoPrecio}>
                            {item.precio}
                          </div>
                        )}
                        {item.proximamente ? (
                          <span className={`${styles.destacadoUnificadoButton} ${styles.proximamenteButton}`}>
                            PROXIMAMENTE
                            <ChevronRight size={16} />
                          </span>
                        ) : item.external ? (
                          <a 
                            href={item.href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.destacadoUnificadoButton}
                          >
                            Ver más
                            <ChevronRight size={16} />
                          </a>
                        ) : (
                          <Link href={item.href} className={styles.destacadoUnificadoButton}>
                            Ver más
                            <ChevronRight size={16} />
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Flecha derecha */}
                <button 
                  className={styles.carouselArrowUnificado} 
                  onClick={() => setCurrentDestacadoIndex(prev => prev === totalGroups - 1 ? 0 : prev + 1)}
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* Indicadores */}
              <div className={styles.destacadosUnificadosIndicators}>
                {Array.from({ length: totalGroups }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentDestacadoIndex(index)}
                    className={`${styles.destacadoUnificadoIndicator} ${
                      index === currentDestacadoIndex ? styles.active : ''
                    }`}
                    aria-label={`Ver grupo ${index + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </section>



        {/* Testimonios Section - SLIDER UNIFICADO */}
        <section className={styles.testimoniosUnificados}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={styles.testimoniosUnificadosHeader}>
                <h2>Lo que dicen nuestros clientes</h2>
              </div>

              <div className={styles.testimoniosUnificadosCarousel}>
                {/* Flecha izquierda */}
                <button 
                  className={styles.carouselArrowTestimonios} 
                  onClick={() => setCurrentTestimonialGroupIndex(prev => prev === 0 ? totalTestimonialGroups - 1 : prev - 1)}
                >
                  <ChevronLeft size={24} />
                </button>

                {/* Testimonios */}
                <div className={styles.testimoniosUnificadosCards}>
                  {testimoniosUnificados
                    .slice(currentTestimonialGroupIndex * testimoniosPerGroup, (currentTestimonialGroupIndex + 1) * testimoniosPerGroup)
                    .map((testimonio, index) => (
                    <motion.div
                      key={testimonio.id}
                      className={styles.testimonioUnificadoCard}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <div className={styles.testimonioUnificadoAvatar}>
                        <div 
                          className={styles.avatarCircleUnificado}
                          style={{ backgroundColor: testimonio.avatarColor }}
                        >
                          {testimonio.nombre.charAt(0)}
                        </div>
                      </div>
                      
                      <h4 className={styles.testimonioUnificadoNombre}>{testimonio.nombre}</h4>
                      
                      <div className={styles.testimonioUnificadoRating}>
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            size={16} 
                            fill={i < testimonio.calificacion ? "#fbbf24" : "none"}
                            stroke={i < testimonio.calificacion ? "#fbbf24" : "#ffffff"}
                            className={styles.ratingStarUnificado}
                          />
                        ))}
                      </div>
                      
                      <p className={styles.testimonioUnificadoTexto}>"{testimonio.texto}"</p>
                    </motion.div>
                  ))}
                </div>

                {/* Flecha derecha */}
                <button 
                  className={styles.carouselArrowTestimonios} 
                  onClick={() => setCurrentTestimonialGroupIndex(prev => prev === totalTestimonialGroups - 1 ? 0 : prev + 1)}
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* Indicadores */}
              <div className={styles.testimoniosUnificadosIndicators}>
                {Array.from({ length: totalTestimonialGroups }, (_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonialGroupIndex(index)}
                    className={`${styles.testimonioUnificadoIndicator} ${
                      index === currentTestimonialGroupIndex ? styles.active : ''
                    }`}
                    aria-label={`Ver grupo de testimonios ${index + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </section>



        {/* CTA Final */}
        <section className={styles.ctaInvestmentSection}>
          <div className="container">
            <motion.div
              className={styles.ctaInvestmentContent}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.ctaInvestmentTitle}>
                ¿Listo para llevar tus inversiones al siguiente nivel?
              </h2>
              <p className={styles.ctaInvestmentSubtitle}>
                Únete a nuestra comunidad y comienza construir tu libertad financiera
              </p>
              
              <div className={styles.ctaInvestmentActions}>
                <button 
                  onClick={handleStartNowClick} 
                  className={styles.ctaInvestmentButtonPrimary}
                >
                  Comenzar ahora
                </button>
                
                {/* Botón Mentoring - Condicional */}
                {isFeatureEnabled('mentoring') && (
                  <a 
                    href="https://plataformacursos.lozanonahuel.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.ctaInvestmentButtonSecondary}
                  >
                    Ir a Mentoring 🚀
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </section>



        {/* YouTube Community Section */}
        <section className={styles.youtubeSection}>
          <div className="container">
            <motion.div
              className={styles.youtubeContent}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={styles.youtubeText}>
                <h2 className={styles.youtubeTitle}>
                  ¡Sumate a nuestra comunidad<br />
                  en YouTube!
                </h2>
                <p className={styles.youtubeSubtitle}>
                  No te pierdas nuestros últimos videos
                </p>
              </div>

              <div className={styles.youtubeVideoContainer}>
                <YouTubeAutoCarousel />
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // console.log('🔄 Ejecutando getServerSideProps en página principal');
  
  try {
    // Verificar si el usuario es administrador (solo para la flag, no para restringir acceso)
    const adminVerification = await verifyAdminAccess(context);
    const isAdmin = adminVerification.isAdmin || false;
    
    // console.log('👤 Usuario es admin:', isAdmin);
    
    const session = await getSession(context);
    // console.log('✅ Sesión obtenida:', session ? 'Usuario autenticado' : 'Usuario no autenticado');
    
    // Configuración por defecto - siempre funcional
    const defaultSiteConfig = {
      heroVideo: {
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Video de Presentación',
        description: 'Conoce más sobre nuestros servicios de trading',
        autoplay: true,
        muted: true,
        loop: true,
        volume: 25
      },
      servicios: { orden: 1, visible: true },
      cursos: { orden: 2, visible: true, destacados: [] },
      learningVideo: {
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Video de Cursos',
        description: 'Conoce más sobre nuestros cursos de trading',
        autoplay: true,
        muted: true,
        loop: true,
        volume: 25
      },
      statistics: {
        visible: true,
        backgroundColor: '#f8f9fa', // Un color claro para el fondo
        textColor: '#343a40', // Un color oscuro para el texto
        stats: [
          { id: 'alumnos', number: '+1,500', label: 'Alumnos', icon: <Users size={32} />, color: '#007bff', order: 1 },
          { id: 'horas', number: '+300', label: 'Horas de formación', icon: <Clock size={32} />, color: '#28a745', order: 2 },
          { id: 'satisfaccion', number: '4.8', label: 'Satisfacción', icon: <Star size={32} />, color: '#ffc107', order: 3 },
        ]
      },
      serviciosVideos: {
        alertas: {
          youtubeId: 'dQw4w9WgXcQ',
          title: 'Video de Alertas',
          autoplay: false,
          muted: true,
          loop: false,
          volume: 25
        },
        entrenamientos: {
          youtubeId: 'dQw4w9WgXcQ',
          title: 'Video de Entrenamientos',
          autoplay: false,
          muted: true,
          loop: false,
          volume: 25
        },
        asesorias: {
          youtubeId: 'dQw4w9WgXcQ',
          title: 'Video de Asesorías',
          autoplay: false,
          muted: true,
          loop: false,
          volume: 25
        }
      }
    };

    // Entrenamientos por defecto
    const defaultEntrenamientos = [
      {
        _id: '1',
        tipo: 'SwingTrading',
        nombre: 'Zero 2 Trader',
        descripcion: 'Experiencia de entrenamiento integral para llevarte de cero a operar con independencia total. Aprendés a analizar el mercado como un profesional, aplicás una estrategia de trading probada y operás en un entorno real con acompañamiento en cada paso.',
        precio: 299,
        duracion: 8,
        contenido: {
          modulos: 6,
          lecciones: 24,
          certificacion: true,
          nivelAcceso: 'Principiante'
        },
        metricas: {
          rentabilidad: 85,
          estudiantesActivos: 450,
          entrenamientosRealizados: 12,
          satisfaccion: 4.8
        },
        activo: true
      },
      {
        _id: '2',
        tipo: 'DowJones',
        nombre: 'Estrategias Dow Jones',
        descripcion: 'Domina las estrategias avanzadas del mercado estadounidense',
        precio: 499,
        duracion: 12,
        contenido: {
          modulos: 8,
          lecciones: 32,
          certificacion: true,
          nivelAcceso: 'Avanzado'
        },
        metricas: {
          rentabilidad: 92,
          estudiantesActivos: 280,
          entrenamientosRealizados: 8,
          satisfaccion: 4.9
        },
        activo: true
      }
    ];

    let siteConfig = defaultSiteConfig;
    let entrenamientos = defaultEntrenamientos;
    let courseCards: CourseCard[] = [];
    let initialPricing = null as any;

    // Intentar obtener datos reales solo si estamos en el servidor con URL válida
    if (process.env.NEXTAUTH_URL) {
      try {
        // Obtener configuración del sitio
        const siteConfigResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/site-config`);
        if (siteConfigResponse.ok) {
          const configData = await siteConfigResponse.json();
          siteConfig = { ...defaultSiteConfig, ...configData };
        }

        // Obtener entrenamientos activos
        const entrenamientosResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/entrenamientos`);
        if (entrenamientosResponse.ok) {
          const entrenamientosData = await entrenamientosResponse.json();
          if (Array.isArray(entrenamientosData) && entrenamientosData.length > 0) {
            entrenamientos = entrenamientosData.filter((e: Training) => e.activo);
          }
        }

        // Obtener tarjetas de cursos personalizadas
        const courseCardsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/course-cards?destacados=true&activos=true`);
        if (courseCardsResponse.ok) {
          const courseCardsData = await courseCardsResponse.json();
          if (Array.isArray(courseCardsData)) {
            courseCards = courseCardsData;
          }
        }

        // Obtener pricing para SSR como respaldo del hook
        const pricingRes = await fetch(`${process.env.NEXTAUTH_URL}/api/pricing`);
        if (pricingRes.ok) {
          const pricingData = await pricingRes.json();
          initialPricing = pricingData?.data || null;
        }
      } catch (apiError) {
        // console.log('⚠️ Error al obtener datos de APIs, usando valores por defecto:', apiError);
      }
    }

    return {
      props: {
        session: session || null,
        siteConfig,
        entrenamientos,
        courseCards,
        initialPricing,
        isAdmin
      },
    };
  } catch (error) {
    // console.error('❌ Error in getServerSideProps:', error);
    // En caso de error, devolver valores por defecto funcionales
    return {
      props: {
        session: null,
        isAdmin: false,
        initialPricing: null,
        siteConfig: {
          heroVideo: {
            youtubeId: 'dQw4w9WgXcQ',
            title: 'Video de Presentación',
            description: 'Conoce más sobre nuestros servicios de trading',
            autoplay: true,
            muted: true,
            loop: true,
            volume: 25
          },
          servicios: { orden: 1, visible: true },
          cursos: { orden: 2, visible: true, destacados: [] },
          learningVideo: {
            youtubeId: 'dQw4w9WgXcQ',
            title: 'Video de Cursos',
            description: 'Conoce más sobre nuestros cursos de trading',
            autoplay: true,
            muted: true,
            loop: true,
            volume: 25
          },
          statistics: {
            visible: true,
            backgroundColor: '#f8f9fa', // Un color claro para el fondo
            textColor: '#343a40', // Un color oscuro para el texto
            stats: [
              { id: 'alumnos', number: '+1,500', label: 'Alumnos', icon: <Users size={32} />, color: '#007bff', order: 1 },
              { id: 'horas', number: '+300', label: 'Horas de formación', icon: <Clock size={32} />, color: '#28a745', order: 2 },
              { id: 'satisfaccion', number: '4.8', label: 'Satisfacción', icon: <Star size={32} />, color: '#ffc107', order: 3 },
            ]
          },
          serviciosVideos: {
            alertas: {
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Video de Alertas',
              autoplay: false,
              muted: true,
              loop: false,
              volume: 25
            },
            entrenamientos: {
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Video de Entrenamientos',
              autoplay: false,
              muted: true,
              loop: false,
              volume: 25
            },
            asesorias: {
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Video de Asesorías',
              autoplay: false,
              muted: true,
              loop: false,
              volume: 25
            }
          }
        },
        entrenamientos: [
          {
            _id: '1',
            tipo: 'SwingTrading',
            nombre: 'Zero 2 Trader',
            descripcion: 'Aprende los fundamentos del trading y análisis técnico',
            precio: 299,
            duracion: 8,
            contenido: {
              modulos: 6,
              lecciones: 24,
              certificacion: true,
              nivelAcceso: 'Principiante'
            },
            metricas: {
              rentabilidad: 85,
              estudiantesActivos: 450,
              entrenamientosRealizados: 12,
              satisfaccion: 4.8
            },
            activo: true
          }
        ],
        courseCards: []
      },
    };
  }
}; 