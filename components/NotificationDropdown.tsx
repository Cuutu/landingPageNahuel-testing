import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Bell, X, ExternalLink, Clock, ArrowRight, Check, CheckCheck, Trash2 } from 'lucide-react';
import styles from '@/styles/NotificationDropdown.module.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'novedad' | 'actualizacion' | 'sistema' | 'promocion' | 'alerta';
  priority: 'alta' | 'media' | 'baja';
  icon: string;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
  timeAgo: string;
  isRead: boolean;
  isAutomatic?: boolean;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose, onUpdate }) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('normal');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [deletingRead, setDeletingRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Obtener notificaciones
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/get?limit=8');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        
        // Notificar al componente padre sobre la actualización
        if (onUpdate) {
          onUpdate();
        }
      }
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Marcar notificación como leída
  const markAsRead = async (notificationId: string) => {
    try {
      // console.log('🔔 Marcando notificación como leída:', notificationId);
      setMarkingAsRead(notificationId);
      
      const response = await fetch('/api/notifications/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId }),
      });

      // console.log('🔔 Respuesta del servidor:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        // console.log('🔔 Resultado exitoso:', result);
        
        // Actualizar estado local
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, isRead: true }
              : notification
          )
        );
        
        // Actualizar contador
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Notificar al componente padre
        if (onUpdate) {
          onUpdate();
        }
      } else {
        const errorData = await response.json();
        console.error('🔔 Error del servidor:', errorData);
      }
    } catch (error) {
      console.error('🔔 Error al marcar como leída:', error);
    } finally {
      setMarkingAsRead(null);
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      // console.log('🔔 Marcando todas las notificaciones como leídas');
      setMarkingAllAsRead(true);
      
      const response = await fetch('/api/notifications/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      // console.log('🔔 Respuesta del servidor (markAllAsRead):', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        // console.log('🔔 Resultado exitoso (markAllAsRead):', result);
        
        // Actualizar todas las notificaciones como leídas
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        setUnreadCount(0);
        
        // Notificar al componente padre
        if (onUpdate) {
          onUpdate();
        }
      } else {
        const errorData = await response.json();
        console.error('🔔 Error del servidor (markAllAsRead):', errorData);
      }
    } catch (error) {
      console.error('🔔 Error al marcar todas como leídas:', error);
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  // Eliminar todas las notificaciones leídas
  const deleteAllReadNotifications = async () => {
    try {
      // console.log('🗑️ Eliminando todas las notificaciones leídas...');
      setDeletingRead(true);
      
      const response = await fetch('/api/notifications/delete-read', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // console.log('🗑️ Respuesta del servidor:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        // console.log('🗑️ Resultado exitoso:', result);
        
        // Recargar notificaciones para reflejar los cambios
        await fetchNotifications();
        
        // Opcional: mostrar mensaje de éxito
        // console.log(`✅ ${result.deletedCount} notificaciones leídas eliminadas`);
      } else {
        const errorData = await response.json();
        console.error('🗑️ Error del servidor:', errorData);
      }
    } catch (error) {
      console.error('🗑️ Error al eliminar notificaciones leídas:', error);
    } finally {
      setDeletingRead(false);
    }
  };

  // Verificar el rol del usuario
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

  // Manejar clic en notificación
  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como leída si no lo está
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    
    // Cerrar dropdown si tiene URL de acción
    if (notification.actionUrl) {
      onClose();
    }
  };

  // Cargar notificaciones cuando se abre el dropdown
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Función para obtener el color del tipo de notificación
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'promocion': return '#f59e0b';
      case 'actualizacion': return '#3b82f6';
      case 'sistema': return '#ef4444';
      case 'alerta': return '#00ff88';
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        className={styles.dropdown}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Bell size={20} />
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </div>
          <div className={styles.headerActions}>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className={styles.markAllButton}
                title="Marcar todas como leídas"
                disabled={markingAllAsRead}
              >
                {markingAllAsRead ? (
                  <div className={styles.miniSpinner} />
                ) : (
                  <CheckCheck size={16} />
                )}
              </button>
            )}
            {/* Botón para eliminar notificaciones leídas */}
            {notifications.some(n => n.isRead) && (
              <button 
                onClick={deleteAllReadNotifications}
                className={styles.deleteReadButton}
                title="Eliminar notificaciones leídas"
                disabled={deletingRead}
              >
                {deletingRead ? (
                  <div className={styles.miniSpinner} />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            )}
            <button onClick={onClose} className={styles.closeButton}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Cargando notificaciones...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <Bell size={48} className={styles.emptyIcon} />
              <h4>Sin notificaciones</h4>
              <p>No tienes notificaciones nuevas por el momento.</p>
            </div>
          ) : (
            <div className={styles.notificationsList}>
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  className={`${styles.notificationItem} ${notification.isRead ? styles.read : styles.unread}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Priority indicator */}
                  <div 
                    className={styles.priorityIndicator}
                    style={{ backgroundColor: getPriorityColor(notification.priority) }}
                  />

                  {/* Icon */}
                  <div className={styles.notificationIcon}>
                    <span className={styles.emoji}>{notification.icon}</span>
                    {notification.isAutomatic && (
                      <span className={styles.automaticBadge} title="Notificación automática">
                        🤖
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <h4 className={styles.notificationTitle}>
                        {notification.title}
                        {!notification.isRead && (
                          <span className={styles.unreadDot}></span>
                        )}
                      </h4>
                      <div className={styles.notificationMeta}>
                        <span 
                          className={styles.notificationType}
                          style={{ color: getTypeColor(notification.type) }}
                        >
                          {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
                        </span>
                        <Clock size={12} />
                        <span className={styles.timeAgo}>{notification.timeAgo}</span>
                      </div>
                    </div>
                    
                    <div 
                      className={styles.notificationMessage}
                      dangerouslySetInnerHTML={{ __html: notification.message }}
                    />
                    
                    {/* Action button */}
                    {notification.actionUrl && notification.actionText && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReportLink(notification.actionUrl!, notification.actionText!);
                          onClose();
                        }}
                        className={styles.actionButton}
                      >
                        {notification.actionText}
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>

                  {/* Mark as read button */}
                  {!notification.isRead && (
                    <button
                      className={styles.markReadButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      disabled={markingAsRead === notification.id}
                      title="Marcar como leída"
                    >
                      {markingAsRead === notification.id ? (
                        <div className={styles.miniSpinner} />
                      ) : (
                        <Check size={14} />
                      )}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Link href="/notificaciones" className={styles.viewAllButton} onClick={onClose}>
            Ver todas las notificaciones
            <ArrowRight size={16} />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationDropdown; 