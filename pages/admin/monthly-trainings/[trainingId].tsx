import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  MapPin,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  UserPlus,
  UserMinus,
  Edit
} from 'lucide-react';
import AdminRouteGuard from '../../../components/AdminRouteGuard';
import styles from '../../../styles/admin/MonthlyTrainingDetail.module.css';

interface TrainingClass {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  meetingLink?: string;
}

interface Student {
  _id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  enrolledAt: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentId?: string;
  experienceLevel?: 'principiante' | 'intermedio' | 'avanzado';
  attendance: {
    classId: string;
    attended: boolean;
    attendedAt?: string;
  }[];
}

interface MonthlyTraining {
  _id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  monthName: string;
  maxStudents: number;
  price: number;
  classes: TrainingClass[];
  students: Student[];
  status: 'draft' | 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
  registrationOpenDate: string;
  registrationCloseDate: string;
  availableSpots: number;
  totalClasses: number;
  completedClasses: number;
  createdAt: string;
  createdBy: string;
}

export default function MonthlyTrainingDetail() {
  const router = useRouter();
  const { trainingId } = router.query;
  const { data: session, status } = useSession();
  
  const [training, setTraining] = useState<MonthlyTraining | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'students'>('overview');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  
  // Estados para agregar estudiante
  const [newStudent, setNewStudent] = useState({
    userId: '',
    name: '',
    email: '',
    phone: '',
    experienceLevel: 'principiante' as 'principiante' | 'intermedio' | 'avanzado'
  });

  useEffect(() => {
    if (trainingId && status === 'authenticated') {
      loadTraining();
      loadStudents();
    }
  }, [trainingId, status]);

  const loadTraining = async () => {
    try {
      const response = await fetch(`/api/admin/monthly-trainings?id=${trainingId}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        setTraining(data.data[0]);
      } else {
        console.error('Entrenamiento no encontrado');
        router.push('/admin/monthly-trainings');
      }
    } catch (error) {
      console.error('Error cargando entrenamiento:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await fetch(`/api/admin/monthly-trainings/${trainingId}/students`);
      const data = await response.json();
      
      if (data.success) {
        setStudents(data.data.students);
      }
    } catch (error) {
      console.error('Error cargando estudiantes:', error);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/admin/monthly-trainings/${trainingId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStudent,
          paymentStatus: 'completed' // Admin agrega directamente como pagado
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Estudiante agregado exitosamente');
        setShowAddStudentModal(false);
        setNewStudent({
          userId: '',
          name: '',
          email: '',
          phone: '',
          experienceLevel: 'principiante'
        });
        loadTraining();
        loadStudents();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error agregando estudiante:', error);
      alert('Error agregando estudiante');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('¿Estás seguro de que quieres remover este estudiante?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/monthly-trainings/${trainingId}/students?studentId=${studentId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Estudiante removido exitosamente');
        loadTraining();
        loadStudents();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error removiendo estudiante:', error);
      alert('Error removiendo estudiante');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { color: '#6b7280', text: 'Borrador' },
      open: { color: '#10b981', text: 'Abierto' },
      full: { color: '#f59e0b', text: 'Lleno' },
      'in-progress': { color: '#3b82f6', text: 'En Progreso' },
      completed: { color: '#059669', text: 'Completado' },
      cancelled: { color: '#ef4444', text: 'Cancelado' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
      <span 
        className={styles.statusBadge}
        style={{ backgroundColor: config.color }}
      >
        {config.text}
      </span>
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

  const getClassStatusBadge = (status: string) => {
    const statusConfig = {
      scheduled: { color: '#6b7280', text: 'Programada' },
      completed: { color: '#10b981', text: 'Completada' },
      cancelled: { color: '#ef4444', text: 'Cancelada' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];

    return (
      <span 
        className={styles.classBadge}
        style={{ backgroundColor: config.color }}
      >
        {config.text}
      </span>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <p>Cargando entrenamiento...</p>
      </div>
    );
  }

  if (!training) {
    return (
      <div className={styles.error}>
        <h2>Entrenamiento no encontrado</h2>
        <Link href="/admin/monthly-trainings" className={styles.backButton}>
          Volver a Entrenamientos
        </Link>
      </div>
    );
  }

  return (
    <AdminRouteGuard>
      <div className={styles.container}>
        <Head>
          <title>{training.title} - Admin</title>
        </Head>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Link href="/admin/monthly-trainings" className={styles.backLink}>
              <ArrowLeft size={20} />
              Volver a Entrenamientos
            </Link>
            <h1>{training.title}</h1>
            <div className={styles.headerMeta}>
              {getStatusBadge(training.status)}
              <span className={styles.monthYear}>
                {training.monthName} {training.year}
              </span>
            </div>
          </div>
          
          <div className={styles.headerActions}>
            <Link 
              href={`/admin/monthly-trainings/edit/${training._id}`}
              className={styles.editButton}
            >
              <Edit size={16} />
              Editar
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Users size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{training.students.length}/{training.maxStudents}</span>
              <span className={styles.statLabel}>Estudiantes</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <DollarSign size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>${training.price}</span>
              <span className={styles.statLabel}>Precio</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Clock size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{training.completedClasses}/{training.totalClasses}</span>
              <span className={styles.statLabel}>Clases</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <Calendar size={24} />
            </div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>{training.availableSpots}</span>
              <span className={styles.statLabel}>Cupos Disponibles</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Resumen
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'classes' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            Clases ({training.classes.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'students' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('students')}
          >
            Estudiantes ({training.students.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewContent}>
              <div className={styles.overviewGrid}>
                <div className={styles.overviewCard}>
                  <h3>Descripción</h3>
                  <p>{training.description}</p>
                </div>

                <div className={styles.overviewCard}>
                  <h3>Información General</h3>
                  <div className={styles.infoList}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Mes:</span>
                      <span>{training.monthName} {training.year}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Precio:</span>
                      <span>${training.price}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Máximo Estudiantes:</span>
                      <span>{training.maxStudents}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Estado:</span>
                      {getStatusBadge(training.status)}
                    </div>
                  </div>
                </div>

                <div className={styles.overviewCard}>
                  <h3>Fechas de Inscripción</h3>
                  <div className={styles.infoList}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Apertura:</span>
                      <span>{new Date(training.registrationOpenDate).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Cierre:</span>
                      <span>{new Date(training.registrationCloseDate).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.overviewCard}>
                  <h3>Creación</h3>
                  <div className={styles.infoList}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Creado por:</span>
                      <span>{training.createdBy}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Fecha:</span>
                      <span>{new Date(training.createdAt).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'classes' && (
            <div className={styles.classesContent}>
              <div className={styles.classesList}>
                {training.classes.map((classItem, index) => (
                  <div key={classItem._id} className={styles.classCard}>
                    <div className={styles.classHeader}>
                      <div className={styles.classTitle}>
                        <h4>{classItem.title}</h4>
                        {getClassStatusBadge(classItem.status)}
                      </div>
                      <span className={styles.classNumber}>Clase {index + 1}</span>
                    </div>

                    <div className={styles.classInfo}>
                      <div className={styles.classInfoItem}>
                        <Calendar size={16} />
                        <span>{new Date(classItem.date).toLocaleDateString('es-AR')}</span>
                      </div>
                      <div className={styles.classInfoItem}>
                        <Clock size={16} />
                        <span>{classItem.startTime} - {classItem.endTime}</span>
                      </div>
                      {classItem.meetingLink && (
                        <div className={styles.classInfoItem}>
                          <MapPin size={16} />
                          <a href={classItem.meetingLink} target="_blank" rel="noopener noreferrer">
                            Link de la clase
                          </a>
                        </div>
                      )}
                    </div>

                    {classItem.description && (
                      <p className={styles.classDescription}>{classItem.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div className={styles.studentsContent}>
              <div className={styles.studentsHeader}>
                <h3>Estudiantes Inscritos ({students.length})</h3>
                <button
                  onClick={() => setShowAddStudentModal(true)}
                  className={styles.addStudentButton}
                  disabled={training.students.length >= training.maxStudents}
                >
                  <UserPlus size={16} />
                  Agregar Estudiante
                </button>
              </div>

              <div className={styles.studentsList}>
                {students.map((student) => (
                  <div key={student._id} className={styles.studentCard}>
                    <div className={styles.studentHeader}>
                      <div className={styles.studentInfo}>
                        <h4>{student.name}</h4>
                        <div className={styles.studentMeta}>
                          {getPaymentStatusBadge(student.paymentStatus)}
                          <span className={styles.experienceLevel}>
                            {student.experienceLevel || 'No especificado'}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveStudent(student._id)}
                        className={styles.removeStudentButton}
                        title="Remover estudiante"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>

                    <div className={styles.studentDetails}>
                      <div className={styles.studentContact}>
                        <div className={styles.contactItem}>
                          <Mail size={14} />
                          <span>{student.email}</span>
                        </div>
                        {student.phone && (
                          <div className={styles.contactItem}>
                            <Phone size={14} />
                            <span>{student.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className={styles.enrollmentInfo}>
                        <span>Inscrito: {new Date(student.enrolledAt).toLocaleDateString('es-AR')}</span>
                        {student.paymentId && (
                          <span>ID Pago: {student.paymentId}</span>
                        )}
                      </div>
                    </div>

                    {/* Asistencia */}
                    <div className={styles.attendanceSection}>
                      <h5>Asistencia</h5>
                      <div className={styles.attendanceList}>
                        {training.classes.map((classItem, index) => {
                          const attendance = student.attendance.find(a => a.classId === classItem._id);
                          return (
                            <div key={classItem._id} className={styles.attendanceItem}>
                              <span>Clase {index + 1}</span>
                              <div className={styles.attendanceStatus}>
                                {attendance?.attended ? (
                                  <CheckCircle size={16} className={styles.attendedIcon} />
                                ) : (
                                  <XCircle size={16} className={styles.notAttendedIcon} />
                                )}
                                <span>
                                  {attendance?.attended ? 'Asistió' : 'No asistió'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {students.length === 0 && (
                  <div className={styles.emptyStudents}>
                    <Users size={48} />
                    <h4>No hay estudiantes inscritos</h4>
                    <p>Los estudiantes aparecerán aquí cuando se inscriban al entrenamiento</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Agregar Estudiante */}
        {showAddStudentModal && (
          <div className={styles.modalOverlay} onClick={() => setShowAddStudentModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3>Agregar Estudiante</h3>
                <button onClick={() => setShowAddStudentModal(false)}>×</button>
              </div>

              <form onSubmit={handleAddStudent} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>User ID *</label>
                  <input
                    type="text"
                    value={newStudent.userId}
                    onChange={(e) => setNewStudent({ ...newStudent, userId: e.target.value })}
                    placeholder="ID del usuario en el sistema"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="Nombre completo"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="email@ejemplo.com"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Nivel de Experiencia</label>
                  <select
                    value={newStudent.experienceLevel}
                    onChange={(e) => setNewStudent({ 
                      ...newStudent, 
                      experienceLevel: e.target.value as 'principiante' | 'intermedio' | 'avanzado'
                    })}
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                  </select>
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => setShowAddStudentModal(false)}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className={styles.submitButton}>
                    Agregar Estudiante
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
}
