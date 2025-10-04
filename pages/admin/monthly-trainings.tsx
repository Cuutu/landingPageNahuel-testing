import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Calendar, 
  Users, 
  DollarSign, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import AdminRouteGuard from '../../components/AdminRouteGuard';
import styles from '../../styles/admin/MonthlyTrainings.module.css';

interface TrainingClass {
  _id?: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
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
  students: any[];
  status: 'draft' | 'open' | 'full' | 'in-progress' | 'completed' | 'cancelled';
  registrationOpenDate: string;
  registrationCloseDate: string;
  availableSpots: number;
  totalClasses: number;
  completedClasses: number;
  createdAt: string;
  createdBy: string;
}

export default function MonthlyTrainingsAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [trainings, setTrainings] = useState<MonthlyTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTraining, setEditingTraining] = useState<MonthlyTraining | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Estados para el formulario
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    maxStudents: 10,
    price: 0,
    registrationOpenDate: '',
    registrationCloseDate: '',
    classes: [] as TrainingClass[]
  });

  useEffect(() => {
    if (status === 'authenticated') {
      loadTrainings();
    }
  }, [status, selectedYear]);

  const loadTrainings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/monthly-trainings?year=${selectedYear}`);
      const data = await response.json();
      
      if (data.success) {
        setTrainings(data.data);
      } else {
        console.error('Error cargando entrenamientos:', data.error);
      }
    } catch (error) {
      console.error('Error cargando entrenamientos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTraining = () => {
    setFormData({
      title: '',
      description: '',
      month: new Date().getMonth() + 1,
      year: selectedYear,
      maxStudents: 10,
      price: 0,
      registrationOpenDate: '',
      registrationCloseDate: '',
      classes: []
    });
    setEditingTraining(null);
    setShowCreateModal(true);
  };

  const handleEditTraining = (training: MonthlyTraining) => {
    setFormData({
      title: training.title,
      description: training.description,
      month: training.month,
      year: training.year,
      maxStudents: training.maxStudents,
      price: training.price,
      registrationOpenDate: training.registrationOpenDate.split('T')[0],
      registrationCloseDate: training.registrationCloseDate.split('T')[0],
      classes: training.classes
    });
    setEditingTraining(training);
    setShowCreateModal(true);
  };

  const handleDeleteTraining = async (trainingId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este entrenamiento?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/monthly-trainings?id=${trainingId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Entrenamiento eliminado exitosamente');
        loadTrainings();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error eliminando entrenamiento:', error);
      alert('Error eliminando entrenamiento');
    }
  };

  const handleSubmitTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.classes.length === 0) {
      alert('Debes agregar al menos una clase');
      return;
    }

    try {
      const url = editingTraining 
        ? `/api/admin/monthly-trainings?id=${editingTraining._id}`
        : '/api/admin/monthly-trainings';
      
      const method = editingTraining ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(editingTraining ? 'Entrenamiento actualizado exitosamente' : 'Entrenamiento creado exitosamente');
        setShowCreateModal(false);
        loadTrainings();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error guardando entrenamiento:', error);
      alert('Error guardando entrenamiento');
    }
  };

  const addNewClass = () => {
    const newClass: TrainingClass = {
      date: '',
      startTime: '19:00',
      endTime: '21:00',
      title: `Clase ${formData.classes.length + 1}`,
      description: '',
      status: 'scheduled'
    };
    
    setFormData({
      ...formData,
      classes: [...formData.classes, newClass]
    });
  };

  const updateClass = (index: number, field: string, value: string) => {
    const updatedClasses = [...formData.classes];
    (updatedClasses[index] as any)[field] = value;
    setFormData({ ...formData, classes: updatedClasses });
  };

  const removeClass = (index: number) => {
    const updatedClasses = formData.classes.filter((_, i) => i !== index);
    setFormData({ ...formData, classes: updatedClasses });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { icon: Edit, color: '#6b7280', text: 'Borrador' },
      open: { icon: CheckCircle, color: '#10b981', text: 'Abierto' },
      full: { icon: Users, color: '#f59e0b', text: 'Lleno' },
      'in-progress': { icon: Clock, color: '#3b82f6', text: 'En Progreso' },
      completed: { icon: CheckCircle, color: '#059669', text: 'Completado' },
      cancelled: { icon: XCircle, color: '#ef4444', text: 'Cancelado' }
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <span 
        className={styles.statusBadge}
        style={{ backgroundColor: config.color }}
      >
        <Icon size={14} />
        {config.text}
      </span>
    );
  };

  const getMonthName = (month: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1];
  };

  if (status === 'loading') {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <AdminRouteGuard>
      <div className={styles.container}>
        <Head>
          <title>Entrenamientos Mensuales - Admin</title>
        </Head>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>Entrenamientos Mensuales de Swing Trading</h1>
            <p>Gestiona entrenamientos por mes con múltiples clases</p>
          </div>
          
          <div className={styles.headerRight}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={styles.yearSelector}
            >
              {Array.from({ length: 3 }, (_, i) => {
                const year = new Date().getFullYear() + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            
            <button 
              onClick={handleCreateTraining}
              className={styles.createButton}
            >
              <Plus size={20} />
              Crear Entrenamiento
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingGrid}>
            <div className={styles.loadingCard}>Cargando entrenamientos...</div>
          </div>
        ) : (
          <div className={styles.trainingsGrid}>
            {trainings.length === 0 ? (
              <div className={styles.emptyState}>
                <Calendar size={48} />
                <h3>No hay entrenamientos para {selectedYear}</h3>
                <p>Crea tu primer entrenamiento mensual</p>
                <button onClick={handleCreateTraining} className={styles.createButton}>
                  <Plus size={20} />
                  Crear Entrenamiento
                </button>
              </div>
            ) : (
              trainings.map((training) => (
                <div key={training._id} className={styles.trainingCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      <h3>{training.title}</h3>
                      {getStatusBadge(training.status)}
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        onClick={() => handleEditTraining(training)}
                        className={styles.actionButton}
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTraining(training._id)}
                        className={`${styles.actionButton} ${styles.deleteButton}`}
                        title="Eliminar"
                        disabled={training.students.length > 0}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardContent}>
                    <div className={styles.trainingInfo}>
                      <div className={styles.infoItem}>
                        <Calendar size={16} />
                        <span>{training.monthName} {training.year}</span>
                      </div>
                      
                      <div className={styles.infoItem}>
                        <Users size={16} />
                        <span>{training.students.length}/{training.maxStudents} estudiantes</span>
                      </div>
                      
                      <div className={styles.infoItem}>
                        <DollarSign size={16} />
                        <span>${training.price}</span>
                      </div>
                      
                      <div className={styles.infoItem}>
                        <Clock size={16} />
                        <span>{training.completedClasses}/{training.totalClasses} clases</span>
                      </div>
                    </div>

                    <p className={styles.description}>{training.description}</p>

                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill}
                        style={{ 
                          width: `${training.totalClasses > 0 ? (training.completedClasses / training.totalClasses) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.createdDate}>
                      Creado: {new Date(training.createdAt).toLocaleDateString('es-AR')}
                    </span>
                    <Link 
                      href={`/admin/monthly-trainings/${training._id}`}
                      className={styles.viewButton}
                    >
                      <Eye size={16} />
                      Ver Detalles
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal de Crear/Editar */}
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>
                  {editingTraining ? 'Editar Entrenamiento' : 'Crear Nuevo Entrenamiento'}
                </h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmitTraining} className={styles.form}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Título *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ej: Swing Trading - Noviembre 2024"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Mes *</label>
                    <select
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                      required
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {getMonthName(i + 1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Año *</label>
                    <select
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                    >
                      {Array.from({ length: 3 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Precio (USD) *</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Máximo Estudiantes *</label>
                    <input
                      type="number"
                      value={formData.maxStudents}
                      onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) })}
                      min="1"
                      max="20"
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Descripción *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe el contenido del entrenamiento mensual..."
                    rows={3}
                    required
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Fecha Apertura Inscripción *</label>
                    <input
                      type="date"
                      value={formData.registrationOpenDate}
                      onChange={(e) => setFormData({ ...formData, registrationOpenDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Fecha Cierre Inscripción *</label>
                    <input
                      type="date"
                      value={formData.registrationCloseDate}
                      onChange={(e) => setFormData({ ...formData, registrationCloseDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Sección de Clases */}
                <div className={styles.classesSection}>
                  <div className={styles.classesSectionHeader}>
                    <h3>Clases del Mes ({formData.classes.length})</h3>
                    <button
                      type="button"
                      onClick={addNewClass}
                      className={styles.addClassButton}
                    >
                      <Plus size={16} />
                      Agregar Clase
                    </button>
                  </div>

                  {formData.classes.map((classItem, index) => (
                    <div key={index} className={styles.classItem}>
                      <div className={styles.classHeader}>
                        <h4>Clase {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => removeClass(index)}
                          className={styles.removeClassButton}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className={styles.classGrid}>
                        <div className={styles.formGroup}>
                          <label>Título *</label>
                          <input
                            type="text"
                            value={classItem.title}
                            onChange={(e) => updateClass(index, 'title', e.target.value)}
                            required
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Fecha *</label>
                          <input
                            type="date"
                            value={classItem.date}
                            onChange={(e) => updateClass(index, 'date', e.target.value)}
                            required
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Hora Inicio *</label>
                          <input
                            type="time"
                            value={classItem.startTime}
                            onChange={(e) => updateClass(index, 'startTime', e.target.value)}
                            required
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Hora Fin *</label>
                          <input
                            type="time"
                            value={classItem.endTime}
                            onChange={(e) => updateClass(index, 'endTime', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Descripción</label>
                        <textarea
                          value={classItem.description || ''}
                          onChange={(e) => updateClass(index, 'description', e.target.value)}
                          placeholder="Descripción opcional de la clase..."
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}

                  {formData.classes.length === 0 && (
                    <div className={styles.emptyClasses}>
                      <AlertCircle size={24} />
                      <p>No hay clases definidas. Agrega al menos una clase.</p>
                    </div>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={formData.classes.length === 0}
                  >
                    {editingTraining ? 'Actualizar' : 'Crear'} Entrenamiento
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
