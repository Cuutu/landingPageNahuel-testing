import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/googleAuth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VideoPlayerMux from '@/components/VideoPlayerMux';
import YouTubePlayer from '@/components/YouTubePlayer';

import Carousel from '@/components/Carousel';
import ImageUploader, { CloudinaryImage } from '@/components/ImageUploader';
import AlertExamplesCarousel from '@/components/AlertExamplesCarousel';
import FAQAccordion from '@/components/FAQAccordion';
import SP500Comparison from '@/components/SP500Comparison';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Activity, 
  Download, 
  BarChart3,
  CheckCircle,
  Star,
  Bell,
  Filter,
  Search,
  MessageCircle,
  Clock,
  ThumbsUp,
  Send,
  Reply,
  X,
  AlertTriangle,
  DollarSign,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import styles from '@/styles/TraderCall.module.css';
import { useRouter } from 'next/router';
import { calculateDaysRemaining, calculateDaysSinceSubscription } from '../../utils/dateUtils';
import SPY500Indicator from '@/components/SPY500Indicator';
import PortfolioTimeRange from '@/components/PortfolioTimeRange';
import { usePricing } from '@/hooks/usePricing';
import ScreenshotProtection from '@/components/ScreenshotProtection';
import OperationsTable from '@/components/OperationsTable';
import { toast } from 'react-hot-toast';

interface AlertExample {
  id: string;
  title: string;
  description: string;
  chartImage?: string;
  entryPrice: string;
  exitPrice: string;
  profit: string;
  profitPercentage: string;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
  country: string;
  ticker: string;
  order: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'trader-call' | 'smart-money' | 'general';
  order: number;
  visible: boolean;
}

interface HistoricalAlert {
  date: string;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
  country: string;
  ticker: string;
  entryPrice: string;
  currentPrice: string;
  takeProfit1: string;
  takeProfit2?: string;
  stopLoss?: string;
  div?: string;
  exitPrice: string;
  profitPercentage: string;
}

interface TraderCallPageProps {
  isSubscribed: boolean;
  metrics: {
    performance: string;
    activeUsers: string;
    alertsSent: string;
    accuracy: string;
  };
  historicalAlerts: HistoricalAlert[];
  alertExamples: AlertExample[];
  faqs: FAQ[];
  traderHeroVideo?: {
    youtubeId?: string;
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
  };
}

// Vista No Suscripto
const NonSubscriberView: React.FC<{ 
  metrics: any, 
  historicalAlerts: HistoricalAlert[], 
  alertExamples: AlertExample[], 
  faqs: FAQ[],
  traderHeroVideo?: {
    youtubeId?: string;
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
  }
}> = ({ 
  metrics, 
  historicalAlerts,
  alertExamples,
  faqs,
  traderHeroVideo
}) => {
  const { data: session } = useSession();
  const { pricing, loading: pricingLoading } = usePricing();

  const [isProcessing, setIsProcessing] = useState(false);
  // Rango de rentabilidad (vista pública)
  const [publicPortfolioRange, setPublicPortfolioRange] = useState('30d');

  const handleSubscribe = async () => {
    if (!session) {
      signIn('google');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Obtener el precio dinámico del sistema
      const subscriptionPrice = pricing?.alertas?.traderCall?.monthly || 15000;
      
      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'TraderCall',
          amount: subscriptionPrice,
          currency: 'ARS',
          type: 'subscription'
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('Error creando checkout:', data.error);
        alert('Error al procesar el pago. Por favor intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar el pago. Por favor intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPDF = () => {
    console.log('Exportando PDF...');
  };

  const exampleImages = [
    {
      src: '/logos/ALERTACOMPRAEDN.png',
      alt: 'Ejemplo de alerta de compra EDN',
      title: 'Alerta de Compra EDN',
      description: 'Señal de compra en Edenor con análisis técnico detallado'
    },
    {
      src: '/logos/ALERTACOMPRAETHA.png',
      alt: 'Ejemplo de alerta de compra ETHE',
      title: 'Alerta de Compra ETHE',
      description: 'Señal de compra en Ethereum con fundamentos sólidos'
    },
    {
      src: '/logos/ALERTACOMPRASATL.png',
      alt: 'Ejemplo de alerta de compra SATL',
      title: 'Alerta de Compra SATL',
      description: 'Señal de compra en Satellogic con potencial alcista'
    },
    {
      src: '/logos/ALERTACOMPRASPOT.png',
      alt: 'Ejemplo de alerta de compra SPOT',
      title: 'Alerta de Compra SPOT',
      description: 'Señal de compra en Spotify con análisis fundamental'
    },
    {
      src: '/logos/ALERTAVENTAPARCIALEDN.png',
      alt: 'Ejemplo de alerta de venta parcial EDN',
      title: 'Alerta de Venta Parcial EDN',
      description: 'Toma de ganancias parcial en Edenor para proteger capital'
    },
    {
      src: '/logos/ALERTAVENTAPARCIALETHA.png',
      alt: 'Ejemplo de alerta de venta parcial ETHE',
      title: 'Alerta de Venta Parcial ETHE',
      description: 'Toma de ganancias parcial en Ethereum con stop loss dinámico'
    },
    {
      src: '/logos/ALERTAVENTAPARCIALSATL.png',
      alt: 'Ejemplo de alerta de venta parcial SATL',
      title: 'Alerta de Venta Parcial SATL',
      description: 'Toma de ganancias parcial en Satellogic manteniendo posición'
    },
    {
      src: '/logos/ALERTAVENTAPARCIALSPOT.png',
      alt: 'Ejemplo de alerta de venta parcial SPOT',
      title: 'Alerta de Venta Parcial SPOT',
      description: 'Toma de ganancias parcial en Spotify con análisis técnico'
    },
    {
      src: '/logos/ALERTAVENTATOTALEDN.png',
      alt: 'Ejemplo de alerta de venta total EDN',
      title: 'Alerta de Venta Total EDN',
      description: 'Cierre completo de posición en Edenor con máxima ganancia'
    },
    {
      src: '/logos/ALERTAVENTATOTALETHA.png',
      alt: 'Ejemplo de alerta de venta total ETHE',
      title: 'Alerta de Venta Total ETHE',
      description: 'Cierre completo de posición en Ethereum con take profit'
    },
    {
      src: '/logos/ALERTAVENTATOTALSATL.png',
      alt: 'Ejemplo de alerta de venta total SATL',
      title: 'Alerta de Venta Total SATL',
      description: 'Cierre completo de posición en Satellogic con análisis fundamental'
    },
    {
      src: '/logos/ALERTAVENTATOTALSPOT.png',
      alt: 'Ejemplo de alerta de venta total SPOT',
      title: 'Alerta de Venta Total SPOT',
      description: 'Cierre completo de posición en Spotify con máxima rentabilidad'
    },
    {
      src: '/logos/alertashistoricas.png',
      alt: 'Ejemplo de alertas históricas',
      title: 'Alertas Históricas',
      description: 'Resumen de alertas históricas con rendimientos comprobados'
    }
  ];

  return (
    <div className={styles.nonSubscriberView}>
      {/* Hero Section con Imagen de Fondo */}
      <section className={styles.heroSection}>
        {/* Image Background */}
        <div className={styles.imageBackground}>
          <div className={styles.imageOverlay}></div>
        </div>
        
        <div className={styles.container}>
          <motion.div 
            className={styles.heroContent}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>
                Trader Call
              </h1>
              <p className={styles.heroDescription}>
                Servicio de alertas de compra y venta con estrategia de corto plazo, informes detallados y seguimiento activo, para que puedas invertir en CEDEARs y acciones de forma simple y estratégica. Ideal para quienes buscan grandes rendimientos.
              </p>
              <div className={styles.heroFeatures}>
                <button 
                  className={styles.heroFeature}
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader size={20} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      <span>Quiero Suscribirme</span>
                    </>
                  )}
                </button>
                <div className={styles.heroPricing}>
                  <span className={styles.price}>
                    {pricingLoading ? (
                      'Cargando precio...'
                    ) : pricing ? (
                      `$${pricing.alertas.traderCall.monthly} ${pricing.currency}/mes`
                    ) : (
                      '$15000 ARS/mes'
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.heroVideo}>
              <div className={styles.videoContainer}>
                {traderHeroVideo?.youtubeId ? (
                  <YouTubePlayer
                    videoId={traderHeroVideo.youtubeId}
                    title={traderHeroVideo.title || 'Trader Call - Video'}
                    autoplay={!!traderHeroVideo.autoplay}
                    muted={!!traderHeroVideo.muted}
                    loop={!!traderHeroVideo.loop}
                    controls={true}
                    className={styles.video}
                  />
                ) : (
                  <YouTubePlayer
                    videoId="dQw4w9WgXcQ"
                    title="Trader Call - Video"
                    autoplay={false}
                    muted={true}
                    loop={false}
                    controls={true}
                    className={styles.video}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Ejemplo de Alertas */}
      <section className={styles.examplesSection}>
        <div className={styles.container}>
          <motion.h2 
            className={styles.sectionTitle}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Ejemplo de Alertas
          </motion.h2>
          
          <motion.div 
            className={styles.carouselContainer}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <AlertExamplesCarousel 
              examples={alertExamples}
              autoplay={true}
              interval={5000}
            />
          </motion.div>
        </div>
      </section>


      {/* Evolución del Portafolio Real */}
      <section className={styles.historySection}>
        <div className={styles.container}>
          <PortfolioTimeRange 
            selectedRange={publicPortfolioRange}
            onRangeChange={(range) => setPublicPortfolioRange(range)}
          />
        </div>
      </section>

      {/* Rendimiento Comparado */}
      <section className={styles.comparisonSection}>
        <div className={styles.container}>
          <SP500Comparison />
        </div>
      </section>

      {/* Preguntas Frecuentes */}
      <section className={styles.faqSection}>
        <div className={styles.container}>
          <motion.h2 
            className={styles.sectionTitle}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Preguntas Frecuentes
          </motion.h2>
          
          <motion.div 
            className={styles.faqContainer}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <FAQAccordion 
              faqs={faqs}
              category="trader-call"
              maxItems={10}
            />
          </motion.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className={styles.finalCtaSection}>
        <div className={styles.container}>
          <motion.div 
            className={styles.finalCtaCard}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className={styles.finalCtaContent}>
              <h2 className={styles.finalCtaTitle}>
                ¿Listo para llevar tus inversiones al siguiente nivel?
              </h2>
              <p className={styles.finalCtaDescription}>
                Únete a nuestra comunidad y comienza construir tu libertad financiera
              </p>
              <button 
                className={styles.finalCtaButton}
                onClick={handleSubscribe}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader size={16} className={styles.spinner} />
                    Procesando...
                  </>
                ) : session ? (
                  'Quiero Suscribirme >'
                ) : (
                  'Iniciar Sesión y Suscribirme >'
                )}
              </button>
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
    </div>
  );
};

// Interfaces para tipos
interface CommunityMessage {
  id: number;
  user: string;
  message: string;
  timestamp: string;
}

