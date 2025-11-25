import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Calendar, 
  Clock, 
  Edit3, 
  Trash2, 
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminHorarios.module.css';

interface TrainingDate {
  _id: string;
  trainingType: 'SwingTrading' | 'DowJones';
  date: string;
  time: string;
  title: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  meetLink?: string; // Added meetLink to the interface
}

interface NewTrainingDateForm {
  trainingType: 'SwingTrading' | 'DowJones';
  date: string;
  time: string;
  title: string;
}

const TRAINING_TYPES = {
  SwingTrading: 'Zero 2 Trader',
  DowJones: 'Dow Jones Advanced'
};

export default function EntrenamientosFechasPage() {
  const [trainingDates, setTrainingDates] = useState<TrainingDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState<TrainingDate | null>(null);
  const [formData, setFormData] = useState<NewTrainingDateForm>({
    trainingType: 'SwingTrading',
    date: '',
    time: '10:00',
    title: ''
  });

  const fetchTrainingDates = async () => {
    try {
      setLoading(true);
      console.log('📅 Cargando fechas de entrenamientos...');
      
      // Cargar fechas para ambos tipos de entrenamiento
      const [swingResponse, dowResponse] = await Promise.all([
        fetch('/api/training-dates/SwingTrading'),
        fetch('/api/training-dates/DowJones')
      ]);
      
      const allDates: TrainingDate[] = [];
      
      if (swingResponse.ok) {
        const swingData = await swingResponse.json();
        if (swingData.success && swingData.dates) {
          allDates.push(...swingData.dates);
        }
      }
      
      if (dowResponse.ok) {
        const dowData = await dowResponse.json();
        if (dowData.success && dowData.dates) {
          allDates.push(...dowData.dates);
        }
      }
      
      // Ordenar por fecha
      allDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTrainingDates(allDates);
      console.log('✅ Fechas cargadas:', allDates.length);
      
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainingDates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time || !formData.title.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      console.log('📝 Guardando fecha de entrenamiento...');
      
      const url = editingDate 
        ? `/api/training-dates/${formData.trainingType}`
        : `/api/training-dates/${formData.trainingType}`;
      
      const method = editingDate ? 'PUT' : 'POST';
      const body = editingDate 
        ? { ...formData, id: editingDate._id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(editingDate ? 'Fecha actualizada exitosamente' : 'Fecha creada exitosamente');
        await fetchTrainingDates();
        resetForm();
      } else {
        console.error('❌ Error del servidor:', data);
        toast.error(data.error || 'Error al guardar la fecha');
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    }
  };

  const handleDelete = async (dateId: string, trainingType: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta fecha?')) {
      return;
    }

    try {
      console.log('🗑️ Eliminando fecha:', dateId);
      
      const response = await fetch(`/api/training-dates/${trainingType}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: dateId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Fecha eliminada exitosamente');
        await fetchTrainingDates();
      } else {
        console.error('❌ Error al eliminar:', data);
        toast.error(data.error || 'Error al eliminar la fecha');
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    }
  };

  const handleEdit = (trainingDate: TrainingDate) => {
    setEditingDate(trainingDate);
    setFormData({
      trainingType: trainingDate.trainingType,
      date: new Date(trainingDate.date).toISOString().split('T')[0],
      time: trainingDate.time,
      title: trainingDate.title
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingDate(null);
    setFormData({
      trainingType: 'SwingTrading',
      date: '',
      time: '10:00',
      title: ''
    });
    setShowForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return `${timeString}hs`;
  };

  return (
    <>
      <Head>
        <title>Gestión de Fechas de Entrenamientos - Admin</title>
        <meta name="description" content="Administrar fechas específicas de entrenamientos" />
      </Head>

      <Navbar />

      <main className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
                      <Link href="/admin/dashboard" className={styles.backButton}>
          <ArrowLeft size={20} />
          Volver al Dashboard
        </Link>
              <h1 className={styles.title}>
                <Calendar className={styles.titleIcon} />
                Gestión de Fechas de Entrenamientos
              </h1>
              <p className={styles.subtitle}>
                Administra fechas específicas para cada entrenamiento
              </p>
            </div>
            <motion.button
              className={styles.addButton}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(true)}
            >
              <Plus size={20} />
              Nueva Fecha
            </motion.button>
          </div>
        </div>

        {showForm && (
          <motion.div
            className={styles.formContainer}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className={styles.formTitle}>
              {editingDate ? 'Editar Fecha' : 'Nueva Fecha de Entrenamiento'}
            </h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Tipo de Entrenamiento</label>
                  <select
                    value={formData.trainingType}
                    onChange={(e) => {
                      const newType = e.target.value as 'SwingTrading' | 'DowJones';
                      setFormData({
                        ...formData,
                        trainingType: newType,
                        title: `Clase de ${TRAINING_TYPES[newType]}`
                      });
                    }}
                    required
                  >
                    <option value="SwingTrading">Swing Trading</option>
                    <option value="DowJones">Dow Jones Advanced</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Hora</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Título de la Clase</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej: Clase de Zero 2 Trader - Módulo 1"
                    required
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={resetForm}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                >
                  {editingDate ? 'Actualizar' : 'Crear'} Fecha
                </button>
              </div>
            </form>
          </motion.div>
        )}

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>Cargando fechas...</p>
            </div>
          ) : (
            <div className={styles.schedulesGrid}>
              {trainingDates.length === 0 ? (
                <div className={styles.emptyState}>
                  <Calendar size={48} />
                  <h3>No hay fechas configuradas</h3>
                  <p>Agrega la primera fecha de entrenamiento</p>
                </div>
              ) : (
                trainingDates.map((trainingDate) => (
                  <motion.div
                    key={trainingDate._id}
                    className={styles.scheduleCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -5 }}
                  >
                    <div className={styles.scheduleHeader}>
                      <div className={styles.scheduleType}>
                        <BookOpen size={16} />
                        {TRAINING_TYPES[trainingDate.trainingType]}
                      </div>
                      <div className={`${styles.scheduleStatus} ${
                        trainingDate.isActive ? styles.active : styles.inactive
                      }`}>
                        {trainingDate.isActive ? (
                          <>
                            <CheckCircle size={16} />
                            Activo
                          </>
                        ) : (
                          <>
                            <XCircle size={16} />
                            Inactivo
                          </>
                        )}
                      </div>
                    </div>

                    <div className={styles.scheduleInfo}>
                      <div className={styles.scheduleDetail}>
                        <Calendar size={16} />
                        {formatDate(trainingDate.date)}
                      </div>
                      <div className={styles.scheduleDetail}>
                        <Clock size={16} />
                        {formatTime(trainingDate.time)}
                      </div>
                      <div className={styles.scheduleDetail}>
                        <AlertCircle size={16} />
                        {trainingDate.title}
                      </div>
                      {trainingDate.meetLink && (
                        <div className={styles.scheduleDetail}>
                          <ExternalLink size={16} />
                          <a href={trainingDate.meetLink} target="_blank" rel="noopener noreferrer">Abrir Meet</a>
                          <button
                            className={styles.copyButton}
                            onClick={() => {
                              navigator.clipboard.writeText(trainingDate.meetLink as string);
                              toast.success('Link de Meet copiado');
                            }}
                            style={{ marginLeft: 8 }}
                          >
                            Copiar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={styles.scheduleActions}>
                      <button
                        className={styles.editButton}
                        onClick={() => handleEdit(trainingDate)}
                      >
                        <Edit3 size={16} />
                        Editar
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDelete(trainingDate._id, trainingDate.trainingType)}
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminCheck = await verifyAdminAccess(context);
  
  if (!adminCheck.isAdmin) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};
