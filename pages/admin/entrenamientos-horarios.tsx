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
  DollarSign,
  BookOpen,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminHorarios.module.css';

interface TrainingSchedule {
  _id: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  duration: number;
  type: 'SwingTrading' | 'DowJones';
  price: number;
  cuposDisponibles: number;
  activo: boolean;
  trainingId: string;
  trainingName: string;
}

interface NewScheduleForm {
  dayOfWeek: number;
  hour: number;
  minute: number;
  duration: number;
  type: 'SwingTrading' | 'DowJones';
  price: number;
  maxBookingsPerDay: number;
}

const DAYS_OF_WEEK = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
];

const TRAINING_TYPES = {
  SwingTrading: 'Zero 2 Trader',
  DowJones: 'Dow Jones Advanced'
};

export default function EntrenamientosHorariosPage() {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TrainingSchedule | null>(null);
  const [formData, setFormData] = useState<NewScheduleForm>({
    dayOfWeek: 1,
    hour: 9,
    minute: 0,
    duration: 90,
    type: 'SwingTrading',
    price: 497,
    maxBookingsPerDay: 2
  });

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      console.log('📅 Cargando horarios de entrenamientos...');
      
      const response = await fetch('/api/entrenamientos/schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
        console.log('✅ Horarios cargados:', data.schedules?.length || 0);
      } else {
        console.error('❌ Error al cargar horarios:', response.status);
        toast.error('Error al cargar horarios');
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingSchedule 
        ? `/api/entrenamientos/schedule/${editingSchedule._id}`
        : '/api/entrenamientos/schedule';
      
      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(
          editingSchedule 
            ? 'Horario actualizado exitosamente' 
            : 'Horario creado exitosamente'
        );
        setShowForm(false);
        setEditingSchedule(null);
        resetForm();
        fetchSchedules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al guardar horario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: TrainingSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      dayOfWeek: schedule.dayOfWeek,
      hour: schedule.hour,
      minute: schedule.minute,
      duration: schedule.duration,
      type: schedule.type,
      price: schedule.price,
      maxBookingsPerDay: schedule.cuposDisponibles
    });
    setShowForm(true);
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este horario?')) {
      return;
    }

    try {
      const response = await fetch(`/api/entrenamientos/schedule/${scheduleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Horario eliminado exitosamente');
        fetchSchedules();
      } else {
        toast.error('Error al eliminar horario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const resetForm = () => {
    setFormData({
      dayOfWeek: 1,
      hour: 9,
      minute: 0,
      duration: 90,
      type: 'SwingTrading',
      price: 497,
      maxBookingsPerDay: 2
    });
  };

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Head>
        <title>Horarios de Entrenamientos - Admin</title>
        <meta name="description" content="Gestión de horarios de entrenamientos" />
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
              <h1 className={styles.title}>Horarios de Entrenamientos</h1>
              <p className={styles.subtitle}>
                Gestiona los horarios disponibles para entrenamientos personalizados
              </p>
              <Link href="/admin/dashboard" className={styles.backLink}>
                ← Volver al Dashboard
              </Link>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button 
                onClick={() => {
                  setEditingSchedule(null);
                  resetForm();
                  setShowForm(true);
                }}
                className={styles.addButton}
              >
                <Plus size={20} />
                Nuevo Horario
              </button>
            </div>

            {/* Horarios Grid */}
            <div className={styles.schedulesContainer}>
              {loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Cargando horarios...</p>
                </div>
              ) : schedules.length === 0 ? (
                <div className={styles.empty}>
                  <Calendar size={48} />
                  <h3>No hay horarios configurados</h3>
                  <p>Crea el primer horario para entrenamientos</p>
                </div>
              ) : (
                <div className={styles.schedulesGrid}>
                  {schedules.map((schedule, index) => (
                    <motion.div
                      key={schedule._id}
                      className={styles.scheduleCard}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className={styles.cardHeader}>
                        <div className={styles.typeInfo}>
                          <BookOpen size={20} />
                          <span>{TRAINING_TYPES[schedule.type]}</span>
                        </div>
                        <div 
                          className={styles.statusBadge}
                          style={{ 
                            background: schedule.activo ? '#059669' : '#64748b',
                            color: 'white'
                          }}
                        >
                          {schedule.activo ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          {schedule.activo ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>

                      <div className={styles.scheduleDetails}>
                        <div className={styles.timeInfo}>
                          <Calendar size={16} />
                          <span>{DAYS_OF_WEEK[schedule.dayOfWeek]}</span>
                          <Clock size={16} />
                          <span>{formatTime(schedule.hour, schedule.minute)}</span>
                        </div>

                        <div className={styles.additionalInfo}>
                          <div className={styles.infoItem}>
                            <Clock size={16} />
                            <span>{schedule.duration} minutos</span>
                          </div>
                          <div className={styles.infoItem}>
                            <DollarSign size={16} />
                            <span>${schedule.price} ARS</span>
                          </div>
                          <div className={styles.infoItem}>
                            <Users size={16} />
                            <span>{schedule.cuposDisponibles} cupos</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.cardActions}>
                        <button
                          onClick={() => handleEdit(schedule)}
                          className={styles.editButton}
                        >
                          <Edit3 size={16} />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(schedule._id)}
                          className={styles.deleteButton}
                        >
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Modal de Formulario */}
        {showForm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContainer}>
              <div className={styles.modalHeader}>
                <h3>
                  {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
                </h3>
                <button 
                  onClick={() => {
                    setShowForm(false);
                    setEditingSchedule(null);
                  }}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label>Tipo de Entrenamiento</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({
                      ...formData,
                              type: e.target.value as 'SwingTrading' | 'DowJones',
        price: e.target.value === 'SwingTrading' ? 497 : 997
                    })}
                    required
                  >
                    <option value="SwingTrading">Zero 2 Trader</option>
                    <option value="DowJones">Dow Jones Advanced</option>
                  </select>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Día de la Semana</label>
                    <select
                      value={formData.dayOfWeek}
                      onChange={(e) => setFormData({...formData, dayOfWeek: parseInt(e.target.value)})}
                      required
                    >
                      {DAYS_OF_WEEK.map((day, index) => (
                        <option key={index} value={index}>{day}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Hora</label>
                    <input
                      type="number"
                      min="6"
                      max="22"
                      value={formData.hour}
                      onChange={(e) => setFormData({...formData, hour: parseInt(e.target.value)})}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Minutos</label>
                    <select
                      value={formData.minute}
                      onChange={(e) => setFormData({...formData, minute: parseInt(e.target.value)})}
                    >
                      <option value={0}>00</option>
                      <option value={30}>30</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Duración (minutos)</label>
                    <select
                      value={formData.duration}
                      onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                      required
                    >
                      <option value={60}>60 minutos</option>
                      <option value={90}>90 minutos</option>
                      <option value={120}>120 minutos</option>
                      <option value={180}>180 minutos</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Precio (ARS)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Cupos Disponibles</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={formData.maxBookingsPerDay}
                      onChange={(e) => setFormData({...formData, maxBookingsPerDay: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formActions}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowForm(false);
                      setEditingSchedule(null);
                    }}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className={styles.submitButton}
                  >
                    {loading ? 'Guardando...' : (editingSchedule ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  console.log('🔍 [ENTRENAMIENTOS-HORARIOS] Verificando acceso de admin...');
  
  try {
    const verification = await verifyAdminAccess(context);
    
    if (!verification.isAdmin) {
      console.log('❌ [ENTRENAMIENTOS-HORARIOS] Acceso denegado');
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    console.log('✅ [ENTRENAMIENTOS-HORARIOS] Acceso confirmado');
    
    return {
      props: {
        user: verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [ENTRENAMIENTOS-HORARIOS] Error:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
}; 