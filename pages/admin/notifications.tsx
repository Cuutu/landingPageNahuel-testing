import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  Gift
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminNotifications.module.css';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'novedad' | 'actualizacion' | 'sistema' | 'promocion';
  priority: 'alta' | 'media' | 'baja';
  targetUsers: 'todos' | 'suscriptores' | 'admin';
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  icon?: string;
  actionUrl?: string;
  actionText?: string;
}

interface AdminNotificationsProps {
  user: any;
}

export default function AdminNotificationsPage({ user }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'novedad' as Notification['type'],
    priority: 'media' as Notification['priority'],
    targetUsers: 'todos' as Notification['targetUsers'],
    icon: '📢',
    actionUrl: '',
    actionText: '',
    expiresAt: ''
  });

  // Cargar notificaciones
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // console.log('📊 Notificaciones - Cargando...');
      const response = await fetch('/api/admin/notifications');
      if (response.ok) {
        const data = await response.json();
        // console.log('✅ Notificaciones - Cargadas:', data.notifications?.length);
        setNotifications(data.notifications || []);
      } else {
        console.error('❌ Notificaciones - Error al cargar:', response.status);
      }
    } catch (error) {
      console.error('💥 Notificaciones - Error al cargar:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Crear nueva notificación
  const handleCreateNotification = async () => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newNotification),
      });

      if (response.ok) {
        await fetchNotifications();
        setShowCreateForm(false);
        setNewNotification({
          title: '',
          message: '',
          type: 'novedad',
          priority: 'media',
          targetUsers: 'todos',
          icon: '📢',
          actionUrl: '',
          actionText: '',
          expiresAt: ''
        });
      }
    } catch (error) {
      console.error('Error al crear notificación:', error);
    }
  };

  // Alternar estado activo
  const toggleNotificationStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error('Error al actualizar notificación:', error);
    }
  };

  // Eliminar notificación
  const deleteNotification = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta notificación?')) {
      try {
        const response = await fetch(`/api/admin/notifications/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          await fetchNotifications();
        }
      } catch (error) {
        console.error('Error al eliminar notificación:', error);
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sistema': return <AlertCircle size={16} />;
      case 'actualizacion': return <CheckCircle size={16} />;
      case 'promocion': return <Gift size={16} />;
      default: return <Info size={16} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'alta': return styles.highPriority;
      case 'media': return styles.mediumPriority;
      case 'baja': return styles.lowPriority;
      default: return styles.mediumPriority;
    }
  };

  return (
    <>
      <Head>
        <title>Gestión de Notificaciones - Administrador</title>
        <meta name="description" content="Gestión de notificaciones del sistema" />
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
                  <Bell size={40} />
                </div>
                <div>
                  <h1 className={styles.title}>Gestión de Notificaciones</h1>
                  <p className={styles.subtitle}>
                    Crear y gestionar notificaciones del sistema
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Link href="/admin/dashboard" className={styles.backButton}>
                  ← Volver al Dashboard
                </Link>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className={`${styles.actionButton} ${styles.primary}`}
                >
                  <Plus size={20} />
                  Nueva Notificación
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Bell size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{notifications.length}</h3>
                  <p>Total Notificaciones</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Eye size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{notifications.filter(n => n.isActive).length}</h3>
                  <p>Activas</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <EyeOff size={24} className={styles.iconRed} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{notifications.filter(n => !n.isActive).length}</h3>
                  <p>Inactivas</p>
                </div>
              </div>
            </div>

            {/* Create/Edit Form */}
            {showCreateForm && (
              <motion.div
                className={styles.formOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className={styles.formModal}>
                  <div className={styles.formHeader}>
                    <h3>Nueva Notificación</h3>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      className={styles.closeButton}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className={styles.formContent}>
                    <div className={styles.formGroup}>
                      <label>Título</label>
                      <input
                        type="text"
                        value={newNotification.title}
                        onChange={(e) => setNewNotification({...newNotification, title: e.target.value})}
                        placeholder="Título de la notificación"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>Mensaje</label>
                      <textarea
                        value={newNotification.message}
                        onChange={(e) => setNewNotification({...newNotification, message: e.target.value})}
                        placeholder="Mensaje de la notificación"
                        rows={4}
                      />
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Tipo</label>
                        <select
                          value={newNotification.type}
                          onChange={(e) => setNewNotification({...newNotification, type: e.target.value as Notification['type']})}
                        >
                          <option value="novedad">Novedad</option>
                          <option value="actualizacion">Actualización</option>
                          <option value="sistema">Sistema</option>
                          <option value="promocion">Promoción</option>
                        </select>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Prioridad</label>
                        <select
                          value={newNotification.priority}
                          onChange={(e) => setNewNotification({...newNotification, priority: e.target.value as Notification['priority']})}
                        >
                          <option value="baja">Baja</option>
                          <option value="media">Media</option>
                          <option value="alta">Alta</option>
                        </select>
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Dirigido a</label>
                      <select
                        value={newNotification.targetUsers}
                        onChange={(e) => setNewNotification({...newNotification, targetUsers: e.target.value as Notification['targetUsers']})}
                      >
                        <option value="todos">Todos los usuarios</option>
                        <option value="suscriptores">Solo suscriptores</option>
                        <option value="admin">Solo administradores</option>
                      </select>
                    </div>

                    <div className={styles.formActions}>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className={styles.cancelButton}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleCreateNotification}
                        className={styles.submitButton}
                        disabled={!newNotification.title || !newNotification.message}
                      >
                        <Save size={20} />
                        Crear Notificación
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications List */}
            <div className={styles.notificationsList}>
              <h2>Notificaciones Activas</h2>
              
              {loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Cargando notificaciones...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className={styles.empty}>
                  <Bell size={48} className={styles.emptyIcon} />
                  <h3>No hay notificaciones</h3>
                  <p>Crea tu primera notificación para comenzar</p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className={styles.emptyButton}
                  >
                    <Plus size={20} />
                    Crear Notificación
                  </button>
                </div>
              ) : (
                <div className={styles.notificationsGrid}>
                  {notifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`${styles.notificationCard} ${!notification.isActive ? styles.inactive : ''}`}
                    >
                      <div className={styles.notificationHeader}>
                        <div className={styles.notificationMeta}>
                          <span className={styles.notificationIcon}>
                            {notification.icon}
                          </span>
                          <div className={styles.notificationInfo}>
                            <h4>{notification.title}</h4>
                            <div className={styles.notificationTags}>
                              <span className={`${styles.typeTag} ${styles[notification.type]}`}>
                                {getTypeIcon(notification.type)}
                                {notification.type}
                              </span>
                              <span className={`${styles.priorityTag} ${getPriorityColor(notification.priority)}`}>
                                {notification.priority}
                              </span>
                              <span className={styles.targetTag}>
                                {notification.targetUsers}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.notificationActions}>
                          <button
                            onClick={() => toggleNotificationStatus(notification._id, notification.isActive)}
                            className={`${styles.actionButton} ${notification.isActive ? styles.deactivate : styles.activate}`}
                            title={notification.isActive ? 'Desactivar' : 'Activar'}
                          >
                            {notification.isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            onClick={() => deleteNotification(notification._id)}
                            className={`${styles.actionButton} ${styles.danger}`}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className={styles.notificationContent}>
                        <div dangerouslySetInnerHTML={{ __html: notification.message }} />
                        
                        {notification.actionUrl && (
                          <div className={styles.notificationAction}>
                            <a href={notification.actionUrl} className={styles.actionLink}>
                              {notification.actionText || 'Ver más'}
                            </a>
                          </div>
                        )}
                        
                        <div className={styles.notificationFooter}>
                          <span className={styles.createdBy}>
                            Por: {notification.createdBy}
                          </span>
                          <span className={styles.createdAt}>
                            {new Date(notification.createdAt).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // console.log('🔍 [NOTIFICATIONS] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    // console.log('🔍 [NOTIFICATIONS] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      // console.log('❌ [NOTIFICATIONS] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [NOTIFICATIONS] Acceso de admin confirmado para:', verification.session?.user?.email);
    
    return {
      props: {
        user: verification.session?.user || verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [NOTIFICATIONS] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
}; 