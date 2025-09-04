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
import Carousel from '@/components/Carousel';
import ImageUploader, { CloudinaryImage } from '@/components/ImageUploader';
import AlertExamplesCarousel from '@/components/AlertExamplesCarousel';
import HistoricalAlertsTable from '@/components/HistoricalAlertsTable';
import FAQAccordion from '@/components/FAQAccordion';
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
  ChevronRight
} from 'lucide-react';
import styles from '@/styles/SmartMoney.module.css';
import { useRouter } from 'next/router';
import { calculateDaysRemaining, calculateDaysSinceSubscription } from '../../utils/dateUtils';
import SPY500Indicator from '@/components/SPY500Indicator';
import PortfolioTimeRange from '@/components/PortfolioTimeRange';
import { usePricing } from '@/hooks/usePricing';

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

interface SmartMoneyPageProps {
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
}

// Vista No Suscripto
const NonSubscriberView: React.FC<{ 
  metrics: any, 
  historicalAlerts: HistoricalAlert[], 
  alertExamples: AlertExample[], 
  faqs: FAQ[] 
}> = ({ 
  metrics, 
  historicalAlerts,
  alertExamples,
  faqs
}) => {
  const { data: session } = useSession();
  const { pricing, loading: pricingLoading } = usePricing();

  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async () => {
    if (!session) {
      signIn('google');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Obtener el precio dinámico del sistema
      const subscriptionPrice = pricing?.alertas?.smartMoney?.monthly || 20000;
      
      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'SmartMoney',
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
      src: '/alerts/smart-money-example-1.jpg',
      alt: 'Ejemplo de alerta Smart Money - Análisis AAPL',
      title: 'Alerta AAPL - Entrada Perfecta',
      description: 'Señal de compra en Apple con +15% de ganancia en 3 días'
    },
    {
      src: '/alerts/smart-money-example-2.jpg',
      alt: 'Ejemplo de alerta Smart Money - Análisis TSLA',
      title: 'Alerta TSLA - Stop Loss Activado',
      description: 'Protección de capital con stop loss inteligente'
    },
    {
      src: '/alerts/smart-money-example-3.jpg',
      alt: 'Ejemplo de alerta Smart Money - Análisis SPY',
      title: 'Alerta SPY - Take Profit',
      description: 'Maximización de ganancias con take profit automático'
    }
  ];

  return (
    <div className={styles.nonSubscriberView}>
      {/* Hero Section con Video Background */}
      <section className={styles.heroSection}>
        {/* Video Background */}
        <div className={styles.videoBackground}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className={styles.backgroundVideo}
          >
            <source src="/logos/DiseñoWeb-LozanoNahuel-Alertas-TraderCall.mp4" type="video/mp4" />
            Tu navegador no soporta el elemento de video.
          </video>
          <div className={styles.videoOverlay}></div>
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
                Smart Money
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
                      `$${pricing.alertas.smartMoney.monthly} ARS/mes`
                    ) : (
                      '$20000 ARS/mes'
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.heroVideo}>
              <div className={styles.videoContainer}>
                <VideoPlayerMux 
                  playbackId="sample-smart-money-video" 
                  autoplay={true}
                  className={styles.video}
                />
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

      {/* Métricas - Sección independiente para ocupar todo el ancho */}
      <section className={styles.metricsSection}>
          <div className={styles.metricsGrid}>
            <motion.div 
              className={styles.metricCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
            <h3 className={styles.metricNumber}>+700</h3>
            <p className={styles.metricLabel}>USUARIOS ACTIVOS</p>
            </motion.div>

            <motion.div 
              className={styles.metricCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
            <h3 className={styles.metricNumber}>+87%</h3> 
            <p className={styles.metricLabel}>RENTABILIDAD ANUAL</p>
            </motion.div>

            <motion.div 
              className={styles.metricCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
            <h3 className={styles.metricNumber}>+200</h3>
            <p className={styles.metricLabel}>ALERTAS ENVIADAS</p>
            </motion.div>

            <motion.div 
              className={styles.metricCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
            <h3 className={styles.metricNumber}>+79%</h3>
            <p className={styles.metricLabel}>EFECTIVIDAD</p>
            </motion.div>
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
              category="smart-money"
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

// Vista de suscriptor completa
const SubscriberView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [communityMessages, setCommunityMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    action: 'BUY',
    stopLoss: '',
    takeProfit: '',
    analysis: ''
  });
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [chartImage, setChartImage] = useState<CloudinaryImage | null>(null);
  const [additionalImages, setAdditionalImages] = useState<CloudinaryImage[]>([]);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [realAlerts, setRealAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Estados para edición de alertas
  const [showEditAlert, setShowEditAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [editAlert, setEditAlert] = useState({
    symbol: '',
    action: 'BUY',
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    analysis: ''
  });
  const [editLoading, setEditLoading] = useState(false);
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

  const { data: session } = useSession();
  const router = useRouter();

  // Verificar rol del usuario
  React.useEffect(() => {
    const checkUserRole = async () => {
      try {
        const response = await fetch('/api/profile/get', {
          credentials: 'same-origin',
        });
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.user?.role || '');
        }
      } catch (error) {
        console.error('Error al verificar rol:', error);
      }
    };

    if (session?.user) {
      checkUserRole();
    }
  }, [session]);

  // Función para manejar la edición de alertas
  const handleEditAlert = (alert: any) => {
    console.log('🔍 Editando alerta en Smart Money:', alert);

    // Preparar los datos de la alerta para edición
    setEditingAlert(alert);
    setEditAlert({
      symbol: alert.symbol || '',
      action: alert.action || 'BUY',
      entryPrice: alert.entryPrice ? alert.entryPrice.replace('$', '') : '',
      stopLoss: alert.stopLoss ? alert.stopLoss.replace('$', '') : '',
      takeProfit: alert.takeProfit ? alert.takeProfit.replace('$', '') : '',
      analysis: alert.analysis || ''
    });

    // Mostrar el modal de edición
    setShowEditAlert(true);
  };

  // Función para guardar los cambios de la alerta
  const handleSaveEditAlert = async () => {
    if (!editingAlert) return;

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

      console.log('🔄 Guardando cambios de alerta en Smart Money:', {
        alertId: editingAlert.id || editingAlert._id,
        changes: editAlert
      });

      const response = await fetch('/api/alerts/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          alertId: editingAlert.id || editingAlert._id,
          symbol: editAlert.symbol,
          action: editAlert.action,
          entryPrice: parseFloat(editAlert.entryPrice),
          stopLoss: parseFloat(editAlert.stopLoss),
          takeProfit: parseFloat(editAlert.takeProfit),
          analysis: editAlert.analysis,
          reason: 'Edición por administrador desde panel de Smart Money'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Alerta editada exitosamente en Smart Money:', result.alert);

        // Recargar alertas para mostrar cambios
        await loadAlerts();

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
      console.error('❌ Error al editar alerta en Smart Money:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('❌ Error de conexión. Verifica tu internet e intenta nuevamente.');
      } else {
        alert('❌ Error inesperado al editar la alerta. Por favor, intenta nuevamente.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  // Función para calcular métricas reales del dashboard usando alertas reales
  const calculateDashboardMetrics = () => {
    const alertasActivas = realAlerts.filter(alert => alert.status === 'ACTIVE').length;
    const alertasCerradas = realAlerts.filter(alert => alert.status === 'CLOSED');
    
    const alertasGanadoras = alertasCerradas.filter(alert => {
      const profitValue = parseFloat(alert.profit.replace('%', '').replace('+', ''));
      return profitValue > 0;
    }).length;
    
    const alertasPerdedoras = alertasCerradas.filter(alert => {
      const profitValue = parseFloat(alert.profit.replace('%', '').replace('+', ''));
      return profitValue < 0;
    }).length;
    
    const ahora = new Date();
    const inicioAño = new Date(ahora.getFullYear(), 0, 1);
    const alertasAnuales = realAlerts.filter(alert => {
      const fechaAlert = new Date(alert.date);
      return fechaAlert >= inicioAño;
    }).length;

    const alertasAnualConGanancias = realAlerts.filter(alert => {
      const fechaAlert = new Date(alert.date);
      return fechaAlert >= inicioAño;
    });

    const gananciasAnual = alertasAnualConGanancias.reduce((total, alert) => {
      const profitValue = parseFloat(alert.profit.replace('%', '').replace('+', ''));
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
        const currentPrice = parseFloat(String(alert.currentPrice || '0').replace('$', ''));
        const entryPrice = parseFloat(String(alert.entryPrice || '0').replace('$', ''));
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
        const entryPriceFormatted = String(alert.entryPrice || '0').replace('$', '');
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

    return activities
      .sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime())
      .slice(0, 6);
  };

  // Generar actividad reciente reactivamente cuando cambien las alertas
  const recentActivity = React.useMemo(() => {
    return generateRecentActivity();
  }, [realAlerts, informes]);

  // Función para cargar alertas desde la API
  const loadAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const response = await fetch('/api/alerts/list?tipo=SmartMoney', {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        setRealAlerts(data.alerts || []);
        console.log('Alertas cargadas:', data.alerts?.length || 0);
      } else {
        console.error('Error al cargar alertas:', response.status);
      }
    } catch (error) {
      console.error('Error al cargar alertas:', error);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Función para actualizar precios en tiempo real
  const updatePrices = async (silent: boolean = false) => {
    if (!silent) setUpdatingPrices(true);
    
    try {
      const response = await fetch('/api/alerts/update-prices', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Precios actualizados:', data.updated, 'alertas');
        setLastPriceUpdate(new Date());
        
        if (data.alerts && data.alerts.length > 0) {
          const hasSimulated = data.alerts.some((alert: any) => alert.isSimulated);
          setIsUsingSimulatedPrices(hasSimulated);
          
          if (data.alerts[0].marketStatus) {
            setMarketStatus(data.alerts[0].marketStatus);
          }
        }
        
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

  // Función para cargar informes desde la API
  const loadInformes = async () => {
    setLoadingInformes(true);
    try {
      const response = await fetch('/api/reports?limit=6&featured=false&category=smart-money', {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        setInformes(data.data?.reports || []);
        console.log('Informes Smart Money cargados:', data.data?.reports?.length || 0);
      } else {
        console.error('Error al cargar informes:', response.status);
      }
    } catch (error) {
      console.error('Error al cargar informes:', error);
    } finally {
      setLoadingInformes(false);
    }
  };

  // Cargar alertas y informes al montar el componente
  React.useEffect(() => {
    loadAlerts();
    loadInformes();
  }, []);

  // ✅ OPTIMIZADO: Sistema de actualización automática de precios cada 2 minutos
  React.useEffect(() => {
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

  return (
    <div className={styles.subscriberView}>
      {/* Header de Bienvenida Personalizado */}
      <div className={styles.welcomeHeader}>
        <div className={styles.welcomeContent}>
          <h1 className={styles.welcomeTitle}>
            Hola {session?.user?.name || 'Nahuel'}! Ésta es tu área exclusiva de Smart Money
          </h1>
          <p className={styles.welcomeSubtitle}>
            Aquí tienes acceso completo a todas las alertas y recursos
          </p>
        </div>
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
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className={styles.dashboardContent}>
              <h2 className={styles.sectionTitle}>Dashboard de Smart Money</h2>
              
              {/* Métricas principales */}
              <div className={styles.modernMetricsGrid}>
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
              </div>

              {/* Actividad Reciente */}
              <div className={styles.activitySection}>
                <div className={styles.activityHeader}>
                  <h3>Actividad Reciente</h3>
                  <div className={styles.activityActions}>
                    <button 
                      className={styles.viewAllButton}
                      onClick={() => setActiveTab('seguimiento')}
                    >
                      Ver toda la actividad
                    </button>
                    <button 
                      className={styles.refreshButton}
                      onClick={() => {
                        setRefreshingActivity(true);
                        Promise.all([loadAlerts(), loadInformes()]).finally(() => setRefreshingActivity(false));
                      }}
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
          )}

          {/* Seguimiento Tab */}
          {activeTab === 'seguimiento' && (
            <div className={styles.seguimientoContent}>
              <h2 className={styles.sectionTitle}>Seguimiento de Alertas</h2>
              <div className={styles.seguimientoGrid}>
                {realAlerts.length > 0 ? (
                  realAlerts.map((alert, index) => (
                    <div key={alert._id || index} className={styles.alertCard}>
                      <div className={styles.alertHeader}>
                        <h3>{alert.symbol}</h3>
                        <span className={`${styles.alertStatus} ${alert.status === 'ACTIVE' ? styles.statusActive : styles.statusClosed}`}>
                          {alert.status === 'ACTIVE' ? 'Activa' : 'Cerrada'}
                        </span>
                      </div>
                      <div className={styles.alertDetails}>
                        <p><strong>Entrada:</strong> ${alert.entryPrice}</p>
                        <p><strong>Precio Actual:</strong> ${alert.currentPrice}</p>
                        {alert.profit && <p><strong>Ganancia:</strong> {alert.profit}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>No hay alertas para mostrar</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alertas Vigentes Tab */}
          {activeTab === 'vigentes' && (
            <div className={styles.vigentesContent}>
              <h2 className={styles.sectionTitle}>Alertas Vigentes</h2>
              <div className={styles.vigentesGrid}>
                {realAlerts.filter(alert => alert.status === 'ACTIVE').length > 0 ? (
                  realAlerts
                    .filter(alert => alert.status === 'ACTIVE')
                    .map((alert, index) => (
                      <div key={alert._id || index} className={styles.alertCard}>
                        <div className={styles.alertHeader}>
                          <h3>{alert.symbol}</h3>
                          <span className={styles.alertStatus}>Activa</span>
                        </div>
                        <div className={styles.alertDetails}>
                          <p><strong>Entrada:</strong> ${alert.entryPrice}</p>
                          <p><strong>Precio Actual:</strong> ${alert.currentPrice}</p>
                          <p><strong>Stop Loss:</strong> ${alert.stopLoss || 'No definido'}</p>
                          <p><strong>Take Profit:</strong> ${alert.takeProfit || 'No definido'}</p>
                        </div>
                        {userRole === 'admin' && (
                          <div className={styles.alertActions}>
                            <button
                              className={styles.editButton}
                              onClick={() => handleEditAlert(alert)}
                              title="Editar alerta"
                            >
                              ✏️ Editar
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>No hay alertas vigentes</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Informes Tab */}
          {activeTab === 'informes' && (
            <div className={styles.informesContent}>
              <h2 className={styles.sectionTitle}>Informes Disponibles</h2>
              <div className={styles.informesGrid}>
                {informes.length > 0 ? (
                  informes.map((informe, index) => (
                    <div key={informe._id || index} className={styles.informeCard}>
                      <div className={styles.informeHeader}>
                        <h3>{informe.title}</h3>
                        <span className={styles.informeType}>{informe.type}</span>
                      </div>
                      <div className={styles.informeDetails}>
                        <p>{informe.description}</p>
                        <p><strong>Fecha:</strong> {new Date(informe.createdAt).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <p>No hay informes disponibles</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Consultas Tab */}
          {activeTab === 'comunidad' && (
            <div className={styles.comunidadContent}>
              <h2 className={styles.sectionTitle}>Consultas y Comunidad</h2>
              <div className={styles.comunidadInfo}>
                <p>Aquí podrás hacer consultas sobre tus inversiones y conectarte con otros miembros de la comunidad.</p>
                <div className={styles.comunidadFeatures}>
                  <div className={styles.featureCard}>
                    <h3>📊 Análisis Personalizado</h3>
                    <p>Solicita análisis específicos de tus posiciones</p>
                  </div>
                  <div className={styles.featureCard}>
                    <h3>💬 Chat en Vivo</h3>
                    <p>Conecta con otros traders en tiempo real</p>
                  </div>
                  <div className={styles.featureCard}>
                    <h3>📈 Estrategias</h3>
                    <p>Comparte y aprende estrategias de trading</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal de edición de alertas */}
      {showEditAlert && (
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
                <label>Precio de Entrada</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Precio de entrada"
                  value={editAlert.entryPrice}
                  onChange={(e) => setEditAlert(prev => ({ ...prev, entryPrice: e.target.value }))}
                  className={styles.input}
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
      )}
    </div>
  );
};

// Componente principal
const SmartMoneyPage: React.FC<SmartMoneyPageProps> = ({ 
  isSubscribed, 
  metrics, 
  historicalAlerts, 
  alertExamples, 
  faqs 
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Mostrar loading mientras se verifica la sesión
  if (status === 'loading') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Smart Money - Alertas de Trading | Nahuel Lozano</title>
        <meta name="description" content="Servicio de alertas Smart Money con estrategia de corto plazo, informes detallados y seguimiento activo para inversiones en CEDEARs y acciones." />
        <meta name="keywords" content="smart money, alertas trading, inversiones, CEDEARs, acciones, trading, finanzas" />
        <meta property="og:title" content="Smart Money - Alertas de Trading" />
        <meta property="og:description" content="Servicio de alertas Smart Money con estrategia de corto plazo para inversiones exitosas." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://lozanonahuel.vercel.app/alertas/smart-money" />
        <link rel="canonical" href="https://lozanonahuel.vercel.app/alertas/smart-money" />
      </Head>

      <div className={styles.pageContainer}>
      <Navbar />
      
        {isSubscribed ? (
          <SubscriberView />
        ) : (
          <NonSubscriberView 
            metrics={metrics} 
            historicalAlerts={historicalAlerts} 
            alertExamples={alertExamples}
            faqs={faqs}
          />
        )}

      <Footer />
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  
  let isSubscribed = false;
  
  if (session?.user?.email) {
    try {
      // Importar dinámicamente para evitar errores de SSR
      const dbConnect = (await import('@/lib/mongodb')).default;
      const User = (await import('@/models/User')).default;

      await dbConnect();
      const user = await User.findOne({ email: session.user.email });
      
      if (user) {
        // Verificar suscripción activa a SmartMoney en el array 'subscriptions'
        const subscriptionActiva = user.subscriptions?.find(
          (sub: any) => 
            sub.tipo === 'SmartMoney' && 
            sub.activa === true &&
            (!sub.fechaFin || new Date(sub.fechaFin) > new Date())
        );
        
        // También verificar en el array 'suscripciones' (legacy)
        const suscripcionActiva = user.suscripciones?.find(
          (sub: any) => 
            sub.servicio === 'SmartMoney' && 
            sub.activa === true && 
            new Date(sub.fechaVencimiento) > new Date()
        );

        isSubscribed = !!(subscriptionActiva || suscripcionActiva);
        
        console.log('🔍 Verificación SmartMoney:', {
          email: user.email,
          subscriptions: user.subscriptions?.length || 0,
          suscripciones: user.suscripciones?.length || 0,
          subscriptionActiva: !!subscriptionActiva,
          suscripcionActiva: !!suscripcionActiva,
          isSubscribed
        });
      }
    } catch (error) {
      console.error('Error verificando suscripción SmartMoney:', error);
      // En caso de error, mostramos vista no suscrita por defecto
      isSubscribed = false;
    }
  }

  // Obtener datos de configuración del sitio
  let siteConfig = null;
  try {
    const configResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/site-config`);
    if (configResponse.ok) {
      siteConfig = await configResponse.json();
    }
  } catch (error) {
    console.error('Error fetching site config:', error);
  }

  // Datos por defecto
  const defaultMetrics = {
    performance: '+87%',
    activeUsers: '+700',
    alertsSent: '+200',
    accuracy: '+79%'
  };

  const defaultHistoricalAlerts: HistoricalAlert[] = [
    {
      date: '2024-01-15',
      riskLevel: 'MEDIO',
      status: 'CERRADO TP1',
      country: 'United States',
      ticker: 'AAPL',
      entryPrice: '$132.31',
      currentPrice: '$230.25',
      takeProfit1: '$203.64',
      exitPrice: '$230.25',
      profitPercentage: '+15.89%'
    },
    {
      date: '2024-01-10',
      riskLevel: 'BAJO',
      status: 'CERRADO TP1 Y SL',
      country: 'United States',
      ticker: 'TSLA',
      entryPrice: '$185.50',
      currentPrice: '$210.75',
      takeProfit1: '$200.00',
      exitPrice: '$210.75',
      profitPercentage: '+13.61%'
    }
  ];

  const defaultAlertExamples: AlertExample[] = [
  {
    id: '1',
    title: 'Alerta SPOT - Venta Total',
    description: 'Señal de venta total en SPOT con +15% de ganancia en 3 días',
    chartImage: '/logos/ALERTAVENTATOTALSPOT.png',
    entryPrice: 'USD $132.31',
    exitPrice: 'USD $230.25 ($203.64)',
    profit: '$75.00',
    profitPercentage: '+15.89%',
    riskLevel: 'MEDIO',
    status: 'CERRADO TP1',
    country: 'United States',
    ticker: 'SPOT',
    order: 1
  },
  {
    id: '2',
    title: 'Alerta SATL - Venta Parcial',
    description: 'Protección de capital con venta parcial inteligente',
    chartImage: '/logos/ALERTAVENTAPARCIALSATL.png',
    entryPrice: 'USD $185.50',
    exitPrice: 'USD $210.75 ($200.00)',
    profit: '$45.00',
    profitPercentage: '+13.61%',
    riskLevel: 'BAJO',
    status: 'CERRADO TP1 Y SL',
    country: 'United States',
    ticker: 'SATL',
    order: 2
  },
  {
    id: '3',
    title: 'Alerta ETHA - Venta Total',
    description: 'Venta total exitosa con excelente rendimiento',
    chartImage: '/logos/ALERTAVENTATOTALETHA.png',
    entryPrice: 'USD $420.00',
    exitPrice: 'USD $504.00',
    profit: '$84.00',
    profitPercentage: '+20.0%',
    riskLevel: 'BAJO',
    status: 'CERRADO TP1',
    country: 'United States',
    ticker: 'ETHA',
    order: 3
  },
  {
    id: '4',
    title: 'Alerta EDN - Venta Total',
    description: 'Venta total exitosa en EDN con análisis técnico',
    chartImage: '/logos/ALERTAVENTATOTALEDN.png',
    entryPrice: 'USD $300.00',
    exitPrice: 'USD $360.00',
    profit: '$60.00',
    profitPercentage: '+20.0%',
    riskLevel: 'MEDIO',
    status: 'CERRADO TP1',
    country: 'United States',
    ticker: 'EDN',
    order: 4
  },
  {
    id: '5',
    title: 'Alerta SATL - Compra',
    description: 'Señal de compra confirmada en SATL',
    chartImage: '/logos/ALERTACOMPRASATL.png',
    entryPrice: 'USD $200.00',
    exitPrice: 'USD $240.00',
    profit: '$40.00',
    profitPercentage: '+20.0%',
    riskLevel: 'BAJO',
    status: 'CERRADO TP1',
    country: 'United States',
    ticker: 'SATL',
    order: 5
  },
  {
    id: '6',
    title: 'Alerta ETHA - Venta Parcial',
    description: 'Venta parcial estratégica en ETHA',
    chartImage: '/logos/ALERTAVENTAPARCIALETHA.png',
    entryPrice: 'USD $350.00',
    exitPrice: 'USD $420.00',
    profit: '$70.00',
    profitPercentage: '+20.0%',
    riskLevel: 'MEDIO',
    status: 'CERRADO TP1 Y SL',
    country: 'United States',
    ticker: 'ETHA',
    order: 6
  },
  
];

  const defaultFaqs: FAQ[] = [
    {
      id: '1',
      question: '¿Qué es Smart Money?',
      answer: 'Smart Money es un servicio de alertas de trading especializado en estrategias de corto plazo para inversiones en CEDEARs y acciones. Proporcionamos señales de compra y venta con análisis detallado y seguimiento activo.',
      category: 'smart-money',
      order: 1,
      visible: true
    },
    {
      id: '2',
      question: '¿Cómo funcionan las alertas?',
      answer: 'Recibirás notificaciones en tiempo real con señales de compra o venta, incluyendo precio de entrada, stop loss, take profit y análisis técnico detallado.',
      category: 'smart-money',
      order: 2,
      visible: true
    }
  ];

  return {
    props: {
      isSubscribed,
      metrics: defaultMetrics,
      historicalAlerts: defaultHistoricalAlerts,
      alertExamples: defaultAlertExamples,
      faqs: defaultFaqs
    },
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

export default SmartMoneyPage; 