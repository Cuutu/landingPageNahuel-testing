import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Mail, 
  Calendar, 
  Filter, 
  Send, 
  RefreshCw, 
  Loader,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/AdminDashboard.module.css';
import toast from 'react-hot-toast';

interface Subscription {
  _id: string;
  userId: string;
  userEmail: string;
  userName: string;
  trainingType: 'SwingTrading' | 'DayTrading' | 'DowJones';
  subscriptionMonth: number;
  subscriptionYear: number;
  startDate: string;
  endDate: string;
  paymentAmount: number;
  paymentStatus: string;
  isActive: boolean;
  accessGranted: boolean;
  createdAt: string;
  user: {
    name: string;
    email: string;
    phone?: string;
  };
}

interface Stats {
  total: number;
  active: number;
  revenue: number;
  byType: Array<{
    _id: string;
    count: number;
    totalRevenue: number;
    activeSubscriptions: number;
  }>;
}

interface MonthlyTrainingSubscriptionsProps {
  user: any;
}

export default function MonthlyTrainingSubscriptionsPage({ user }: MonthlyTrainingSubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [filters, setFilters] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    trainingType: 'all',
    status: 'completed'
  });
  const [customMessage, setCustomMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    fetchSubscriptions();
  }, [filters]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        year: filters.year.toString(),
        month: filters.month.toString(),
        trainingType: filters.trainingType,
        status: filters.status
      });

      const response = await fetch(`/api/admin/monthly-training-subscriptions?${params}`);
      const data = await response.json();

      if (data.success) {
        setSubscriptions(data.data.subscriptions);
        setStats(data.data.stats);
      } else {
        toast.error('Error al cargar suscripciones');
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast.error('Error al cargar suscripciones');
    } finally {
      setLoading(false);
    }
  };

  const sendReminders = async () => {
    if (subscriptions.length === 0) {
      toast.error('No hay suscripciones para enviar recordatorios');
      return;
    }

    try {
      setSendingReminders(true);
      
      const response = await fetch('/api/admin/send-training-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: filters.year,
          month: filters.month,
          trainingType: filters.trainingType,
          message: customMessage,
          sendToAll: true
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Recordatorios enviados: ${data.results.sent} exitosos, ${data.results.failed} fallidos`);
        if (data.results.errors.length > 0) {
          console.error('Errores en envío:', data.results.errors);
        }
      } else {
        toast.error(data.error || 'Error al enviar recordatorios');
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
      toast.error('Error al enviar recordatorios');
    } finally {
      setSendingReminders(false);
    }
  };

  const getTrainingDisplayName = (type: string) => {
    const names: { [key: string]: string } = {
      'SwingTrading': 'Swing Trading',
      'DayTrading': 'Day Trading',
      'DowJones': 'Dow Jones'
    };
    return names[type] || type;
  };

  const getMonthName = (month: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1] || 'Mes';
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (status === 'completed' && isActive) {
      return <span className={`${styles.badge} ${styles.badgeSuccess}`}>✅ Activo</span>;
    } else if (status === 'completed' && !isActive) {
      return <span className={`${styles.badge} ${styles.badgeWarning}`}>⏸️ Inactivo</span>;
    } else if (status === 'pending') {
      return <span className={`${styles.badge} ${styles.badgeWarning}`}>⏳ Pendiente</span>;
    } else {
      return <span className={`${styles.badge} ${styles.badgeError}`}>❌ ${status}</span>;
    }
  };

  return (
    <>
      <Head>
        <title>Gestión de Suscripciones Mensuales - Admin Dashboard</title>
        <meta name="description" content="Administra las suscripciones mensuales de entrenamientos" />
      </Head>
      
      <Navbar />
      
      <main className={`${styles.main} admin-dashboard`}>
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
                  <BookOpen size={30} />
                </div>
                <div>
                  <h1 className={styles.title}>Suscripciones Mensuales de Entrenamientos</h1>
                  <p className={styles.subtitle}>
                    Gestiona usuarios suscritos a entrenamientos mensuales y envía recordatorios
                  </p>
                </div>
              </div>
              
              <div className={styles.headerActions}>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={styles.actionButton}
                >
                  <Filter size={20} />
                  Filtros
                </button>
                <button 
                  onClick={fetchSubscriptions}
                  className={styles.actionButton}
                  disabled={loading}
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  Actualizar
                </button>
              </div>
            </div>

            {/* Filtros */}
            {showFilters && (
              <motion.div
                className={styles.card}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 16 }}>Filtros</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div>
                    <label className={styles.label}>Año</label>
                    <select
                      value={filters.year}
                      onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                      className={styles.input}
                    >
                      {[2024, 2025, 2026].map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className={styles.label}>Mes</label>
                    <select
                      value={filters.month}
                      onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
                      className={styles.input}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month}>{getMonthName(month)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className={styles.label}>Tipo de Entrenamiento</label>
                    <select
                      value={filters.trainingType}
                      onChange={(e) => setFilters({ ...filters, trainingType: e.target.value })}
                      className={styles.input}
                    >
                      <option value="all">Todos</option>
                      <option value="SwingTrading">Swing Trading</option>
                      <option value="DayTrading">Day Trading</option>
                      <option value="DowJones">Dow Jones</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className={styles.label}>Estado</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      className={styles.input}
                    >
                      <option value="completed">Completado</option>
                      <option value="pending">Pendiente</option>
                      <option value="failed">Fallido</option>
                      <option value="refunded">Reembolsado</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Estadísticas */}
            {stats && (
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <Users size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>{stats.total}</div>
                    <div className={styles.statLabel}>Total Suscripciones</div>
                  </div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <CheckCircle size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>{stats.active}</div>
                    <div className={styles.statLabel}>Activas</div>
                  </div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <DollarSign size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>${stats.revenue.toLocaleString()}</div>
                    <div className={styles.statLabel}>Ingresos</div>
                  </div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>
                    <TrendingUp size={24} />
                  </div>
                  <div className={styles.statContent}>
                    <div className={styles.statValue}>{stats.byType.length}</div>
                    <div className={styles.statLabel}>Tipos de Entrenamiento</div>
                  </div>
                </div>
              </div>
            )}

            {/* Panel de Recordatorios */}
            <div className={styles.card}>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>Enviar Recordatorios</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
                <div>
                  <label className={styles.label}>Mensaje Personalizado (Opcional)</label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Escribe un mensaje personalizado para incluir en los recordatorios..."
                    className={styles.input}
                    rows={3}
                  />
                </div>
                <button
                  onClick={sendReminders}
                  disabled={sendingReminders || subscriptions.length === 0}
                  className={styles.actionButton}
                  style={{ 
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: sendingReminders ? 'not-allowed' : 'pointer',
                    opacity: sendingReminders ? 0.7 : 1
                  }}
                >
                  {sendingReminders ? (
                    <>
                      <Loader size={20} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Enviar a {subscriptions.length} usuarios
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lista de Suscripciones */}
            <div className={styles.card}>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>
                Suscripciones - {getMonthName(filters.month)} {filters.year}
                {filters.trainingType !== 'all' && ` - ${getTrainingDisplayName(filters.trainingType)}`}
              </h3>
              
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader size={32} className="animate-spin" />
                  <p style={{ marginTop: 16 }}>Cargando suscripciones...</p>
                </div>
              ) : subscriptions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <Users size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <p>No se encontraron suscripciones para los filtros seleccionados</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.tableHeader}>Usuario</th>
                        <th className={styles.tableHeader}>Email</th>
                        <th className={styles.tableHeader}>Entrenamiento</th>
                        <th className={styles.tableHeader}>Estado</th>
                        <th className={styles.tableHeader}>Monto</th>
                        <th className={styles.tableHeader}>Fecha de Suscripción</th>
                        <th className={styles.tableHeader}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((subscription) => (
                        <tr key={subscription._id} className={styles.tableRow}>
                          <td className={styles.tableCell}>
                            <div>
                              <div style={{ fontWeight: '600' }}>{subscription.user.name}</div>
                              {subscription.user.phone && (
                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                  📞 {subscription.user.phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={styles.tableCell}>
                            <a href={`mailto:${subscription.user.email}`} style={{ color: '#3b82f6' }}>
                              {subscription.user.email}
                            </a>
                          </td>
                          <td className={styles.tableCell}>
                            <span className={`${styles.badge} ${styles.badgeInfo}`}>
                              {getTrainingDisplayName(subscription.trainingType)}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            {getStatusBadge(subscription.paymentStatus, subscription.isActive)}
                          </td>
                          <td className={styles.tableCell}>
                            <span style={{ fontWeight: '600', color: '#059669' }}>
                              ${subscription.paymentAmount.toLocaleString()}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            {new Date(subscription.createdAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className={styles.tableCell}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a
                                href={`mailto:${subscription.user.email}?subject=Recordatorio: Clases de ${getTrainingDisplayName(subscription.trainingType)} - ${getMonthName(filters.month)} ${filters.year}`}
                                className={styles.actionButton}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                <Mail size={14} />
                                Email
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
  const adminCheck = await verifyAdminAccess(context);
  if (!adminCheck.isAdmin) {
    return {
      redirect: { destination: adminCheck.redirectTo || '/', permanent: false }
    };
  }
  return { 
    props: { 
      user: adminCheck.session?.user || adminCheck.user 
    } 
  };
};