// Vista de suscriptor completa
const SubscriberView: React.FC<{ faqs: FAQ[] }> = ({ faqs }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [communityMessages, setCommunityMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    action: 'BUY',
    stopLoss: '',
    takeProfit: '',
    analysis: '',
    tipoAlerta: 'precio' as 'precio' | 'rango',
    precioMinimo: '',
    precioMaximo: '',
    horarioCierre: '17:30',
    emailMessage: '',
    emailImageUrl: '',
    liquidityPercentage: 0 // Nuevo campo para el porcentaje de liquidez
  });
  
  const [emailImage, setEmailImage] = useState<CloudinaryImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Funciones para manejar la subida de imagen
  const handleImageUploaded = (image: CloudinaryImage) => {
    setEmailImage(image);
    setNewAlert(prev => ({ ...prev, emailImageUrl: image.secure_url }));
    setUploadingImage(false);
    console.log('✅ Imagen de email subida:', image.public_id);
  };

  const handleImageUploadStart = () => {
    setUploadingImage(true);
  };

  const handleImageUploadError = (error: string) => {
    setUploadingImage(false);
    toast.error(`Error subiendo imagen: ${error}`);
  };

  const removeEmailImage = () => {
    setEmailImage(null);
    setNewAlert(prev => ({ ...prev, emailImageUrl: '' }));
  };
  
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [liquidityMap, setLiquidityMap] = useState<Record<string, { alertId: string; allocatedAmount: number; shares: number; entryPrice: number; currentPrice: number; profitLoss: number; profitLossPercentage: number; realizedProfitLoss: number }>>({});
  const [liquidityTotal, setLiquidityTotal] = useState<number>(0);

  // Estados para edición de alertas
  const [showEditAlert, setShowEditAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [editAlert, setEditAlert] = useState({
    symbol: '',
    action: 'BUY',
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    analysis: '',
    availableForPurchase: false,
    // ✅ NUEVO: Campos para liquidez y venta rápida
    liquidityPercentage: 0,
    quickSellPercentage: 0
  });
  const [editLoading, setEditLoading] = useState(false);
  
  // Estados para venta parcial
  const [showPartialSaleModal, setShowPartialSaleModal] = useState(false);
  const [partialSaleAlert, setPartialSaleAlert] = useState<any>(null);
  const [partialSaleLoading, setPartialSaleLoading] = useState(false);
  
  // ✅ NUEVO: Estados para venta con rango de precios
  const [sellPercentage, setSellPercentage] = useState<number>(50);
  const [sellPriceMin, setSellPriceMin] = useState<string>('');
  const [sellPriceMax, setSellPriceMax] = useState<string>('');
  const [sellEmailMessage, setSellEmailMessage] = useState<string>('');
  const [sellEmailImageUrl, setSellEmailImageUrl] = useState<string>('');
  const [sellEmailImageFile, setSellEmailImageFile] = useState<File | null>(null);
  const [sellEmailImagePreview, setSellEmailImagePreview] = useState<string>('');
  const [uploadingSellImage, setUploadingSellImage] = useState<boolean>(false);
  
  // Estados para imágenes del gráfico de TradingView
  const [chartImage, setChartImage] = useState<CloudinaryImage | null>(null);
  const [additionalImages, setAdditionalImages] = useState<CloudinaryImage[]>([]);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [realAlerts, setRealAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [informes, setInformes] = useState<any[]>([]);
  const [loadingInformes, setLoadingInformes] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [userRole, setUserRole] = React.useState<string>('');
  const [refreshingActivity, setRefreshingActivity] = useState(false);
  
  // Estados para filtros
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Estados para modales de imágenes
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CloudinaryImage | null>(null);
  const [showAdditionalImagesModal, setShowAdditionalImagesModal] = useState(false);
  const [selectedAlertImages, setSelectedAlertImages] = useState<CloudinaryImage[]>([]);
  
  // Estados para información del mercado
  const [marketStatus, setMarketStatus] = useState<string>('');
  const [isUsingSimulatedPrices, setIsUsingSimulatedPrices] = useState(false);

  // Estados para paginación de informes
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInformes, setTotalInformes] = useState(0);
  const [informesPerPage] = useState(8);

  const { data: session } = useSession();
  const router = useRouter();

  // Verificar rol del usuario
  React.useEffect(() => {
    const checkUserRole = async () => {
      try {
        console.log('🔍 Verificando rol del usuario...');
        console.log('🔍 Sesión actual:', session);
        
        const response = await fetch('/api/profile/get', {
          credentials: 'same-origin',
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Datos del perfil obtenidos:', {
            email: data.user?.email,
            role: data.user?.role,
            success: data.success,
            fullResponse: data
          });
          
          if (data.success && data.user?.role) {
            setUserRole(data.user.role);
            console.log('👤 Rol del usuario establecido:', data.user.role);
            console.log('👤 Estado userRole actualizado:', data.user.role);
          } else {
            console.warn('⚠️ No se pudo obtener el rol del usuario:', data);
            setUserRole('');
          }
        } else {
          console.error('❌ Error al obtener perfil:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Detalles del error:', errorData);
        }
      } catch (error) {
        console.error('❌ Error al verificar rol:', error);
        setUserRole('');
      }
    };

    if (session?.user) {
      console.log('🔐 Sesión activa, verificando rol para:', session.user.email);
      checkUserRole();
    } else {
      console.log('❌ No hay sesión activa');
      setUserRole('');
    }
  }, [session]);

  // Función para calcular métricas reales del dashboard usando alertas reales
  const calculateDashboardMetrics = () => {
    // Usar alertas reales en lugar de datos simulados
    const alertasActivas = realAlerts.filter(alert => alert.status === 'ACTIVE').length;
    const alertasCerradas = realAlerts.filter(alert => alert.status === 'CLOSED');
    
    // Calcular ganadoras y perdedoras basándose en el profit
    const alertasGanadoras = alertasCerradas.filter(alert => {
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace('%', '').replace('+', ''))
        : Number(alert.profit) || 0;
      return profitValue > 0;
    }).length;
    
    const alertasPerdedoras = alertasCerradas.filter(alert => {
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace('%', '').replace('+', ''))
        : Number(alert.profit) || 0;
      return profitValue < 0;
    }).length;
    
    // **CAMBIO: Calcular alertas del año actual (en lugar de semanal)**
    const ahora = new Date();
    const inicioAño = new Date(ahora.getFullYear(), 0, 1);
    const alertasAnuales = realAlerts.filter(alert => {
      const fechaAlert = new Date(alert.date);
      return fechaAlert >= inicioAño;
    }).length;

    // **CAMBIO: Calcular rentabilidad anual usando alertas reales**
    const alertasAnualConGanancias = realAlerts.filter(alert => {
      const fechaAlert = new Date(alert.date);
      return fechaAlert >= inicioAño;
    });

    const gananciasAnual = alertasAnualConGanancias.reduce((total, alert) => {
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace('%', '').replace('+', ''))
        : Number(alert.profit) || 0;
      return total + profitValue;
    }, 0);

    const rentabilidadAnual = gananciasAnual.toFixed(1);

    return {
      alertasActivas,
      alertasGanadoras,
      alertasPerdedoras,
      rentabilidadAnual: `${gananciasAnual >= 0 ? '+' : ''}${rentabilidadAnual}%`,
      alertasAnuales
    };
  };

  // Calcular métricas reactivamente cuando cambien las alertas reales
  const dashboardMetrics = React.useMemo(() => {
    return calculateDashboardMetrics();
  }, [realAlerts]);

  // Generar actividad reciente con alertas e informes
  const generateRecentActivity = () => {
    const activities: any[] = [];
    
    // Agregar alertas recientes
    realAlerts.forEach((alert) => {
      const alertDate = new Date(alert.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - alertDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffTime / (1000 * 60));

      let timestamp;
      if (diffDays > 0) {
        timestamp = `${diffDays}d`;
      } else if (diffHours > 0) {
        timestamp = `${diffHours}h`;
      } else {
        timestamp = `${diffMinutes}min`;
      }

      let message = '';
      let type = 'alert';
      
      if (alert.status === 'ACTIVE') {
        const currentPrice = typeof alert.currentPrice === 'string' 
          ? parseFloat(alert.currentPrice.replace('$', ''))
          : Number(alert.currentPrice) || 0;
        const entryPrice = typeof alert.entryPrice === 'string' 
          ? parseFloat(alert.entryPrice.replace('$', ''))
          : Number(alert.entryPrice) || 0;
        const currentPnL = entryPrice > 0 
          ? ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)
          : '0.00';
        const pnlValue = parseFloat(currentPnL);
        message = `${alert.symbol} actualizado: ${pnlValue > 0 ? '+' : ''}${currentPnL}% P&L #${alert.symbol}`;
      } else if (alert.status === 'CLOSED') {
        const profitString = String(alert.profit || '0%').replace('%', '').replace('+', '');
        const profit = parseFloat(profitString) || 0;
        message = `${alert.symbol} cerrado: ${profit > 0 ? '+' : ''}${profit.toFixed(2)}% ${profit > 0 ? 'ganancia' : 'pérdida'} #${alert.symbol}`;
      } else {
        const entryPriceFormatted = typeof alert.entryPrice === 'string' 
          ? alert.entryPrice.replace('$', '')
          : String(alert.entryPrice || '0');
        message = `Nueva alerta: ${alert.symbol} ${alert.action} a $${entryPriceFormatted} #${alert.symbol}`;
      }

      activities.push({
        id: alert._id,
        type,
        message,
        timestamp,
        dateCreated: alertDate
      });
    });

    // Agregar informes recientes
    informes.forEach((informe) => {
      const informeDate = new Date(informe.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - informeDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffTime / (1000 * 60));

      let timestamp;
      if (diffDays > 0) {
        timestamp = `${diffDays}d`;
      } else if (diffHours > 0) {
        timestamp = `${diffHours}h`;
      } else {
        timestamp = `${diffMinutes}min`;
      }

      const typeIcon = informe.type === 'video' ? '🎥' : informe.type === 'analisis' ? '📊' : '📄';
      const message = `Nuevo ${informe.type}: ${informe.title} ${typeIcon}`;

      activities.push({
        id: informe.id || informe._id,
        type: 'informe',
        message,
        timestamp,
        dateCreated: informeDate,
        reportData: informe
      });
    });

    // Ordenar por fecha más reciente y tomar los primeros 6
    return activities
      .sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime())
      .slice(0, 6);
  };

  // Generar actividad reciente reactivamente cuando cambien las alertas
  const recentActivity = React.useMemo(() => {
    return generateRecentActivity();
  }, [realAlerts, informes]);

  // ✅ NUEVO: Función para cargar alertas vigentes (solo las marcadas como disponibles para compra)
  const loadVigentesAlerts = async () => {
    setLoadingAlerts(true);
    try {
      // ✅ CAMBIO: Usar API global para datos consistentes
      const response = await fetch('/api/alerts/global?tipo=TraderCall&availableForPurchase=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No incluir credentials para datos globales
      });

      if (response.ok) {
        const data = await response.json();
        setRealAlerts(data.alerts || []);
        console.log('📊 [GLOBAL] Alertas vigentes cargadas:', data.alerts?.length || 0);
      } else {
        console.error('Error al cargar alertas vigentes:', response.status);
        setRealAlerts([]); // Establecer array vacío en caso de error
      }
    } catch (error) {
      console.error('Error al cargar alertas vigentes:', error);
      setRealAlerts([]); // Establecer array vacío en caso de error
    } finally {
      setLoadingAlerts(false);
    }
  };

  // ✅ NUEVO: Función para cargar todas las alertas (para seguimiento) - Cache bust v2
  const loadSeguimientoAlerts = async () => {
    console.log('🔄 Cargando alertas de seguimiento - versión actualizada');
    setLoadingAlerts(true);
    try {
      // ✅ CAMBIO: Usar API global para datos consistentes
      const response = await fetch('/api/alerts/global?tipo=TraderCall', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No incluir credentials para datos globales
      });

      if (response.ok) {
        const data = await response.json();
        setRealAlerts(data.alerts || []);
        console.log('📊 [GLOBAL] Alertas de seguimiento cargadas:', data.alerts?.length || 0);
      } else {
        console.error('Error al cargar alertas de seguimiento:', response.status);
        setRealAlerts([]); // Establecer array vacío en caso de error
      }
    } catch (error) {
      console.error('Error al cargar alertas de seguimiento:', error);
      setRealAlerts([]); // Establecer array vacío en caso de error
    } finally {
      setLoadingAlerts(false);
    }
  };

  // ✅ MODIFICADO: Función principal para cargar alertas según la pestaña activa
  const loadAlerts = async () => {
    try {
      if (activeTab === 'vigentes') {
        await loadVigentesAlerts();
      } else if (activeTab === 'seguimiento') {
        await loadSeguimientoAlerts();
      } else {
        // Para dashboard, cargar alertas vigentes por defecto
        await loadVigentesAlerts();
      }
    } catch (error) {
      console.error('Error cargando alertas:', error);
      // Continuar sin alertas si hay error
    }
  };

  // Función para actualizar precios en tiempo real
  const updatePrices = async (silent: boolean = false) => {
    if (!silent) setUpdatingPrices(true);
    
    try {
      const response = await fetch('/api/alerts/update-prices-manual', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Precios actualizados:', data.updated, 'alertas');
        setLastPriceUpdate(new Date());
        
        // Actualizar información del mercado
        setIsUsingSimulatedPrices(data.isSimulated || false);
        setMarketStatus(data.marketStatus || 'UNKNOWN');
        
        // Recargar alertas para mostrar los nuevos precios
        await loadAlerts();
      } else {
        console.error('Error al actualizar precios:', response.status);
      }
    } catch (error) {
      console.error('Error al actualizar precios:', error);
    } finally {
      if (!silent) setUpdatingPrices(false);
    }
  };

  // Función para cargar informes desde la API con paginación
  const loadInformes = async (page: number = 1) => {
    setLoadingInformes(true);
    try {
      // Filtrar solo informes de Trader Call con paginación
      const response = await fetch(`/api/reports?page=${page}&limit=${informesPerPage}&featured=false&category=trader-call`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        setInformes(data.data?.reports || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
        setTotalInformes(data.data?.pagination?.total || 0);
        setCurrentPage(page);
        console.log('Informes Trader Call cargados:', data.data?.reports?.length || 0, 'Página:', page);
      } else {
        console.error('Error al cargar informes:', response.status);
      }
    } catch (error) {
      console.error('Error al cargar informes:', error);
    } finally {
      setLoadingInformes(false);
    }
  };

  // Funciones para manejar la paginación
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadInformes(page);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  // Función para abrir informe completo - Ahora redirige a la página de reportes
  const openReport = async (reportId: string) => {
    try {
      console.log('🔍 Redirigiendo a informe:', reportId);
      
      // Redirigir directamente a la página de reportes individuales
      router.push(`/reports/${reportId}`);
      
    } catch (error) {
      console.error('Error al redirigir al informe:', error);
      alert('Error al abrir el informe. Intenta nuevamente.');
    }
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setSelectedReport(null);
  };

  const handleCreateReport = async (formData: any) => {
    setCreatingReport(true);
    try {
      console.log('📤 Enviando datos del informe:', {
        title: formData.title,
        type: formData.type,
        category: formData.category,
        readTime: formData.readTime,
        hasArticles: !!formData.articles,
        articlesCount: formData.articles?.length || 0
      });
      
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData, 
          category: 'trader-call' // Asignar categoría Trader Call
        }),
      });

      console.log('📡 Respuesta recibida del servidor:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Informe Trader Call creado exitosamente:', result);
        const newReport = result.data.report;
        setInformes(prev => [newReport, ...prev]);
        setShowCreateReportModal(false);
        // Mostrar mensaje de éxito
        alert('Informe creado exitosamente.');
      } else {
        const errorData = await response.json();
        console.error('❌ Error del servidor:', errorData);
        alert(`Error: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('❌ Error al crear informe:', error);
      alert('Error al crear el informe: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      console.log('🔄 Finalizando creación de informe...');
      setCreatingReport(false);
    }
  };

  // Refrescar actividad
  const refreshActivity = async () => {
    setRefreshingActivity(true);
    try {
      // Recargar alertas y informes
      await Promise.all([
        loadAlerts(),
        loadInformes()
      ]);
      console.log('✅ Actividad actualizada correctamente');
    } catch (error) {
      console.error('❌ Error al actualizar actividad:', error);
    } finally {
      setRefreshingActivity(false);
    }
  };

  // Función para filtrar alertas
  const getFilteredAlerts = () => {
    let filtered = [...realAlerts];

    // Filtrar por símbolo
    if (filterSymbol) {
      filtered = filtered.filter(alert => 
        alert.symbol && typeof alert.symbol === 'string' && alert.symbol.toLowerCase().includes(filterSymbol.toLowerCase())
      );
    }

    // Filtrar por estado
    if (filterStatus) {
      filtered = filtered.filter(alert => alert.status === filterStatus);
    }

    // Filtrar por fecha
    if (filterDate) {
      const filterDateObj = new Date(filterDate);
      filtered = filtered.filter(alert => {
        const alertDate = new Date(alert.date || alert.createdAt);
        return alertDate >= filterDateObj;
      });
    }

    return filtered;
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilterSymbol('');
    setFilterStatus('');
    setFilterDate('');
  };

  // Cargar alertas y informes al montar el componente
  React.useEffect(() => {
    loadAlerts();
    loadInformes(1); // Cargar primera página
  }, []);

  // ✅ NUEVO: Recargar alertas cuando cambie la pestaña activa
  React.useEffect(() => {
    loadAlerts();
  }, [activeTab]);

  // ✅ OPTIMIZADO: Sistema de actualización automática de precios cada 2 minutos
  React.useEffect(() => {
    // Solo actualizar si hay alertas activas
    const hasActiveAlerts = realAlerts.some(alert => alert.status === 'ACTIVE');
    
    if (!hasActiveAlerts) return;

    // ✅ OPTIMIZADO: Solo actualizar si no se actualizó recientemente
    if (!lastPriceUpdate) {
      updatePrices(true);
    } else {
      const timeSinceLastUpdate = Date.now() - lastPriceUpdate.getTime();
      const shouldUpdate = timeSinceLastUpdate >= 2 * 60 * 1000; // 2 minutos
      
      if (shouldUpdate) {
        updatePrices(true);
      }
    }

    // ✅ OPTIMIZADO: Intervalo más eficiente (2 minutos en lugar de 30 segundos)
    const interval = setInterval(() => {
      const hasActiveAlerts = realAlerts.some(alert => alert.status === 'ACTIVE');
      if (hasActiveAlerts) {
        updatePrices(true); // silent = true para no mostrar loading
      }
    }, 2 * 60 * 1000); // 2 minutos

    return () => clearInterval(interval);
  }, [realAlerts, lastPriceUpdate, updatePrices]);

  // ✅ MEJORADO: Cargar liquidez con mejor manejo de errores y logging
  const loadLiquidity = async () => {
    try {
      console.log('🔄 [LIQUIDITY] Iniciando carga de liquidez para TraderCall...');
      
      // Agregar timestamp para evitar cache del browser
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/liquidity/public?pool=TraderCall&_t=${timestamp}`);
      
      if (res.ok) {
        const json = await res.json();
        console.log('✅ [LIQUIDITY] Respuesta de API recibida:', {
          success: json.success,
          hasData: !!json.data,
          totalLiquidity: json.data?.totalLiquidity,
          distributionsCount: json.data?.distributions?.length || 0
        });
        
        if (json.success && json.data) {
          const map: Record<string, any> = {};
          (json.data?.distributions || []).forEach((d: any) => {
            map[d.symbol] = d;
            console.log(`📊 [LIQUIDITY] Distribución cargada: ${d.symbol} - $${d.allocatedAmount}`);
          });
          
          setLiquidityMap(map);
          setLiquidityTotal(Number(json.data?.totalLiquidity || 0));
          
          console.log('✅ [LIQUIDITY] Datos de liquidez cargados exitosamente:', {
            mapKeys: Object.keys(map).length,
            totalLiquidity: json.data?.totalLiquidity
          });
        } else {
          console.warn('⚠️ [LIQUIDITY] Respuesta de API sin datos de liquidez');
        }
      } else {
        console.error('❌ [LIQUIDITY] Error en respuesta de API:', res.status, res.statusText);
      }
    } catch (e) {
      console.error('❌ [LIQUIDITY] Error cargando liquidez:', e);
    }
  };

  React.useEffect(() => {
    // Solo cargar si no hay datos de liquidez cargados
    if (Object.keys(liquidityMap).length === 0) {
      loadLiquidity();
    }
  }, [liquidityMap]);

  // ✅ NUEVO: Recargar liquidez automáticamente si no se carga correctamente
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (Object.keys(liquidityMap).length === 0 && liquidityTotal === 0) {
        console.log('🔄 [LIQUIDITY] Reintentando carga de liquidez después de 3 segundos...');
        loadLiquidity();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [liquidityMap, liquidityTotal]);

  // Función para obtener precio individual de una acción (modal crear alerta)
  const fetchStockPrice = async (symbol: string) => {
    if (!symbol.trim()) {
      alert('Por favor ingresa un símbolo válido');
      return;
    }

    setPriceLoading(true);
    setStockPrice(null);
    
    try {
      console.log(`🔍 Obteniendo precio para: ${symbol}`);
      
      const response = await fetch(`/api/stock-price?symbol=${symbol.toUpperCase()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`💰 Precio obtenido para ${symbol}: $${data.price}`);
        console.log(`📊 Estado del mercado: ${data.marketStatus}`);
        
        setStockPrice(data.price);
        
      } else {
        console.error('Error al obtener precio:', response.status);
        alert('Error al obtener el precio. Intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error al obtener precio:', error);
      alert('Error de conexión. Verifica tu internet e intenta nuevamente.');
    } finally {
      setPriceLoading(false);
    }
  };

  // Funciones para manejar imágenes
  const handleChartImageUploaded = (image: CloudinaryImage) => {
    setChartImage(image);
    setUploadingChart(false);
    console.log('✅ Gráfico de TradingView subido:', image.public_id);
  };

  const handleAdditionalImageUploaded = (image: CloudinaryImage) => {
    setAdditionalImages(prev => [...prev, image]);
    setUploadingImages(false);
    console.log('✅ Imagen adicional subida:', image.public_id);
  };

  const removeChartImage = () => {
    setChartImage(null);
  };

  const removeAdditionalImage = (indexToRemove: number) => {
    setAdditionalImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const updateImageCaption = (index: number, caption: string) => {
    setAdditionalImages(prev => prev.map((img, i) => 
      i === index ? { ...img, caption } : img
    ));
  };

  // Funciones para manejar modales de imágenes
  const handleShowChart = (chartImage: CloudinaryImage) => {
    setSelectedImage(chartImage);
    setShowImageModal(true);
  };

  const handleShowAdditionalImages = (images: CloudinaryImage[]) => {
    setSelectedAlertImages(images);
    setShowAdditionalImagesModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  const closeAdditionalImagesModal = () => {
    setShowAdditionalImagesModal(false);
    setSelectedAlertImages([]);
  };

  const handleCreateAlert = async () => {
    if (!newAlert.symbol || !stockPrice) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }
    
    // ✅ DEBUG: Log de datos antes de enviar
    const liquidityAmount = newAlert.liquidityPercentage > 0 ? (liquidityTotal * newAlert.liquidityPercentage / 100) : 0;
    console.log('🔍 [DEBUG] Datos de liquidez antes de enviar:', {
      liquidityPercentage: newAlert.liquidityPercentage,
      liquidityTotal,
      liquidityAmount,
      symbol: newAlert.symbol.toUpperCase()
    });
    
    setLoading(true);
    try {
      const response = await fetch('/api/alerts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          tipo: 'TraderCall',
          symbol: newAlert.symbol.toUpperCase(),
          action: newAlert.action,
          entryPrice: newAlert.tipoAlerta === 'precio' ? stockPrice : undefined, // Solo para alertas de precio específico
          stopLoss: parseFloat(newAlert.stopLoss),
          takeProfit: parseFloat(newAlert.takeProfit),
          analysis: newAlert.analysis || '',
          date: new Date().toISOString(),
          chartImage: chartImage,
          images: additionalImages,
          // ✅ NUEVO: Campos para alertas de rango
          tipoAlerta: newAlert.tipoAlerta,
          precioMinimo: newAlert.tipoAlerta === 'rango' ? parseFloat(newAlert.precioMinimo) : undefined,
          precioMaximo: newAlert.tipoAlerta === 'rango' ? parseFloat(newAlert.precioMaximo) : undefined,
          horarioCierre: newAlert.horarioCierre,
          // Campos de email opcionales
          emailMessage: newAlert.emailMessage || undefined,
          emailImageUrl: newAlert.emailImageUrl || (chartImage?.secure_url || chartImage?.url),
          // ✅ NUEVO: Campo de liquidez
          liquidityPercentage: newAlert.liquidityPercentage,
          liquidityAmount: newAlert.liquidityPercentage > 0 ? (liquidityTotal * newAlert.liquidityPercentage / 100) : 0
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Alerta Trader Call creada:', result.alert);
        
        // Recargar alertas y limpiar formulario
        await loadAlerts();
        setNewAlert({
          symbol: '',
          action: 'BUY',
          stopLoss: '',
          takeProfit: '',
          analysis: '',
          tipoAlerta: 'precio',
          precioMinimo: '',
          precioMaximo: '',
          horarioCierre: '17:30',
          emailMessage: '',
          emailImageUrl: '',
          liquidityPercentage: 0
        });
        setStockPrice(null);
        setChartImage(null);
        setAdditionalImages([]);
        setEmailImage(null);
        setShowCreateAlert(false);
        
        alert('¡Alerta de Trader Call creada exitosamente!');
      } else {
        const error = await response.json();
        console.error('❌ Error del servidor:', error);
        alert(`Error: ${error.message || 'No se pudo crear la alerta'}`);
      }
    } catch (error) {
      console.error('Error creating alert:', error);
      alert('Error al crear la alerta');
    } finally {
      setLoading(false);
    }
  };

  // Función para cerrar posición
  const [confirmClose, setConfirmClose] = useState<{open: boolean; alertId?: string; price?: string}>({ open: false });
  const [closeEmailMessage, setCloseEmailMessage] = useState<string>('');
  const [closeEmailImageUrl, setCloseEmailImageUrl] = useState<string>('');
  const [closeEmailImageFile, setCloseEmailImageFile] = useState<File | null>(null);
  const [closeEmailImagePreview, setCloseEmailImagePreview] = useState<string>('');
  const [uploadingCloseImage, setUploadingCloseImage] = useState<boolean>(false);

  const handleClosePosition = async (alertId: string, currentPrice: string) => {
    console.log('🔍 handleClosePosition llamado con:', { alertId, currentPrice, userRole });
    setConfirmClose({ open: true, alertId, price: currentPrice });
  };

  // ✅ NUEVO: Función para manejar selección de archivo de imagen
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        alert('❌ Por favor selecciona un archivo de imagen válido');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen debe ser menor a 5MB');
        return;
      }

      setCloseEmailImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCloseEmailImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Limpiar URL si había una
      setCloseEmailImageUrl('');
    }
  };

  // ✅ NUEVO: Función para subir imagen a Cloudinary
  const uploadImageToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file); // Cambiado de 'file' a 'image' para coincidir con el API

    const response = await fetch('/api/upload/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al subir la imagen');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al subir la imagen');
    }
    
    return data.data.secure_url;
  };

  const confirmCloseAction = async () => {
    if (!confirmClose.alertId || !confirmClose.price) { setConfirmClose({ open: false }); return; }
    try {
      if (userRole !== 'admin') { alert('❌ Solo los administradores pueden cerrar posiciones'); setConfirmClose({ open: false }); return; }
      const priceNumber = parseFloat(confirmClose.price.replace('$',''));
      if (isNaN(priceNumber) || priceNumber <= 0) { alert('❌ Precio inválido. Por favor, verifica el precio actual.'); setConfirmClose({ open: false }); return; }
      
      let finalImageUrl: string | undefined = closeEmailImageUrl;
      
      // ✅ NUEVO: Subir imagen si se seleccionó un archivo
      if (closeEmailImageFile) {
        setUploadingCloseImage(true);
        try {
          finalImageUrl = await uploadImageToCloudinary(closeEmailImageFile);
          console.log('✅ Imagen subida exitosamente:', finalImageUrl);
        } catch (uploadError) {
          console.error('❌ Error subiendo imagen:', uploadError);
          alert('❌ Error al subir la imagen. Se procederá sin imagen.');
          finalImageUrl = undefined;
        } finally {
          setUploadingCloseImage(false);
        }
      }
      
      const response = await fetch('/api/alerts/close', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ 
          alertId: confirmClose.alertId, 
          currentPrice: priceNumber, 
          reason: 'MANUAL', 
          emailMessage: closeEmailMessage || undefined, 
          emailImageUrl: finalImageUrl || undefined 
        })
      });
      const result = await response.json();
      if (response.ok && result.success) { await loadAlerts(); alert('✅ ¡Posición cerrada exitosamente!'); }
      else { alert(result?.error || result?.message || '❌ No se pudo cerrar la posición'); }
    } catch (error) {
      console.error('❌ Error al cerrar posición:', error); alert('❌ Error inesperado al cerrar la posición.');
    } finally { 
      setConfirmClose({ open: false }); 
      setCloseEmailMessage(''); 
      setCloseEmailImageUrl(''); 
      setCloseEmailImageFile(null);
      setCloseEmailImagePreview('');
      setUploadingCloseImage(false);
    }
  };

  // ✅ NUEVO: Función para probar el cierre de mercado
  const handleTestMarketClose = async () => {
    if (!confirm('¿Quieres probar el cierre de mercado? Esto procesará todas las alertas que deban cerrarse según su horario personalizado.')) {
      return;
    }

    try {
      console.log('🧪 Iniciando prueba de cierre de mercado...');
      
      const response = await fetch('/api/cron/market-close?test=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Prueba de cierre exitosa:', result);
        alert(`✅ Prueba de cierre completada!\n\nProcesadas: ${result.processedCount} alertas\nTiempo: ${result.executionTime}ms\n\n${result.message}`);
        
        // Recargar las alertas para mostrar los cambios
        await loadAlerts();
      } else {
        console.error('❌ Error en prueba de cierre:', result);
        alert(`❌ Error en prueba de cierre: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('❌ Error al probar cierre de mercado:', error);
      alert('❌ Error al probar cierre de mercado. Verifica la consola para más detalles.');
    }
  };

  // ✅ NUEVO: Función para convertir rangos a precios fijos
  const handleTestRangeConversion = async () => {
    if (!confirm('¿Quieres convertir todos los rangos de precio a precios fijos? Esto simulará el cierre de mercado usando los precios actuales.')) {
      return;
    }

    try {
      console.log('🔄 Iniciando conversión de rangos...');
      
      const response = await fetch('/api/test-market-close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Conversión exitosa:', result);
        
        // Mostrar detalles de la conversión
        let detailsMessage = '';
        if (result.details && result.details.length > 0) {
          detailsMessage = '\n\nDetalles:\n' + result.details.map((detail: any) => 
            `• ${detail.symbol}: ${detail.oldRange} → $${detail.newPrice}`
          ).join('\n');
        }
        
        alert(`✅ Conversión completada!\n\nProcesadas: ${result.processedCount} alertas${detailsMessage}\n\n${result.message}`);
        
        // Recargar las alertas para mostrar los cambios
        await loadAlerts();
      } else {
        console.error('❌ Error en conversión:', result);
        alert(`❌ Error en conversión: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('❌ Error al convertir rangos:', error);
      alert('❌ Error al convertir rangos. Verifica la consola para más detalles.');
    }
  };

  // ✅ NUEVO: Función para conversión automática basada en estado del mercado
  const handleAutoConvertRanges = async () => {
    if (!confirm('¿Quieres verificar el estado del mercado y convertir rangos automáticamente si está cerrado?')) {
      return;
    }

    try {
      console.log('🔄 Verificando estado del mercado y ejecutando conversión automática...');
      
      const response = await fetch('/api/auto-convert-ranges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Verificación completada:', result);
        
        let message = `📊 Estado del mercado: ${result.marketStatus.isOpen ? 'ABIERTO' : 'CERRADO'}\n${result.marketStatus.message}`;
        
        if (result.conversion && result.conversion.processed > 0) {
          // Mostrar detalles de la conversión
          let detailsMessage = '\n\n🔄 Conversión automática ejecutada:\n';
          detailsMessage += result.conversion.details.map((detail: any) => 
            `• ${detail.symbol}: ${detail.oldRange} → $${detail.newPrice}`
          ).join('\n');
          
          message += detailsMessage;
          message += `\n\n✅ Procesadas: ${result.conversion.processed} alertas`;
          
          // Recargar las alertas para mostrar los cambios
          await loadAlerts();
        } else if (!result.marketStatus.isOpen) {
          message += '\n\nℹ️ No se encontraron alertas con rangos para convertir.';
        } else {
          message += '\n\nℹ️ El mercado está abierto, no se ejecutó conversión.';
        }
        
        alert(message);
      } else {
        console.error('❌ Error en verificación automática:', result);
        alert(`❌ Error: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('❌ Error al verificar mercado:', error);
      alert('❌ Error al verificar estado del mercado. Verifica la consola para más detalles.');
    }
  };

  // ✅ NUEVO: Función para probar el cron job manualmente
  const handleTestCronJob = async () => {
    if (!confirm('¿Quieres probar el cron job de conversión automática? Esto simulará la ejecución automática.')) {
      return;
    }

    try {
      console.log('🔄 Probando cron job de conversión automática...');
      
      const response = await fetch('/api/test-cron-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Prueba de cron job exitosa:', result);
        
        let message = `🧪 PRUEBA DE CRON JOB COMPLETADA\n\n`;
        
        if (result.conversion && result.conversion.processed > 0) {
          // Mostrar detalles de la conversión
          let detailsMessage = '🔄 Conversión ejecutada:\n';
          detailsMessage += result.conversion.details.map((detail: any) => 
            `• ${detail.symbol}: ${detail.oldRange} → $${detail.newPrice}`
          ).join('\n');
          
          message += detailsMessage;
          message += `\n\n✅ Procesadas: ${result.conversion.processed} alertas`;
          
          // Recargar las alertas para mostrar los cambios
          await loadAlerts();
        } else {
          message += 'ℹ️ No se encontraron alertas con rangos para convertir.';
        }
        
        alert(message);
      } else {
        console.error('❌ Error en prueba de cron job:', result);
        alert(`❌ Error: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('❌ Error al probar cron job:', error);
      alert('❌ Error al probar cron job. Verifica la consola para más detalles.');
    }
  };

  // Función para manejar la edición de alertas
  const handleEditAlert = (alert: any) => {
    console.log('🔍 Editando alerta:', alert);

    // Preparar los datos de la alerta para edición
    setEditingAlert(alert);
    setEditAlert({
      symbol: alert.symbol || '',
      action: alert.action || 'BUY',
      entryPrice: alert.entryPrice ? (typeof alert.entryPrice === 'string' ? alert.entryPrice.replace('$', '') : String(alert.entryPrice)) : '',
      stopLoss: alert.stopLoss ? (typeof alert.stopLoss === 'string' ? alert.stopLoss.replace('$', '') : String(alert.stopLoss)) : '',
      takeProfit: alert.takeProfit ? (typeof alert.takeProfit === 'string' ? alert.takeProfit.replace('$', '') : String(alert.takeProfit)) : '',
      analysis: alert.analysis || '',
      availableForPurchase: alert.availableForPurchase || false,
      // ✅ NUEVO: Inicializar campos de liquidez y venta rápida
      liquidityPercentage: 0,
      quickSellPercentage: 0
    });

    // Mostrar el modal de edición
    setShowEditAlert(true);
  };

  // Función para abrir modal de venta parcial
  const handlePartialSale = (alert: any) => {
    console.log('💰 Iniciando venta parcial para:', alert);
    setPartialSaleAlert(alert);
    setShowPartialSaleModal(true);
    
    // ✅ NUEVO: Inicializar valores por defecto
    setSellPercentage(50);
    setSellPriceMin('');
    setSellPriceMax('');
    setSellEmailMessage('');
    setSellEmailImageUrl('');
    setSellEmailImageFile(null);
    setSellEmailImagePreview('');
  };

  // ✅ NUEVO: Función para manejar selección de archivo de imagen en venta
  const handleSellImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        alert('❌ Por favor selecciona un archivo de imagen válido');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen debe ser menor a 5MB');
        return;
      }

      setSellEmailImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSellEmailImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Limpiar URL si había una
      setSellEmailImageUrl('');
    }
  };

  // ✅ NUEVO: Función para ejecutar venta con rango de precios
  const executeSellWithRange = async () => {
    if (!partialSaleAlert) {
      console.error('❌ No hay alerta seleccionada para la venta');
      alert('❌ No hay alerta seleccionada para la venta');
      return;
    }

    if (!partialSaleAlert._id && !partialSaleAlert.id) {
      console.error('❌ La alerta no tiene ID válido:', partialSaleAlert);
      alert('❌ Error: La alerta no tiene ID válido');
      return;
    }

    // Validaciones
    if (!sellPriceMin || !sellPriceMax) {
      alert('❌ Por favor ingresa tanto el precio mínimo como el máximo');
      return;
    }

    const priceMin = parseFloat(sellPriceMin);
    const priceMax = parseFloat(sellPriceMax);

    if (isNaN(priceMin) || isNaN(priceMax) || priceMin <= 0 || priceMax <= 0) {
      alert('❌ Los precios deben ser números válidos mayores a 0');
      return;
    }

    if (priceMin >= priceMax) {
      alert('❌ El precio mínimo debe ser menor al precio máximo');
      return;
    }

    if (sellPercentage <= 0 || sellPercentage > 100) {
      alert('❌ El porcentaje debe estar entre 1 y 100');
      return;
    }

    try {
      setPartialSaleLoading(true);
      const alertId = partialSaleAlert._id || partialSaleAlert.id;
      console.log(`💰 Ejecutando venta de ${sellPercentage}% en rango $${priceMin}-$${priceMax} para alerta:`, alertId);
      console.log('🔍 Datos de la alerta:', {
        _id: partialSaleAlert._id,
        id: partialSaleAlert.id,
        symbol: partialSaleAlert.symbol,
        entryPrice: partialSaleAlert.entryPrice
      });

      let finalImageUrl: string | undefined = sellEmailImageUrl;
      
      // Subir imagen si se seleccionó un archivo
      if (sellEmailImageFile) {
        setUploadingSellImage(true);
        try {
          finalImageUrl = await uploadImageToCloudinary(sellEmailImageFile);
          console.log('✅ Imagen de venta subida exitosamente:', finalImageUrl);
        } catch (uploadError) {
          console.error('❌ Error subiendo imagen de venta:', uploadError);
          alert('❌ Error al subir la imagen. Se procederá sin imagen.');
          finalImageUrl = undefined;
        } finally {
          setUploadingSellImage(false);
        }
      }

      const requestData = {
        alertId: alertId,
        percentage: sellPercentage,
        priceRange: {
          min: priceMin,
          max: priceMax
        },
        tipo: 'TraderCall',
        emailMessage: sellEmailMessage || undefined,
        emailImageUrl: finalImageUrl || undefined
      };

      console.log('📤 Enviando datos al API:', requestData);

      const response = await fetch('/api/admin/partial-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Venta con rango ejecutada exitosamente:', result);
        
        // Mostrar mensaje de confirmación
        alert(`✅ Venta de ${sellPercentage}% en rango $${priceMin}-$${priceMax} ejecutada exitosamente!\n\n` +
              `💰 Liquidez liberada: $${result.liquidityReleased?.toFixed(2) || 'N/A'}\n` +
              `📊 Posición restante: ${100 - sellPercentage}%\n` +
              `💵 Ganancia realizada: $${result.realizedProfit?.toFixed(2) || 'N/A'}`);
        
        // Recargar datos
        await loadAlerts();
        
        // ✅ FORZAR RECARGA DE LIQUIDEZ con delay para asegurar actualización
        setTimeout(async () => {
          await loadLiquidity();
        }, 500); // Esperar 500ms para que la DB se actualice
        
        // Cerrar modal y limpiar estados
        setShowPartialSaleModal(false);
        setPartialSaleAlert(null);
        setSellPercentage(50);
        setSellPriceMin('');
        setSellPriceMax('');
        setSellEmailMessage('');
        setSellEmailImageUrl('');
        setSellEmailImageFile(null);
        setSellEmailImagePreview('');
      } else {
        console.error('❌ Error en venta con rango:', result);
        alert(`❌ Error: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('❌ Error al ejecutar venta con rango:', error);
      alert('❌ Error al ejecutar venta. Verifica la consola para más detalles.');
    } finally {
      setPartialSaleLoading(false);
    }
  };

  // Función para guardar los cambios de la alerta
  const handleSaveEditAlert = async () => {
    if (!editingAlert) return;

    // ✅ CORREGIDO: Verificar que tengamos un ID válido
    const alertId = editingAlert.id || editingAlert._id;
    if (!alertId) {
      alert('❌ Error: No se pudo identificar la alerta a editar');
      return;
    }

    try {
      setEditLoading(true);

      // Validar datos
      if (!editAlert.symbol.trim()) {
        alert('❌ El símbolo es obligatorio');
        return;
      }

      if (!editAlert.entryPrice || parseFloat(editAlert.entryPrice) <= 0) {
        alert('❌ El precio de entrada debe ser mayor a 0');
        return;
      }

      if (!editAlert.stopLoss || parseFloat(editAlert.stopLoss) <= 0) {
        alert('❌ El stop loss debe ser mayor a 0');
        return;
      }

      if (!editAlert.takeProfit || parseFloat(editAlert.takeProfit) <= 0) {
        alert('❌ El take profit debe ser mayor a 0');
        return;
      }

      console.log('🔄 Guardando cambios de alerta:', {
        alertId: alertId,
        changes: editAlert
      });

      // ✅ NUEVO: Preparar datos de liquidez y venta rápida
      const liquidityAmount = editAlert.liquidityPercentage > 0 ? (liquidityTotal * editAlert.liquidityPercentage / 100) : 0;
      
      console.log('🔍 [DEBUG] Datos de edición con liquidez:', {
        alertId: alertId,
        liquidityPercentage: editAlert.liquidityPercentage,
        liquidityAmount,
        quickSellPercentage: editAlert.quickSellPercentage,
        liquidityTotal
      });

      const response = await fetch('/api/alerts/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          alertId: alertId,
          symbol: editAlert.symbol,
          action: editAlert.action,
          entryPrice: parseFloat(editAlert.entryPrice),
          stopLoss: parseFloat(editAlert.stopLoss),
          takeProfit: parseFloat(editAlert.takeProfit),
          analysis: editAlert.analysis,
          availableForPurchase: editAlert.availableForPurchase,
          // ✅ NUEVO: Campos de liquidez y venta rápida
          liquidityPercentage: editAlert.liquidityPercentage,
          liquidityAmount: liquidityAmount,
          quickSellPercentage: editAlert.quickSellPercentage,
          reason: 'Edición por administrador desde panel de control'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Alerta editada exitosamente:', result.alert);

        // ✅ CORREGIDO: Recargar AMBAS listas para evitar duplicados
        // Si cambió el estado de availableForPurchase, la alerta debe moverse entre secciones
        await Promise.all([
          loadVigentesAlerts(),
          loadSeguimientoAlerts()
        ]);

        // Cerrar modal
        setShowEditAlert(false);
        setEditingAlert(null);

        alert('✅ ¡Alerta editada exitosamente!');
      } else {
        console.error('❌ Error del servidor:', result);

        let errorMessage = 'No se pudo editar la alerta';

        if (result.error) {
          if (result.error.includes('Permisos insuficientes')) {
            errorMessage = '❌ No tienes permisos para editar alertas. Solo los administradores pueden hacerlo.';
          } else if (result.error.includes('No autorizado')) {
            errorMessage = '❌ Sesión expirada. Por favor, inicia sesión nuevamente.';
          } else if (result.error.includes('Alerta no encontrada')) {
            errorMessage = '❌ La alerta no fue encontrada. Puede que haya sido eliminada.';
          } else if (result.error.includes('no está activa')) {
            errorMessage = '❌ La alerta ya no está activa.';
          } else {
            errorMessage = `❌ ${result.error}`;
          }
        } else if (result.message) {
          errorMessage = `❌ ${result.message}`;
        }

        alert(errorMessage);
      }
    } catch (error) {
      console.error('❌ Error al editar alerta:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('❌ Error de conexión. Verifica tu internet e intenta nuevamente.');
      } else {
        alert('❌ Error inesperado al editar la alerta. Por favor, intenta nuevamente.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  // **NUEVO: Estado para manejo de rango temporal del portafolio**
  const [portfolioRange, setPortfolioRange] = useState('30d');
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // **NUEVO: Función para manejar cambio de rango temporal**
  const handlePortfolioRangeChange = useCallback(async (range: string, days: number) => {
    setPortfolioRange(range);
    setPortfolioLoading(true);
    
    try {
      // Simular carga de datos del portafolio
      // En producción, esto haría fetch a una API real
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generar datos simulados basados en el rango
      const mockData = generatePortfolioData(days);
      setPortfolioData(mockData);
    } catch (error) {
      console.error('Error al cargar datos del portafolio:', error);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  // **NUEVO: Función para generar datos simulados del portafolio**
  const generatePortfolioData = (days: number) => {
    const data = [];
    const baseValue = 10000;
    let currentValue = baseValue;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      // Simular variación diaria
      const dailyChange = (Math.random() - 0.5) * 0.02; // ±1% diario
      currentValue *= (1 + dailyChange);
      
      data.push({
        date: date.toISOString(),
        value: currentValue,
        change: dailyChange * 100
      });
    }
    
    return data;
  };

  // Funciones de renderizado
  // ✅ MEJORADO: Función auxiliar para crear datos del gráfico de torta con logging
  const createPieChartData = (alerts: any[]) => {
    console.log('📊 [PIE CHART] Creando datos del gráfico de torta...', {
      alertsCount: alerts.length,
      liquidityMapKeys: Object.keys(liquidityMap || {}).length,
      liquidityTotal: liquidityTotal
    });

    // Paleta de colores dinámicos para cada alerta
    const colorPalette = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#F97316', '#6366F1',
      '#14B8A6', '#F43F5E', '#A855F7', '#EAB308', '#22C55E'
    ];

    // Construir base desde las asignaciones de liquidez activas
    const activeDistributions = Object.values(liquidityMap || {})
      .filter((d: any) => d && d.allocatedAmount > 0);

    console.log('📊 [PIE CHART] Distribuciones activas encontradas:', activeDistributions.length);

    // ✅ CORREGIDO: Filtrar solo distribuciones de alertas ACTIVAS
    const activeDistributionsWithActiveAlerts = activeDistributions.filter((d: any) => {
      const alert = (realAlerts || []).find((a: any) => a.symbol === d.symbol);
      const isActive = alert && alert.status === 'ACTIVE';
      if (isActive) {
        console.log(`✅ [PIE CHART] Alerta activa encontrada: ${d.symbol} - $${d.allocatedAmount}`);
      }
      return isActive;
    });

    console.log('📊 [PIE CHART] Distribuciones con alertas activas:', activeDistributionsWithActiveAlerts.length);

    // Mapear distribuciones a segmentos (solo símbolos con liquidez asignada y alertas activas)
    const chartData = activeDistributionsWithActiveAlerts.map((d: any, index: number) => {
      const symbol = d.symbol;
      const allocated = Number(d.allocatedAmount || 0);
      const alert = (realAlerts || []).find((a: any) => a.symbol === symbol);
      const profitValue = alert ? (typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace(/[+%]/g, ''))
        : Number(alert.profit) || 0) : 0;
      
      // ✅ CORREGIDO: Usar el precio actual de la alerta en lugar del precio del liquidityMap
      // El precio del liquidityMap puede estar desactualizado
      const currentPrice = alert?.currentPrice ? 
        (typeof alert.currentPrice === 'string' 
          ? parseFloat(alert.currentPrice.replace('$', ''))
          : Number(alert.currentPrice) || 0) 
        : d.currentPrice;
      
      return {
        id: d.alertId || symbol,
        symbol,
        profit: profitValue,
        status: 'ACTIVE',
        entryPrice: d.entryPrice,
        currentPrice: currentPrice, // ✅ Usar precio actualizado de la alerta
        stopLoss: alert?.stopLoss ?? 0,
        takeProfit: alert?.takeProfit ?? 0,
        action: alert?.action ?? 'BUY',
        date: alert?.date ?? '',
        analysis: alert?.analysis ?? '',
        allocatedAmount: allocated,
        color: colorPalette[index % colorPalette.length],
        darkColor: colorPalette[index % colorPalette.length] + '80'
      };
    });

    // Calcular el tamaño de cada segmento basado en la liquidez asignada
    const totalAllocated = chartData.reduce((sum, seg) => sum + Math.abs(seg.allocatedAmount || 0), 0);
    // Si hay totalLiquidity (>0) usarlo como base; si no, usar totalAllocated.
    const totalBase = (liquidityTotal && liquidityTotal > 0) ? liquidityTotal : totalAllocated;

    let cumulativeAngle = 0;
    const chartSegments = chartData.map((seg) => {
      const segmentBase = Math.abs(seg.allocatedAmount || 0);
      const size = totalBase > 0 ? (segmentBase / totalBase) * 100 : 0;
      const angle = (segmentBase / (totalBase || 1)) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = startAngle + angle;
      cumulativeAngle = endAngle;

      return {
        ...seg,
        size,
        startAngle,
        endAngle,
        centerAngle: (startAngle + endAngle) / 2
      };
    });

    // Agregar segmento de liquidez disponible para que la suma sea 100%
    const available = Math.max((totalBase || 0) - totalAllocated, 0);
    // Siempre agregar el segmento de liquidez, incluso si es 0, para mostrar la composición completa
    const liqStart = cumulativeAngle;
    const liqEnd = liqStart + ((available / (totalBase || 1)) * 360);
    chartSegments.push({
      id: 'LIQ-SEG',
      symbol: 'LIQUIDEZ',
      profit: 0,
      status: 'ACTIVE',
      entryPrice: 0,
      currentPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      action: 'BUY',
      date: '',
      analysis: '',
      allocatedAmount: available,
      color: '#9CA3AF',
      darkColor: '#9CA3AF80',
      size: (available / (totalBase || 1)) * 100,
      startAngle: liqStart,
      endAngle: liqEnd,
      centerAngle: (liqStart + liqEnd) / 2,
    } as any);

    // ✅ NUEVO: Logging final de los segmentos creados
    console.log('📊 [PIE CHART] Segmentos finales creados:', {
      totalSegments: chartSegments.length,
      segments: chartSegments.map(s => ({
        symbol: s.symbol,
        size: s.size,
        allocatedAmount: s.allocatedAmount
      }))
    });

    // Si no hay distribuciones ni totalLiquidity, no hay segmentos
    return chartSegments;
  };

  // Función auxiliar para renderizar el gráfico de torta
  const renderPieChart = (chartSegments: any[]) => (
    <div className={styles.pieChart3D} id="alertsChartContainer">
      <svg viewBox="0 0 500 500" className={styles.chartSvg3D}>
        {/* Sombra del gráfico para efecto 3D */}
        <defs>
          <filter id="shadow3D" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="3" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.3"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Fondo del gráfico con efecto 3D */}
        <circle cx="250" cy="250" r="200" className={styles.chartBackground3D} />

        {/* Segmentos del gráfico 3D */}
        {chartSegments.map((segment, index) => (
          <g key={segment.id} className={styles.chartSegment3D}>
            {/* Sombra del segmento */}
            <path
              d={describeArc(250, 250, 200, segment.startAngle, segment.endAngle)}
              fill={segment.darkColor}
              filter="url(#shadow3D)"
              className={styles.segmentShadow}
            />
            {/* Segmento principal */}
            <path
              d={describeArc(250, 250, 200, segment.startAngle, segment.endAngle)}
              fill={segment.color}
              className={styles.segmentPath3D}
              onMouseEnter={(e) => showTooltip(e, segment)}
              onMouseLeave={hideTooltip}
              filter="url(#glow)"
            />
            {/* Borde del segmento */}
            <path
              d={describeArc(250, 250, 200, segment.startAngle, segment.endAngle)}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              opacity="0.3"
              className={styles.segmentBorder}
            />
            {/* Etiqueta del símbolo - Solo mostrar si el segmento es grande (>8%) */}
            {segment.size > 8 && (
              <>
                {/* Símbolo visible solo para segmentos grandes */}
                <text
                  x={250 + Math.cos((segment.centerAngle - 90) * Math.PI / 180) * 150}
                  y={250 + Math.sin((segment.centerAngle - 90) * Math.PI / 180) * 150}
                  className={styles.segmentLabel}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fontWeight="bold"
                  fill="#ffffff"
                  filter="url(#shadow3D)"
                  style={{
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  {segment.symbol}
                </text>
              </>
            )}
          </g>
        ))}

        {/* Círculo central con efecto 3D */}
        <circle cx="250" cy="250" r="60" className={styles.chartCenter3D} />
      </svg>
    </div>
  );

  const renderDashboard = () => {
    // ✅ MEJORADO: Obtener datos para el gráfico de torta con mejor manejo de errores
    const alertasActivas = realAlerts.filter(alert => alert.status === 'ACTIVE');
    
    // ✅ NUEVO: Verificar si los datos de liquidez están cargados
    const liquidityLoaded = Object.keys(liquidityMap).length > 0 || liquidityTotal > 0;
    const hasActiveAlerts = alertasActivas.length > 0;
    
    // ✅ NUEVO: Crear datos del gráfico solo si tenemos datos de liquidez
    const chartSegments = liquidityLoaded ? createPieChartData(alertasActivas) : [];
    
    // ✅ NUEVO: Determinar el estado del gráfico
    const showChart = liquidityLoaded && hasActiveAlerts && chartSegments.length > 0;
    const showLoading = !liquidityLoaded && hasActiveAlerts;
    const showEmpty = !hasActiveAlerts;

    return (
      <div className={styles.dashboardContent}>
        <h2 className={styles.sectionTitle}>Dashboard de Trabajo</h2>
        <div className={styles.chartSection}>
          <PortfolioTimeRange 
            selectedRange={portfolioRange}
            onRangeChange={handlePortfolioRangeChange}
          />
        </div>

        {/* Comparación con SP500 - MOVIDO AL INICIO */}
        <SP500Comparison />

        {/* Métricas principales - OCULTADO */}
        {/* <div className={styles.modernMetricsGrid}>
          <div className={`${styles.modernMetricCard} ${styles.activeCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <Activity size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>ALERTAS ACTIVAS</h3>
              <div className={styles.metricValue}>{dashboardMetrics.alertasActivas}</div>
              <p className={styles.metricSubtext}>Posiciones abiertas</p>
            </div>
          </div>

          <div className={`${styles.modernMetricCard} ${styles.successCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <TrendingUp size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>ALERTAS GANADORAS</h3>
              <div className={styles.metricValue}>{dashboardMetrics.alertasGanadoras}</div>
              <p className={styles.metricSubtext}>Cerradas con ganancia</p>
            </div>
          </div>

          <div className={`${styles.modernMetricCard} ${styles.errorCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <TrendingDown size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>ALERTAS PERDEDORAS</h3>
              <div className={styles.metricValue}>{dashboardMetrics.alertasPerdedoras}</div>
              <p className={styles.metricSubtext}>Cerradas con pérdida</p>
            </div>
          </div>

          <div className={`${styles.modernMetricCard} ${styles.warningCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <BarChart3 size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>RENTABILIDAD ANUAL</h3>
              <div className={styles.metricValue}>{dashboardMetrics.rentabilidadAnual}</div>
              <p className={styles.metricSubtext}>Año {new Date().getFullYear()}</p>
            </div>
          </div>
        </div> */}

        {/* Gráfico de Distribución de Alertas */}
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <h3>📊 Distribución de Alertas Activas</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* ✅ Botón para ir a seguimiento */}
              <button 
                onClick={() => setActiveTab('seguimiento')} 
                className={styles.viewAllButton}
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                📈 Ir a alertas
              </button>
              {/* ✅ Botón de recarga para debug */}
              <button 
                onClick={() => loadLiquidity()} 
                className={styles.refreshButton}
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                🔄 Recargar
              </button>
            </div>
          </div>
          <div className={styles.dashboardChartContainer}>
            {showChart ? (
              <div className={styles.simpleChartLayout}>
                {renderPieChart(chartSegments)}
              </div>
            ) : showLoading ? (
              <div className={styles.emptyChartState}>
                <div className={styles.emptyChartIcon}>⏳</div>
                <h4>Cargando datos de liquidez...</h4>
                <p>Por favor espera mientras se cargan los datos del gráfico.</p>
                <button 
                  onClick={() => loadLiquidity()} 
                  className={styles.refreshButton}
                  style={{ marginTop: '10px' }}
                >
                  🔄 Reintentar
                </button>
              </div>
            ) : showEmpty ? (
              <div className={styles.emptyChartState}>
                <div className={styles.emptyChartIcon}>📊</div>
                <h4>No hay alertas activas</h4>
                <p>Las alertas aparecerán aquí cuando sean creadas por el administrador.</p>
              </div>
            ) : (
              <div className={styles.emptyChartState}>
                <div className={styles.emptyChartIcon}>❌</div>
                <h4>Error cargando datos</h4>
                <p>No se pudieron cargar los datos de liquidez. Intenta recargar la página.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className={styles.refreshButton}
                  style={{ marginTop: '10px' }}
                >
                  🔄 Recargar página
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comparación con SP500 - MOVIDO AL INICIO DEL DASHBOARD */}

        {/* Actividad Reciente */}
        <div className={styles.activitySection}>
          <div className={styles.activityHeader}>
            <h3>Actividad Reciente</h3>
            <div className={styles.activityActions}>
              <button
                className={styles.viewAllButton}
                onClick={() => setActiveTab('seguimiento')}
              >
                Ver Seguimiento
              </button>
              <button
                className={styles.refreshButton}
                onClick={() => refreshActivity()}
                disabled={refreshingActivity}
              >
                <Activity size={16} />
                {refreshingActivity ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
          <div className={styles.activityList}>
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div key={activity.id || index} className={styles.activityItem}>
                <span className={styles.activityTime}>{activity.timestamp}</span>
                <span className={styles.activityMessage}>{activity.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSeguimientoAlertas = () => {
    // Mostrar TODAS las alertas activas para seguimiento (tanto marcadas como desmarcadas)
    // Los clientes deben poder seguir cualquier alerta que hayan comprado
    // ✅ NUEVO: Incluir alertas descartadas del día actual
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const alertasEnSeguimiento = realAlerts.filter(alert => {
      // ✅ CORREGIDO: Excluir TODAS las alertas que están disponibles para compra (sin importar el tipo)
      // Esas alertas deben aparecer SOLO en "Alertas Vigentes"
      if (alert.status === 'ACTIVE' && alert.availableForPurchase === true) {
        return false;
      }

      // Incluir alertas activas que NO estén marcadas como disponibles para compra
      if (alert.status === 'ACTIVE') {
        return true;
      }

      // Incluir alertas descartadas del día actual
      if (alert.status === 'DESCARTADA' && alert.descartadaAt) {
        const descartadaAt = new Date(alert.descartadaAt);
        return descartadaAt >= startOfDay && descartadaAt <= endOfDay;
      }

      return false;
    });
    
    return (
      <div className={styles.seguimientoContent}>
        <div className={styles.seguimientoHeader}>
          <h2 className={styles.sectionTitle}>🎯 Seguimiento de Alertas</h2>
          <p className={styles.sectionDescription}>
            Todas las alertas activas disponibles para seguimiento
          </p>
          <div className={styles.chartControls}>
            {userRole === 'admin' && (
              <button 
                className={styles.createAlertButton}
                onClick={() => setShowCreateAlert(true)}
                title="Crear nueva alerta"
              >
                + Crear Nueva Alerta
              </button>
            )}
            {/* Filtros - OCULTOS */}
            <div className={styles.filtersContainer} style={{ display: 'none' }}>
              <input
                type="text"
                placeholder="Filtrar por símbolo..."
                value={filterSymbol}
                onChange={(e) => setFilterSymbol(e.target.value)}
                className={styles.filterInput}
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activas</option>
                <option value="CLOSED">Cerradas</option>
                <option value="STOPPED">Detenidas</option>
                <option value="DESESTIMADA">Desestimadas</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={styles.filterDate}
              />
              <button onClick={clearFilters} className={styles.clearFilters}>
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
        
        {loadingAlerts ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Cargando alertas...</p>
          </div>
        ) : alertasEnSeguimiento.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <h3>No hay alertas en seguimiento</h3>
            <p>Las alertas que muevas desde "Alertas Vigentes" aparecerán aquí para su seguimiento.</p>
            {userRole === 'admin' && (
              <button 
                className={styles.createFirstAlertButton}
                onClick={() => setShowCreateAlert(true)}
              >
                + Crear Primera Alerta
              </button>
            )}
          </div>
        ) : (
          <div className={styles.alertsListContainer}>
            {/* Resumen estadístico - OCULTO */}
            <div className={styles.statsSummary} style={{ display: 'none' }}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryIcon}>📊</div>
                <div className={styles.summaryContent}>
                  <span className={styles.summaryLabel}>Total Alertas</span>
                  <span className={styles.summaryValue}>{alertasEnSeguimiento.length}</span>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryIcon}>🟢</div>
                <div className={styles.summaryContent}>
                  <span className={styles.summaryLabel}>En Seguimiento</span>
                  <span className={styles.summaryValue}>{alertasEnSeguimiento.length}</span>
                </div>
              </div>
            </div>
            
            {/* Lista de alertas en seguimiento */}
            <div className={styles.alertsList}>
              {alertasEnSeguimiento.map((alert) => (
                <div key={alert.id} className={`${styles.alertCard} alertCard`}>
                  <div className={styles.alertHeader}>
                    <h3 className={styles.alertSymbol}>{alert.symbol}</h3>
                    <span className={`${styles.alertAction} ${alert.action === 'BUY' ? styles.buyAction : styles.sellAction}`} style={{ display: 'none' }}>
                      {alert.action}
                    </span>
                    <span className={styles.alertStatus}>🟢 ACTIVA</span>
                  </div>
                  
                  <div className={styles.alertDetails}>
                    <div className={styles.alertDetail}>
                      <span>Precio Entrada:</span>
                      <strong className={alert.entryPrice && typeof alert.entryPrice === 'string' && alert.entryPrice.includes(' / ') ? styles.priceRange : ''}>
                        {alert.entryPrice}
                        {alert.entryPrice && typeof alert.entryPrice === 'string' && alert.entryPrice.includes(' / ') && (
                          <span className={styles.rangeIndicator}>RANGO</span>
                        )}
                      </strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>Precio Actual:</span>
                      <strong>{alert.currentPrice}</strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>Stop Loss:</span>
                      <strong>{alert.stopLoss}</strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>Take Profit:</span>
                      <strong>{alert.takeProfit}</strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>P&L:</span>
                      <strong className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profit : styles.loss}>
                        <span>{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '+' : ''}{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0).toFixed(2)}%</span>
                        <span className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profitArrow : styles.lossArrow}>
                          {(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '↗' : '↘'}
                        </span>
                      </strong>
                    </div>
                    {/* ✅ NUEVO: Porcentaje de participación restante */}
                    <div className={styles.alertDetail}>
                      <span>Participación:</span>
                      <strong className={styles.participationPercentage}>
                        {alert.participationPercentage || 100}%
                        {alert.participationPercentage && alert.participationPercentage < 100 && (
                          <span className={styles.partialSaleIndicator} title="Venta parcial realizada">
                            📉
                          </span>
                        )}
                      </strong>
                    </div>
                    {alert.hasSellRange && (
                      <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                        <span>RANGO VENTA:</span>
                        <strong>${alert.sellRangeMin} - ${alert.sellRangeMax}</strong>
                      </div>
                    )}
                    {alert.hasSellPrice && (
                      <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                        <span>PRECIO VENTA:</span>
                        <strong>{alert.sellPrice}</strong>
                      </div>
                    )}
                    <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                      <span>Fecha:</span>
                      <strong>{new Date(alert.date).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Argentina/Buenos_Aires'
                      })}</strong>
                    </div>
                  </div>
                  
                  {alert.analysis && (
                    <div className={styles.alertAnalysis}>
                      <h4>📊 Análisis:</h4>
                      <p>{alert.analysis}</p>
                    </div>
                  )}
                  
                  <div className={styles.alertActions}>
                    {userRole === 'admin' && (
                      <button
                        className={styles.editButton}
                        onClick={() => handleEditAlert(alert)}
                        title="Editar alerta"
                      >
                        ✏️ Editar
                      </button>
                    )}
                    <button
                      className={styles.closeButton}
                      onClick={() => handleClosePosition(alert.id, alert.currentPrice)}
                      disabled={userRole !== 'admin'}
                      title={userRole !== 'admin' ? 'Solo los administradores pueden cerrar posiciones' : 'Cierre total: vender todo y cerrar'}
                      style={{ display: 'none' }}
                    >
                      Cierre total
                    </button>
                    {userRole === 'admin' && (
                      <button
                        className={styles.editButton}
                        onClick={() => handlePartialSale(alert)}
                        title="Venta parcial (25% o 50%)"
                      >
                        💰 Venta Parcial
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
      </div>
    );
  };

  // Funciones auxiliares para el gráfico de torta
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "L", x, y,
      "Z"
    ].join(" ");
  };

  const showTooltip = (event: React.MouseEvent, segment: any) => {
    const liq = (liquidityMap as any)?.[segment.symbol];
    
    // Crear o actualizar tooltip simplificado
    let tooltip = document.getElementById('chartTooltipSimple') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chartTooltipSimple';
      tooltip.className = styles.chartTooltipSimple;
      document.body.appendChild(tooltip);
    }

    // Contenido del tooltip simplificado con P&L
    const percentageText = `${segment.size.toFixed(1)}%`;
    const profitText = segment.symbol !== 'LIQUIDEZ' ? 
      `${segment.profit >= 0 ? '+' : ''}${segment.profit.toFixed(2)}%` : 
      'Disponible';
    
    const profitClass = segment.profit >= 0 ? styles.profitPositive : styles.profitNegative;
    
    tooltip.innerHTML = `
      <div class="${styles.tooltipSimpleSymbol}">${segment.symbol}</div>
      <div class="${styles.tooltipSimpleDivider}"></div>
      <div class="${styles.tooltipSimpleRow}">
        <span class="${styles.tooltipSimpleLabel}">Del gráfico:</span>
        <span class="${styles.tooltipSimpleValue}">${percentageText}</span>
      </div>
      ${segment.symbol !== 'LIQUIDEZ' ? `
        <div class="${styles.tooltipSimpleRow}">
          <span class="${styles.tooltipSimpleLabel}">P&L:</span>
          <span class="${styles.tooltipSimpleValue} ${profitClass}">${profitText}</span>
        </div>
      ` : `
        <div class="${styles.tooltipSimpleRow}">
          <span class="${styles.tooltipSimpleLiquidity}">${profitText}</span>
        </div>
      `}
    `;

    // Posicionar tooltip cerca del cursor
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    tooltip.style.display = 'block';
    tooltip.style.left = `${mouseX + 15}px`;
    tooltip.style.top = `${mouseY + 15}px`;
  };

  const hideTooltip = () => {
    const tooltip1 = document.getElementById('chartTooltip') as HTMLElement;
    const tooltip2 = document.getElementById('chartTooltipDashboard') as HTMLElement;
    const tooltipSimple = document.getElementById('chartTooltipSimple') as HTMLElement;
    if (tooltip1) tooltip1.style.display = 'none';
    if (tooltip2) tooltip2.style.display = 'none';
    if (tooltipSimple) tooltipSimple.style.display = 'none';
  };

  const renderAlertasVigentes = () => {
    // Solo mostrar alertas que están disponibles para compra (manejadas manualmente por el admin)
    const alertasVigentes = realAlerts.filter(alert => 
      alert.status === 'ACTIVE' && alert.availableForPurchase === true
    );
    
    return (
      <div className={styles.vigentesContent}>
        <div className={styles.vigentesHeader}>
          <h2 className={styles.sectionTitle}>Alertas Vigentes</h2>
          <p className={styles.sectionDescription}>
            Alertas disponibles para comprar ahora
          </p>
          <div className={styles.priceUpdateControls}>
            {userRole === 'admin' && (
              <>
                <button 
                  className={styles.createAlertButton}
                  onClick={() => setShowCreateAlert(true)}
                  title="Crear nueva alerta"
                >
                  + Crear Alerta
                </button>
                {/* Botones de testing ocultados temporalmente
                <button 
                  className={styles.testCloseButton}
                  onClick={handleTestMarketClose}
                  title="Probar cierre de mercado (solo desarrollo)"
                >
                  🧪 Probar Cierre
                </button>
                <button 
                  className={styles.testRangeButton}
                  onClick={handleTestRangeConversion}
                  title="Convertir rangos a precios fijos (solo administradores)"
                >
                  🔄 Convertir Rangos
                </button>
                <button 
                  className={styles.testRangeButton}
                  onClick={handleAutoConvertRanges}
                  title="Verificar estado del mercado y convertir rangos automáticamente si está cerrado"
                >
                  🤖 Auto Convertir
                </button>
                <button 
                  className={styles.testRangeButton}
                  onClick={handleTestCronJob}
                  title="Probar el cron job de conversión automática (simula la ejecución automática)"
                >
                  🧪 Probar Cron
                </button>
                */}
              </>
            )}
            <button 
              className={styles.updatePricesButton}
              onClick={() => updatePrices(false)}
              disabled={updatingPrices}
            >
              {updatingPrices ? '🔄 Actualizando...' : '📈 Actualizar Precios'}
            </button>
          </div>
        </div>
        
        {loadingAlerts ? (
          <div className={styles.loadingContainer}>
            <p>Cargando alertas...</p>
          </div>
        ) : alertasVigentes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay alertas vigentes disponibles para compra en este momento.</p>
          </div>
        ) : (
          alertasVigentes.map((alert) => (
            <div key={alert.id} className={`${styles.alertCard} alertCard`}>
              <div className={styles.alertHeader}>
                <h3 className={styles.alertSymbol}>{alert.symbol}</h3>
                <span className={`${styles.alertAction} ${alert.action === 'BUY' ? styles.buyAction : styles.sellAction}`} style={{ display: 'none' }}>
                  {alert.action}
                </span>
              </div>
              
              <div className={styles.alertDetails}>
                <div className={styles.alertDetail} style={{
                  background: 'rgba(55, 65, 81, 0.5)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '0.85em',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600'
                  }}>Precio Entrada:</span>
                  <div style={{ marginTop: '4px' }}>
                    {(alert.tipoAlerta === 'rango' || alert.hasRange) && (alert.precioMinimo && alert.precioMaximo) ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        <span style={{ color: '#60a5fa' }}>$</span>
                        <span className="sensitivePrice">{alert.precioMinimo}</span>
                        <span style={{ color: '#60a5fa' }}>-</span>
                        <span className="sensitivePrice">{alert.precioMaximo}</span>
                      </div>
                    ) : alert.entryPrice && typeof alert.entryPrice === 'string' && alert.entryPrice.includes(' / ') ? (
                      // Si entryPrice viene formateado como rango desde el API
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        <span className="sensitivePrice" style={{
                          fontSize: '1.1em',
                          color: '#f3f4f6'
                        }}>{alert.entryPrice}</span>
                      </div>
                    ) : (
                      <strong className="sensitivePrice" style={{
                        fontSize: '1.1em',
                        color: '#f3f4f6'
                      }}>{alert.entryPrice || '$0.00'}</strong>
                    )}
                  </div>
                </div>
                <div className={styles.alertDetail}>
                  <span>Precio Actual:</span>
                  <strong className="sensitivePrice">{alert.currentPrice}</strong>
                </div>
                <div className={styles.alertDetail}>
                  <span>Stop Loss:</span>
                  <strong className="sensitivePrice">{alert.stopLoss}</strong>
                </div>
                <div className={styles.alertDetail}>
                  <span>Take Profit:</span>
                  <strong className="sensitivePrice">{alert.takeProfit}</strong>
                </div>
                <div className={styles.alertDetail}>
                  <span>P&L:</span>
                  <strong className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profit : styles.loss}>
                    <span>{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '+' : ''}{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0).toFixed(2)}%</span>
                  </strong>
                </div>
              </div>
              
              <div className={styles.alertActions}>
                {userRole === 'admin' && (
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditAlert(alert)}
                    title="Editar alerta"
                  >
                    ✏️ Editar
                  </button>
                )}
                <button
                  className={styles.closeButton}
                  onClick={() => handleClosePosition(alert.id, alert.currentPrice)}
                  disabled={userRole !== 'admin'}
                  title={userRole !== 'admin' ? 'Solo los administradores pueden cerrar posiciones' : 'Cierre total: vender todo y cerrar'}
                  style={{ display: 'none' }}
                >
                  Cierre total
                </button>
                {userRole === 'admin' && (
                  <button
                    className={styles.editButton}
                    onClick={() => handlePartialSale(alert)}
                    title="Venta parcial (25% o 50%)"
                  >
                    💰 Venta Parcial
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderInformes = () => {
    return (
      <div className={styles.informesContent}>
        <div className={styles.informesHeader}>
          <h2 className={styles.sectionTitle}>📊 Informes y Análisis</h2>
          {userRole === 'admin' && (
            <button 
              className={styles.createButton}
              onClick={() => setShowCreateReportModal(true)}
              title="Crear nuevo informe"
            >
              <PlusCircle size={16} />
              Crear Informe
            </button>
          )}
        </div>
        
        {loadingInformes ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⏳</div>
            <h3>Cargando informes...</h3>
          </div>
        ) : informes.length > 0 ? (
          <>
            <div className={styles.informesList}>
              {informes.map((informe: any) => {
                const reportDate = new Date(informe.publishedAt || informe.createdAt);
                const isRecent = (Date.now() - reportDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 días
                // Usar el tiempo de lectura almacenado en la base de datos
                const readTime = informe.readTime || 1;
                
                return (
                  <div key={informe.id || informe._id} className={styles.informeCard}>
                    <div className={styles.informeHeader}>
                      <h3>{informe.title}</h3>
                      {/* Información del informe en lista - OCULTA */}
                      <div className={styles.informeMeta} style={{ display: 'none' }}>
                        <span className={styles.informeDate}>
                          📅 {reportDate.toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                          {isRecent && (
                            <span className={styles.recentBadge}>NUEVO</span>
                          )}
                        </span>
                        <span className={styles.informeType}>
                          {informe.type === 'video' ? '🎥 Video' : 
                           informe.type === 'analisis' ? '📊 Análisis' : 
                           informe.type === 'mixed' ? '📋 Mixto' : '📄 Informe'}
                        </span>
                        {informe.category && (
                          <span className={styles.informeCategory}>
                            📂 {informe.category.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </span>
                        )}
                      </div>
                    </div>
                    

                    
                    <div className={styles.informeDescription}>
                      {informe.content ? 
                        (() => {
                          // Limpiar HTML y obtener solo el texto
                          const cleanText = informe.content
                            .replace(/<[^>]*>/g, '') // Remover todas las etiquetas HTML
                            .replace(/&nbsp;/g, ' ') // Reemplazar espacios no separables
                            .replace(/&amp;/g, '&') // Reemplazar entidades HTML
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .trim();
                          
                          return cleanText.length > 200 ? 
                            cleanText.substring(0, 200) + '...' : 
                            cleanText;
                        })() : 
                        'Sin descripción disponible'
                      }
                    </div>

                    {/* Estadísticas del informe */}
                    <div className={styles.informeStats}>
                      <span className={styles.informeStat}>
                        👁️ {informe.views || 0} vistas
                      </span>
                      {informe.images && informe.images.length > 0 && (
                        <span className={styles.informeStat}>
                          📸 {informe.images.length} imágenes
                        </span>
                      )}
                    </div>

                    {/* Tags del informe */}
                    {informe.tags && informe.tags.length > 0 && (
                      <div className={styles.informeTags}>
                        {informe.tags.slice(0, 3).map((tag: string, index: number) => (
                          <span key={index} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                        {informe.tags.length > 3 && (
                          <span className={styles.tag}>+{informe.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.informeActions}>
                      <button 
                        className={styles.readButton}
                        onClick={() => openReport(informe.id || informe._id)}
                      >
                        📖 Leer Informe Completo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  <span>Mostrando {((currentPage - 1) * informesPerPage) + 1} - {Math.min(currentPage * informesPerPage, totalInformes)} de {totalInformes} informes</span>
                </div>
                <div className={styles.paginationControls}>
                  <button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className={`${styles.paginationButton} ${currentPage === 1 ? styles.disabled : ''}`}
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>
                  
                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      // Asegurar que pageNum esté dentro del rango válido
                      if (pageNum < 1 || pageNum > totalPages) {
                        return null;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`${styles.pageButton} ${currentPage === pageNum ? styles.active : ''}`}
                        >
                          {pageNum}
                        </button>
                      );
                    }).filter(Boolean)}
                  </div>
                  
                  <button 
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`${styles.paginationButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📄</div>
            <h3>No hay informes disponibles</h3>
            <p>Los informes y análisis aparecerán aquí cuando estén disponibles.</p>
          </div>
        )}
      </div>
    );
  };

  // Componente separado para el Chat de Comunidad
  const CommunityChat = () => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      // Hacer scroll solo dentro del contenedor del chat, no de toda la página
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };

    // Función para convertir URLs en enlaces clicables
    const linkifyText = (text: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = text.split(urlRegex);
      
      return parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#4a9eff', 
                textDecoration: 'underline',
                wordBreak: 'break-all'
              }}
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      });
    };

    // Función para borrar mensaje (solo admin)
    const deleteMessage = async (messageId: string) => {
      if (!confirm('¿Estás seguro de eliminar este mensaje?')) return;
      
      try {
        const response = await fetch(`/api/chat/messages?messageId=${messageId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const updatedMessages = messages.filter(m => m._id !== messageId);
          setMessages(updatedMessages);
          
          // Actualizar cache local
          localStorage.setItem('trader-call-chat-messages', JSON.stringify(updatedMessages));
          localStorage.setItem('trader-call-chat-timestamp', Date.now().toString());
        } else {
          alert('Error al eliminar mensaje');
        }
      } catch (error) {
        console.error('Error eliminando mensaje:', error);
        alert('Error al eliminar mensaje');
      }
    };

    // ✅ CORREGIDO: Control más preciso del scroll para evitar múltiples saltos
    const [previousMessageCount, setPreviousMessageCount] = useState(0);
    const [isReady, setIsReady] = useState(false);
    
    useEffect(() => {
      // Solo hacer scroll si se agregó un mensaje nuevo después de la carga inicial
      if (messages.length > previousMessageCount && isReady) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
      setPreviousMessageCount(messages.length);
    }, [messages.length, previousMessageCount, isReady]);

    // ✅ CORREGIDO: Scroll instantáneo al cargar, ANTES de mostrar el contenido
    useEffect(() => {
      if (messages.length > 0 && !loading && !isReady) {
        // Hacer scroll inmediatamente de forma síncrona
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        // Marcar como listo para mostrar
        setIsReady(true);
      }
    }, [messages.length, loading, isReady]);

    // Cargar mensajes existentes al montar el componente
    useEffect(() => {
      fetchMessages();
    }, []);

    const fetchMessages = async () => {
      try {
        // Intentar cargar mensajes desde localStorage primero
        const cachedMessages = localStorage.getItem('trader-call-chat-messages');
        const cacheTimestamp = localStorage.getItem('trader-call-chat-timestamp');
        const now = Date.now();
        
        // Si hay cache y tiene menos de 5 minutos, usarlo
        if (cachedMessages && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 300000) {
          setMessages(JSON.parse(cachedMessages));
          setLoading(false);
          return;
        }

        // Si no hay cache válido, fetch desde API
        const response = await fetch('/api/chat/messages?chatType=trader-call');
        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];
          
          // Guardar en localStorage
          localStorage.setItem('trader-call-chat-messages', JSON.stringify(messages));
          localStorage.setItem('trader-call-chat-timestamp', now.toString());
          
          setMessages(messages);
        }
      } catch (error) {
        console.error('Error cargando mensajes:', error);
        // En caso de error, intentar usar cache aunque sea viejo
        const cachedMessages = localStorage.getItem('trader-call-chat-messages');
        if (cachedMessages) {
          setMessages(JSON.parse(cachedMessages));
        }
      } finally {
        setLoading(false);
      }
    };

    const sendMessage = async () => {
      if (message.trim()) {
        try {
          const messageData: any = {
            message: message.trim(),
            chatType: 'trader-call'
          };

          // Si estamos respondiendo a un mensaje, incluir la referencia
          if (replyingTo) {
            messageData.replyTo = {
              messageId: replyingTo._id || replyingTo.id,
              userName: replyingTo.userName,
              message: replyingTo.message
            };
          }

          const response = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageData),
          });

          if (response.ok) {
            const data = await response.json();
            const updatedMessages = [...messages, data.message];
            setMessages(updatedMessages);
            
            // Actualizar cache local
            localStorage.setItem('trader-call-chat-messages', JSON.stringify(updatedMessages));
            localStorage.setItem('trader-call-chat-timestamp', Date.now().toString());
            
            setMessage('');
            setReplyingTo(null); // Limpiar la respuesta
          } else {
            alert('Error al enviar mensaje');
          }
        } catch (error) {
          console.error('Error enviando mensaje:', error);
          alert('Error al enviar mensaje');
        }
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      } else if (e.key === 'Escape') {
        setReplyingTo(null); // Cancelar respuesta con Escape
      }
    };

    const handleReply = (msg: any) => {
      setReplyingTo(msg);
      // Enfocar el input después de seleccionar respuesta
      setTimeout(() => {
        const input = document.querySelector('.messageInput') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    };

    const cancelReply = () => {
      setReplyingTo(null);
    };

    const formatTime = (timestamp: string) => {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      // Si es hoy, solo mostrar hora
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      // Si es ayer, mostrar "Ayer" + hora
      else if (date.toDateString() === yesterday.toDateString()) {
        return `Ayer ${date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      }
      // Si es más antiguo, mostrar fecha completa + hora
      else {
        return `${date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit'
        })} ${date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      }
    };

    if (loading) {
      return (
        <div className={styles.comunidadContent}>
          <div className={styles.chatContainer}>
            <div className={styles.chatHeader}>
              <div className={styles.chatTitle}>
                <h2>💬 Comunidad Trader Call</h2>
              </div>
            </div>
            <div className={styles.loadingChat}>
              <div className={styles.loadingSpinner}></div>
              <p>Cargando chat...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.comunidadContent}>
        <div className={styles.chatContainer}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>
              <h2>💬 Comunidad Trader Call</h2>
            </div>
          </div>
          
          <div 
            className={styles.chatMainFull} 
            ref={chatContainerRef}
            style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.15s ease-in' }}
          >
            {messages.length === 0 ? (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>💬</div>
                <p>¡Sé el primero en escribir un mensaje!</p>
              </div>
            ) : (
              <div className={styles.messagesContainer}>
                {messages.map((msg, index) => (
                  <div key={msg._id || index} className={styles.chatMessage}>
                    <div className={styles.messageHeader}>
                      <div className={styles.messageUser}>
                        <div className={styles.userAvatar}>
                          <div className={styles.userAvatarPlaceholder}>
                            {msg.userName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        </div>
                        <span className={styles.userName}>{msg.userName || 'Usuario'}</span>
                      </div>
                      <span className={styles.messageTime}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    
                    <div className={styles.messageContent}>
                      {msg.replyTo && (
                        <div className={styles.replyReference}>
                          <div className={styles.replyLine}></div>
                          <div className={styles.replyContent}>
                            <span className={styles.replyUser}>{msg.replyTo.userName}</span>
                            <span className={styles.replyText}>{linkifyText(msg.replyTo.message)}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className={styles.messageText}>{linkifyText(msg.message)}</div>
                    </div>
                    
                    <div className={styles.messageActions}>
                      <button 
                        className={styles.replyButton}
                        onClick={() => handleReply(msg)}
                      >
                        <Reply size={14} />
                        Responder
                      </button>
                      {userRole === 'admin' && (
                        <button 
                          className={styles.deleteButton}
                          onClick={() => deleteMessage(msg._id)}
                          title="Eliminar mensaje"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          <div className={styles.chatInput}>
            {replyingTo && (
              <div className={styles.replyingTo}>
                <div className={styles.replyingHeader}>
                  <span>Respondiendo a {replyingTo.userName}</span>
                  <button onClick={cancelReply} className={styles.cancelReply}>
                    <X size={14} />
                  </button>
                </div>
                <div className={styles.replyingText}>{replyingTo.message}</div>
              </div>
            )}
            
            <div className={styles.inputContainer}>
              <textarea
                className={`${styles.messageInput} messageInput`}
                placeholder="Escribe tu mensaje..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
              />
              <button 
                className={styles.sendButton}
                onClick={sendMessage}
                disabled={!message.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Modal para editar alerta existente
  const renderEditAlertModal = () => {
    if (!showEditAlert) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h3>Editar Alerta - {editingAlert?.symbol}</h3>
            <button
              className={styles.closeModal}
              onClick={() => {
                setShowEditAlert(false);
                setEditingAlert(null);
              }}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.inputGroup}>
              <label>Símbolo de la Acción</label>
              <input
                type="text"
                placeholder="Ej: AAPL, TSLA, MSFT"
                value={editAlert.symbol}
                onChange={(e) => setEditAlert(prev => ({ ...prev, symbol: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Precio Acción</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio acción"
                value={editAlert.entryPrice}
                onChange={(e) => setEditAlert(prev => ({ ...prev, entryPrice: e.target.value }))}
                readOnly={!!editAlert.entryPrice && editAlert.entryPrice !== ''}
                className={styles.input}
                style={{
                  backgroundColor: (!!editAlert.entryPrice && editAlert.entryPrice !== '') ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  cursor: (!!editAlert.entryPrice && editAlert.entryPrice !== '') ? 'not-allowed' : 'text'
                }}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Acción</label>
              <select
                value={editAlert.action}
                onChange={(e) => setEditAlert(prev => ({ ...prev, action: e.target.value }))}
                className={styles.select}
              >
                <option value="BUY">BUY (Compra)</option>
                <option value="SELL">SELL (Venta)</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label>Stop Loss</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de stop loss"
                value={editAlert.stopLoss}
                onChange={(e) => setEditAlert(prev => ({ ...prev, stopLoss: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Take Profit</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de take profit"
                value={editAlert.takeProfit}
                onChange={(e) => setEditAlert(prev => ({ ...prev, takeProfit: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Análisis / Descripción</label>
              <textarea
                placeholder="Descripción del análisis técnico o fundamental..."
                value={editAlert.analysis}
                onChange={(e) => setEditAlert(prev => ({ ...prev, analysis: e.target.value }))}
                className={styles.textarea}
                rows={4}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editAlert.availableForPurchase}
                  onChange={(e) => setEditAlert(prev => ({ ...prev, availableForPurchase: e.target.checked }))}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>
                  🛒 Disponible para compra (aparece en Alertas Vigentes)
                </span>
              </label>
              <p className={styles.checkboxDescription}>
                <strong>Marcado:</strong> La alerta aparece en "Alertas Vigentes" (disponible para nuevos clientes)<br/>
                <strong>Desmarcado:</strong> La alerta se mueve a "Seguimiento" (solo para clientes que ya la compraron)
              </p>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              onClick={() => {
                setShowEditAlert(false);
                setEditingAlert(null);
              }}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEditAlert}
              disabled={editLoading}
              className={styles.createButton}
            >
              {editLoading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderComunidad = () => <CommunityChat />;

  const renderFAQ = () => (
    <div className={styles.faqSection}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>
          Preguntas Frecuentes
        </h2>
        
        <div className={styles.faqContainer}>
          <FAQAccordion 
            faqs={faqs}
            category="trader-call"
            maxItems={20}
          />
        </div>
      </div>
    </div>
  );

  // Modal para crear nueva alerta
  const renderCreateAlertModal = () => {
    if (!showCreateAlert) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h3>Crear Nueva Alerta</h3>
            <button 
              className={styles.closeModal}
              onClick={() => {
                setShowCreateAlert(false);
                setEmailImage(null);
              }}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.inputGroup}>
              <label>Símbolo de la Acción</label>
              <div className={styles.symbolInput}>
                <input
                  type="text"
                  placeholder="Ej: AAPL, TSLA, MSFT"
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, symbol: e.target.value }))}
                  className={styles.input}
                />
                <button
                  onClick={() => fetchStockPrice(newAlert.symbol)}
                  disabled={!newAlert.symbol || priceLoading}
                  className={styles.getPriceButton}
                >
                  {priceLoading ? 'Cargando...' : 'Obtener Precio'}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Precio Acción</label>
              <div className={styles.priceInputContainer}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Precio acción"
                  value={stockPrice || ''}
                  onChange={(e) => setStockPrice(parseFloat(e.target.value) || null)}
                  readOnly={!!stockPrice && stockPrice !== null}
                  className={styles.input}
                  style={{
                    backgroundColor: (!!stockPrice && stockPrice !== null) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    cursor: (!!stockPrice && stockPrice !== null) ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            </div>

            {/* Campo Acción - OCULTO - Siempre BUY */}
            <div className={styles.inputGroup} style={{ display: 'none' }}>
              <label>Acción</label>
              <select
                value={newAlert.action}
                onChange={(e) => setNewAlert(prev => ({ ...prev, action: e.target.value }))}
                className={styles.select}
              >
                <option value="BUY">BUY (Compra)</option>
                <option value="SELL">SELL (Venta)</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label>Tipo de Alerta</label>
              <select
                value={newAlert.tipoAlerta}
                onChange={(e) => setNewAlert(prev => ({ ...prev, tipoAlerta: e.target.value as 'precio' | 'rango' }))}
                className={`${styles.select} ${newAlert.tipoAlerta === 'rango' ? styles.rangeSelect : ''}`}
              >
                <option value="precio">💰 Precio Específico</option>
                <option value="rango">📊 Rango de Precio</option>
              </select>
            </div>

            {newAlert.tipoAlerta === 'rango' && (
              <>
                <div className={styles.inputGroup}>
                  <label>Precio Mínimo del Rango</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio mínimo"
                    value={newAlert.precioMinimo}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, precioMinimo: e.target.value }))}
                    className={styles.input}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Precio Máximo del Rango</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio máximo"
                    value={newAlert.precioMaximo}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, precioMaximo: e.target.value }))}
                    className={styles.input}
                  />
                </div>

                {/* Campo Horario de Cierre - OCULTO */}
                <div className={styles.inputGroup} style={{ display: 'none' }}>
                  <label>Horario de Cierre del Mercado</label>
                  <input
                    type="time"
                    value={newAlert.horarioCierre}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, horarioCierre: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </>
            )}

            <div className={styles.inputGroup}>
              <label>Stop Loss</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de stop loss"
                value={newAlert.stopLoss}
                onChange={(e) => setNewAlert(prev => ({ ...prev, stopLoss: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Take Profit</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de take profit"
                value={newAlert.takeProfit}
                onChange={(e) => setNewAlert(prev => ({ ...prev, takeProfit: e.target.value }))}
                className={styles.input}
              />
            </div>

            {/* Campo Análisis - OCULTO */}
            <div className={styles.inputGroup} style={{ display: 'none' }}>
              <label>Análisis / Descripción</label>
              <textarea
                placeholder="Descripción del análisis técnico o fundamental..."
                value={newAlert.analysis}
                onChange={(e) => setNewAlert(prev => ({ ...prev, analysis: e.target.value }))}
                className={styles.textarea}
                rows={4}
              />
            </div>

            {/* Selector de Liquidez - Solo para administradores */}
            {userRole === 'admin' && (
              <div className={styles.inputGroup}>
                <label>💰 Asignar Liquidez</label>
                <p className={styles.liquidityDescription}>
                  Tienes <strong>${liquidityTotal.toFixed(2)}</strong> de liquidez disponible
                </p>
                <div className={styles.liquiditySelector}>
                  {[0, 5, 10, 15, 20].map((percentage) => (
                    <button
                      key={percentage}
                      type="button"
                      className={`${styles.liquidityButton} ${newAlert.liquidityPercentage === percentage ? styles.liquidityButtonActive : ''}`}
                      onClick={() => setNewAlert(prev => ({ ...prev, liquidityPercentage: percentage }))}
                    >
                      <span className={styles.liquidityPercentage}>{percentage}%</span>
                      <span className={styles.liquidityAmount}>
                        ${((liquidityTotal * percentage) / 100).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
                {newAlert.liquidityPercentage > 0 && (
                  <div className={styles.liquidityPreview}>
                    💡 Se asignarán <strong>${((liquidityTotal * newAlert.liquidityPercentage) / 100).toFixed(2)}</strong> ({newAlert.liquidityPercentage}% del total)
                  </div>
                )}
              </div>
            )}

            <div className={styles.inputGroup}>
              <label>Mensaje personalizado para Email (opcional)</label>
              <textarea
                placeholder="Texto que verán los suscriptores en el correo"
                value={newAlert.emailMessage}
                onChange={(e) => setNewAlert(prev => ({ ...prev, emailMessage: e.target.value }))}
                className={styles.textarea}
                rows={3}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Imagen para Email (opcional)</label>
              {emailImage ? (
                <div className={styles.uploadedImageContainer}>
                  <img 
                    src={emailImage.secure_url} 
                    alt="Imagen de email" 
                    className={styles.uploadedImagePreview}
                  />
                  <button
                    type="button"
                    onClick={removeEmailImage}
                    className={styles.removeImageButton}
                    title="Eliminar imagen"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <ImageUploader
                  onImageUploaded={handleImageUploaded}
                  onUploadStart={handleImageUploadStart}
                  onError={handleImageUploadError}
                  maxFiles={1}
                  maxSizeBytes={5 * 1024 * 1024} // 5MB
                  allowedFormats={['jpeg', 'jpg', 'png', 'gif', 'webp']}
                  buttonText="Subir Imagen para Email"
                  className={styles.emailImageUploader}
                />
              )}
              <p className={styles.helpText}>
                Si no se sube imagen, se usará la imagen del gráfico automáticamente
              </p>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button 
              onClick={() => {
                setShowCreateAlert(false);
                setEmailImage(null);
              }}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreateAlert}
              disabled={!newAlert.symbol || !stockPrice || loading}
              className={styles.createButton}
            >
              {loading ? 'Creando...' : 'Crear Alerta'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.subscriberView}>
      {/* Header de Bienvenida Personalizado */}
      <div className={styles.welcomeHeader}>
        <div className={styles.welcomeContent}>
          <h1 className={styles.welcomeTitle}>
            Hola {session?.user?.name || 'Nahuel'}! Ésta es tu área exclusiva de Trader Call
          </h1>
          <p className={styles.welcomeSubtitle}>
            Aquí tienes acceso completo a todas las alertas y recursos
          </p>
        </div>
      </div>

      {/* Navegación Móvil (Tabs) */}
      <div className={styles.mobileTabs}>
        <button
          className={`${styles.mobileTab} ${activeTab === 'dashboard' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'seguimiento' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('seguimiento')}
        >
          Seguimiento
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'vigentes' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('vigentes')}
        >
          Alertas
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'informes' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('informes')}
        >
          Informes
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'comunidad' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('comunidad')}
        >
          Consultas
        </button>
      </div>

      {/* Layout Principal con Sidebar */}
      <div className={styles.mainLayout}>
        {/* Sidebar de Accesos Rápidos */}
        <aside className={styles.sidebar}>
          <nav className={styles.sidebarNav}>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'dashboard' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 size={20} />
              Dashboard
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'seguimiento' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('seguimiento')}
            >
              <Activity size={20} />
              Seguimiento
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'operaciones' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('operaciones')}
            >
              <TrendingUp size={20} />
              Operaciones
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'vigentes' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('vigentes')}
            >
              <Bell size={20} />
              Alertas Vigentes
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'informes' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('informes')}
            >
              <Download size={20} />
              Informes
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'comunidad' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('comunidad')}
            >
              <MessageCircle size={20} />
              Consultas
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'faq' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              <MessageCircle size={20} />
              Preguntas frecuentes
            </button>
          </nav>

          {/* Accesos Rápidos */}
          <div className={styles.quickAccess}>
            <h3 className={styles.quickAccessTitle}>Accesos Rápidos</h3>
            <div className={styles.quickAccessLinks}>
              <Link href="/entrenamientos" className={styles.quickLink}>
                <TrendingUp size={16} />
                Entrenamientos
              </Link>
              <Link href="/asesorias" className={styles.quickLink}>
                <Users size={16} />
                Asesorías
              </Link>
              <Link href="/recursos" className={styles.quickLink}>
                <Download size={16} />
                Recursos
              </Link>
            </div>
          </div>
        </aside>

        {/* Contenido Principal */}
        <main className={styles.mainContent}>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'seguimiento' && renderSeguimientoAlertas()}
          {activeTab === 'operaciones' && (
            <div className="p-6">
              <OperationsTable system="TraderCall" />
            </div>
          )}
          {activeTab === 'vigentes' && renderAlertasVigentes()}
          {activeTab === 'informes' && renderInformes()}
          {activeTab === 'comunidad' && renderComunidad()}
          {activeTab === 'faq' && renderFAQ()}
        </main>
      </div>

      {/* Modales */}
      {renderCreateAlertModal()}
      {renderEditAlertModal()}
      {/* Modal de confirmación de cierre */}
      {confirmClose.open && (
        <div className={styles.modalOverlay} onClick={() => setConfirmClose({ open: false })}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <h3>Confirmar cierre</h3>
              <button className={styles.closeModalButton} onClick={() => setConfirmClose({ open: false })}>×</button>
            </div>
            <div className={styles.imageModalContent}>
              <p>¿Estás seguro de cerrar esta posición? Se venderá todo y la alerta pasará a cerrada.</p>
              <div className={styles.inputGroup}>
                <label>Mensaje para Email (opcional)</label>
                <textarea className={styles.textarea} rows={3} placeholder="Texto a incluir en el email" value={closeEmailMessage} onChange={(e) => setCloseEmailMessage(e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label>Imagen para Email (opcional)</label>
                <div className={styles.imageUploadContainer}>
                  {/* Input de archivo */}
                  <div className={styles.fileInputWrapper}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange}
                      className={styles.fileInput}
                      id="closeEmailImageFile"
                    />
                    <label htmlFor="closeEmailImageFile" className={styles.fileInputLabel}>
                      📁 Seleccionar imagen
                    </label>
                  </div>
                  
                  {/* O separador */}
                  <div className={styles.orSeparator}>O</div>
                  
                  {/* Input de URL */}
                  <input 
                    className={styles.input} 
                    type="text" 
                    placeholder="https://..." 
                    value={closeEmailImageUrl} 
                    onChange={(e) => {
                      setCloseEmailImageUrl(e.target.value);
                      // Limpiar archivo si se ingresa URL
                      if (e.target.value) {
                        setCloseEmailImageFile(null);
                        setCloseEmailImagePreview('');
                      }
                    }} 
                  />
                  
                  {/* Preview de imagen */}
                  {closeEmailImagePreview && (
                    <div className={styles.imagePreview}>
                      <img src={closeEmailImagePreview} alt="Preview" className={styles.previewImage} />
                      <button 
                        type="button"
                        className={styles.removeImageButton}
                        onClick={() => {
                          setCloseEmailImageFile(null);
                          setCloseEmailImagePreview('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {/* Preview de URL */}
                  {closeEmailImageUrl && !closeEmailImagePreview && (
                    <div className={styles.urlPreview}>
                      <span className={styles.urlText}>URL: {closeEmailImageUrl}</span>
                      <button 
                        type="button"
                        className={styles.removeUrlButton}
                        onClick={() => setCloseEmailImageUrl('')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.clearFilters} onClick={() => setConfirmClose({ open: false })}>Cancelar</button>
              <button 
                className={styles.closeButton} 
                onClick={confirmCloseAction}
                disabled={uploadingCloseImage}
              >
                {uploadingCloseImage ? '⏳ Subiendo imagen...' : 'Cerrar posición'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateReportModal && (
        <CreateReportModal 
          onClose={() => setShowCreateReportModal(false)}
          onSubmit={handleCreateReport}
          loading={creatingReport}
        />
      )}
      {showReportModal && selectedReport && (
        <ReportViewModal 
          report={selectedReport}
          onClose={closeReportModal}
        />
      )}

      {/* Modales de Imágenes */}
      {showImageModal && selectedImage && (
        <div className={styles.modalOverlay} onClick={closeImageModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <h3>Gráfico de TradingView</h3>
              <button className={styles.closeModalButton} onClick={closeImageModal}>
                ×
              </button>
            </div>
            <div className={styles.imageModalContent}>
              <img 
                src={selectedImage.secure_url} 
                alt="Gráfico de TradingView"
                className={styles.modalImage}
              />
              <div className={styles.imageInfo}>
                <span>{selectedImage.width} × {selectedImage.height}</span>
                <span>{Math.round(selectedImage.bytes / 1024)}KB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdditionalImagesModal && selectedAlertImages.length > 0 && (
        <div className={styles.modalOverlay} onClick={closeAdditionalImagesModal}>
          <div className={styles.additionalImagesModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <h3>Imágenes Adicionales ({selectedAlertImages.length})</h3>
              <button className={styles.closeModalButton} onClick={closeAdditionalImagesModal}>
                ×
              </button>
            </div>
            <div className={styles.additionalImagesContent}>
              {selectedAlertImages.map((image, index) => (
                <div key={image.public_id} className={styles.additionalImageItem}>
                  <img 
                    src={image.secure_url} 
                    alt={`Imagen adicional ${index + 1}`}
                    className={styles.additionalImage}
                  />
                  {image.caption && (
                    <p className={styles.imageCaption}>{image.caption}</p>
                  )}
                  <div className={styles.imageInfo}>
                    <span>{image.width} × {image.height}</span>
                    <span>{Math.round(image.bytes / 1024)}KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Modal de venta con rango de precios */}
      {showPartialSaleModal && partialSaleAlert && (
        <div className={styles.modalOverlay} onClick={() => setShowPartialSaleModal(false)}>
          <div className={styles.partialSaleModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>💰 Vender - {partialSaleAlert.symbol}</h3>
              <button 
                className={styles.closeModal}
                onClick={() => setShowPartialSaleModal(false)}
                disabled={partialSaleLoading}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.alertInfo}>
                <p><strong>Precio acción:</strong> {partialSaleAlert.entryPrice}</p>
                <p><strong>Precio actual:</strong> {partialSaleAlert.currentPrice}</p>
                <p><strong>P&L actual:</strong> <span className={partialSaleAlert.profit >= 0 ? styles.profit : styles.loss}>{partialSaleAlert.profit >= 0 ? '+' : ''}{partialSaleAlert.profit?.toFixed(2)}%</span></p>
              </div>

              {/* ✅ NUEVO: Campo de porcentaje personalizable */}
              <div className={styles.inputGroup}>
                <label>Porcentaje a vender</label>
                <div className={styles.percentageInputContainer}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sellPercentage}
                    onChange={(e) => setSellPercentage(parseInt(e.target.value) || 0)}
                    className={styles.percentageInput}
                    placeholder="50"
                  />
                  <span className={styles.percentageSymbol}>%</span>
                </div>
                <p className={styles.inputDescription}>
                  Porcentaje de tus acciones actuales que deseas vender
                </p>
              </div>

              {/* ✅ NUEVO: Rango de precios */}
              <div className={styles.inputGroup}>
                <label>Rango de precios de venta</label>
                <div className={styles.priceRangeContainer}>
                  <div className={styles.priceInputWrapper}>
                    <label className={styles.priceLabel}>Precio mínimo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPriceMin}
                      onChange={(e) => setSellPriceMin(e.target.value)}
                      className={styles.priceInput}
                      placeholder="0.00"
                    />
                  </div>
                  <div className={styles.priceRangeSeparator}>a</div>
                  <div className={styles.priceInputWrapper}>
                    <label className={styles.priceLabel}>Precio máximo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPriceMax}
                      onChange={(e) => setSellPriceMax(e.target.value)}
                      className={styles.priceInput}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className={styles.inputDescription}>
                  Define el rango de precios en el que deseas vender
                </p>
              </div>

              {/* ✅ NUEVO: Mensaje opcional para email */}
              <div className={styles.inputGroup}>
                <label>Mensaje de email (opcional)</label>
                <textarea 
                  className={styles.textarea} 
                  rows={3} 
                  placeholder="Mensaje personalizado para incluir en la notificación" 
                  value={sellEmailMessage} 
                  onChange={(e) => setSellEmailMessage(e.target.value)} 
                />
              </div>

              {/* ✅ NUEVO: Imagen opcional para email */}
              <div className={styles.inputGroup}>
                <label>Imagen para Email (opcional)</label>
                <div className={styles.imageUploadContainer}>
                  {/* Input de archivo */}
                  <div className={styles.fileInputWrapper}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSellImageFileChange}
                      className={styles.fileInput}
                      id="sellEmailImageFile"
                    />
                    <label htmlFor="sellEmailImageFile" className={styles.fileInputLabel}>
                      📁 Seleccionar imagen
                    </label>
                  </div>
                  
                  {/* O separador */}
                  <div className={styles.orSeparator}>O</div>
                  
                  {/* Input de URL */}
                  <input 
                    className={styles.input} 
                    type="text" 
                    placeholder="https://..." 
                    value={sellEmailImageUrl} 
                    onChange={(e) => {
                      setSellEmailImageUrl(e.target.value);
                      // Limpiar archivo si se ingresa URL
                      if (e.target.value) {
                        setSellEmailImageFile(null);
                        setSellEmailImagePreview('');
                      }
                    }} 
                  />
                  
                  {/* Preview de imagen */}
                  {sellEmailImagePreview && (
                    <div className={styles.imagePreview}>
                      <img src={sellEmailImagePreview} alt="Preview" className={styles.previewImage} />
                  <button
                        type="button"
                        className={styles.removeImageButton}
                        onClick={() => {
                          setSellEmailImageFile(null);
                          setSellEmailImagePreview('');
                        }}
                      >
                        ✕
                  </button>
                    </div>
                  )}
                  
                  {/* Preview de URL */}
                  {sellEmailImageUrl && !sellEmailImagePreview && (
                    <div className={styles.urlPreview}>
                      <span className={styles.urlText}>URL: {sellEmailImageUrl}</span>
                  <button
                        type="button"
                        className={styles.removeUrlButton}
                        onClick={() => setSellEmailImageUrl('')}
                      >
                        ✕
                  </button>
                </div>
                  )}
                </div>
              </div>

              {/* ✅ NUEVO: Botón de venta */}
              <div className={styles.modalActions}>
                <button 
                  className={styles.clearFilters} 
                  onClick={() => setShowPartialSaleModal(false)} 
                  disabled={partialSaleLoading}
                >
                  Cancelar
                </button>
                <button 
                  className={styles.closeButton} 
                  onClick={executeSellWithRange}
                  disabled={partialSaleLoading || uploadingSellImage}
                >
                  {partialSaleLoading ? '⏳ Procesando...' : uploadingSellImage ? '⏳ Subiendo imagen...' : 'Vender'}
                </button>
              </div>

              {partialSaleLoading && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Procesando venta...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip para el gráfico de torta */}
      <div id="chartTooltipDashboard" className={styles.chartTooltip} style={{ display: 'none' }}>
        <div className={styles.tooltipSymbol}></div>
        <div className={styles.tooltipAction}></div>
        <div className={styles.tooltipEntry}></div>
        <div className={styles.tooltipCurrent}></div>
        <div className={styles.tooltipPnl}></div>
        <div className={styles.tooltipStatus}></div>
        <div className={styles.tooltipLiquidity}></div>
        <div className={styles.tooltipShares}></div>
        <div className={styles.tooltipRealized}></div>
      </div>
    </div>
  );
};

// Componente para modal de visualización de informes mejorado
const ReportViewModal = ({ report, onClose }: {
  report: any;
  onClose: () => void;
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [stickyImage, setStickyImage] = useState<any>(null);
  const [showStickyModal, setShowStickyModal] = useState(false);

  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleImageSticky = (image: any, index: number) => {
    setStickyImage({ ...image, index });
  };

  const closeStickyImage = () => {
    setStickyImage(null);
  };

  const openStickyModal = () => {
    if (stickyImage) {
      setCurrentImageIndex(stickyImage.index);
      setShowStickyModal(true);
    }
  };

  const closeStickyModal = () => {
    setShowStickyModal(false);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const nextImage = () => {
    if (report.images && report.images.length > 0 && currentImageIndex < report.images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      resetZoom();
    }
  };

  const prevImage = () => {
    if (report.images && report.images.length > 0 && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      resetZoom();
    }
  };

  // Navegación con teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!showImageModal) return;
      
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'Escape') {
        closeImageModal();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showImageModal, currentImageIndex, report.images]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return '🎥';
      case 'analisis':
        return '📊';
      case 'mixed':
        return '📋';
      default:
        return '📄';
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'analisis':
        return 'Análisis';
      case 'mixed':
        return 'Mixto';
      default:
        return 'Informe';
    }
  };

  // Funciones de descarga y compartir ELIMINADAS POR SEGURIDAD
  // Los botones de descargar y compartir han sido removidos para prevenir filtración de información



  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.reportViewModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>
              <h2>{report.title}</h2>
              {/* Información del informe - OCULTA */}
              <div className={styles.reportMeta} style={{ display: 'none' }}>
                <span className={styles.reportDate}>
                  📅 {formatDate(report.publishedAt || report.createdAt)}
                </span>
                <span className={styles.reportType}>
                  {getReportTypeIcon(report.type)} {getReportTypeLabel(report.type)}
                </span>
                {report.author && (
                  <span className={styles.reportAuthor}>
                    👤 {typeof report.author === 'object' ? report.author.name || report.author.email : report.author}
                  </span>
                )}
                {report.category && (
                  <span className={styles.reportType}>
                    📂 {report.category.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                )}
              </div>
            </div>
            <button 
              className={styles.closeModal}
              onClick={onClose}
              aria-label="Cerrar modal"
            >
              ×
            </button>
          </div>

          <div className={styles.reportContent}>
            {/* Imagen de portada */}
            {report.coverImage && (
              <div className={styles.reportCover}>
                <img 
                  src={report.coverImage.secure_url || report.coverImage.url} 
                  alt={report.title}
                  className={styles.coverImage}
                  loading="lazy"
                />
              </div>
            )}

            {/* Contenido del informe */}
            <div className={styles.reportText}>
              <div 
                className={styles.reportBody}
                dangerouslySetInnerHTML={{ __html: report.content }}
              />
            </div>

            {/* Imágenes adicionales */}
            {report.images && report.images.length > 0 && (
              <div className={styles.reportImages}>
                <h3>📸 Imágenes del Informe ({report.images.length})</h3>
                <div className={styles.imagesGrid}>
                  {report.images.map((image: any, index: number) => (
                    <div 
                      key={image.public_id} 
                      className={styles.imageThumbnail}
                    >
                      <div className={styles.imageContainer}>
                        <img 
                          src={image.secure_url || image.url} 
                          alt={image.caption || `Imagen ${index + 1}`}
                          loading="lazy"
                          onClick={() => handleImageClick(index)}
                        />
                        <div className={styles.imageActions}>
                          <button 
                            className={styles.stickyButton}
                            onClick={() => handleImageSticky(image, index)}
                            title="Hacer sticky"
                          >
                            📌
                          </button>
                          <button 
                            className={styles.viewButton}
                            onClick={() => handleImageClick(index)}
                            title="Ver en grande"
                          >
                            👁️
                          </button>
                        </div>
                      </div>
                      {image.caption && (
                        <div className={styles.imageCaption}>
                          {image.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}



            {/* Estadísticas del informe */}
            <div className={styles.reportStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>👁️ Vistas</span>
                <span className={styles.statValue}>{report.views || 0}</span>
              </div>

              {report.images && report.images.length > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>📸 Imágenes</span>
                  <span className={styles.statValue}>{report.images.length}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            {/* Botones de descarga y compartir ELIMINADOS POR SEGURIDAD */}
            {/* Los botones de descargar y compartir han sido removidos para prevenir filtración de información */}
          </div>
        </div>
      </div>

      {/* Modal para imágenes */}
      {showImageModal && report.images && report.images.length > 0 && (
        <div className={styles.imageModalOverlay} onClick={closeImageModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeImageModal} 
              onClick={closeImageModal}
              aria-label="Cerrar modal de imagen"
            >
              ×
            </button>
            
            {/* Controles de zoom */}
            <div className={styles.zoomControls}>
              <button 
                className={styles.zoomButton} 
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                aria-label="Alejar"
              >
                −
              </button>
              <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
              <button 
                className={styles.zoomButton} 
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                aria-label="Acercar"
              >
                +
              </button>
              <button 
                className={styles.zoomButton} 
                onClick={resetZoom}
                aria-label="Resetear zoom"
              >
                ⌂
              </button>
            </div>

            <div 
              className={styles.imageModalContent}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={prevImage}
                  disabled={currentImageIndex === 0}
                  aria-label="Imagen anterior"
                >
                  ‹
                </button>
              )}
              <div 
                className={styles.zoomableImageContainer}
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center'
                }}
              >
                <img 
                  src={report.images[currentImageIndex].secure_url || report.images[currentImageIndex].url}
                  alt={report.images[currentImageIndex].caption || `Imagen ${currentImageIndex + 1}`}
                  className={styles.modalImage}
                  loading="lazy"
                  draggable={false}
                />
              </div>
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={nextImage}
                  disabled={currentImageIndex === report.images.length - 1}
                  aria-label="Imagen siguiente"
                >
                  ›
                </button>
              )}
            </div>
            <div className={styles.imageModalInfo}>
              <span className={styles.imageCounter}>
                {currentImageIndex + 1} de {report.images.length}
              </span>
              {report.images[currentImageIndex].caption && (
                <span className={styles.imageCaption}>
                  {report.images[currentImageIndex].caption}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Imagen Sticky Flotante */}
      {stickyImage && (
        <div className={styles.stickyImageContainer}>
          <div className={styles.stickyImage} onClick={openStickyModal}>
            <img 
              src={stickyImage.secure_url || stickyImage.url}
              alt={stickyImage.caption || `Imagen ${stickyImage.index + 1}`}
            />
            <div className={styles.stickyImageTitle}>
              {stickyImage.caption || `Imagen ${stickyImage.index + 1}`}
            </div>
            <button 
              className={styles.closeStickyButton}
              onClick={closeStickyImage}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Modal para imagen sticky */}
      {showStickyModal && report.images && report.images.length > 0 && (
        <div className={styles.imageModalOverlay} onClick={closeStickyModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeImageModal} 
              onClick={closeStickyModal}
              aria-label="Cerrar modal de imagen"
            >
              ×
            </button>
            
            {/* Controles de zoom */}
            <div className={styles.zoomControls}>
              <button 
                className={styles.zoomButton} 
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                aria-label="Alejar"
              >
                −
              </button>
              <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
              <button 
                className={styles.zoomButton} 
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                aria-label="Acercar"
              >
                +
              </button>
              <button 
                className={styles.zoomButton} 
                onClick={resetZoom}
                aria-label="Resetear zoom"
              >
                ⌂
              </button>
            </div>

            <div 
              className={styles.imageModalContent}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={prevImage}
                  disabled={currentImageIndex === 0}
                  aria-label="Imagen anterior"
                >
                  ‹
                </button>
              )}
              <div 
                className={styles.zoomableImageContainer}
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center'
                }}
              >
                <img 
                  src={report.images[currentImageIndex].secure_url || report.images[currentImageIndex].url}
                  alt={report.images[currentImageIndex].caption || `Imagen ${currentImageIndex + 1}`}
                  className={styles.modalImage}
                  loading="lazy"
                  draggable={false}
                />
              </div>
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={nextImage}
                  disabled={currentImageIndex === report.images.length - 1}
                  aria-label="Imagen siguiente"
                >
                  ›
                </button>
              )}
            </div>
            <div className={styles.imageModalInfo}>
              <span className={styles.imageCounter}>
                {currentImageIndex + 1} de {report.images.length}
              </span>
              {report.images[currentImageIndex].caption && (
                <span className={styles.imageCaption}>
                  {report.images[currentImageIndex].caption}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Componente para modal de creación de informes
const CreateReportModal = ({ onClose, onSubmit, loading }: {
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) => {
  const [formData, setFormData] = useState({
    title: '',
    type: 'text',
    category: 'trader-call',
    content: '',
    isFeature: false,
    publishedAt: new Date().toISOString().split('T')[0],
    status: 'published'
  });

  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);


  // Debug: monitorear cambios en formData
  React.useEffect(() => {
    console.log('📊 [FORM] Estado actual del formulario:', {
      title: formData.title,
      type: formData.type,
      category: formData.category,
      hasContent: !!formData.content
    });
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Título y contenido son obligatorios');
      return;
    }

    // Preparar datos con imágenes de Cloudinary
    const submitData = {
      ...formData,
      publishedAt: new Date(formData.publishedAt),
      images: images
    };

    // Debug: mostrar qué datos se están enviando
    console.log('🔍 [FORM] Datos a enviar:', {
      title: submitData.title,
      type: submitData.type,
      category: submitData.category,
      content: submitData.content?.substring(0, 100) + '...',
      hasImages: submitData.images?.length || 0
    });
    
    onSubmit(submitData);
  };

  const handleInputChange = (field: string, value: string) => {
    console.log(`🔄 [FORM] Cambiando campo '${field}' de '${formData[field as keyof typeof formData]}' a '${value}'`);
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };




  const handleImageUploaded = (image: CloudinaryImage) => {
    setImages(prev => [...prev, image]);
    setUploadingImages(false);  // Asegurar que se actualice el estado
    console.log('✅ Imagen adicional agregada:', image.public_id);
  };



  const removeImage = (publicId: string) => {
    setImages(prev => prev.filter(img => img.public_id !== publicId));
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.createReportModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Crear Nuevo Informe Trader Call</h2>
          <button 
            className={styles.closeModal}
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.createReportForm}>
          {/* Campos del formulario - VISIBLES */}
          <div className={styles.formSection}>
            <div className={styles.formGroup}>
              <label htmlFor="title">Título *</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Título del informe Trader Call"
                required
                disabled={loading}
              />
            </div>

            {/* Campo Tipo - OCULTO */}
            <div className={styles.formGroup} style={{ display: 'none' }}>
              <label htmlFor="type">Tipo</label>
              <input
                id="type"
                type="text"
                value={formData.type}
                onChange={(e) => {
                  console.log('🎯 [INPUT] Cambio detectado en tipo:', e.target.value);
                  handleInputChange('type', e.target.value);
                }}
                placeholder="Ej: Texto, Video, Mixto, Análisis, Reporte..."
                disabled={loading}
                style={{ 
                  cursor: 'text',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  width: '100%'
                }}
              />
              {/* Debug: mostrar el valor actual */}
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#94a3b8', 
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                🔍 Valor actual del tipo: <strong>{formData.type}</strong>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="publishedAt">Fecha de Publicación</label>
                <input
                  id="publishedAt"
                  type="date"
                  value={formData.publishedAt}
                  onChange={(e) => handleInputChange('publishedAt', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="content">Contenido Principal del Informe *</label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Contenido principal del informe"
                rows={6}
                required
                disabled={loading}
              />
            </div>

            {/* Imágenes adicionales */}
            <div className={styles.formGroup}>
              <label>Imágenes Adicionales</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Imágenes que se mostrarán dentro del contenido del informe
              </p>
              
              <ImageUploader
                onImageUploaded={handleImageUploaded}
                onUploadStart={() => setUploadingImages(true)}
                onUploadProgress={() => {}}
                onError={(error) => {
                  console.error('Error subiendo imagen adicional:', error);
                  alert('Error subiendo imagen: ' + error);
                  setUploadingImages(false);
                }}
                maxFiles={5}
                multiple={true}
                buttonText="Subir Imágenes Adicionales"
                className={styles.additionalImagesUploader}
              />

              {/* Preview de imágenes adicionales */}
              {images.length > 0 && (
                <div className={styles.additionalImagesPreview}>
                  <h4>Imágenes Adicionales ({images.length}/5)</h4>
                  <div className={styles.imagesGrid}>
                    {images.map((image, index) => (
                      <div key={image.public_id} className={styles.imagePreviewItem}>
                        <img 
                          src={image.secure_url} 
                          alt={`Imagen adicional ${index + 1}`}
                          className={styles.previewThumbnail}
                        />
                        <div className={styles.imagePreviewActions}>
                          <button 
                            type="button" 
                            onClick={() => removeImage(image.public_id)}
                            className={styles.removeImageButton}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>


          <div className={styles.formActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
                          <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading || uploadingImages}
              >
                {loading ? 'Creando...' : uploadingImages ? 'Subiendo...' : 'Crear Informe'}
              </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TraderCallPage: React.FC<TraderCallPageProps> = ({ 
  isSubscribed, 
  metrics, 
  historicalAlerts,
  alertExamples,
  faqs,
  traderHeroVideo
}) => {
  return (
    <>
      <Head>
        <title>Trader Call - Alertas de Trading en Tiempo Real | Nahuel Lozano</title>
        <meta name="description" content="Recibe alertas de trading profesionales en tiempo real con análisis técnico avanzado. Señales precisas de compra y venta para maximizar tus ganancias." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />
      
      <main className={styles.main}>
        {isSubscribed ? (
          <ScreenshotProtection>
            <SubscriberView faqs={faqs} />
          </ScreenshotProtection>
        ) : (
          <NonSubscriberView 
            metrics={metrics} 
            historicalAlerts={historicalAlerts}
            alertExamples={alertExamples}
            faqs={faqs}
            traderHeroVideo={traderHeroVideo}
          />
        )}
      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Verificar autenticación y suscripción
  let isSubscribed = false;
  
  try {
    // Importar dinámicamente para evitar errores de SSR
    const { getSession } = await import('next-auth/react');
    const dbConnect = (await import('@/lib/mongodb')).default;
    const User = (await import('@/models/User')).default;

    const session = await getSession(context);
    
    if (session?.user?.email) {
      await dbConnect();
      const user = await User.findOne({ email: session.user.email });
      
      if (user) {
        // Verificar si tiene suscripción activa a TraderCall
        const suscripcionActiva = user.suscripciones?.find(
          (sub: any) => 
            sub.servicio === 'TraderCall' && 
            sub.activa === true && 
            new Date(sub.fechaVencimiento) > new Date()
        );
        
        // También verificar en el array alternativo
        const subscriptionActiva = user.subscriptions?.find(
          (sub: any) => 
            sub.tipo === 'TraderCall' && 
            sub.activa === true &&
            (!sub.fechaFin || new Date(sub.fechaFin) > new Date())
        );

        // ✅ IMPORTANTE: Verificar también en activeSubscriptions (MercadoPago)
        const activeSubscription = user.activeSubscriptions?.find(
          (sub: any) => 
            sub.service === 'TraderCall' && 
            sub.isActive === true &&
            new Date(sub.expiryDate) > new Date()
        );

        // ✅ IMPORTANTE: Solo verificar suscripciones específicas a TraderCall
        // NO verificar por rol general para evitar acceso cruzado entre servicios
        isSubscribed = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
        
        console.log('🔍 Verificación de suscripción TraderCall:', {
          email: user.email,
          role: user.role,
          suscripcionActiva: !!suscripcionActiva,
          subscriptionActiva: !!subscriptionActiva,
          activeSubscription: !!activeSubscription,
          activeSubscriptionDetails: activeSubscription ? {
            service: activeSubscription.service,
            isActive: activeSubscription.isActive,
            expiryDate: activeSubscription.expiryDate,
            expired: new Date(activeSubscription.expiryDate) <= new Date()
          } : null,
          isSubscribed
        });
      }
    }
  } catch (error) {
    console.error('Error verificando suscripción:', error);
    // En caso de error, mostramos vista no suscrita por defecto
    isSubscribed = false;
  }

  const metrics = {
    performance: '+87.5%',
    activeUsers: '+500',
    alertsSent: '+1,300',
    accuracy: '92.3%'
  };

  // Obtener configuración del sitio para ejemplos de alertas y FAQs
  let alertExamples: AlertExample[] = [];
  let faqs: FAQ[] = [];
  
  try {
    const dbConnect = (await import('@/lib/mongodb')).default;
    const SiteConfig = (await import('@/models/SiteConfig')).default;
    
    await dbConnect();
    const siteConfig = await SiteConfig.findOne({}).lean();
    
    if (siteConfig) {
      alertExamples = (siteConfig as any).alertExamples?.traderCall || [];
      faqs = (siteConfig as any).faqs?.filter((faq: any) => 
        faq.visible && (faq.category === 'trader-call' || faq.category === 'general')
      ) || [];
    }
  } catch (error) {
    console.error('Error obteniendo configuración del sitio:', error);
  }

  // Si no hay datos en la configuración, usar datos de ejemplo
  if (alertExamples.length === 0) {
    alertExamples = [
      {
        id: 'example-1',
        title: 'Alerta de Compra SATL',
        description: 'Señal de compra confirmada: precio por encima de SMA200 y EMA50, MACD cruza a positivo y RSI > 50.',
        chartImage: '/logos/ALERTACOMPRASATL.png',
        entryPrice: 'USD $132.31',
        exitPrice: 'USD $145.54',
        profit: '$13.23',
        profitPercentage: '+10.0%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1' as const,
        country: 'United States',
        ticker: 'SATL',
        order: 1
      },
      {
        id: 'example-2',
        title: 'Alerta de Venta Parcial EDN',
        description: 'Venta parcial del 50% tras fuerte avance: aseguramos ganancias y mantenemos el resto con stop ajustado.',
        chartImage: '/logos/ALERTAVENTAPARCIALEDN.png',
        entryPrice: 'USD $180.50',
        exitPrice: 'USD $225.63',
        profit: '$45.13',
        profitPercentage: '+25.0%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1 Y SL' as const,
        country: 'United States',
        ticker: 'EDN',
        order: 2
      },
      {
        id: 'example-3',
        title: 'Alerta de Compra ETHA',
        description: 'Objetivo alcanzado: cerramos el 50% restante y finalizamos el trade con excelente rendimiento.',
        chartImage: '/logos/ALERTACOMPRAETHA.png',
        entryPrice: 'USD $420.00',
        exitPrice: 'USD $504.00',
        profit: '$84.00',
        profitPercentage: '+20.0%',
        riskLevel: 'BAJO' as const,
        status: 'CERRADO TP1' as const,
        country: 'United States',
        ticker: 'ETHA',
        order: 3
      },
      {
        id: 'example-4',
        title: 'Alerta de Venta Total SPOT',
        description: 'Venta total exitosa con excelente rendimiento en SPOT.',
        chartImage: '/logos/ALERTAVENTATOTALSPOT.png',
        entryPrice: 'USD $150.00',
        exitPrice: 'USD $180.00',
        profit: '$30.00',
        profitPercentage: '+20.0%',
        riskLevel: 'BAJO' as const,
        status: 'CERRADO TP1' as const,
        country: 'United States',
        ticker: 'SPOT',
        order: 4
      },
      {
        id: 'example-5',
        title: 'Alerta de Venta Parcial SATL',
        description: 'Venta parcial inteligente para proteger ganancias.',
        chartImage: '/logos/ALERTAVENTAPARCIALSATL.png',
        entryPrice: 'USD $200.00',
        exitPrice: 'USD $240.00',
        profit: '$40.00',
        profitPercentage: '+20.0%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1 Y SL' as const,
        country: 'United States',
        ticker: 'SATL',
        order: 5
      },
      {
        id: 'example-6',
        title: 'Alerta de Venta Total ETHA',
        description: 'Venta total exitosa en ETHA con análisis técnico.',
        chartImage: '/logos/ALERTAVENTATOTALETHA.png',
        entryPrice: 'USD $300.00',
        exitPrice: 'USD $360.00',
        profit: '$60.00',
        profitPercentage: '+20.0%',
        riskLevel: 'BAJO' as const,
        status: 'CERRADO TP1' as const,
        country: 'United States',
        ticker: 'ETHA',
        order: 6
      },
      {
        id: 'example-7',
        title: 'Alerta de Compra EDN',
        description: 'Señal de compra en Edenor con análisis técnico detallado.',
        chartImage: '/logos/ALERTACOMPRAEDN.png',
        entryPrice: 'USD $45.20',
        exitPrice: 'USD $52.80',
        profit: '$7.60',
        profitPercentage: '+16.8%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1' as const,
        country: 'Argentina',
        ticker: 'EDN',
        order: 7
      },
      {
        id: 'example-8',
        title: 'Alerta de Compra ETHE',
        description: 'Señal de compra en Ethereum con fundamentos sólidos.',
        chartImage: '/logos/ALERTACOMPRAETHA.png',
        entryPrice: 'USD $2,850.00',
        exitPrice: 'USD $3,420.00',
        profit: '$570.00',
        profitPercentage: '+20.0%',
        riskLevel: 'ALTO' as const,
        status: 'CERRADO TP1' as const,
        country: 'Global',
        ticker: 'ETHE',
        order: 8
      },
      {
        id: 'example-9',
        title: 'Alerta de Compra SPOT',
        description: 'Señal de compra en Spotify con análisis fundamental.',
        chartImage: '/logos/ALERTACOMPRASPOT.png',
        entryPrice: 'USD $180.50',
        exitPrice: 'USD $216.60',
        profit: '$36.10',
        profitPercentage: '+20.0%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1' as const,
        country: 'United States',
        ticker: 'SPOT',
        order: 9
      },
      {
        id: 'example-10',
        title: 'Alerta de Venta Parcial ETHE',
        description: 'Toma de ganancias parcial en Ethereum con stop loss dinámico.',
        chartImage: '/logos/ALERTAVENTAPARCIALETHA.png',
        entryPrice: 'USD $3,200.00',
        exitPrice: 'USD $3,840.00',
        profit: '$640.00',
        profitPercentage: '+20.0%',
        riskLevel: 'ALTO' as const,
        status: 'CERRADO TP1 Y SL' as const,
        country: 'Global',
        ticker: 'ETHE',
        order: 10
      },
      {
        id: 'example-11',
        title: 'Alerta de Venta Parcial SPOT',
        description: 'Toma de ganancias parcial en Spotify con análisis técnico.',
        chartImage: '/logos/ALERTAVENTAPARCIALSPOT.png',
        entryPrice: 'USD $195.00',
        exitPrice: 'USD $234.00',
        profit: '$39.00',
        profitPercentage: '+20.0%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1 Y SL' as const,
        country: 'United States',
        ticker: 'SPOT',
        order: 11
      },
      {
        id: 'example-12',
        title: 'Alerta de Venta Total EDN',
        description: 'Cierre completo de posición en Edenor con máxima ganancia.',
        chartImage: '/logos/ALERTAVENTATOTALEDN.png',
        entryPrice: 'USD $42.50',
        exitPrice: 'USD $59.50',
        profit: '$17.00',
        profitPercentage: '+40.0%',
        riskLevel: 'MEDIO' as const,
        status: 'CERRADO TP1' as const,
        country: 'Argentina',
        ticker: 'EDN',
        order: 12
      }

    ];
  }

  if (faqs.length === 0) {
    faqs = [
      {
        id: 'faq-1',
        question: '¿Qué es Trader Call? ¿Para qué sirve?',
        answer: 'Trader Call es un servicio de suscripción de alertas de trading, donde comparto mi estrategia de trading de corto-mediano plazo que vengo llevando a cabo en los mercados desde hace varios años. Este servicio tiene como finalidad ayudar a la comunidad inversora a invertir de manera profesional en el mercado de capitales argentino, proporcionando mi mirada y para que empiecen con el pie derecho en este mundo tan hostil. De la mano de Trader Call, podrás comenzar a operar en el mercado con la seguridad de una análisis técnico exhaustivo y profesional para enterarte antes que nadie de las mejores oportunidades de inversión.\n\nLuego de la suscripción, se enviará un mail a la dirección de correo electrónico vinculada a la cuenta de mercadopago con la que se realizó la suscripción. En dicho correo se enviará el link de acceso al canal privado de telegram para comenzar a disfrutar del servicio. tenga en cuenta que tanto el envío del correo con la información como la aceptación en telegram puede demorar hasta 48hs hábiles.',
        category: 'trader-call' as const,
        order: 1,
        visible: true
      },
      {
        id: 'faq-2',
        question: '¿Como funcionan las alertas de trading?',
        answer: 'El mecanismo de las alertas funciona a través de la página web, donde se publica un informe diario con mi mirada del mercado y las señales de compra o venta detectadas cada día.\n\nEste informe se publica entre las 18 y las 22 hs de cada día hábil bursátil, una vez cerrado el mercado. Esto se debe a que el análisis técnico debe realizarse con el mercado cerrado, para lograr mayor precisión y fiabilidad. Por esta razón, las operaciones de los suscriptores que deseen operar bajo esta estrategia deberán ejecutarse al día hábil bursátil siguiente, en cualquier horario. Cabe destacar que no todos los días se generan alertas de compra o venta, ya que el mercado puede no arrojar ninguna señal bajo mi método de trading. \n\nEl análisis y las alertas de trading son sobre activos que cotizan en USA, en dólares. Sin embargo, esto no presenta inconvenientes para realizar operaciones en CEDEARs contra pesos en Argentina. Esto permite ingresar en cada alerta con menor cantidad de dinero y en pesos, ya que los CEDEARs cotizan tanto en pesos como en dólares y cuentan con un ratio de conversión que facilita el acceso a inversores con menor capital inicial. De hecho, el servicio contempla la inversión en CEDEARs y en pesos como la opción preferible, ya que suele haber mucho más volumen de operaciones en el mercado local en esa moneda.\n\nTodos los días se hace un repaso del estado actual de todas las alertas activadas mediante un informe de mercado. Las alertas están rigurosamente analizadas bajo mi método de trading y tienen como horizonte una duración que puede ir desde unos pocos días hasta 3 meses.\n\nCada alerta de compra tiene asignado un nivel de riesgo propio, que contempla tanto el riesgo del contexto general de mercado como el riesgo particular de cada activo.\n\nEste servicio no tiene vínculo alguno con brokers de bolsa argentinos o internacionales, por lo que la estrategia puede aplicarse en cualquier cuenta de inversiones, independientemente del broker o intermediario utilizado.',
        category: 'trader-call' as const,
        order: 2,
        visible: true
      },
      {
        id: 'faq-3',
        question: '¿Las alertas tienen vencimiento?',
        answer: 'Sí, tanto las alertas de compra como de venta tienen 24 horas de vencimiento. Esto se debe a que el análisis realizado del activo y del contexto en general cambia día a día, siguiendo el desarrollo del mercado. En cada informe detallamos a qué activos, de los que ya tuvieron alertas de compra con fechas anteriores, se puede ingresar al día siguiente en caso de que hubiera alguno.',
        category: 'trader-call' as const,
        order: 3,
        visible: true
      },
      {
        id: 'faq-4',
        question: '¿Cuánto dinero hay que invertir?',
        answer: 'No hay un mínimo de dinero con el que tengas que empezar, pero una suma recomendable sería el equivalente a U$D 1.000.',
        category: 'trader-call' as const,
        order: 4,
        visible: true
      },
      {
        id: 'faq-5',
        question: '¿Como son los pagos de la suscripción?',
        answer: 'Solo aceptamos suscripciones y pagos por mercadopago\n\nLos cobros de mercado pago son automáticos y tienen en cuenta la oferta de los 30 días gratis, por lo que usted empezará a pagar su suscripción luego de 30 días. Todos los 1ro de mes, se debitará del método de pago asociado el importe de la suscripción con la referencia "TRADERCALL". En el caso del primer pago, luego de los 30 días gratis, se debitará el prorrateo correspondiente de los días del mes en curso hasta llegar al primer día del mes siguiente. Esto quiere decir, que el primer cobro por la suscripción, que será luego de los 30 días de iniciada la suscripción, puede ser menor al valor del mes entero, ya que corresponden al prorrateo de días. Luego de hecho el primer pago, todos los 1ro de cada mes, se debitará el valor total de la suscripción. Cabe destacar, que son días corridos y no días hábiles.\n\nIMPORTANTE: Tenga a bien contar con los fondos suficientes en el método de pago seleccionado para no tener inconvenientes con el estado de su suscripción.\n\nES OPORTUNO ACLARAR QUE, EN NINGÚN CASO SE COBRARÁN COMISIONES EXTRAS A LA HORA DE REALIZAR LAS OPERACIONES A MERCADO, YA QUE NO EXISTE VÍNCULO ALGUNO ENTRE EL SERVICIO DE ALERTAS Y NINGUN BROKER DE BOLSA ARGENTINO O INTERNACIONAL.\n\nTenga en cuenta que las comunicaciones respecto al estado de su suscripción serán por correo electrónico, el mismo con el cual se realizó la suscripción por mercadopago. no se harán comunicaciones de este tipo por telegram.',
        category: 'trader-call' as const,
        order: 5,
        visible: true
      },
      {
        id: 'faq-6',
        question: '¿Seguís con dudas?',
        answer: 'Escribime un correo electrónico a la siguiente casilla para resolver las dudas que te puedan surgir: lozanonahuel@gmail.com',
        category: 'trader-call' as const,
        order: 6,
        visible: true
      }
    ];
  }

  const historicalAlerts: HistoricalAlert[] = [
    {
      date: '20/06/2023',
      riskLevel: 'MEDIO',
      status: 'CERRADO TP1',
      country: 'United States',
      ticker: 'AAPL',
      entryPrice: '$44.50',
      currentPrice: '$50.60',
      takeProfit1: '$45.30',
      takeProfit2: '$63.25',
      stopLoss: '$75.00',
      div: '$41.18',
      exitPrice: '$45.30',
      profitPercentage: '+1.80%'
    },
    {
      date: '29/06/2023',
      riskLevel: 'ALTO',
      status: 'CERRADO TP1 Y SL',
      country: 'United States',
      ticker: 'TSLA',
      entryPrice: '$98.52',
      currentPrice: '$47.71',
      takeProfit1: '$63.25',
      stopLoss: '$60.09',
      div: '$82.09',
      exitPrice: '$82.09',
      profitPercentage: '-16.70%'
    },
    {
      date: '30/06/2023',
      riskLevel: 'BAJO',
      status: 'CERRADO SL',
      country: 'Canada',
      ticker: 'SHOP',
      entryPrice: '$16.93',
      currentPrice: '$1.08',
      takeProfit1: '$19.12',
      takeProfit2: '$21.12',
      stopLoss: '$16.78',
      div: '$16.78',
      exitPrice: '$16.78',
      profitPercentage: '-0.89%'
    },
    {
      date: '30/06/2023',
      riskLevel: 'ALTO',
      status: 'CERRADO TP1 Y SL',
      country: 'Canada',
      ticker: 'SHOP',
      entryPrice: '$49.98',
      currentPrice: '$119.20',
      takeProfit1: '$53.31',
      stopLoss: '$50.60',
      div: '$50.60',
      exitPrice: '$54.15',
      profitPercentage: '+8.35%'
    },
    {
      date: '03/07/2023',
      riskLevel: 'BAJO',
      status: 'CERRADO TP1',
      country: 'Canada',
      ticker: 'SHOP',
      entryPrice: '$14.81',
      currentPrice: '$29.70',
      takeProfit1: '$16.50',
      stopLoss: '$15.57',
      div: '$15.57',
      exitPrice: '$16.04',
      profitPercentage: '+8.27%'
    }
  ];

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  // Cargar configuración de sitio para obtener el video del hero
  const siteConfigRes = await fetch(`${baseUrl}/api/site-config`);
  const siteConfig = siteConfigRes.ok ? await siteConfigRes.json() : null;
  const traderHeroVideo = siteConfig?.alertsVideos?.traderCall?.heroVideo || null;

  return {
    props: {
      isSubscribed,
      metrics,
      historicalAlerts,
      alertExamples,
      faqs,
      traderHeroVideo
    }
  };
};

// Componente YouTubeAutoCarousel idéntico al de la landing page
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

export default TraderCallPage; 