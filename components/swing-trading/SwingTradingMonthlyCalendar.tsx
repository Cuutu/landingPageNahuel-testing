import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar,
  Users,
  DollarSign,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  CreditCard,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import styles from '../../styles/SwingTradingCalendar.module.css';

interface TrainingClass {
  _id: string;
  date: string;
  startTime: string;
  title: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface MonthlyTraining {
  _id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  monthName: string;
  price: number;
  maxStudents: number;
  classes: TrainingClass[];
  status: 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
  availableSpots: number;
  totalClasses: number;
  completedClasses: number;
  canEnroll: boolean;
  isEnrolled: boolean;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Helper function to format date for Argentina timezone (UTC-3)
function formatArgentinaDate(dateString: string): string {
  console.log('🔍 formatArgentinaDate - Input dateString:', dateString);
  
  const date = new Date(dateString);
  console.log('🔍 Created date object:', date);
  console.log('🔍 Date ISO string:', date.toISOString());
  console.log('🔍 Date local string:', date.toLocaleDateString('es-AR'));
  
  // Format the date directly without timezone adjustment
  // since dates are now stored correctly in UTC
  const formatted = date.toLocaleDateString('es-AR', { 
    day: '2-digit', 
    month: '2-digit',
    year: 'numeric'
  });
  
  console.log('🔍 Formatted result:', formatted);
  return formatted;
}

export default function SwingTradingCalendar() {
  const { data: session } = useSession();
  const [trainings, setTrainings] = useState<MonthlyTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    loadTrainings();
  }, [currentMonth, currentYear, session]);

  const loadTrainings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/monthly-trainings?year=${currentYear}&month=${currentMonth}`);
      const data = await response.json();
      
      if (data.success) {
        setTrainings(data.data);
      }
    } catch (error) {
      console.error('Error cargando entrenamientos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (trainingId: string) => {
    if (!session) {
      alert('Debes iniciar sesión para inscribirte');
      return;
    }

    setEnrolling(trainingId);
    
    try {
      // Crear checkout de MercadoPago
      const response = await fetch('/api/payments/mercadopago/create-monthly-training-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Redirigir a MercadoPago
        window.location.href = process.env.NODE_ENV === 'production' 
          ? data.initPoint 
          : data.sandboxInitPoint;
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error creando checkout:', error);
      alert('Error procesando el pago. Inténtalo nuevamente.');
    } finally {
      setEnrolling(null);
    }
  };

  const navigateToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const navigateToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const getCurrentMonthName = () => {
    return MONTHS[currentMonth - 1];
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: '#6b7280', text: 'Borrador', icon: AlertCircle },
      open: { color: '#10b981', text: 'Abierto', icon: CheckCircle },
      full: { color: '#ef4444', text: 'AGOTADO', icon: Users },
      'in-progress': { color: '#3b82f6', text: 'En Progreso', icon: Clock },
      completed: { color: '#059669', text: 'Completado', icon: CheckCircle },
      cancelled: { color: '#ef4444', text: 'Cancelado', icon: AlertCircle }
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

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <p>Cargando entrenamientos...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Swing Trading - Entrenamientos Mensuales</h2>
          <p>Inscríbete a nuestros entrenamientos mensuales de Swing Trading</p>
        </div>
        
        <div className={styles.monthNavigation}>
          <button 
            onClick={navigateToPreviousMonth}
            className={styles.navButton}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className={styles.currentMonthDisplay}>
            <span className={styles.monthName}>{getCurrentMonthName()}</span>
            <span className={styles.yearName}>{currentYear}</span>
          </div>
          
          <button 
            onClick={navigateToNextMonth}
            className={styles.navButton}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Entrenamiento del Mes Actual */}
      <div className={styles.monthContainer}>
        {trainings.length > 0 ? (
          trainings.map((training) => (
            <div key={training._id} className={styles.trainingCard}>
              <div className={styles.trainingHeader}>
                <div className={styles.trainingTitle}>
                  <h3>{training.title}</h3>
                  <span className={styles.monthYear}>
                    {training.monthName} {training.year}
                  </span>
                </div>
                
                {getStatusBadge(training.status)}
              </div>

              <p className={styles.trainingDescription}>{training.description}</p>
              
              <div className={styles.trainingStats}>
                <div className={styles.stat}>
                  <DollarSign size={16} />
                  <span>ARS ${training.price.toLocaleString('es-AR')}</span>
                </div>
                <div className={styles.stat}>
                  <Users size={16} />
                  <span>{training.maxStudents - training.availableSpots}/{training.maxStudents}</span>
                </div>
                <div className={styles.stat}>
                  <Calendar size={16} />
                  <span>{training.totalClasses} clases</span>
                </div>
              </div>

              {/* Clases del mes */}
              <div className={styles.classesList}>
                <h4>Clases programadas:</h4>
                {training.classes.map((classItem, classIndex) => (
                  <div key={classIndex} className={styles.classItem}>
                    <div className={styles.classDate}>
                      {formatArgentinaDate(classItem.date)}
                    </div>
                    <div className={styles.classInfo}>
                      <span className={styles.classTitle}>{classItem.title}</span>
                      <span className={styles.classTime}>
                        {classItem.startTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón de acción */}
              <div className={styles.trainingActions}>
                {training.isEnrolled ? (
                  <div className={styles.enrolledBadge}>
                    <CheckCircle size={16} />
                    <span>Ya inscripto</span>
                  </div>
                ) : training.canEnroll ? (
                  <button
                    onClick={() => handleEnroll(training._id)}
                    disabled={enrolling === training._id}
                    className={styles.enrollButton}
                  >
                    <CreditCard size={16} />
                    {enrolling === training._id ? 'Procesando...' : `Inscribirse - ARS $${training.price.toLocaleString('es-AR')}`}
                  </button>
                ) : (
                  <div className={styles.unavailableBadge}>
                    {training.status === 'full' && (
                      <span>Sin cupos disponibles</span>
                    )}
                    {training.status === 'completed' && (
                      <span>Entrenamiento finalizado</span>
                    )}
                    {training.status === 'cancelled' && (
                      <span>Entrenamiento cancelado</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className={styles.noTraining}>
            <Calendar size={64} />
            <h3>No hay entrenamiento disponible</h3>
            <p>No hay entrenamientos programados para {getCurrentMonthName()} {currentYear}</p>
            <div className={styles.navigationHint}>
              <p>Usa las flechas para navegar entre meses</p>
            </div>
          </div>
        )}
      </div>

      {/* Información adicional - OCULTA */}
      {/* <div className={styles.infoSection}>
        <div className={styles.infoCard}>
          <h3>¿Cómo funcionan los entrenamientos mensuales?</h3>
          <ul>
            <li>Cada mes ofrecemos un entrenamiento completo de Swing Trading</li>
            <li>Incluye múltiples clases en vivo durante el mes</li>
            <li>Máximo 10 participantes por entrenamiento para atención personalizada</li>
            <li>Material de apoyo y seguimiento personalizado</li>
            <li>Acceso a grabaciones de las clases</li>
          </ul>
        </div>

        <div className={styles.infoCard}>
          <h3>Proceso de inscripción</h3>
          <ul>
            <li>Selecciona el mes de tu interés</li>
            <li>Realiza el pago a través de MercadoPago</li>
            <li>Recibirás confirmación y acceso al grupo privado</li>
            <li>Las clases se realizan según el cronograma publicado</li>
          </ul>
        </div>
      </div> */}
    </div>
  );
}
