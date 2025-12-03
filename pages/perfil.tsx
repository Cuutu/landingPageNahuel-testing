import { GetServerSideProps } from 'next';
import { getSession, useSession } from 'next-auth/react';
import Head from 'next/head';
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { generateCircularAvatarDataURL } from '@/lib/utils';
import { 
  User, 
  ShoppingBag, 
  Bell,
  Mail,
  Building,
  GraduationCap,
  TrendingUp,
  Edit3,
  Download,
  Calendar,
  DollarSign,
  AlertTriangle,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import UserSubscriptions from '@/components/UserSubscriptions';
import styles from '@/styles/Perfil.module.css';

// Componente para mostrar notificaciones reales
const NotificationsSection = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        
        // Primero intentar generar notificaciones automáticamente
        try {
          await fetch('/api/notifications/auto-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (autoGenError) {
          // console.log('Auto-generación de notificaciones no disponible:', autoGenError);
        }
        
        // Luego obtener las notificaciones
        const response = await fetch('/api/notifications/get?limit=10');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Error cargando notificaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace menos de 1 hora';
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `Hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
    
    return 'Hace más de 1 mes';
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pago': return <DollarSign size={16} />;
      case 'advertencia': return <AlertTriangle size={16} />;
      case 'novedad': return <Bell size={16} />;
      case 'bienvenida': return <CheckCircle size={16} />;
      default: return <Bell size={16} />;
    }
  };

  if (loading) {
    return (
      <motion.div
        className={styles.sectionContent}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.sectionHeader}>
          <h2>Central de Notificaciones</h2>
        </div>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Cargando notificaciones...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={styles.sectionContent}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.sectionHeader}>
        <h2>Central de Notificaciones</h2>
      </div>
      
      <div className={styles.notificationsContainer}>
        {notifications.length === 0 ? (
          <div className={styles.emptyNotifications}>
            <Bell size={48} />
            <h3>Sin notificaciones</h3>
            <p>No tienes notificaciones nuevas por el momento.</p>
          </div>
        ) : (
          <div className={styles.notificationCard}>
            <div className={styles.cardHeader}>
              <Bell size={24} />
              <h3>Notificaciones Reales</h3>
            </div>
            <div className={styles.notificationsList}>
              {notifications.map((notification, index) => (
                <div key={notification.id || index} className={styles.notificationItem}>
                  <div className={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className={styles.notificationContent}>
                    <h4>{notification.title}</h4>
                    <div dangerouslySetInnerHTML={{ __html: notification.message }} />
                    <span className={styles.notificationTime}>
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Interfaz para los datos del perfil
interface UserProfile {
  email: string;
  name: string;
  image: string;
  fullName?: string;
  cuitCuil?: string;
  educacionFinanciera?: string;
  brokerPreferencia?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Función para mostrar el nombre del broker de forma legible
const getBrokerDisplayName = (brokerValue: string) => {
  const brokerNames: { [key: string]: string } = {
    'bull-market': 'Bull Market',
    'iol': 'IOL',
    'portfolio-personal': 'Portfolio Personal',
    'cocos-capital': 'Cocos Capital',
    'eco-valores': 'Eco Valores',
    'otros': 'Otros'
  };
  return brokerNames[brokerValue] || brokerValue;
};

export default function PerfilPage() {
  const { data: session, status, update } = useSession();
  const [activeSection, setActiveSection] = useState(1);
  const [showIncompleteNotification, setShowIncompleteNotification] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  const [formData, setFormData] = useState({
    fullName: '',
    cuitCuil: '',
    educacionFinanciera: '',
    brokerPreferencia: ''
  });

  // Función para obtener el perfil del usuario
  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await fetch('/api/profile/get', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUserProfile(result.profile);
        
        // Inicializar formulario con datos reales
        setFormData({
          fullName: result.profile.fullName || result.profile.name || '',
          cuitCuil: result.profile.cuitCuil || '',
          educacionFinanciera: result.profile.educacionFinanciera || '',
          brokerPreferencia: result.profile.brokerPreferencia || ''
        });
      } else {
        console.error('Error al obtener perfil:', response.statusText);
      }
    } catch (error) {
      console.error('Error al obtener perfil:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Obtener perfil al cargar y cuando la sesión esté lista
  useEffect(() => {
    if (session?.user?.email) {
      fetchUserProfile();
    }
  }, [session]);

  // Verificar información incompleta del perfil usando datos reales
  const profileIncomplete = useMemo(() => {
    if (!userProfile) return { incomplete: false, missingFields: [] };
    
    const missingFields = [];
    
    // Verificar campos obligatorios
    if (!userProfile.fullName || userProfile.fullName.trim() === '') {
      missingFields.push('Nombre completo');
    }
    
    if (!userProfile.cuitCuil) {
      missingFields.push('CUIT/CUIL');
    }
    
    if (!userProfile.educacionFinanciera) {
      missingFields.push('Educación Financiera');
    }
    
    if (!userProfile.brokerPreferencia) {
      missingFields.push('Broker de Preferencia');
    }
    
    return {
      incomplete: missingFields.length > 0,
      missingFields
    };
  }, [userProfile]);

  // Función para mostrar notificaciones
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: 'success', message: '' });
    }, 5000);
  };

  // Función para guardar el perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName.trim()) {
      showNotification('error', 'El nombre completo es obligatorio');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          cuitCuil: formData.cuitCuil,
          educacionFinanciera: formData.educacionFinanciera,
          brokerPreferencia: formData.brokerPreferencia,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', 'Perfil actualizado exitosamente');
        setShowEditModal(false);
        setShowIncompleteNotification(false);
        
        // Actualizar los datos del perfil inmediatamente
        await fetchUserProfile();
        
        // También actualizar la sesión de NextAuth si es necesario
        await update();
      } else {
        showNotification('error', result.message || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('error', 'Error al actualizar el perfil');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || profileLoading) {
    return (
      <>
        <Head>
          <title>Mi Cuenta - Nahuel Lozano</title>
        </Head>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner} />
              <p>Cargando tu cuenta...</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!session || !userProfile) {
    return null;
  }

  const sections = [
    {
      id: 1,
      title: 'Información Personal',
      description: 'Nombre y Apellido, Avatar, CUIT/CUIL, Correo Electrónico, Educación Financiera, Broker de Preferencia',
      icon: <User size={20} />
    },
    {
      id: 2,
      title: 'Mis Compras',
      description: 'Suscripciones, Compras Entrenamientos, Compras Cursos, etc',
      icon: <ShoppingBag size={20} />
    },
    {
      id: 3,
      title: 'Notificaciones',
      description: 'Central de Notificaciones del usuario respecto al pago y novedades',
      icon: <Bell size={20} />
    }
  ];

  return (
    <>
      <Head>
        <title>Mi Cuenta - Nahuel Lozano</title>
        <meta name="description" content="Gestiona tu cuenta, información personal y consulta tu historial de compras" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.profileContent}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className={styles.profileHeader}>
              <h1 className={styles.mainTitle}>Mi Cuenta</h1>
              <p className={styles.mainSubtitle}>
                Gestiona tu información personal y consulta tu historial de compras
              </p>
            </div>

            {/* Notificación de perfil incompleto */}
            {profileIncomplete.incomplete && showIncompleteNotification && (
              <motion.div
                className={styles.incompleteNotification}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className={styles.notificationContent}>
                  <div className={styles.notificationIcon}>
                    <AlertTriangle size={24} />
                  </div>
                  <div className={styles.notificationText}>
                    <h3>Completa tu perfil</h3>
                    <p>
                      Te faltan algunos datos importantes: {profileIncomplete.missingFields.join(', ')}. 
                      Completar tu perfil te ayudará a tener una mejor experiencia.
                    </p>
                  </div>
                  <div className={styles.notificationActions}>
                    <button 
                      className={styles.completeButton}
                      onClick={() => {
                        setActiveSection(1);
                        setShowIncompleteNotification(false);
                      }}
                    >
                      Completar Ahora
                    </button>
                    <button 
                      className={styles.dismissButton}
                      onClick={() => setShowIncompleteNotification(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Navigation Table */}
            <div className={styles.navigationTable}>
              <div className={styles.tableHeader}>
                <div className={styles.headerColumn}>Menú y Submenú Desplegable</div>
                <div className={styles.headerColumn}>
                  Servicios y Funcionalidades
                </div>
              </div>
              
              {sections.map((section, index) => (
                <motion.div
                  key={section.id}
                  className={`${styles.tableRow} ${activeSection === section.id ? styles.active : ''}`}
                  onClick={() => setActiveSection(section.id)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={styles.sectionNumber}>{section.id}</div>
                  <div className={styles.sectionInfo}>
                    <div className={styles.sectionTitle}>
                      {section.icon}
                      <span>{section.title}</span>
                    </div>
                  </div>
                  <div className={styles.sectionDescription}>
                    {section.description}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Content Sections */}
            <div className={styles.contentContainer}>
              {/* Información Personal */}
              {activeSection === 1 && (
                <motion.div
                  className={styles.sectionContent}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={styles.sectionHeader}>
                    <h2>Información Personal</h2>
                    <button 
                      className={styles.editButton}
                      onClick={() => setShowEditModal(true)}
                    >
                      <Edit3 size={16} />
                      Carga y Modificación
                    </button>
                  </div>
                  
                  <div className={styles.infoGrid}>
                    <div className={styles.infoCard}>
                      <div className={styles.cardIcon}>
                        <User size={24} />
                      </div>
                      <h3>Datos Personales</h3>
                      <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Nombre y Apellido:</span>
                          <span className={`${styles.value} ${!userProfile?.fullName ? styles.missing : ''}`}>
                            {userProfile?.fullName || 'No especificado'}
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>CUIT/CUIL:</span>
                          <span className={`${styles.value} ${!userProfile?.cuitCuil ? styles.missing : ''}`}>
                            {userProfile?.cuitCuil || 'No especificado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.infoCard}>
                      <div className={styles.cardIcon}>
                        <Mail size={24} />
                      </div>
                      <h3>Contacto</h3>
                      <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Correo Electrónico:</span>
                          <span className={styles.value}>{userProfile?.email}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Avatar:</span>
                          <span className={styles.value}>
                            <img 
                              src={userProfile?.image || generateCircularAvatarDataURL(userProfile?.name || 'Usuario', '#3b82f6', '#ffffff', 120)}
                              alt="Foto de perfil"
                              className={styles.profileImage}
                            />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.infoCard}>
                      <div className={styles.cardIcon}>
                        <GraduationCap size={24} />
                      </div>
                      <h3>Preferencias</h3>
                      <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Educación Financiera:</span>
                          <span className={`${styles.value} ${!userProfile?.educacionFinanciera ? styles.missing : ''}`}>
                            {userProfile?.educacionFinanciera ? 
                              userProfile.educacionFinanciera.charAt(0).toUpperCase() + userProfile.educacionFinanciera.slice(1) : 
                              'No especificado'
                            }
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Broker de Preferencia:</span>
                          <span className={`${styles.value} ${!userProfile?.brokerPreferencia ? styles.missing : ''}`}>
                            {userProfile?.brokerPreferencia ? 
                              getBrokerDisplayName(userProfile.brokerPreferencia) : 
                              'No especificado'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información sobre seguridad de pagos */}
                  <div className={styles.securityNotice}>
                    <div className={styles.securityIcon}>
                      🔒
                    </div>
                    <div className={styles.securityText}>
                      <h4>Seguridad en Pagos</h4>
                      <p>
                        Por tu seguridad, no almacenamos información de tarjetas de crédito. 
                        Todos los pagos se procesan de forma segura a través de <strong>Mercado Pago</strong> y <strong>transferencia bancaria </strong> 
                         al momento de realizar cada compra.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Mis Compras */}
              {activeSection === 2 && (
                <motion.div
                  className={styles.sectionContent}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <UserSubscriptions />
                </motion.div>
              )}

              {/* Notificaciones */}
              {activeSection === 3 && (
                <NotificationsSection />
              )}
            </div>
          </motion.div>
        </div>

        {/* Modal de Edición del Perfil */}
        {showEditModal && (
          <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Editar Información Personal</h2>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowEditModal(false)}
                >
                  <X size={24} />
                </button>
              </div>

              <div className={styles.modalContent}>
                <form className={styles.editForm} onSubmit={handleSaveProfile}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="fullName">Nombre y Apellido</label>
                      <input
                        type="text"
                        id="fullName"
                        value={formData.fullName}
                        className={styles.formInput}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="cuitCuil">CUIT/CUIL</label>
                      <input
                        type="text"
                        id="cuitCuil"
                        value={formData.cuitCuil}
                        placeholder="Ej: 20-12345678-9"
                        className={styles.formInput}
                        onChange={(e) => setFormData({ ...formData, cuitCuil: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="email">Correo Electrónico</label>
                      <input
                        type="email"
                        id="email"
                        value={userProfile?.email || ''}
                        className={styles.formInput}
                        disabled
                      />
                      <small className={styles.formNote}>
                        El email no se puede modificar por seguridad
                      </small>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="educacionFinanciera">Educación Financiera</label>
                      <select 
                        id="educacionFinanciera" 
                        className={styles.formSelect} 
                        value={formData.educacionFinanciera}
                        onChange={(e) => setFormData({ ...formData, educacionFinanciera: e.target.value })}
                      >
                        <option value="">Seleccionar nivel</option>
                        <option value="principiante">Principiante</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                        <option value="experto">Experto</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="brokerPreferencia">Broker de Preferencia</label>
                      <select 
                        id="brokerPreferencia" 
                        className={styles.formSelect}
                        value={formData.brokerPreferencia}
                        onChange={(e) => setFormData({ ...formData, brokerPreferencia: e.target.value })}
                      >
                        <option value="">Seleccionar broker</option>
                        <option value="bull-market">Bull Market</option>
                        <option value="iol">IOL</option>
                        <option value="portfolio-personal">Portfolio Personal</option>
                        <option value="cocos-capital">Cocos Capital</option>
                        <option value="eco-valores">Eco Valores</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.modalActions}>
                    <button 
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setShowEditModal(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className={styles.saveButton}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {notification.show && (
        <motion.div
          className={`${styles.toast} ${styles[notification.type]}`}
          initial={{ opacity: 0, y: 50, x: '50%' }}
          animate={{ opacity: 1, y: 0, x: '50%' }}
          exit={{ opacity: 0, y: 50, x: '50%' }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.toastIcon}>
            {notification.type === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
          </div>
          <span className={styles.toastMessage}>{notification.message}</span>
          <button 
            className={styles.toastClose}
            onClick={() => setNotification({ show: false, type: 'success', message: '' })}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
    },
  };
};