import React, { useState, useEffect } from 'react';
import { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
  Send, 
  Calendar, 
  Clock,
  User,
  Mail,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Users,
  GraduationCap,
  Building,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/AdminEnviarLinks.module.css';
import { generateCircularAvatarDataURL } from '@/lib/utils';

interface UpcomingSession {
  _id: string;
  type: 'advisory' | 'training';
  serviceType: string;
  serviceName: string;
  startDate: string;
  endDate: string;
  duration: number;
  price: number;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  user: {
    name: string;
    email: string;
    image?: string;
  };
  meetingLink?: string;
  notes?: string;
  daysUntil: number;
}

interface SendLinkForm {
  sessionId: string;
  subject: string;
  meetingLink: string;
  customMessage: string;
}

interface AdminEnviarLinksProps {
  user: any;
}

const AdminEnviarLinksPage = ({ user }: AdminEnviarLinksProps) => {
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<UpcomingSession | null>(null);
  const [formData, setFormData] = useState<SendLinkForm>({
    sessionId: '',
    subject: '',
    meetingLink: '',
    customMessage: ''
  });

  useEffect(() => {
    loadUpcomingSessions();
  }, []);

  const loadUpcomingSessions = async () => {
    try {
      setLoading(true);
      // console.log('📅 Cargando sesiones próximas...');
      
      const response = await fetch('/api/admin/upcoming-sessions');
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        // console.log(`✅ Cargadas ${data.sessions?.length || 0} sesiones próximas`);
      } else {
        console.error('❌ Error al cargar sesiones:', response.status);
        toast.error('Error al cargar sesiones próximas');
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSendLink = (session: UpcomingSession) => {
    setSelectedSession(session);
    
    // Pre-rellenar el formulario
    const serviceTypeText = session.type === 'advisory' ? 'Asesoría' : 'Entrenamiento';
    const defaultSubject = `Link de reunión para tu ${serviceTypeText}: ${session.serviceName}`;
    
    setFormData({
      sessionId: session._id,
      subject: defaultSubject,
      meetingLink: session.meetingLink || '',
      customMessage: `Hola ${session.user.name},\n\nEspero que estés bien. Te envío el link para nuestra ${serviceTypeText.toLowerCase()} programada para el ${new Date(session.startDate).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}.\n\n¡Nos vemos pronto!\n\nSaludos,\nNahuel`
    });
    
    setShowForm(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.meetingLink.trim()) {
      toast.error('El link de reunión es obligatorio');
      return;
    }
    
    if (!formData.subject.trim()) {
      toast.error('El asunto es obligatorio');
      return;
    }

    try {
      setSendingEmail(true);
      
      const response = await fetch('/api/admin/send-meeting-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('¡Link de reunión enviado exitosamente!');
        setShowForm(false);
        setSelectedSession(null);
        setFormData({
          sessionId: '',
          subject: '',
          meetingLink: '',
          customMessage: ''
        });
        
        // Recargar sesiones para actualizar el estado
        loadUpcomingSessions();
      } else {
        toast.error(data.error || 'Error al enviar link de reunión');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar email');
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#059669';
      case 'pending': return '#d97706';
      case 'completed': return '#64748b';
      case 'cancelled': return '#dc2626';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getServiceIcon = (type: string, serviceType: string) => {
    if (type === 'advisory') {
      return <Building size={20} />;
    } else {
      return <GraduationCap size={20} />;
    }
  };

  return (
    <>
      <Head>
        <title>Enviar Links de Reunión - Admin</title>
        <meta name="description" content="Gestión centralizada de links de reunión para asesorías y entrenamientos" />
        <meta name="robots" content="noindex, nofollow" />
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
              <h1 className={styles.title}>Enviar Links de Reunión</h1>
              <p className={styles.subtitle}>
                Gestión centralizada de links de reunión para todas las sesiones próximas
              </p>
              <Link href="/admin/dashboard" className={styles.backLink}>
                ← Volver al Dashboard
              </Link>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button 
                onClick={loadUpcomingSessions}
                className={styles.refreshButton}
                disabled={loading}
              >
                <RefreshCw size={20} className={loading ? styles.spinning : ''} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {/* Sessions List */}
            <div className={styles.sessionsContainer}>
              {loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Cargando sesiones próximas...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className={styles.empty}>
                  <Calendar size={48} />
                  <h3>No hay sesiones próximas</h3>
                  <p>No se encontraron asesorías o entrenamientos programados para los próximos días</p>
                </div>
              ) : (
                <div className={styles.sessionsList}>
                  {sessions.map((session, index) => (
                    <motion.div
                      key={session._id}
                      className={styles.sessionCard}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className={styles.cardHeader}>
                        <div className={styles.serviceInfo}>
                          {getServiceIcon(session.type, session.serviceType)}
                          <div className={styles.serviceDetails}>
                            <h3>{session.serviceName}</h3>
                            <span className={styles.serviceType}>
                              {session.type === 'advisory' ? 'Asesoría' : 'Entrenamiento'}
                            </span>
                          </div>
                        </div>
                        
                        <div className={styles.urgencyBadge}>
                          {session.daysUntil === 0 ? (
                            <span className={styles.today}>Hoy</span>
                          ) : session.daysUntil === 1 ? (
                            <span className={styles.tomorrow}>Mañana</span>
                          ) : (
                            <span className={styles.upcoming}>En {session.daysUntil} días</span>
                          )}
                        </div>
                      </div>

                      <div className={styles.cardBody}>
                        <div className={styles.dateTimeInfo}>
                          <div className={styles.dateTime}>
                            <Calendar size={16} />
                            <span>
                              {new Date(session.startDate).toLocaleDateString('es-AR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                              })}
                            </span>
                          </div>
                          <div className={styles.dateTime}>
                            <Clock size={16} />
                            <span>
                              {new Date(session.startDate).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })} 
                              ({session.duration} min)
                            </span>
                          </div>
                        </div>

                        <div className={styles.userInfo}>
                          <div className={styles.userAvatar}>
                            <img 
                              src={session.user.image || generateCircularAvatarDataURL(session.user.name, '#3b82f6', '#ffffff', 40)}
                              alt={session.user.name}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = generateCircularAvatarDataURL(session.user.name, '#3b82f6', '#ffffff', 40);
                              }}
                            />
                          </div>
                          <div className={styles.userDetails}>
                            <span className={styles.userName}>{session.user.name}</span>
                            <span className={styles.userEmail}>{session.user.email}</span>
                          </div>
                        </div>

                        <div className={styles.sessionMeta}>
                          <div 
                            className={styles.statusBadge}
                            style={{ 
                              backgroundColor: getStatusColor(session.status),
                              color: 'white'
                            }}
                          >
                            {getStatusText(session.status)}
                          </div>
                          <span className={styles.price}>${session.price} ARS</span>
                        </div>

                        {session.meetingLink && (
                          <div className={styles.existingLink}>
                            <ExternalLink size={16} />
                            <span>Link ya enviado</span>
                            <CheckCircle size={16} className={styles.checkIcon} />
                          </div>
                        )}
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          onClick={() => handleSendLink(session)}
                          className={styles.sendButton}
                          disabled={session.status === 'cancelled'}
                        >
                          <Send size={16} />
                          {session.meetingLink ? 'Reenviar Link' : 'Enviar Link'}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Modal de Envío de Link */}
        {showForm && selectedSession && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContainer}>
              <div className={styles.modalHeader}>
                <h3>Enviar Link de Reunión</h3>
                <button 
                  onClick={() => {
                    setShowForm(false);
                    setSelectedSession(null);
                  }}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.sessionSummary}>
                  <h4>Sesión: {selectedSession.serviceName}</h4>
                  <p>Cliente: {selectedSession.user.name} ({selectedSession.user.email})</p>
                  <p>Fecha: {new Date(selectedSession.startDate).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>

                <form onSubmit={handleSubmitForm} className={styles.form}>
                  <div className={styles.formGroup}>
                    <label>Destinatario <span className={styles.required}>*</span></label>
                    <input
                      type="email"
                      value={selectedSession.user.email}
                      readOnly
                      className={styles.readOnlyField}
                      title="Email del cliente - No modificable"
                    />
                    <small className={styles.formHint}>
                      ✅ Email del cliente confirmado - No se puede modificar
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Asunto del Email</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      placeholder="Ej: Link de reunión para tu asesoría del lunes 24"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Link de Reunión <span className={styles.required}>*</span></label>
                    <input
                      type="url"
                      value={formData.meetingLink}
                      onChange={(e) => setFormData({...formData, meetingLink: e.target.value})}
                      placeholder="https://zoom.us/j/123456789 o https://meet.google.com/abc-defg-hij"
                      required
                    />
                    <small className={styles.formHint}>
                      Puedes usar Zoom, Google Meet, Teams, etc.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Mensaje Personalizado</label>
                    <textarea
                      value={formData.customMessage}
                      onChange={(e) => setFormData({...formData, customMessage: e.target.value})}
                      rows={6}
                      placeholder="Mensaje personalizado para el cliente..."
                    />
                  </div>

                  <div className={styles.formActions}>
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowForm(false);
                        setSelectedSession(null);
                      }}
                      className={styles.cancelButton}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={sendingEmail}
                      className={styles.submitButton}
                    >
                      {sendingEmail ? (
                        <>
                          <RefreshCw size={16} className={styles.spinning} />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Enviar Link a {selectedSession.user.name}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context: GetServerSidePropsContext) => {
  // console.log('🔍 [ENVIAR-LINKS] Verificando acceso de admin...');
  
  try {
    const verification = await verifyAdminAccess(context);
    
    if (!verification.isAdmin) {
      // console.log('❌ [ENVIAR-LINKS] Acceso denegado');
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [ENVIAR-LINKS] Acceso confirmado');
    
    return {
      props: {
        user: verification.session?.user || verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [ENVIAR-LINKS] Error:', error);
    
    const callbackUrl = encodeURIComponent(context.resolvedUrl || '/admin/dashboard');
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }
};

export default AdminEnviarLinksPage; 