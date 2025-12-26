import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  Bell, 
  ArrowLeft,
  CheckCircle,
  Clock,
  Mail,
  User as UserIcon,
  DollarSign,
  Calendar,
  Send,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  X
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminIndicatorsUsers.module.css';
import toast from 'react-hot-toast';

interface IndicatorUser {
  _id: string;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  transactionDate: string;
  tradingViewUser?: string;
  formSubmitted: boolean;
  paymentId: string;
  notificationSent: boolean; // ✅ NUEVO: Estado de notificación
}

interface AdminIndicatorsUsersProps {
  user: any;
}

export default function AdminIndicatorsUsersPage({ user }: AdminIndicatorsUsersProps) {
  const [loading, setLoading] = useState(true);
  const [indicatorUsers, setIndicatorUsers] = useState<IndicatorUser[]>([]);
  const [notifyingUser, setNotifyingUser] = useState<string | null>(null);
  const [markingAsNotified, setMarkingAsNotified] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubmitted, setFilterSubmitted] = useState<'all' | 'new' | 'without-notification' | 'notified'>('all');

  const fetchIndicatorUsers = async () => {
    try {
      setLoading(true);
      // ✅ CORREGIDO: Agregar timestamp para evitar caché
      const response = await fetch(`/api/admin/indicators/users?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await response.json();

      if (data.success) {
        const previousCount = indicatorUsers.length;
        const newUsers = data.users || [];
        
        // ✅ DEBUG: Verificar usuarios notificados
        const notifiedUsers = newUsers.filter((u: IndicatorUser) => u.notificationSent);
        console.log('📊 Usuarios cargados:', {
          total: newUsers.length,
          notificados: notifiedUsers.length,
          sinNotificar: newUsers.length - notifiedUsers.length
        });
        
        setIndicatorUsers(newUsers);
        
        // ✅ NUEVO: Mostrar mensaje informativo si se actualizó la lista
        if (previousCount > 0) {
          const notifiedCount = notifiedUsers.length;
          toast.success(`Lista actualizada: ${newUsers.length} usuarios (${notifiedCount} notificados)`, {
            duration: 3000
          });
        }
      } else {
        toast.error(data.error || 'Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error fetching indicator users:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndicatorUsers();
  }, []);

  const handleNotifyUser = async (paymentId: string, userEmail: string, userName: string, tradingViewUser?: string) => {
    if (!confirm(`¿Enviar notificación de alta a ${userName}?`)) {
      return;
    }

    setNotifyingUser(paymentId);
    try {
      const response = await fetch('/api/admin/indicators/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          userEmail,
          userName,
          tradingViewUser
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Notificación enviada exitosamente');
        // ✅ CORREGIDO: Recargar la lista completa desde el servidor para asegurar sincronización
        // Esto hace que el usuario desaparezca automáticamente si el filtro está en 'new' o 'without-notification'
        await fetchIndicatorUsers();
      } else {
        toast.error(data.error || 'Error al enviar notificación.');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Error de conexión');
    } finally {
      setNotifyingUser(null);
    }
  };

  // ✅ NUEVO: Función para marcar como notificado sin enviar email
  const handleMarkAsNotified = async (paymentId: string, userName: string) => {
    if (!confirm(`¿Marcar a ${userName} como notificado sin enviar email?\n\nEsto hará que desaparezca de la lista de usuarios a notificar.`)) {
      return;
    }

    setMarkingAsNotified(paymentId);
    try {
      const response = await fetch('/api/admin/indicators/mark-notified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Usuario marcado como notificado (sin enviar email)');
        // ✅ CORREGIDO: Esperar un momento antes de recargar para asegurar que el servidor guardó
        await new Promise(resolve => setTimeout(resolve, 500));
        // Recargar la lista para que desaparezca
        await fetchIndicatorUsers();
      } else {
        toast.error(data.error || 'Error al marcar como notificado.');
      }
    } catch (error) {
      console.error('Error marking as notified:', error);
      toast.error('Error de conexión');
    } finally {
      setMarkingAsNotified(null);
    }
  };

  const filteredUsers = indicatorUsers.filter(user => {
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !user.userEmail.toLowerCase().includes(search) &&
        !user.userName.toLowerCase().includes(search) &&
        !(user.tradingViewUser?.toLowerCase().includes(search))
      ) {
        return false;
      }
    }

    // Filtro por estado de notificación
    if (filterSubmitted === 'new' && user.notificationSent) {
      return false;
    }
    if (filterSubmitted === 'without-notification' && user.notificationSent) {
      return false;
    }
    if (filterSubmitted === 'notified' && !user.notificationSent) {
      return false;
    }

    return true;
  });

  const stats = {
    total: indicatorUsers.length,
    newUsers: indicatorUsers.filter(u => !u.notificationSent).length,
    withoutNotification: indicatorUsers.filter(u => !u.notificationSent).length,
    notified: indicatorUsers.filter(u => u.notificationSent).length
  };

  return (
    <>
      <Head>
        <title>Usuarios de Indicadores - Admin</title>
        <meta name="description" content="Gestión de usuarios del servicio de indicadores" />
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
                <Link href="/admin/dashboard" className={styles.backButton}>
                  <ArrowLeft size={20} />
                </Link>
                <div className={styles.headerIcon}>
                  <BarChart3 size={32} />
                </div>
                <div>
                  <h1 className={styles.title}>Usuarios de Indicadores</h1>
                  <p className={styles.subtitle}>
                    Gestión de usuarios que compraron el servicio de Medias Móviles Automáticas
                  </p>
                </div>
              </div>

              <div className={styles.headerActions}>
                <button 
                  onClick={fetchIndicatorUsers}
                  disabled={loading}
                  className={styles.actionButton}
                  title="Actualizar lista de usuarios"
                >
                  <RefreshCw size={20} className={loading ? styles.spinning : ''} />
                  Actualizar
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
              <motion.div
                className={styles.statCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className={styles.statIcon}>
                  <Users size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.total}</h3>
                  <p>Total Usuarios</p>
                </div>
              </motion.div>

              <motion.div
                className={styles.statCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className={styles.statIcon}>
                  <UserIcon size={24} className={styles.iconYellow} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.newUsers}</h3>
                  <p>Usuarios Nuevos</p>
                </div>
              </motion.div>

              <motion.div
                className={styles.statCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className={styles.statIcon}>
                  <AlertCircle size={24} className={styles.iconOrange} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.withoutNotification}</h3>
                  <p>Sin Notificar</p>
                </div>
              </motion.div>

              <motion.div
                className={styles.statCard}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className={styles.statIcon}>
                  <Bell size={24} className={styles.iconPurple} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.notified}</h3>
                  <p>Notificados</p>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <div className={styles.filtersContainer}>
              <div className={styles.searchContainer}>
                <Search size={20} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar por email, nombre o usuario de TradingView..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                {/* ✅ NUEVO: Botón de actualizar más visible */}
                <button 
                  onClick={fetchIndicatorUsers}
                  disabled={loading}
                  className={styles.refreshButton}
                  title="Actualizar lista desde el servidor"
                  style={{
                    marginLeft: '1rem',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  <RefreshCw size={18} className={loading ? styles.spinning : ''} />
                  {loading ? 'Actualizando...' : 'Actualizar Lista'}
                </button>
              </div>

              <div className={styles.filterButtons}>
                <button
                  onClick={() => setFilterSubmitted('all')}
                  className={`${styles.filterButton} ${filterSubmitted === 'all' ? styles.active : ''}`}
                >
                  Total usuarios ({stats.total})
                </button>
                <button
                  onClick={() => setFilterSubmitted('new')}
                  className={`${styles.filterButton} ${filterSubmitted === 'new' ? styles.active : ''}`}
                >
                  Nuevos ({stats.newUsers})
                </button>
                <button
                  onClick={() => setFilterSubmitted('without-notification')}
                  className={`${styles.filterButton} ${filterSubmitted === 'without-notification' ? styles.active : ''}`}
                >
                  Sin notificar ({stats.withoutNotification})
                </button>
                <button
                  onClick={() => setFilterSubmitted('notified')}
                  className={`${styles.filterButton} ${filterSubmitted === 'notified' ? styles.active : ''}`}
                >
                  Notificados ({stats.notified})
                </button>
              </div>
            </div>

            {/* Users List */}
            {loading ? (
              <div className={styles.loadingContainer}>
                <RefreshCw size={48} className={styles.spinning} />
                <p>Cargando usuarios...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.emptyContainer}>
                <Users size={64} />
                <h3>No hay usuarios</h3>
                <p>No se encontraron usuarios con los filtros aplicados</p>
              </div>
            ) : (
              <div className={styles.usersGrid}>
                {filteredUsers.map((indicatorUser, index) => (
                  <motion.div
                    key={indicatorUser.paymentId}
                    className={styles.userCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className={styles.userCardHeader}>
                      <div className={styles.userCardIcon}>
                        <UserIcon size={24} />
                      </div>
                      <div className={styles.userCardTitle}>
                        <h3>{indicatorUser.userName}</h3>
                        <p className={styles.userEmail}>{indicatorUser.userEmail}</p>
                      </div>
                    </div>

                    <div className={styles.userCardBody}>
                      {indicatorUser.tradingViewUser && (
                        <div className={styles.dataRow}>
                          <strong>Usuario TradingView:</strong>
                          <span className={styles.tradingViewUser}>{indicatorUser.tradingViewUser}</span>
                        </div>
                      )}

                      <div className={styles.dataRow}>
                        <strong><DollarSign size={16} /> Monto:</strong>
                        <span className={styles.amount}>
                          {indicatorUser.currency} ${indicatorUser.amount.toLocaleString('es-AR')}
                        </span>
                      </div>

                      <div className={styles.dataRow}>
                        <strong><Calendar size={16} /> Fecha:</strong>
                        <span>
                          {new Date(indicatorUser.transactionDate).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {indicatorUser.formSubmitted && (
                        <div className={styles.statusBadge}>
                          <CheckCircle size={16} />
                          Formulario enviado
                        </div>
                      )}
                    </div>

                    <div className={styles.userCardFooter} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleNotifyUser(
                          indicatorUser.paymentId,
                          indicatorUser.userEmail,
                          indicatorUser.userName,
                          indicatorUser.tradingViewUser
                        )}
                        disabled={indicatorUser.notificationSent || notifyingUser === indicatorUser.paymentId}
                        className={`${styles.notifyButton} ${indicatorUser.notificationSent ? styles.notified : ''}`}
                      >
                        {notifyingUser === indicatorUser.paymentId ? (
                          <>
                            <RefreshCw size={16} className={styles.spinning} />
                            Enviando...
                          </>
                        ) : indicatorUser.notificationSent ? (
                          <>
                            <CheckCircle size={16} />
                            Notificado
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Notificar
                          </>
                        )}
                      </button>
                      
                      {/* ✅ NUEVO: Botón para marcar como notificado sin enviar email */}
                      {!indicatorUser.notificationSent && (
                        <button
                          onClick={() => handleMarkAsNotified(
                            indicatorUser.paymentId,
                            indicatorUser.userName
                          )}
                          disabled={markingAsNotified === indicatorUser.paymentId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.625rem 1rem',
                            backgroundColor: markingAsNotified === indicatorUser.paymentId ? '#9ca3af' : '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: markingAsNotified === indicatorUser.paymentId ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => {
                            if (markingAsNotified !== indicatorUser.paymentId) {
                              e.currentTarget.style.backgroundColor = '#4b5563';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (markingAsNotified !== indicatorUser.paymentId) {
                              e.currentTarget.style.backgroundColor = '#6b7280';
                            }
                          }}
                          title="Marcar como notificado sin enviar email (para limpiar usuarios antiguos)"
                        >
                          {markingAsNotified === indicatorUser.paymentId ? (
                            <>
                              <RefreshCw size={16} className={styles.spinning} />
                              Marcando...
                            </>
                          ) : (
                            <>
                              <X size={16} />
                              Quitar de lista
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
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
  try {
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
        user: verification.session?.user || verification.user,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};
