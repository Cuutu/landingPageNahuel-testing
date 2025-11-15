import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { 
  Bell, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertTriangle,
  Megaphone,
  Gift
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/Notificaciones.module.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'novedad' | 'actualizacion' | 'sistema' | 'promocion';
  priority: 'alta' | 'media' | 'baja';
  icon: string;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
  timeAgo: string;
}

interface PaginationInfo {
  current: number;
  total: number;
  hasMore: boolean;
}

// Helper function para convertir URLs en links clicables
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
            color: '#00ff88',
            textDecoration: 'underline',
            wordBreak: 'break-all'
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function NotificacionesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  // const [userRole, setUserRole] = useState<string>('normal'); // Ya no se usa
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current: 1,
    total: 1,
    hasMore: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  // const [generatingNotifications, setGeneratingNotifications] = useState(false); // Ya no se usa

  // Obtener notificaciones
  const fetchNotifications = async (page: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notifications/get?limit=10&page=${page}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Verificar el rol del usuario - YA NO SE USA
  /*
  useEffect(() => {
    const checkUserRole = async () => {
      if (!session?.user?.email) return;
      
      try {
        const response = await fetch(`/api/users/role?email=${session.user.email}`);
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.role || 'normal');
        }
      } catch (error) {
        console.error('Error verificando rol:', error);
      }
    };

    checkUserRole();
  }, [session]);
  */

  // Cargar notificaciones al montar el componente
  useEffect(() => {
    fetchNotifications(currentPage);
  }, [currentPage]);

  // Filtrar notificaciones
  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'todos' || notification.type === filterType;
    return matchesSearch && matchesFilter;
  });

  // Funciones para paginación
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Función para generar notificaciones reales - YA NO SE USA
  /*
  const generateRealNotifications = async () => {
    try {
      setGeneratingNotifications(true);
      const response = await fetch('/api/notifications/generate-real', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Se generaron ${data.notifications.length} notificaciones reales basadas en tus datos`);
        // Recargar notificaciones
        fetchNotifications(currentPage);
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error generando notificaciones:', error);
      alert('❌ Error generando notificaciones');
    } finally {
      setGeneratingNotifications(false);
    }
  };
  */

  // Función para manejar enlaces a informes
  const handleReportLink = (actionUrl: string, actionText: string) => {
    // Todos los usuarios pueden acceder a los informes para leerlos
    // Usar router.push en lugar de window.open para evitar bloqueos del navegador
    if (actionUrl.startsWith('/')) {
      router.push(actionUrl);
    } else {
      window.open(actionUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Función para obtener el ícono del tipo
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'promocion': return <Gift size={20} />;
      case 'actualizacion': return <CheckCircle size={20} />;
      case 'sistema': return <AlertTriangle size={20} />;
      default: return <Megaphone size={20} />;
    }
  };

  // Función para obtener el color del tipo
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'promocion': return '#f59e0b';
      case 'actualizacion': return '#3b82f6';
      case 'sistema': return '#ef4444';
      default: return '#10b981';
    }
  };

  // Función para obtener el color de la prioridad
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return '#ef4444';
      case 'media': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <>
      <Head>
        <title>Notificaciones - Nahuel Lozano</title>
        <meta name="description" content="Centro de notificaciones y novedades" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIcon}>
                  <Bell size={32} />
                </div>
                <div>
                  <h1 className={styles.title}>Centro de Notificaciones</h1>
                  <p className={styles.subtitle}>
                    Mantente al día con todas las novedades y actualizaciones
                  </p>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
              {/* Search */}
              <div className={styles.searchContainer}>
                <Search size={20} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar notificaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Filter */}
              <div className={styles.filterContainer}>
                <Filter size={20} className={styles.filterIcon} />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="novedad">Novedades</option>
                  <option value="actualizacion">Actualizaciones</option>
                  <option value="sistema">Sistema</option>
                  <option value="promocion">Promociones</option>
                </select>
              </div>

              {/* Generate Real Notifications Button - OCULTO */}
              {/* 
              <button
                onClick={generateRealNotifications}
                disabled={generatingNotifications}
                className={styles.generateButton}
              >
                {generatingNotifications ? (
                  <>
                    <div className={styles.spinner}></div>
                    Generando...
                  </>
                ) : (
                  <>
                    <Bell size={20} />
                    Generar Notificaciones Reales
                  </>
                )}
              </button>
              */}
            </div>

            {/* Notifications List */}
            <div className={styles.notificationsList}>
              {loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Cargando notificaciones...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className={styles.empty}>
                  <Bell size={64} className={styles.emptyIcon} />
                  <h3>Sin notificaciones</h3>
                  <p>
                    {searchTerm || filterType !== 'todos' 
                      ? 'No se encontraron notificaciones que coincidan con tu búsqueda.'
                      : 'No tienes notificaciones nuevas por el momento.'
                    }
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    className={styles.notificationCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {/* Priority indicator */}
                    <div 
                      className={styles.priorityIndicator}
                      style={{ backgroundColor: getPriorityColor(notification.priority) }}
                    />

                    {/* Card content */}
                    <div className={styles.cardContent}>
                      {/* Header */}
                      <div className={styles.cardHeader}>
                        <div className={styles.cardHeaderLeft}>
                          <div 
                            className={styles.typeIcon}
                            style={{ color: getTypeColor(notification.type) }}
                          >
                            {getTypeIcon(notification.type)}
                          </div>
                          <div className={styles.notificationIcon}>
                            <span className={styles.emoji}>{notification.icon}</span>
                          </div>
                          <div>
                            <h3 className={styles.notificationTitle}>{notification.title}</h3>
                            <div className={styles.notificationMeta}>
                              <span 
                                className={styles.notificationType}
                                style={{ color: getTypeColor(notification.type) }}
                              >
                                {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                              </span>
                              <Clock size={14} />
                              <span className={styles.timeAgo}>{notification.timeAgo}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Message */}
                      <div className={styles.cardBody}>
                        <div 
                          className={styles.notificationMessage}
                          dangerouslySetInnerHTML={{ __html: notification.message }}
                        />
                      </div>

                      {/* Action */}
                      {notification.actionUrl && notification.actionText && (
                        <div className={styles.cardFooter}>
                          <button 
                            onClick={() => handleReportLink(notification.actionUrl!, notification.actionText!)}
                            className={styles.actionButton}
                          >
                            {notification.actionText}
                            <ExternalLink size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Pagination */}
            {!loading && filteredNotifications.length > 0 && (
              <div className={styles.pagination}>
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={styles.paginationButton}
                >
                  <ChevronLeft size={20} />
                  Anterior
                </button>
                
                <div className={styles.paginationInfo}>
                  Página {pagination.current} de {pagination.total}
                </div>
                
                <button
                  onClick={handleNextPage}
                  disabled={!pagination.hasMore}
                  className={styles.paginationButton}
                >
                  Siguiente
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
    },
  };
}; 