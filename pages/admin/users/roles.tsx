import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Users, 
  Crown, 
  UserCheck, 
  User as UserIcon,
  Shield,
  Edit3,
  Save,
  X,
  ArrowLeft
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminUsers.module.css';
import { toast } from 'react-hot-toast';
import connectDB from '@/lib/mongodb';

interface RoleStats {
  admin: number;
  suscriptor: number;
  normal: number;
  total: number;
}

interface UserData {
  _id: string;
  name: string;
  email: string;
  picture?: string;
  role: 'admin' | 'suscriptor' | 'normal';
  createdAt: string;
  lastLogin?: string;
}

export default function AdminRolesPage() {
  const [roleStats, setRoleStats] = useState<RoleStats>({
    admin: 0,
    suscriptor: 0,
    normal: 0,
    total: 0
  });
  const [recentRoleChanges, setRecentRoleChanges] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar estadísticas de roles
  const fetchRoleStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users/roles-stats');
      if (response.ok) {
        const data = await response.json();
        setRoleStats(data.stats);
        setRecentRoleChanges(data.recentChanges);
      } else {
        toast.error('Error al cargar estadísticas de roles');
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleStats();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#f59e0b';
      case 'suscriptor': return '#10b981';
      default: return '#64748b';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown size={16} />;
      case 'suscriptor': return <UserCheck size={16} />;
      default: return <UserIcon size={16} />;
    }
  };

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

  return (
    <>
      <Head>
        <title>Gestión de Roles - Admin Dashboard</title>
        <meta name="description" content="Gestión de roles y permisos de usuarios del sistema" />
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
                  <Settings size={40} />
                </div>
                <div>
                  <h1 className={styles.title}>Gestión de Roles</h1>
                  <p className={styles.subtitle}>
                    Administra roles, permisos y estadísticas de usuarios
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Link 
                  href="/admin/users"
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  <ArrowLeft size={20} />
                  Volver a Usuarios
                </Link>
                <Link 
                  href="/admin/dashboard"
                  className={`${styles.actionButton} ${styles.outline}`}
                >
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Role Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Crown size={24} className={styles.iconGold} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : roleStats.admin}</h3>
                  <p>Administradores</p>
                  <span className={styles.percentage}>
                    {roleStats.total > 0 ? Math.round((roleStats.admin / roleStats.total) * 100) : 0}% del total
                  </span>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <UserCheck size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : roleStats.suscriptor}</h3>
                  <p>Suscriptores</p>
                  <span className={styles.percentage}>
                    {roleStats.total > 0 ? Math.round((roleStats.suscriptor / roleStats.total) * 100) : 0}% del total
                  </span>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <UserIcon size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : roleStats.normal}</h3>
                  <p>Usuarios Normales</p>
                  <span className={styles.percentage}>
                    {roleStats.total > 0 ? Math.round((roleStats.normal / roleStats.total) * 100) : 0}% del total
                  </span>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Users size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : roleStats.total}</h3>
                  <p>Total Usuarios</p>
                  <span className={styles.percentage}>
                    100% del sistema
                  </span>
                </div>
              </div>
            </div>

            {/* Role Descriptions */}
            <div className={styles.subscriptionStats}>
              <h3>Descripción de Roles</h3>
              <div className={styles.subscriptionGrid}>
                <div className={styles.roleDescriptionCard}>
                  <div 
                    className={styles.subscriptionIcon}
                    style={{ backgroundColor: '#f59e0b' }}
                  >
                    <Crown size={20} />
                  </div>
                  <div className={styles.subscriptionInfo}>
                    <h4>Administrador</h4>
                    <p>Acceso total al sistema</p>
                    <ul className={styles.permissionsList}>
                      <li>✅ Gestión de usuarios</li>
                      <li>✅ Dashboard administrativo</li>
                      <li>✅ Configuración del sistema</li>
                      <li>✅ Gestión de pagos</li>
                    </ul>
                  </div>
                </div>

                <div className={styles.roleDescriptionCard}>
                  <div 
                    className={styles.subscriptionIcon}
                    style={{ backgroundColor: '#10b981' }}
                  >
                    <UserCheck size={20} />
                  </div>
                  <div className={styles.subscriptionInfo}>
                    <h4>Suscriptor</h4>
                    <p>Acceso a contenido premium</p>
                    <ul className={styles.permissionsList}>
                      <li>✅ Alertas de trading</li>
                      <li>✅ Contenido exclusivo</li>
                      <li>✅ Comunidad premium</li>
                      <li>❌ Panel administrativo</li>
                    </ul>
                  </div>
                </div>

                <div className={styles.roleDescriptionCard}>
                  <div 
                    className={styles.subscriptionIcon}
                    style={{ backgroundColor: '#64748b' }}
                  >
                    <UserIcon size={20} />
                  </div>
                  <div className={styles.subscriptionInfo}>
                    <h4>Usuario Normal</h4>
                    <p>Acceso básico al sitio</p>
                    <ul className={styles.permissionsList}>
                      <li>✅ Contenido público</li>
                      <li>✅ Perfil personal</li>
                      <li>❌ Alertas premium</li>
                      <li>❌ Panel administrativo</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Role Changes */}
            <div className={styles.tableContainer}>
              <h3 style={{ padding: '1rem', margin: 0, color: 'var(--text-primary)' }}>
                Cambios de Rol Recientes
              </h3>
              
              {loading ? (
                <div className={styles.loadingState}>
                  <Settings size={40} className={styles.loadingSpinner} />
                  <p>Cargando cambios recientes...</p>
                </div>
              ) : recentRoleChanges.length === 0 ? (
                <div className={styles.emptyState}>
                  <Shield size={48} />
                  <h3>No hay cambios recientes</h3>
                  <p>Los cambios de rol aparecerán aquí</p>
                </div>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableCell}>Usuario</div>
                    <div className={styles.tableCell}>Rol Actual</div>
                    <div className={styles.tableCell}>Fecha de Registro</div>
                    <div className={styles.tableCell}>Último Login</div>
                    <div className={styles.tableCell}>Acciones</div>
                  </div>
                  
                  {recentRoleChanges.map((user) => (
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
                        <div 
                          className={styles.subscriptionBadge}
                          style={{ backgroundColor: getRoleColor(user.role) }}
                        >
                          {getRoleIcon(user.role)}
                          {user.role}
                        </div>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <span className={styles.lastLogin}>
                          {new Date(user.createdAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <span className={styles.lastLogin}>
                          {user.lastLogin 
                            ? new Date(user.lastLogin).toLocaleDateString('es-ES')
                            : 'Nunca'
                          }
                        </span>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <div className={styles.actions}>
                          <Link
                            href={`/admin/users?search=${user.email}`}
                            className={styles.actionBtn}
                            title="Editar usuario"
                          >
                            <Edit3 size={16} />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className={styles.filtersSection}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Acciones Rápidas
              </h3>
              <div className={styles.filters} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <Link
                  href="/admin/users"
                  className={`${styles.actionButton} ${styles.primary}`}
                >
                  <Users size={20} />
                  Ver Todos los Usuarios
                </Link>
                
                <Link
                  href="/admin/users?role=admin"
                  className={`${styles.actionButton} ${styles.outline}`}
                  style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                >
                  <Crown size={20} />
                  Solo Administradores
                </Link>
                
                <Link
                  href="/admin/users?role=suscriptor"
                  className={`${styles.actionButton} ${styles.outline}`}
                  style={{ borderColor: '#10b981', color: '#10b981' }}
                >
                  <UserCheck size={20} />
                  Solo Suscriptores
                </Link>
                
                <Link
                  href="/admin/users?role=normal"
                  className={`${styles.actionButton} ${styles.outline}`}
                  style={{ borderColor: '#64748b', color: '#64748b' }}
                >
                  <UserIcon size={20} />
                  Usuarios Normales
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
  // console.log('🔍 [ROLES] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    // console.log('🔍 [ROLES] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      // console.log('❌ [ROLES] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [ROLES] Acceso de admin confirmado para:', verification.user?.email);
    
    return {
      props: {
        user: verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [ROLES] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
}; 