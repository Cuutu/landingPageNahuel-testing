import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Database, 
  Download, 
  Mail, 
  Users,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Upload,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminDatabase.module.css';
import { toast } from 'react-hot-toast';

interface DatabaseStats {
  totalContacts: number;
  totalEmails: number;
  totalSuscriptors: number;
  lastExport: string | null;
}

export default function AdminDatabasePage() {
  const [stats, setStats] = useState<DatabaseStats>({
    totalContacts: 0,
    totalEmails: 0,
    totalSuscriptors: 0,
    lastExport: null
  });
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  // Cargar estadísticas de la base de datos
  const fetchDatabaseStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/database/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        toast.error('Error al cargar estadísticas');
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  // Exportar contactos a CSV
  const exportContacts = async (format: 'csv' | 'excel') => {
    try {
      setExportLoading(true);
      const response = await fetch(`/api/admin/database/export?format=${format}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `contactos_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success(`Contactos exportados exitosamente en formato ${format.toUpperCase()}`);
        fetchDatabaseStats(); // Actualizar última exportación
      } else {
        toast.error('Error al exportar contactos');
      }
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error('Error al exportar contactos');
    } finally {
      setExportLoading(false);
    }
  };

  // Limpiar base de datos (usuarios inactivos)
  const cleanupDatabase = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar usuarios inactivos? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/database/cleanup', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${data.deletedCount} usuarios inactivos eliminados`);
        fetchDatabaseStats();
      } else {
        toast.error('Error al limpiar base de datos');
      }
    } catch (error) {
      console.error('Error al limpiar:', error);
      toast.error('Error al limpiar base de datos');
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  return (
    <>
      <Head>
        <title>Gestión de Base de Datos - Admin Dashboard</title>
        <meta name="description" content="Gestión y exportación de datos de contactos" />
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
                  <Database size={40} />
                </div>
                <div>
                  <h1 className={styles.title}>Gestión de Base de Datos</h1>
                  <p className={styles.subtitle}>
                    Exporta contactos, gestiona datos y envía comunicaciones masivas
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Link 
                  href="/admin/dashboard"
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  Volver al Dashboard
                </Link>
                <button 
                  onClick={fetchDatabaseStats}
                  className={`${styles.actionButton} ${styles.primary}`}
                  disabled={loading}
                >
                  <RefreshCw size={20} />
                  Actualizar
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Users size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : stats.totalContacts}</h3>
                  <p>Total Contactos</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Mail size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : stats.totalEmails}</h3>
                  <p>Emails Válidos</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Users size={24} className={styles.iconPurple} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{loading ? '...' : stats.totalSuscriptors}</h3>
                  <p>Suscriptores</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Download size={24} className={styles.iconAmber} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{stats.lastExport ? new Date(stats.lastExport).toLocaleDateString() : 'Nunca'}</h3>
                  <p>Última Exportación</p>
                </div>
              </div>
            </div>

            {/* Export Section */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Download size={24} />
                  <h2>Exportar Contactos</h2>
                </div>
                <p className={styles.sectionDescription}>
                  Descarga la información de contacto de todos los usuarios para comunicaciones externas
                </p>
              </div>

              <div className={styles.exportGrid}>
                <div className={styles.exportOption}>
                  <div className={styles.exportIcon}>
                    <FileText size={32} className={styles.csvIcon} />
                  </div>
                  <div className={styles.exportInfo}>
                    <h3>Exportar CSV</h3>
                    <p>Formato estándar para Excel y otras aplicaciones</p>
                    <ul>
                      <li>Nombre completo</li>
                      <li>Email</li>
                      <li>Rol de usuario</li>
                      <li>Fecha de registro</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => exportContacts('csv')}
                    disabled={exportLoading}
                    className={`${styles.exportButton} ${styles.csv}`}
                  >
                    <Download size={20} />
                    Descargar CSV
                  </button>
                </div>

                <div className={styles.exportOption}>
                  <div className={styles.exportIcon}>
                    <FileText size={32} className={styles.excelIcon} />
                  </div>
                  <div className={styles.exportInfo}>
                    <h3>Exportar Excel</h3>
                    <p>Formato optimizado con formato y filtros</p>
                    <ul>
                      <li>Múltiples hojas</li>
                      <li>Filtros automáticos</li>
                      <li>Formato profesional</li>
                      <li>Estadísticas incluidas</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => exportContacts('excel')}
                    disabled={exportLoading}
                    className={`${styles.exportButton} ${styles.excel}`}
                  >
                    <Download size={20} />
                    Descargar Excel
                  </button>
                </div>
              </div>
            </div>

            {/* Email Marketing Section */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <Mail size={24} />
                  <h2>Email Marketing</h2>
                </div>
                <p className={styles.sectionDescription}>
                  Herramientas para comunicación masiva con tus usuarios
                </p>
              </div>

              <div className={styles.emailGrid}>
                <Link href="/admin/email/bulk" className={styles.emailOption}>
                  <div className={styles.emailIcon}>
                    <Mail size={32} className={styles.bulkIcon} />
                  </div>
                  <div className={styles.emailInfo}>
                    <h3>Envío Masivo</h3>
                    <p>Envía emails personalizados a todos tus usuarios o segmentos específicos</p>
                  </div>
                </Link>

                <Link href="/admin/email/templates" className={styles.emailOption}>
                  <div className={styles.emailIcon}>
                    <FileText size={32} className={styles.templateIcon} />
                  </div>
                  <div className={styles.emailInfo}>
                    <h3>Plantillas</h3>
                    <p>Crea y gestiona plantillas de email reutilizables</p>
                  </div>
                </Link>

                <Link href="/admin/email/campaigns" className={styles.emailOption}>
                  <div className={styles.emailIcon}>
                    <Users size={32} className={styles.campaignIcon} />
                  </div>
                  <div className={styles.emailInfo}>
                    <h3>Campañas</h3>
                    <p>Historial y estadísticas de campañas de email</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Database Management */}
            <div className={styles.sectionCard}>
              <div className={`${styles.sectionHeader} ${styles.dangerSection}`}>
                <div className={styles.sectionTitle}>
                  <AlertTriangle size={24} />
                  <h2>Mantenimiento de Base de Datos</h2>
                </div>
                <p className={styles.sectionDescription}>
                  Herramientas avanzadas para limpieza y optimización de datos
                </p>
              </div>

              <div className={styles.maintenanceGrid}>
                <div className={styles.maintenanceOption}>
                  <div className={styles.maintenanceInfo}>
                    <h3>Limpiar Usuarios Inactivos</h3>
                    <p>Elimina usuarios que no han iniciado sesión en los últimos 6 meses y no tienen suscripciones activas</p>
                  </div>
                  <button
                    onClick={cleanupDatabase}
                    className={`${styles.maintenanceButton} ${styles.danger}`}
                  >
                    <Trash2 size={20} />
                    Limpiar BD
                  </button>
                </div>

                <div className={styles.maintenanceOption}>
                  <div className={styles.maintenanceInfo}>
                    <h3>Backup de Seguridad</h3>
                    <p>Crear una copia de seguridad completa de la base de datos</p>
                  </div>
                  <button
                    className={`${styles.maintenanceButton} ${styles.warning}`}
                  >
                    <Download size={20} />
                    Crear Backup
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className={styles.activityCard}>
              <h2 className={styles.activityTitle}>Actividad Reciente de Datos</h2>
              <div className={styles.activityList}>
                <div className={styles.activityItem}>
                  <Download size={16} className={styles.activityIcon} />
                  <span>Exportación de contactos realizada</span>
                  <span className={styles.activityTime}>Hace 2 horas</span>
                </div>
                <div className={styles.activityItem}>
                  <Mail size={16} className={styles.activityIcon} />
                  <span>Campaña de email enviada a 150 usuarios</span>
                  <span className={styles.activityTime}>Ayer</span>
                </div>
                <div className={styles.activityItem}>
                  <Users size={16} className={styles.activityIcon} />
                  <span>5 nuevos usuarios registrados</span>
                  <span className={styles.activityTime}>Hace 3 días</span>
                </div>
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
  // console.log('🔍 [DATABASE] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    // console.log('🔍 [DATABASE] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      // console.log('❌ [DATABASE] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [DATABASE] Acceso de admin confirmado para:', verification.user?.email);
    
    return {
      props: {
        user: verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [DATABASE] Error en getServerSideProps:', error);
    
    const callbackUrl = encodeURIComponent(context.resolvedUrl || '/admin/dashboard');
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }
}; 