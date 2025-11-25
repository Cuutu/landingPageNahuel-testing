import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  BookOpen,
  Video,
  Download,
  ExternalLink
} from 'lucide-react';
import styles from '../../styles/StudentDashboard.module.css';

interface StudentTrainingClass {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  meetLink?: string;
  attended?: boolean;
  attendedAt?: string;
}

interface StudentTraining {
  _id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  monthName: string;
  price: number;
  status: 'draft' | 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
  classes: StudentTrainingClass[];
  enrolledAt: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentId?: string;
  experienceLevel?: string;
  totalClasses: number;
  attendedClasses: number;
  attendancePercentage: number;
}

export default function StudentTrainingDashboard() {
  const { data: session, status } = useSession();
  const [trainings, setTrainings] = useState<StudentTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'completed' | 'all'>('current');

  useEffect(() => {
    if (status === 'authenticated') {
      loadStudentTrainings();
    }
  }, [status]);

  const loadStudentTrainings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/monthly-trainings');
      const data = await response.json();
      
      if (data.success) {
        setTrainings(data.data);
      }
    } catch (error) {
      console.error('Error cargando entrenamientos del estudiante:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'in-progress': { color: '#3b82f6', text: 'En Progreso', icon: Clock },
      completed: { color: '#059669', text: 'Completado', icon: CheckCircle },
      cancelled: { color: '#ef4444', text: 'Cancelado', icon: XCircle },
      draft: { color: '#6b7280', text: 'Borrador', icon: AlertCircle },
      open: { color: '#10b981', text: 'Abierto', icon: CheckCircle },
      full: { color: '#f59e0b', text: 'Lleno', icon: Users }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const IconComponent = config.icon;

    return (
      <div 
        className={styles.statusBadge}
        style={{ backgroundColor: config.color }}
      >
        <IconComponent size={14} />
        <span>{config.text}</span>
      </div>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: '#f59e0b', text: 'Pendiente' },
      completed: { color: '#10b981', text: 'Pagado' },
      failed: { color: '#ef4444', text: 'Fallido' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
      <span 
        className={styles.paymentBadge}
        style={{ backgroundColor: config.color }}
      >
        {config.text}
      </span>
    );
  };

  const filterTrainings = (trainings: StudentTraining[]) => {
    switch (activeTab) {
      case 'current':
        return trainings.filter(t => t.status === 'in-progress' || t.status === 'open');
      case 'completed':
        return trainings.filter(t => t.status === 'completed');
      case 'all':
      default:
        return trainings;
    }
  };

  const getUpcomingClass = (classes: StudentTrainingClass[]) => {
    const now = new Date();
    return classes
      .filter(cls => cls.status === 'scheduled' && new Date(cls.date) > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  };

  if (status === 'loading' || loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <p>Cargando tus entrenamientos...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className={styles.container}>
        <div className={styles.authRequired}>
          <h2>Acceso Requerido</h2>
          <p>Debes iniciar sesión para ver tus entrenamientos</p>
          <Link href="/auth/signin" className={styles.loginButton}>
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  const filteredTrainings = filterTrainings(trainings);

  return (
    <div className={styles.container}>
      <Head>
        <title>Mis Entrenamientos - Dashboard</title>
      </Head>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Mis Entrenamientos</h1>
          <p>Gestiona y accede a todos tus entrenamientos de Zero 2 Trader</p>
        </div>
        
        {trainings.length > 0 && (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{trainings.length}</span>
              <span className={styles.statLabel}>Entrenamientos</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {trainings.filter(t => t.status === 'completed').length}
              </span>
              <span className={styles.statLabel}>Completados</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {Math.round(
                  trainings.reduce((sum, t) => sum + t.attendancePercentage, 0) / trainings.length
                ) || 0}%
              </span>
              <span className={styles.statLabel}>Asistencia</span>
            </div>
          </div>
        )}
      </div>

      {trainings.length === 0 ? (
        <div className={styles.emptyState}>
          <BookOpen size={64} />
          <h2>No tienes entrenamientos</h2>
          <p>Inscríbete a un entrenamiento mensual para comenzar tu aprendizaje</p>
          <Link href="/entrenamientos/swing-trading" className={styles.enrollButton}>
            Ver Entrenamientos Disponibles
          </Link>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'current' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('current')}
            >
              Actuales ({trainings.filter(t => t.status === 'in-progress' || t.status === 'open').length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'completed' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completados ({trainings.filter(t => t.status === 'completed').length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Todos ({trainings.length})
            </button>
          </div>

          {/* Training Cards */}
          <div className={styles.trainingsGrid}>
            {filteredTrainings.map((training) => {
              const upcomingClass = getUpcomingClass(training.classes);
              
              return (
                <div key={training._id} className={styles.trainingCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      <h3>{training.title}</h3>
                      <span className={styles.monthYear}>
                        {training.monthName} {training.year}
                      </span>
                    </div>
                    
                    <div className={styles.cardBadges}>
                      {getStatusBadge(training.status)}
                      {getPaymentStatusBadge(training.paymentStatus)}
                    </div>
                  </div>

                  <p className={styles.trainingDescription}>{training.description}</p>

                  <div className={styles.trainingStats}>
                    <div className={styles.statItem}>
                      <Calendar size={16} />
                      <span>{training.totalClasses} clases</span>
                    </div>
                    <div className={styles.statItem}>
                      <CheckCircle size={16} />
                      <span>{training.attendedClasses} asistidas</span>
                    </div>
                    <div className={styles.statItem}>
                      <Users size={16} />
                      <span>{training.attendancePercentage}% asistencia</span>
                    </div>
                  </div>

                  {upcomingClass && (
                    <div className={styles.upcomingClass}>
                      <h4>Próxima Clase</h4>
                      <div className={styles.classInfo}>
                        <div className={styles.classDate}>
                          {new Date(upcomingClass.date).toLocaleDateString('es-AR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                          })}
                        </div>
                        <div className={styles.classTime}>
                          {upcomingClass.startTime} - {upcomingClass.endTime}
                        </div>
                        <div className={styles.classTitle}>{upcomingClass.title}</div>
                        
                        {upcomingClass.meetLink && (
                          <a 
                            href={upcomingClass.meetLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.joinButton}
                          >
                            <Video size={16} />
                            Unirse a la Clase
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={styles.cardActions}>
                    <Link 
                      href={`/student/training/${training._id}`}
                      className={styles.viewButton}
                    >
                      Ver Detalles
                    </Link>
                    
                    {training.status === 'completed' && (
                      <button className={styles.certificateButton}>
                        <Download size={16} />
                        Certificado
                      </button>
                    )}
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.enrolledDate}>
                      Inscrito: {new Date(training.enrolledAt).toLocaleDateString('es-AR')}
                    </span>
                    {training.paymentId && (
                      <span className={styles.paymentId}>
                        Pago: {training.paymentId}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTrainings.length === 0 && (
            <div className={styles.emptyFiltered}>
              <AlertCircle size={48} />
              <h3>No hay entrenamientos en esta categoría</h3>
              <p>
                {activeTab === 'current' && 'No tienes entrenamientos activos en este momento'}
                {activeTab === 'completed' && 'Aún no has completado ningún entrenamiento'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
