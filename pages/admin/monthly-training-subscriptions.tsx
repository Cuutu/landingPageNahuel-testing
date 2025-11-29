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

  // Scroll automático a la sección cuando hay hash en la URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        // Esperar a que el contenido se cargue
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Ajustar un poco más arriba para compensar el navbar
            window.scrollBy(0, -80);
          }
        }, 500);
      }
    }
  }, [loading]); // Ejecutar cuando termine de cargar

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
      'SwingTrading': 'Zero 2 Trader',
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
                    background: 'linear-gradient(135deg, #365314 0%, #1a2e05 100%)',
                    color: '#e8f5e8',
                    border: '2px solid #4ade80',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 6px 20px rgba(54, 83, 20, 0.4)',
                    fontSize: '16px'
                  }}
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Actualizando...' : 'Actualizar Datos'}
                </button>
              </div>
            </div>

            {/* Filtros - Siempre visibles */}
            <div className={styles.card} style={{ 
              background: 'linear-gradient(135deg, #365314 0%, #1a2e05 100%)',
              border: 'none',
              color: 'white',
              padding: '28px'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 24, color: 'white', fontSize: '20px', fontWeight: '600' }}>
                🔍 Filtros de Búsqueda
              </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                  <div>
                    <label style={{ color: '#e8f5e8', fontWeight: '600', marginBottom: '12px', display: 'block', fontSize: '16px' }}>📅 Año</label>
                    <select
                      value={filters.year}
                      onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(74, 222, 128, 0.3)',
                        background: 'rgba(54, 83, 20, 0.8)',
                        color: '#e8f5e8',
                        fontSize: '16px',
                        fontWeight: '500',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #4ade80';
                        e.target.style.background = 'rgba(54, 83, 20, 0.9)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '2px solid rgba(74, 222, 128, 0.3)';
                        e.target.style.background = 'rgba(54, 83, 20, 0.8)';
                      }}
                    >
                      {[2024, 2025, 2026, 2027].map(year => (
                        <option key={year} value={year} style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ color: '#e8f5e8', fontWeight: '600', marginBottom: '12px', display: 'block', fontSize: '16px' }}>🗓️ Mes</label>
                    <select
                      value={filters.month}
                      onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(74, 222, 128, 0.3)',
                        background: 'rgba(54, 83, 20, 0.8)',
                        color: '#e8f5e8',
                        fontSize: '16px',
                        fontWeight: '500',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #4ade80';
                        e.target.style.background = 'rgba(54, 83, 20, 0.9)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '2px solid rgba(74, 222, 128, 0.3)';
                        e.target.style.background = 'rgba(54, 83, 20, 0.8)';
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                        <option key={month} value={month} style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>{getMonthName(month)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ color: '#e8f5e8', fontWeight: '600', marginBottom: '12px', display: 'block', fontSize: '16px' }}>📚 Tipo de Entrenamiento</label>
                    <select
                      value={filters.trainingType}
                      onChange={(e) => setFilters({ ...filters, trainingType: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(74, 222, 128, 0.3)',
                        background: 'rgba(54, 83, 20, 0.8)',
                        color: '#e8f5e8',
                        fontSize: '16px',
                        fontWeight: '500',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #4ade80';
                        e.target.style.background = 'rgba(54, 83, 20, 0.9)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '2px solid rgba(74, 222, 128, 0.3)';
                        e.target.style.background = 'rgba(54, 83, 20, 0.8)';
                      }}
                    >
                      <option value="all" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>🎯 Todos</option>
                      <option value="SwingTrading" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>📈 Zero 2 Trader</option>
                      <option value="DayTrading" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>⚡ Day Trading</option>
                      <option value="DowJones" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>📊 Dow Jones</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ color: '#e8f5e8', fontWeight: '600', marginBottom: '12px', display: 'block', fontSize: '16px' }}>✅ Estado</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid rgba(74, 222, 128, 0.3)',
                        background: 'rgba(54, 83, 20, 0.8)',
                        color: '#e8f5e8',
                        fontSize: '16px',
                        fontWeight: '500',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #4ade80';
                        e.target.style.background = 'rgba(54, 83, 20, 0.9)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '2px solid rgba(74, 222, 128, 0.3)';
                        e.target.style.background = 'rgba(54, 83, 20, 0.8)';
                      }}
                    >
                      <option value="completed" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>✅ Completado</option>
                      <option value="pending" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>⏳ Pendiente</option>
                      <option value="failed" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>❌ Fallido</option>
                      <option value="refunded" style={{ background: '#1a2e05', color: '#e8f5e8', padding: '8px' }}>🔄 Reembolsado</option>
                    </select>
                  </div>
                </div>
              </div>

            {/* Estadísticas */}
            {stats && (
              <div id="estadisticas" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '24px',
                marginBottom: '32px'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #365314 0%, #1a2e05 100%)',
                  borderRadius: '20px',
                  padding: '28px',
                  color: 'white',
                  boxShadow: '0 12px 40px rgba(26, 46, 5, 0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 50px rgba(26, 46, 5, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(26, 46, 5, 0.3)';
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      background: 'rgba(74, 222, 128, 0.2)', 
                      borderRadius: '16px', 
                      padding: '16px',
                      marginRight: '20px'
                    }}>
                      <Users size={28} color="#4ade80" />
                    </div>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1', color: '#e8f5e8' }}>{stats.total}</div>
                      <div style={{ fontSize: '16px', opacity: '0.9', fontWeight: '600', color: '#c7e5c7' }}>Total Suscripciones</div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #365314 0%, #1a2e05 100%)',
                  borderRadius: '20px',
                  padding: '28px',
                  color: 'white',
                  boxShadow: '0 12px 40px rgba(26, 46, 5, 0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 50px rgba(26, 46, 5, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(26, 46, 5, 0.3)';
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      background: 'rgba(74, 222, 128, 0.2)', 
                      borderRadius: '16px', 
                      padding: '16px',
                      marginRight: '20px'
                    }}>
                      <CheckCircle size={28} color="#4ade80" />
                    </div>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1', color: '#e8f5e8' }}>{stats.active}</div>
                      <div style={{ fontSize: '16px', opacity: '0.9', fontWeight: '600', color: '#c7e5c7' }}>Activas</div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #14532d 0%, #052e16 100%)',
                  borderRadius: '20px',
                  padding: '28px',
                  color: 'white',
                  boxShadow: '0 12px 40px rgba(5, 46, 22, 0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 50px rgba(5, 46, 22, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(5, 46, 22, 0.3)';
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      background: 'rgba(74, 222, 128, 0.2)', 
                      borderRadius: '16px', 
                      padding: '16px',
                      marginRight: '20px'
                    }}>
                      <DollarSign size={28} color="#4ade80" />
                    </div>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1', color: '#e8f5e8' }}>${stats.revenue.toLocaleString()}</div>
                      <div style={{ fontSize: '16px', opacity: '0.9', fontWeight: '600', color: '#c7e5c7' }}>Ingresos</div>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                  borderRadius: '20px',
                  padding: '28px',
                  color: 'white',
                  boxShadow: '0 12px 40px rgba(17, 24, 39, 0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 16px 50px rgba(17, 24, 39, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(17, 24, 39, 0.3)';
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      background: 'rgba(74, 222, 128, 0.2)', 
                      borderRadius: '16px', 
                      padding: '16px',
                      marginRight: '20px'
                    }}>
                      <TrendingUp size={28} color="#4ade80" />
                    </div>
                    <div>
                      <div style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1', color: '#e8f5e8' }}>{stats.byType.length}</div>
                      <div style={{ fontSize: '16px', opacity: '0.9', fontWeight: '600', color: '#c7e5c7' }}>Tipos de Entrenamiento</div>
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
            <div id="recordatorios" className={styles.card} style={{
              background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
              border: 'none',
              color: 'white',
              padding: '28px'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 24, color: '#e8f5e8', fontSize: '22px', fontWeight: '600' }}>
                📧 Enviar Recordatorios
              </h3>
              
              {/* Información sobre links de Meet */}
              {stats && stats.meetLinksAvailable && Object.keys(stats.meetLinksAvailable).length > 0 && (
                <div style={{ 
                  background: 'linear-gradient(135deg, #365314 0%, #1a2e05 100%)', 
                  border: '2px solid #4ade80', 
                  borderRadius: '16px', 
                  padding: '20px', 
                  marginBottom: '24px',
                  color: 'white'
                }}>
                  <h4 style={{ color: '#e8f5e8', marginTop: 0, marginBottom: 12, fontSize: '18px', fontWeight: '600' }}>
                    🔗 Links de Google Meet Disponibles
                  </h4>
                  {Object.entries(stats.meetLinksAvailable).map(([trainingType, links]) => (
                    <div key={trainingType} style={{ marginBottom: 12 }}>
                      <strong style={{ color: '#c7e5c7', fontSize: '16px' }}>
                        {getTrainingDisplayName(trainingType)}: {links.length} clase{links.length !== 1 ? 's' : ''}
                      </strong>
                      {links.length > 0 && (
                        <div style={{ fontSize: '14px', color: '#a7f3d0', marginTop: 8 }}>
                          {links.map((link, index) => (
                            <div key={index} style={{ marginBottom: 6, padding: '8px', background: 'rgba(74, 222, 128, 0.1)', borderRadius: '8px' }}>
                              📹 Clase {index + 1}: {link}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'end' }}>
                <div>
                  <label style={{ color: '#e8f5e8', fontWeight: '600', marginBottom: '12px', display: 'block', fontSize: '16px' }}>
                    💬 Mensaje Personalizado (Opcional)
                  </label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Escribe un mensaje personalizado para incluir en los recordatorios..."
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '2px solid rgba(74, 222, 128, 0.3)',
                      background: 'rgba(31, 41, 55, 0.8)',
                      color: '#e8f5e8',
                      fontSize: '16px',
                      fontWeight: '500',
                      backdropFilter: 'blur(10px)',
                      resize: 'vertical',
                      minHeight: '100px',
                      transition: 'all 0.3s ease',
                      cursor: 'text'
                    }}
                    onFocus={(e) => {
                      e.target.style.border = '2px solid #4ade80';
                      e.target.style.background = 'rgba(31, 41, 55, 0.9)';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '2px solid rgba(74, 222, 128, 0.3)';
                      e.target.style.background = 'rgba(31, 41, 55, 0.8)';
                    }}
                    rows={3}
                  />
                </div>
                <button
                  onClick={sendReminders}
                  disabled={sendingReminders || subscriptions.length === 0}
                  style={{ 
                    background: 'linear-gradient(135deg, #365314 0%, #1a2e05 100%)',
                    color: '#e8f5e8',
                    border: '2px solid #4ade80',
                    padding: '18px 32px',
                    borderRadius: '16px',
                    fontWeight: '600',
                    cursor: sendingReminders ? 'not-allowed' : 'pointer',
                    opacity: sendingReminders ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '18px',
                    boxShadow: '0 8px 25px rgba(54, 83, 20, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!sendingReminders && subscriptions.length > 0) {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 12px 35px rgba(54, 83, 20, 0.5)';
                      e.currentTarget.style.border = '2px solid #6ee7b7';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(54, 83, 20, 0.4)';
                    e.currentTarget.style.border = '2px solid #4ade80';
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
            <div id="suscripciones" className={styles.card}>
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
