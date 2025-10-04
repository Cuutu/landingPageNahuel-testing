import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  Calendar, 
  DollarSign, 
  Mail, 
  Phone, 
  Clock,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import AdminRouteGuard from '../../../components/AdminRouteGuard';
import styles from '../../../styles/admin/MonthlyTrainingUsers.module.css';

interface Student {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  enrolledAt: string;
  paymentId: string;
  experienceLevel: string;
  attendance: Array<{
    classId: string;
    attended: boolean;
    attendedAt?: string;
  }>;
}

interface TrainingData {
  trainingId: string;
  title: string;
  month: number;
  year: number;
  monthName: string;
  price: number;
  maxStudents: number;
  totalPaidStudents: number;
  students: Student[];
}

interface StatsData {
  totalTrainings: number;
  totalStudents: number;
  totalRevenue: number;
}

export default function MonthlyTrainingUsers() {
  const { data: session, status } = useSession();
  const [trainings, setTrainings] = useState<TrainingData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/monthly-trainings/users');
      const data = await response.json();
      
      if (data.success) {
        setTrainings(data.data.trainings);
        setStats(data.data.stats);
      } else {
        console.error('Error cargando datos:', data.error);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrainings = trainings.filter(training => {
    const matchesSearch = training.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         training.students.some(student => 
                           student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           student.email.toLowerCase().includes(searchTerm.toLowerCase())
                         );
    
    const matchesMonth = selectedMonth === 'all' || training.month.toString() === selectedMonth;
    const matchesYear = selectedYear === 'all' || training.year.toString() === selectedYear;
    
    return matchesSearch && matchesMonth && matchesYear;
  });

  const exportToCSV = () => {
    const csvData = trainings.flatMap(training => 
      training.students.map(student => ({
        'Entrenamiento': training.title,
        'Mes': training.monthName,
        'Año': training.year,
        'Nombre': student.name,
        'Email': student.email,
        'Teléfono': student.phone || '',
        'Fecha Inscripción': new Date(student.enrolledAt).toLocaleDateString('es-AR'),
        'ID Pago': student.paymentId,
        'Nivel': student.experienceLevel,
        'Precio': training.price
      }))
    );

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${(row as any)[header]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `usuarios-entrenamientos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner}></div>
          <p>Cargando usuarios de entrenamientos...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminRouteGuard>
      <div className={styles.container}>
        <Head>
          <title>Gestión de Usuarios - Entrenamientos Mensuales</title>
        </Head>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/admin" className={styles.backButton}>
              <ArrowLeft size={20} />
              Volver al Admin
            </Link>
            
            <div className={styles.titleSection}>
              <div className={styles.titleIcon}>
                <Users size={32} />
              </div>
              <div>
                <h1>Gestión de Usuarios - Entrenamientos</h1>
                <p>Administra todos los usuarios inscritos en entrenamientos mensuales</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Calendar size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>{stats.totalTrainings}</span>
                <span className={styles.statLabel}>Entrenamientos</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Users size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>{stats.totalStudents}</span>
                <span className={styles.statLabel}>Estudiantes Pagados</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <DollarSign size={24} />
              </div>
              <div className={styles.statContent}>
                <span className={styles.statValue}>${stats.totalRevenue.toLocaleString('es-AR')}</span>
                <span className={styles.statLabel}>Ingresos Totales</span>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.filtersSection}>
          <div className={styles.searchBox}>
            <Search size={20} />
            <input
              type="text"
              placeholder="Buscar por entrenamiento o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => {
                const monthNames = [
                  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                ];
                return (
                  <option key={i + 1} value={i + 1}>
                    {monthNames[i]}
                  </option>
                );
              })}
            </select>

            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Todos los años</option>
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>

            <button onClick={exportToCSV} className={styles.exportButton}>
              <Download size={20} />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Trainings List */}
        <div className={styles.trainingsList}>
          {filteredTrainings.length === 0 ? (
            <div className={styles.emptyState}>
              <Users size={48} />
              <h3>No se encontraron entrenamientos</h3>
              <p>No hay entrenamientos que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            filteredTrainings.map((training) => (
              <div key={training.trainingId} className={styles.trainingCard}>
                <div className={styles.trainingHeader}>
                  <div className={styles.trainingInfo}>
                    <h3>{training.title}</h3>
                    <div className={styles.trainingMeta}>
                      <span className={styles.monthYear}>
                        <Calendar size={16} />
                        {training.monthName} {training.year}
                      </span>
                      <span className={styles.price}>
                        <DollarSign size={16} />
                        ${training.price.toLocaleString('es-AR')}
                      </span>
                      <span className={styles.students}>
                        <Users size={16} />
                        {training.totalPaidStudents}/{training.maxStudents} estudiantes
                      </span>
                    </div>
                  </div>
                  
                  <div className={styles.trainingActions}>
                    <Link 
                      href={`/admin/monthly-trainings/${training.trainingId}`}
                      className={styles.viewButton}
                    >
                      Ver Detalles
                    </Link>
                  </div>
                </div>

                {/* Students List */}
                <div className={styles.studentsList}>
                  <h4>Estudiantes Inscritos ({training.students.length})</h4>
                  
                  {training.students.length === 0 ? (
                    <div className={styles.noStudents}>
                      <AlertCircle size={24} />
                      <p>No hay estudiantes inscritos en este entrenamiento</p>
                    </div>
                  ) : (
                    <div className={styles.studentsGrid}>
                      {training.students.map((student, index) => (
                        <div key={student.userId} className={styles.studentCard}>
                          <div className={styles.studentHeader}>
                            <div className={styles.studentInfo}>
                              <h5>{student.name}</h5>
                              <p className={styles.studentEmail}>{student.email}</p>
                            </div>
                            <div className={styles.studentStatus}>
                              <CheckCircle size={20} />
                              <span>Pagado</span>
                            </div>
                          </div>
                          
                          <div className={styles.studentDetails}>
                            {student.phone && (
                              <div className={styles.studentDetail}>
                                <Phone size={16} />
                                <span>{student.phone}</span>
                              </div>
                            )}
                            
                            <div className={styles.studentDetail}>
                              <Clock size={16} />
                              <span>
                                Inscrito: {new Date(student.enrolledAt).toLocaleDateString('es-AR')}
                              </span>
                            </div>
                            
                            <div className={styles.studentDetail}>
                              <span className={styles.paymentId}>
                                ID Pago: {student.paymentId}
                              </span>
                            </div>
                            
                            <div className={styles.studentDetail}>
                              <span className={styles.experienceLevel}>
                                Nivel: {student.experienceLevel}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
}
