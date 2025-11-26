import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  EyeOff, 
  Settings, 
  Video, 
  List, 
  Grid, 
  PlayCircle, 
  BarChart3, 
  Layout, 
  Trash2, 
  Plus, 
  Bell, 
  MessageCircle, 
  Calendar,
  BookOpen,
  Users,
  FileText,
  Globe,
  Target,
  TrendingUp,
  DollarSign,
  Briefcase,
  GraduationCap,
  Shield,
  Zap,
  Star,
  Phone
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/Admin.module.css';

interface VideoConfig {
  heroVideo: {
    youtubeId: string;
    title: string;
    description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
  learningVideo: {
    youtubeId: string;
    title: string;
    description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
  serviciosVideos: {
    alertas: {
      youtubeId: string;
      title: string;
      description: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
    entrenamientos: {
      youtubeId: string;
      title: string;
      description: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
    asesorias: {
      youtubeId: string;
      title: string;
      description: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
  };
  trainingVideos: {
    swingTrading: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
      promoVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    dowJones: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
      promoVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    advanced: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
      promoVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
  advisoryVideos: {
    index: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    consultorioFinanciero: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
      testimonialsVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    cuentaAsesorada: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
      finalVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
  alertsVideos: {
    index: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
      communityVideo?: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    traderCall: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    smartMoney: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
    cashFlow: {
      heroVideo: {
        youtubeId: string;
        title: string;
        description: string;
        autoplay: boolean;
        muted: boolean;
        loop: boolean;
      };
    };
  };
  resourcesVideos: {
    mainVideo: {
      youtubeId: string;
      title: string;
      description: string;
      autoplay: boolean;
      muted: boolean;
      loop: boolean;
    };
  };
}

interface VideoSection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  path: string;
  hidden?: boolean; // Videos que no se usan en ninguna página
}

interface VideoConfigProps {
  user: any;
}

const VideoConfig: React.FC<VideoConfigProps> = ({ user }) => {
  const [config, setConfig] = useState<VideoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string>('');

  // Definir todas las secciones de videos
  const videoSections: VideoSection[] = [
    // Videos principales del sitio
    {
      id: 'heroVideo',
      name: 'Video Hero Principal',
      description: 'Video principal de la página de inicio',
      icon: <Globe size={20} />,
      color: '#3b82f6',
      category: 'main',
      path: 'heroVideo'
    },
    {
      id: 'learningVideo',
      name: 'Video de Aprendizaje',
      description: 'Video de la sección "Aprende a invertir"',
      icon: <GraduationCap size={20} />,
      color: '#10b981',
      category: 'main',
      path: 'learningVideo'
    },
    // Videos de servicios
    {
      id: 'serviciosVideos.alertas',
      name: 'Video de Alertas (Servicios)',
      description: 'Video en la sección de servicios - Alertas',
      icon: <Bell size={20} />,
      color: '#ef4444',
      category: 'services',
      path: 'serviciosVideos.alertas'
    },
    {
      id: 'serviciosVideos.entrenamientos',
      name: 'Video de Entrenamientos (Servicios)',
      description: 'Video en la sección de servicios - Entrenamientos',
      icon: <BookOpen size={20} />,
      color: '#f59e0b',
      category: 'services',
      path: 'serviciosVideos.entrenamientos'
    },
    {
      id: 'serviciosVideos.asesorias',
      name: 'Video de Asesorías (Servicios)',
      description: 'Video en la sección de servicios - Asesorías',
      icon: <Users size={20} />,
      color: '#8b5cf6',
      category: 'services',
      path: 'serviciosVideos.asesorias'
    },
    // Videos específicos de entrenamientos
    {
      id: 'trainingVideos.swingTrading.heroVideo',
      name: 'Zero 2 Trader - Video Hero',
      description: 'Video principal de la página Zero 2 Trader',
      icon: <TrendingUp size={20} />,
      color: '#dc2626',
      category: 'trainings',
      path: 'trainingVideos.swingTrading.heroVideo'
    },
    {
      id: 'trainingVideos.swingTrading.promoVideo',
      name: 'Zero 2 Trader - Video Promocional',
      description: 'Video promocional adicional de Zero 2 Trader',
      icon: <Star size={20} />,
      color: '#dc2626',
      category: 'trainings',
      path: 'trainingVideos.swingTrading.promoVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'trainingVideos.dowJones.heroVideo',
      name: 'Dow Jones - Video Hero',
      description: 'Video principal de la página Dow Jones',
      icon: <BarChart3 size={20} />,
      color: '#059669',
      category: 'trainings',
      path: 'trainingVideos.dowJones.heroVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'trainingVideos.dowJones.promoVideo',
      name: 'Dow Jones - Video Promocional',
      description: 'Video promocional adicional de Dow Jones',
      icon: <Star size={20} />,
      color: '#059669',
      category: 'trainings',
      path: 'trainingVideos.dowJones.promoVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'trainingVideos.advanced.heroVideo',
      name: 'Programa Avanzado - Video Hero',
      description: 'Video principal de la página Programa Avanzado',
      icon: <Zap size={20} />,
      color: '#7c3aed',
      category: 'trainings',
      path: 'trainingVideos.advanced.heroVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'trainingVideos.advanced.promoVideo',
      name: 'Programa Avanzado - Video Promocional',
      description: 'Video promocional adicional del Programa Avanzado',
      icon: <Star size={20} />,
      color: '#7c3aed',
      category: 'trainings',
      path: 'trainingVideos.advanced.promoVideo',
      hidden: true // No se usa en ninguna página
    },
    // Videos de asesorías
    {
      id: 'advisoryVideos.index.heroVideo',
      name: 'Asesorías - Video Hero',
      description: 'Video principal de la página de Asesorías generales',
      icon: <Briefcase size={20} />,
      color: '#8b5cf6',
      category: 'advisory',
      path: 'advisoryVideos.index.heroVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'advisoryVideos.consultorioFinanciero.heroVideo',
      name: 'Consultorio Financiero - Video Hero',
      description: 'Video principal de Consultorio Financiero',
      icon: <MessageCircle size={20} />,
      color: '#0891b2',
      category: 'advisory',
      path: 'advisoryVideos.consultorioFinanciero.heroVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'advisoryVideos.consultorioFinanciero.testimonialsVideo',
      name: 'Consultorio Financiero - Video Testimonios',
      description: 'Video de testimonios de Consultorio Financiero',
      icon: <Users size={20} />,
      color: '#0891b2',
      category: 'advisory',
      path: 'advisoryVideos.consultorioFinanciero.testimonialsVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'advisoryVideos.cuentaAsesorada.heroVideo',
      name: 'Cuenta Asesorada - Video Hero',
      description: 'Video principal de Cuenta Asesorada',
      icon: <Shield size={20} />,
      color: '#16a34a',
      category: 'advisory',
      path: 'advisoryVideos.cuentaAsesorada.heroVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'advisoryVideos.cuentaAsesorada.finalVideo',
      name: 'Cuenta Asesorada - Video Final',
      description: 'Video final de Cuenta Asesorada',
      icon: <Target size={20} />,
      color: '#16a34a',
      category: 'advisory',
      path: 'advisoryVideos.cuentaAsesorada.finalVideo',
      hidden: true // No se usa en ninguna página
    },
    // Videos de alertas
    {
      id: 'alertsVideos.index.heroVideo',
      name: 'Alertas - Video Hero',
      description: 'Video principal de la página de Alertas',
      icon: <Bell size={20} />,
      color: '#dc2626',
      category: 'alerts',
      path: 'alertsVideos.index.heroVideo'
    },
    {
      id: 'alertsVideos.index.communityVideo',
      name: 'Alertas - Video Comunidad',
      description: 'Video de comunidad de YouTube en Alertas',
      icon: <Users size={20} />,
      color: '#dc2626',
      category: 'alerts',
      path: 'alertsVideos.index.communityVideo',
      hidden: true // No se usa en ninguna página
    },
    {
      id: 'alertsVideos.traderCall.heroVideo',
      name: 'Trader Call - Video Hero',
      description: 'Video principal de Trader Call',
      icon: <Phone size={20} />,
      color: '#ea580c',
      category: 'alerts',
      path: 'alertsVideos.traderCall.heroVideo'
    },
    {
      id: 'alertsVideos.smartMoney.heroVideo',
      name: 'Smart Money - Video Hero',
      description: 'Video principal de Smart Money',
      icon: <DollarSign size={20} />,
      color: '#059669',
      category: 'alerts',
      path: 'alertsVideos.smartMoney.heroVideo'
    },
    {
      id: 'alertsVideos.cashFlow.heroVideo',
      name: 'Cash Flow - Video Hero',
      description: 'Video principal de Cash Flow',
      icon: <TrendingUp size={20} />,
      color: '#3b82f6',
      category: 'alerts',
      path: 'alertsVideos.cashFlow.heroVideo',
      hidden: true // No se usa en ninguna página
    },
    // Videos de recursos
    {
      id: 'resourcesVideos.mainVideo',
      name: 'Recursos - Video Principal',
      description: 'Video principal de la página de Recursos',
      icon: <FileText size={20} />,
      color: '#7c3aed',
      category: 'resources',
      path: 'resourcesVideos.mainVideo'
    }
  ];

  // Función para obtener el valor de un video por path
  const getVideoByPath = (path: string) => {
    if (!config) return null;
    
    const keys = path.split('.');
    let current: any = config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }
    
    return current;
  };

  // Función para actualizar un video por path
  const updateVideoByPath = (path: string, updates: any) => {
    if (!config) return;
    
    const keys = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig;
    
    // Navegar hasta el penúltimo nivel
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    // Actualizar el último nivel
    current[keys[keys.length - 1]] = { ...current[keys[keys.length - 1]], ...updates };
    
    setConfig(newConfig);
  };

  // Función para manejar cambios en inputs
  const handleInputChange = (path: string, field: string, value: any) => {
    const video = getVideoByPath(path);
    if (video) {
      updateVideoByPath(path, { [field]: value });
    }
  };

  // Función para manejar cambios en URL de YouTube
  const handleYouTubeUrlChange = (path: string, url: string) => {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      handleInputChange(path, 'youtubeId', videoId);
    }
  };

  // Función para extraer ID de YouTube de URL
  const extractYouTubeId = (url: string): string => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return url; // Si no es una URL, asumir que es un ID
  };

  // Función para guardar configuración
  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/site-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        alert('✅ Configuración guardada exitosamente');
      } else {
        alert('❌ Error al guardar la configuración');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('❌ Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  // Función para copiar ID
  const handleCopyId = (videoId: string) => {
    navigator.clipboard.writeText(videoId);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Función para copiar URL
  const handleCopyUrl = (videoId: string) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Cargar configuración
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/site-config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Filtrar secciones (excluir videos ocultos que no se usan)
  const filteredSections = videoSections.filter(section => {
    // Excluir videos ocultos
    if (section.hidden) return false;
    
    const matchesSearch = section.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         section.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || section.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <>
        <Navbar />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Cargando configuración de videos...</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      
      <main className={styles.adminContainer}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/admin/dashboard" className={styles.backButton}>
              <ArrowLeft size={20} />
              Volver al Dashboard
            </Link>
            <h1>🎬 Configuración Completa de Videos</h1>
            <p>Gestiona todos los videos del sitio web de forma centralizada</p>
          </div>
        </div>

        {/* Controles */}
        <div className={styles.controlsSection}>
          <div className={styles.controlsGrid}>
            {/* Búsqueda */}
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Buscar videos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* Filtro por categoría */}
            <div className={styles.filterContainer}>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">Todas las categorías</option>
                <option value="main">Videos Principales</option>
                <option value="services">Videos de Servicios</option>
                <option value="trainings">Videos de Entrenamientos</option>
                <option value="advisory">Videos de Asesorías</option>
                <option value="alerts">Videos de Alertas</option>
                <option value="resources">Videos de Recursos</option>
              </select>
            </div>

            {/* Modo de vista */}
            <div className={styles.viewModeContainer}>
              <button
                onClick={() => setViewMode('grid')}
                className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
              >
                <Grid size={16} />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
              >
                <List size={16} />
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Videos */}
        <div className={`${styles.videosContainer} ${viewMode === 'list' ? styles.listView : ''}`}>
          {filteredSections.map((section) => {
            const video = getVideoByPath(section.path);
            const isConfigured = video && video.youtubeId && video.youtubeId !== 'dQw4w9WgXcQ';
            
            return (
              <motion.div
                key={section.id}
                className={`${styles.videoCard} ${selectedSection === section.id ? styles.selected : ''}`}
                onClick={() => setSelectedSection(section.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={styles.videoCardHeader}>
                  <div className={styles.videoIcon} style={{ color: section.color }}>
                    {section.icon}
                  </div>
                  <div className={styles.videoStatus}>
                    {isConfigured ? (
                      <span className={styles.configured}>✅ Configurado</span>
                    ) : (
                      <span className={styles.notConfigured}>❌ Sin configurar</span>
                    )}
                  </div>
                </div>

                <div className={styles.videoCardContent}>
                  <h3 className={styles.videoCardTitle}>{section.name}</h3>
                  <p className={styles.videoCardDescription}>{section.description}</p>
                  
                  {video && (
                    <div className={styles.videoCardInfo}>
                      <div className={styles.videoCardId}>
                        <strong>ID:</strong> {video.youtubeId}
                      </div>
                      <div className={styles.videoCardCategory}>
                        <strong>Categoría:</strong> {section.category}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.videoCardActions}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (video?.youtubeId) {
                        window.open(`https://www.youtube.com/watch?v=${video.youtubeId}`, '_blank');
                      }
                    }}
                    className={styles.actionButton}
                    disabled={!video?.youtubeId}
                  >
                    <PlayCircle size={16} />
                    Ver
                  </button>
                  
                  {video?.youtubeId && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyId(video.youtubeId);
                        }}
                        className={styles.actionButton}
                      >
                        {copiedId === video.youtubeId ? '✓ Copiado' : '📋 ID'}
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyUrl(video.youtubeId);
                        }}
                        className={styles.actionButton}
                      >
                        {copiedId === video.youtubeId ? '✓ Copiado' : '🔗 URL'}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Panel de Configuración */}
        {selectedSection && (
          <div className={styles.configPanel}>
            <div className={styles.configPanelHeader}>
              <div className={styles.configPanelIcon}>
                {videoSections.find(s => s.id === selectedSection)?.icon}
              </div>
              <div>
                <h3 className={styles.configPanelTitle}>
                  {videoSections.find(s => s.id === selectedSection)?.name}
                </h3>
                <p className={styles.configPanelDescription}>
                  {videoSections.find(s => s.id === selectedSection)?.description}
                </p>
              </div>
            </div>

                          <div className={styles.configPanelContent}>
                {(() => {
                  const section = videoSections.find(s => s.id === selectedSection);
                  const video = section ? getVideoByPath(section.path) : null;
                  
                  if (!video || !section) return <p>Video no encontrado</p>;
                  
                  return (
                    <>
                      <div className={styles.configSection}>
                        <h4>Configuración del Video</h4>
                        
                        <div className={styles.inputGroup}>
                          <label>URL de YouTube:</label>
                          <input
                            type="text"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                            onChange={(e) => handleYouTubeUrlChange(section.path, e.target.value)}
                            className={styles.input}
                          />
                        </div>
                        
                        <div className={styles.inputGroup}>
                          <label>Título:</label>
                          <input
                            type="text"
                            value={video.title}
                            onChange={(e) => handleInputChange(section.path, 'title', e.target.value)}
                            className={styles.input}
                          />
                        </div>
                        
                        <div className={styles.inputGroup}>
                          <label>Descripción:</label>
                          <textarea
                            value={video.description}
                            onChange={(e) => handleInputChange(section.path, 'description', e.target.value)}
                            className={styles.textarea}
                            rows={3}
                          />
                        </div>
                        
                        <div className={styles.checkboxGroup}>
                          <label>
                            <input
                              type="checkbox"
                              checked={video.autoplay}
                              onChange={(e) => handleInputChange(section.path, 'autoplay', e.target.checked)}
                            />
                            Reproducción automática
                          </label>
                          
                          <label>
                            <input
                              type="checkbox"
                              checked={video.muted}
                              onChange={(e) => handleInputChange(section.path, 'muted', e.target.checked)}
                            />
                            Silenciado
                          </label>
                          
                          <label>
                            <input
                              type="checkbox"
                              checked={video.loop}
                              onChange={(e) => handleInputChange(section.path, 'loop', e.target.checked)}
                            />
                            Repetir
                          </label>
                        </div>
                      </div>

                      <div className={styles.previewSection}>
                        <h4>Vista Previa</h4>
                        {video.youtubeId && video.youtubeId !== 'dQw4w9WgXcQ' ? (
                          <div className={styles.videoPreview}>
                            <iframe
                              width="100%"
                              height="200"
                              src={`https://www.youtube.com/embed/${video.youtubeId}?rel=0&modestbranding=1`}
                              title={video.title}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className={styles.noPreview}>
                            <Video size={48} />
                            <p>Configura una URL de YouTube para ver la vista previa</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

            <div className={styles.actionsSection}>
              <button
                onClick={handleSave}
                disabled={saving}
                className={styles.saveButton}
              >
                {saving ? (
                  <>
                    <div className={styles.spinner}></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Configuración
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Acciones Globales */}
        <div className={styles.globalActions}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.globalSaveButton}
          >
            {saving ? 'Guardando...' : '💾 Guardar Todos los Cambios'}
          </button>
        </div>
      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const verification = await verifyAdminAccess(context);
  
  if (!verification.isAdmin) {
    return {
      redirect: {
        destination: verification.redirectTo || '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: verification.user
    }
  };
};

export default VideoConfig; 