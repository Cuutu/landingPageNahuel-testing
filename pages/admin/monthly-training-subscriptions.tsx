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
  meetLinks: string[];
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
  meetLinksAvailable: Record<string, string[]>;
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
  const [showFilters, setShowFilters] = useState(true); // Siempre visibles

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
                  onClick={fetchSubscriptions}
                  className={styles.actionButton}
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                  }}
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Actualizando...' : 'Actualizar Datos'}
                </button>
              </div>
            </div>

            {/* Filtros - Siempre visibles */}
            <div className={styles.card} style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              color: 'white'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 20, color: 'white', fontSize: '18px', fontWeight: '600' }}>
                🔍 Filtros de Búsqueda
              </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={{ color: 'white', fontWeight: '500', marginBottom: '8px', display: 'block' }}>📅 Año</label>
                    <select
                      value={filters.year}
                      onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {[2024, 2025, 2026, 2027].map(year => (
                        <option key={year} value={year} style={{ background: '#333', color: 'white' }}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ color: 'white', fontWeight: '500', marginBottom: '8px', display: 'block' }}>🗓️ Mes</label>
                    <select
                      value={filters.month}
                      onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month} style={{ background: '#333', color: 'white' }}>{getMonthName(month)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ color: 'white', fontWeight: '500', marginBottom: '8px', display: 'block' }}>📚 Tipo de Entrenamiento</label>
                    <select
                      value={filters.trainingType}
                      onChange={(e) => setFilters({ ...filters, trainingType: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <option value="all" style={{ background: '#333', color: 'white' }}>🎯 Todos</option>
                      <option value="SwingTrading" style={{ background: '#333', color: 'white' }}>📈 Swing Trading</option>
                      <option value="DayTrading" style={{ background: '#333', color: 'white' }}>⚡ Day Trading</option>
                      <option value="DowJones" style={{ background: '#333', color: 'white' }}>📊 Dow Jones</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ color: 'white', fontWeight: '500', marginBottom: '8px', display: 'block' }}>✅ Estado</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <option value="completed" style={{ background: '#333', color: 'white' }}>✅ Completado</option>
                      <option value="pending" style={{ background: '#333', color: 'white' }}>⏳ Pendiente</option>
                      <option value="failed" style={{ background: '#333', color: 'white' }}>❌ Fallido</option>
                      <option value="refunded" style={{ background: '#333', color: 'white' }}>🔄 Reembolsado</option>
                    </select>
                  </div>
                </div>
              </div>

            {/* Estadísticas */}
            {stats && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '20px',
                marginBottom: '24px'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  color: 'white',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: '12px', 
                      padding: '12px',
                      marginRight: '16px'
                    }}>
                      <Users size={24} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1' }}>{stats.total}</div>
                      <div style={{ fontSize: '14px', opacity: '0.9', fontWeight: '500' }}>Total Suscripciones</div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  color: 'white',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: '12px', 
                      padding: '12px',
                      marginRight: '16px'
                    }}>
                      <CheckCircle size={24} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1' }}>{stats.active}</div>
                      <div style={{ fontSize: '14px', opacity: '0.9', fontWeight: '500' }}>Activas</div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  color: 'white',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: '12px', 
                      padding: '12px',
                      marginRight: '16px'
                    }}>
                      <DollarSign size={24} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1' }}>${stats.revenue.toLocaleString()}</div>
                      <div style={{ fontSize: '14px', opacity: '0.9', fontWeight: '500' }}>Ingresos</div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  color: 'white',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: '12px', 
                      padding: '12px',
                      marginRight: '16px'
                    }}>
                      <TrendingUp size={24} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: '1' }}>{stats.byType.length}</div>
                      <div style={{ fontSize: '14px', opacity: '0.9', fontWeight: '500' }}>Tipos de Entrenamiento</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Debug de Links de Meet */}
            {stats && stats.meetLinksAvailable && (
              <div style={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                color: '#e5e7eb'
              }}>
                <h4 style={{ color: '#fbbf24', marginTop: 0, marginBottom: 12 }}>
                  🔧 Debug: Links de Meet Disponibles
                </h4>
                <pre style={{ 
                  background: '#111827', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '12px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap'
                }}>
                  {JSON.stringify(stats.meetLinksAvailable, null, 2)}
                </pre>
              </div>
            )}

            {/* Panel de Recordatorios */}
            <div className={styles.card} style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              border: 'none',
              color: 'white'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 20, color: 'white', fontSize: '20px', fontWeight: '600' }}>
                📧 Enviar Recordatorios
              </h3>
              
              {/* Información sobre links de Meet */}
              {stats && stats.meetLinksAvailable && Object.keys(stats.meetLinksAvailable).length > 0 && (
                <div style={{ 
                  background: '#DCFCE7', 
                  border: '1px solid #22c55e', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  marginBottom: '16px' 
                }}>
                  <h4 style={{ color: '#166534', marginTop: 0, marginBottom: 8 }}>
                    🔗 Links de Google Meet Disponibles
                  </h4>
                  {Object.entries(stats.meetLinksAvailable).map(([trainingType, links]) => (
                    <div key={trainingType} style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#166534' }}>
                        {getTrainingDisplayName(trainingType)}: {links.length} clase{links.length !== 1 ? 's' : ''}
                      </strong>
                      {links.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#166534', marginTop: 4 }}>
                          {links.map((link, index) => (
                            <div key={index} style={{ marginBottom: 2 }}>
                              📹 Clase {index + 1}: {link}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
                <div>
                  <label style={{ color: 'white', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                    💬 Mensaje Personalizado (Opcional)
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Escribe un mensaje personalizado para incluir en los recordatorios..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      fontSize: '14px',
                      backdropFilter: 'blur(10px)',
                      resize: 'vertical',
                      minHeight: '80px'
                    }}
                    rows={3}
                  />
                </div>
                <button
                  onClick={sendReminders}
                  disabled={sendingReminders || subscriptions.length === 0}
                  style={{ 
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '16px 28px',
                    borderRadius: '12px',
                    fontWeight: '600',
                    cursor: sendingReminders ? 'not-allowed' : 'pointer',
                    opacity: sendingReminders ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '16px',
                    boxShadow: '0 6px 20px rgba(79, 172, 254, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!sendingReminders && subscriptions.length > 0) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(79, 172, 254, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(79, 172, 254, 0.3)';
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
                        <th className={styles.tableHeader}>Links de Meet</th>
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
                            {subscription.meetLinks.length > 0 ? (
                              <div>
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                  {subscription.meetLinks.length} disponible{subscription.meetLinks.length !== 1 ? 's' : ''}
                                </span>
                                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: 4 }}>
                                  {subscription.meetLinks.slice(0, 2).map((link, index) => (
                                    <div key={index} style={{ marginBottom: 2 }}>
                                      📹 Clase {index + 1}
                                    </div>
                                  ))}
                                  {subscription.meetLinks.length > 2 && (
                                    <div>+{subscription.meetLinks.length - 2} más</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className={`${styles.badge} ${styles.badgeWarning}`}>
                                Sin links
                              </span>
                            )}
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
