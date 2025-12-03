import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserCheck, 
  Users, 
  Activity,
  Calendar,
  TrendingUp,
  ArrowLeft,
  Search,
  RefreshCw
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminUsers.module.css';
import { toast } from 'react-hot-toast';
import connectDB from '@/lib/mongodb';

interface UserData {
  _id: string;
  name: string;
  email: string;
  picture?: string; // Imagen de perfil de Google
  role: 'admin' | 'suscriptor' | 'normal';
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  subscriptions?: Array<{
    tipo: string;
    precio: number;
    fechaInicio: string;
    fechaFin?: string;
    activa: boolean;
  }>;
  ingresoMensual?: number;
}

interface ActiveStats {
  totalActive: number;
  loggedInLast7Days: number;
  loggedInLast30Days: number;
  neverLoggedIn: number;
}

export default function AdminActiveUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStats, setActiveStats] = useState<ActiveStats>({
    totalActive: 0,
    loggedInLast7Days: 0,
    loggedInLast30Days: 0,
    neverLoggedIn: 0
  });

  // Componente para el avatar del usuario
  const UserAvatar = ({ user }: { user: UserData }) => {
    const [imageError, setImageError] = useState(false);
    
    if (user.picture && !imageError) {
      return (
        <img
          src={user.picture}
          alt={`${user.name} avatar`}
          className={styles.userAvatarImage}
          onError={() => setImageError(true)}
        />
      );
    }
    
    // Fallback a iniciales si no hay imagen o falla la carga
    return (
      <div className={styles.userAvatar}>
        {user.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  // Cargar usuarios activos
  const fetchActiveUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: 'active',
        search: searchTerm,
        limit: '50'
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        calculateStats(data.users);
      } else {
        toast.error('Error al cargar usuarios activos');
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  // Calcular estadísticas de actividad
  const calculateStats = (userData: UserData[]) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalActive: userData.length,
      loggedInLast7Days: userData.filter(user => 
        user.lastLogin && new Date(user.lastLogin) >= sevenDaysAgo
      ).length,
      loggedInLast30Days: userData.filter(user => 
        user.lastLogin && new Date(user.lastLogin) >= thirtyDaysAgo
      ).length,
      neverLoggedIn: userData.filter(user => !user.lastLogin).length
    };

    setActiveStats(stats);
  };

  useEffect(() => {
    fetchActiveUsers();
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchActiveUsers();
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const getActivityStatus = (lastLogin?: string) => {
    if (!lastLogin) return { color: '#64748b', text: 'Nunca', status: 'never' };
    
    const loginDate = new Date(lastLogin);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return { color: '#10b981', text: 'Hoy', status: 'today' };
    if (daysDiff <= 7) return { color: '#3b82f6', text: `Hace ${daysDiff} días`, status: 'recent' };
    if (daysDiff <= 30) return { color: '#f59e0b', text: `Hace ${daysDiff} días`, status: 'month' };
    return { color: '#ef4444', text: `Hace ${daysDiff} días`, status: 'old' };
  };

  return (
    <>
      <Head>
        <title>Usuarios Activos - Admin Dashboard</title>
        <meta name="description" content="Gestión de usuarios activos y estadísticas de actividad" />
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
                  <UserCheck size={40} />
                </div>
                <div>
                  <h1 className={styles.title}>Usuarios Activos</h1>
                  <p className={styles.subtitle}>
                    Usuarios con estado activo y estadísticas de actividad
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Link 
                  href="/admin/users"
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  <ArrowLeft size={20} />
                  Todos los Usuarios
                </Link>
                <Link 
                  href="/admin/dashboard"
                  className={`${styles.actionButton} ${styles.outline}`}
                >
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Activity Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <UserCheck size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : activeStats.totalActive}</h3>
                  <p>Usuarios Activos</p>
                  <span className={styles.percentage}>
                    Estado: Activo
                  </span>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Activity size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : activeStats.loggedInLast7Days}</h3>
                  <p>Activos (7 días)</p>
                  <span className={styles.percentage}>
                    {activeStats.totalActive > 0 
                      ? Math.round((activeStats.loggedInLast7Days / activeStats.totalActive) * 100)
                      : 0
                    }% del total activo
                  </span>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Calendar size={24} className={styles.iconGold} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : activeStats.loggedInLast30Days}</h3>
                  <p>Activos (30 días)</p>
                  <span className={styles.percentage}>
                    {activeStats.totalActive > 0 
                      ? Math.round((activeStats.loggedInLast30Days / activeStats.totalActive) * 100)
                      : 0
                    }% del total activo
                  </span>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <TrendingUp size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : activeStats.neverLoggedIn}</h3>
                  <p>Sin Login</p>
                  <span className={styles.percentage}>
                    {activeStats.totalActive > 0 
                      ? Math.round((activeStats.neverLoggedIn / activeStats.totalActive) * 100)
                      : 0
                    }% del total activo
                  </span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className={styles.filtersSection}>
              <div className={styles.searchBox}>
                <Search size={20} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar usuarios activos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.filters}>
                <button 
                  onClick={fetchActiveUsers}
                  className={`${styles.actionButton} ${styles.outline}`}
                  disabled={loading}
                >
                  <RefreshCw size={20} />
                  Actualizar
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className={styles.tableContainer}>
              {loading ? (
                <div className={styles.loadingState}>
                  <RefreshCw size={40} className={styles.loadingSpinner} />
                  <p>Cargando usuarios activos...</p>
                </div>
              ) : users.length === 0 ? (
                <div className={styles.emptyState}>
                  <UserCheck size={48} />
                  <h3>No se encontraron usuarios activos</h3>
                  <p>Intenta ajustar los filtros de búsqueda</p>
                </div>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableCell}>Usuario</div>
                    <div className={styles.tableCell}>Rol</div>
                    <div className={styles.tableCell}>Estado de Actividad</div>
                    <div className={styles.tableCell}>Suscripciones</div>
                    <div className={styles.tableCell}>Último Login</div>
                  </div>
                  
                  {users.map((user) => {
                    const activityStatus = getActivityStatus(user.lastLogin);
                    
                    return (
                      <motion.div
                        key={user._id}
                        className={styles.tableRow}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className={styles.tableCell}>
                          <div className={styles.userInfo}>
                            <UserAvatar user={user} />
                            <div>
                              <p className={styles.userName}>{user.name}</p>
                              <p className={styles.userEmail}>{user.email}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className={styles.tableCell}>
                          <span 
                            className={styles.subscriptionBadge}
                            style={{ 
                              backgroundColor: user.role === 'admin' ? '#f59e0b' : 
                                             user.role === 'suscriptor' ? '#10b981' : '#64748b'
                            }}
                          >
                            {user.role}
                          </span>
                        </div>
                        
                        <div className={styles.tableCell}>
                          <span 
                            className={styles.subscriptionBadge}
                            style={{ backgroundColor: activityStatus.color }}
                          >
                            <Activity size={12} />
                            {activityStatus.text}
                          </span>
                        </div>
                        
                        <div className={styles.tableCell}>
                          <div className={styles.subscriptions}>
                            {user.subscriptions && user.subscriptions.filter(sub => sub.activa).length > 0 ? (
                              user.subscriptions
                                .filter(sub => sub.activa)
                                .map((sub) => (
                                  <span
                                    key={sub.tipo}
                                    className={styles.subscriptionBadge}
                                    style={{ backgroundColor: '#3b82f6' }}
                                  >
                                    {sub.tipo}
                                  </span>
                                ))
                            ) : (
                              <span className={styles.noSubscriptions}>Sin suscripciones</span>
                            )}
                          </div>
                        </div>
                        
                        <div className={styles.tableCell}>
                          <span className={styles.lastLogin}>
                            {user.lastLogin 
                              ? new Date(user.lastLogin).toLocaleDateString('es-ES')
                              : 'Nunca'
                            }
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className={styles.filtersSection}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Filtros Rápidos
              </h3>
              <div className={styles.filters} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <Link
                  href="/admin/users/active"
                  className={`${styles.actionButton} ${styles.primary}`}
                >
                  <UserCheck size={20} />
                  Usuarios Activos
                </Link>
                
                <Link
                  href="/admin/users?status=inactive"
                  className={`${styles.actionButton} ${styles.outline}`}
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  <Users size={20} />
                  Usuarios Inactivos
                </Link>
                
                <Link
                  href="/admin/users?role=suscriptor&status=active"
                  className={`${styles.actionButton} ${styles.outline}`}
                  style={{ borderColor: '#10b981', color: '#10b981' }}
                >
                  <UserCheck size={20} />
                  Suscriptores Activos
                </Link>
                
                <Link
                  href="/admin/users/roles"
                  className={`${styles.actionButton} ${styles.outline}`}
                >
                  <Users size={20} />
                  Gestión de Roles
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // console.log('🔍 [ACTIVE USERS] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    // console.log('🔍 [ACTIVE USERS] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      // console.log('❌ [ACTIVE USERS] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [ACTIVE USERS] Acceso de admin confirmado para:', verification.user?.email);
    
    return {
      props: {
        user: verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [ACTIVE USERS] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
}; 