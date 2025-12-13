import React from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { 
  User, 
  Shield, 
  Mail, 
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import styles from '../../styles/Admin.module.css';

interface DebugSessionProps {
  user: any;
}

const DebugSession: React.FC<DebugSessionProps> = ({ user: serverUser }) => {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const refreshSession = async () => {
    // console.log('🔄 Actualizando sesión...');
    await update();
    // console.log('✅ Sesión actualizada');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'authenticated':
        return '#10b981';
      case 'loading':
        return '#f59e0b';
      case 'unauthenticated':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'authenticated':
        return <CheckCircle size={20} color="#10b981" />;
      case 'loading':
        return <RefreshCw size={20} color="#f59e0b" className={styles.spinner} />;
      case 'unauthenticated':
        return <AlertCircle size={20} color="#ef4444" />;
      default:
        return <Info size={20} color="#6b7280" />;
    }
  };

  return (
    <div className={styles.adminContainer}>
      <div className={styles.header}>
        <button 
                      onClick={() => router.push('/admin/dashboard')}
          className={styles.backButton}
        >
          ← Volver al Admin
        </button>
        <h1 className={styles.title}>
          <Shield size={32} />
          Debug de Sesión
        </h1>
        <p className={styles.subtitle}>
          Información detallada sobre el estado de la sesión actual
        </p>
      </div>

      <div className={styles.content}>
        {/* Estado de la sesión */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className={styles.sectionTitle}>
            <RefreshCw size={24} />
            Estado de la Sesión
          </h2>

          <div className={styles.statusCard}>
            <div className={styles.statusHeader}>
              {getStatusIcon(status)}
              <span className={styles.statusText}>
                Estado: {status}
              </span>
            </div>
            
            <div className={styles.statusDetails}>
              <div className={styles.statusItem}>
                <strong>Status:</strong> {status}
              </div>
              <div className={styles.statusItem}>
                <strong>Color:</strong> 
                <span style={{ 
                  color: getStatusColor(status), 
                  marginLeft: '0.5rem',
                  fontWeight: 'bold'
                }}>
                  {getStatusColor(status)}
                </span>
              </div>
            </div>

            <button
              onClick={refreshSession}
              className={styles.primaryButton}
              style={{ marginTop: '1rem' }}
            >
              <RefreshCw size={16} />
              Actualizar Sesión
            </button>
          </div>
        </motion.div>

        {/* Información del usuario */}
        {session?.user && (
          <motion.div 
            className={styles.section}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2 className={styles.sectionTitle}>
              <User size={24} />
              Información del Usuario
            </h2>

            <div className={styles.userCard}>
              <div className={styles.userHeader}>
                {session.user.image && (
                  <img 
                    src={session.user.image} 
                    alt="Avatar" 
                    className={styles.userAvatar}
                  />
                )}
                <div className={styles.userInfo}>
                  <h3>{session.user.name}</h3>
                  <p>{session.user.email}</p>
                </div>
              </div>

              <div className={styles.userDetails}>
                <div className={styles.detailItem}>
                  <Mail size={16} />
                  <span><strong>Email:</strong> {session.user.email}</span>
                </div>
                
                <div className={styles.detailItem}>
                  <User size={16} />
                  <span><strong>Nombre:</strong> {session.user.name}</span>
                </div>
                
                <div className={styles.detailItem}>
                  <Shield size={16} />
                  <span>
                    <strong>Rol:</strong> 
                    <span className={`${styles.roleBadge} ${styles[session.user.role]}`}>
                      {session.user.role || 'No definido'}
                    </span>
                  </span>
                </div>
                
                <div className={styles.detailItem}>
                  <Calendar size={16} />
                  <span><strong>ID:</strong> {session.user.id || 'No disponible'}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Verificación de permisos */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className={styles.sectionTitle}>
            <Shield size={24} />
            Verificación de Permisos
          </h2>

          <div className={styles.permissionsGrid}>
            <div className={`${styles.permissionCard} ${session?.user?.role === 'admin' ? styles.granted : styles.denied}`}>
              <div className={styles.permissionHeader}>
                {session?.user?.role === 'admin' ? (
                  <CheckCircle size={24} color="#10b981" />
                ) : (
                  <AlertCircle size={24} color="#ef4444" />
                )}
                <h4>Acceso a Admin</h4>
              </div>
              <p>
                {session?.user?.role === 'admin' 
                  ? '✅ Tienes permisos de administrador' 
                  : '❌ No tienes permisos de administrador'
                }
              </p>
            </div>

            <div className={`${styles.permissionCard} ${session?.user?.email ? styles.granted : styles.denied}`}>
              <div className={styles.permissionHeader}>
                {session?.user?.email ? (
                  <CheckCircle size={24} color="#10b981" />
                ) : (
                  <AlertCircle size={24} color="#ef4444" />
                )}
                <h4>Email Válido</h4>
              </div>
              <p>
                {session?.user?.email 
                  ? '✅ Email presente en la sesión' 
                  : '❌ No hay email en la sesión'
                }
              </p>
            </div>

            <div className={`${styles.permissionCard} ${status === 'authenticated' ? styles.granted : styles.denied}`}>
              <div className={styles.permissionHeader}>
                {status === 'authenticated' ? (
                  <CheckCircle size={24} color="#10b981" />
                ) : (
                  <AlertCircle size={24} color="#ef4444" />
                )}
                <h4>Sesión Autenticada</h4>
              </div>
              <p>
                {status === 'authenticated' 
                  ? '✅ Sesión válida y autenticada' 
                  : `❌ Sesión no válida (${status})`
                }
              </p>
            </div>
          </div>
        </motion.div>

        {/* Información técnica */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>
            <Info size={24} />
            Información Técnica
          </h2>

          <div className={styles.techInfo}>
            <div className={styles.techCard}>
              <h4>Datos de Sesión (JSON)</h4>
              <pre className={styles.jsonCode}>
                {JSON.stringify(session, null, 2)}
              </pre>
            </div>

            <div className={styles.techCard}>
              <h4>Variables de Entorno</h4>
              <div className={styles.envVars}>
                <div className={styles.envVar}>
                  <strong>NEXTAUTH_URL:</strong> {process.env.NEXTAUTH_URL || 'No definido'}
                </div>
                <div className={styles.envVar}>
                  <strong>NEXTAUTH_SECRET:</strong> {process.env.NEXTAUTH_SECRET ? 'Definido' : 'No definido'}
                </div>
                <div className={styles.envVar}>
                  <strong>GOOGLE_CLIENT_ID:</strong> {process.env.GOOGLE_CLIENT_ID ? 'Definido' : 'No definido'}
                </div>
                <div className={styles.envVar}>
                  <strong>NODE_ENV:</strong> {process.env.NODE_ENV}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Acciones */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className={styles.sectionTitle}>
            <RefreshCw size={24} />
            Acciones
          </h2>

          <div className={styles.actionsGrid}>
            <button
              onClick={() => router.push('/admin/test-training-notifications')}
              className={styles.actionButton}
              disabled={session?.user?.role !== 'admin'}
            >
              <Shield size={20} />
              Probar Notificaciones
            </button>

            <button
              onClick={() => router.push('/admin/dashboard')}
              className={styles.actionButton}
              disabled={session?.user?.role !== 'admin'}
            >
              <User size={20} />
              Dashboard Admin
            </button>

            <button
              onClick={() => router.push('/')}
              className={styles.actionButton}
            >
              <Info size={20} />
              Ir al Inicio
            </button>

            <button
              onClick={() => window.location.reload()}
              className={styles.actionButton}
            >
              <RefreshCw size={20} />
              Recargar Página
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

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
        user: verification.session?.user || verification.user || null,
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

export default DebugSession; 