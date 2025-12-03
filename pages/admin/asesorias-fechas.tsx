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
  RefreshCw
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminHorarios.module.css';

interface AdvisoryDate {
  _id: string;
  advisoryType: 'ConsultorioFinanciero';
  date: string;
  time: string;
  title: string;
  description?: string;
  isActive: boolean;
  isBooked: boolean;
  createdBy: string;
  createdAt: string;
}

interface NewAdvisoryDateForm {
  advisoryType: 'ConsultorioFinanciero';
  date: string;
  time: string;
  title: string;
  description: string;
}

const ADVISORY_TYPES = {
  ConsultorioFinanciero: 'Consultorio Financiero'
};

export default function AsesoriasFechasPage() {
  const [advisoryDates, setAdvisoryDates] = useState<AdvisoryDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDate, setEditingDate] = useState<AdvisoryDate | null>(null);
  const [formData, setFormData] = useState<NewAdvisoryDateForm>({
    advisoryType: 'ConsultorioFinanciero',
    date: '',
    time: '10:00',
    title: '',
    description: ''
  });

  const fetchAdvisoryDates = async () => {
    try {
      setLoading(true);
      // console.log('📅 Cargando fechas de asesorías...');
      
      const response = await fetch('/api/advisory-dates/ConsultorioFinanciero');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.dates) {
          // Ordenar por fecha
          const sortedDates = data.dates.sort((a: AdvisoryDate, b: AdvisoryDate) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          setAdvisoryDates(sortedDates);
          // console.log('✅ Fechas cargadas:', sortedDates.length);
        } else {
          setAdvisoryDates([]);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ Error en respuesta:', errorData);
        toast.error('Error al cargar fechas de asesorías');
        setAdvisoryDates([]);
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
      setAdvisoryDates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvisoryDates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time || !formData.title.trim()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    try {
      // console.log('📝 Guardando fecha de asesoría...');
      
      const url = `/api/advisory-dates/${formData.advisoryType}`;
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
        await fetchAdvisoryDates();
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

  const handleDelete = async (dateId: string, advisoryType: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta fecha?')) {
      return;
    }

    try {
      // console.log('🗑️ Eliminando fecha:', dateId);
      
      const response = await fetch(`/api/advisory-dates/${advisoryType}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: dateId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Fecha eliminada exitosamente');
        await fetchAdvisoryDates();
      } else {
        console.error('❌ Error al eliminar:', data);
        toast.error(data.error || 'Error al eliminar la fecha');
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    }
  };

  const handleEdit = (advisoryDate: AdvisoryDate) => {
    setEditingDate(advisoryDate);
    
    // Manejar la fecha correctamente para evitar problemas de zona horaria
    const date = new Date(advisoryDate.date);
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    
    setFormData({
      advisoryType: advisoryDate.advisoryType,
      date: localDate.toISOString().split('T')[0],
      time: advisoryDate.time,
      title: advisoryDate.title,
      description: advisoryDate.description || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingDate(null);
    setFormData({
      advisoryType: 'ConsultorioFinanciero',
      date: '',
      time: '10:00',
      title: '',
      description: ''
    });
    setShowForm(false);
  };

  const handleCleanExpiredReservations = async () => {
    try {
      // console.log('🧹 Limpiando reservas temporales expiradas...');
      
      const response = await fetch('/api/admin/clean-expired-reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Limpieza completada: ${data.cleanedCount} reservas liberadas`);
        await fetchAdvisoryDates(); // Recargar la lista
      } else {
        console.error('❌ Error en limpieza:', data);
        toast.error(data.error || 'Error al limpiar reservas');
      }
    } catch (error) {
      console.error('💥 Error:', error);
      toast.error('Error de conexión');
    }
  };

  const formatDate = (dateString: string) => {
    // La fecha viene de la BD en UTC, necesitamos mostrarla correctamente
    const date = new Date(dateString);
    
    // Usar toLocaleDateString con timeZone: 'UTC' para evitar conversión de zona horaria
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const formatTime = (timeString: string) => {
    return `${timeString}hs`;
  };

  return (
    <>
      <Head>
        <title>Gestión de Fechas de Asesorías - Admin</title>
        <meta name="description" content="Administrar fechas específicas de asesorías" />
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
                Gestión de Fechas de Asesorías
              </h1>
              <p className={styles.subtitle}>
                Administra fechas específicas para consultoría financiera
              </p>
            </div>
            <div className={styles.buttonGroup}>
              <motion.button
                className={styles.addButton}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowForm(true)}
              >
                <Plus size={20} />
                Nueva Fecha
              </motion.button>
              <motion.button
                className={styles.cleanButton}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCleanExpiredReservations}
              >
                <RefreshCw size={20} />
                Limpiar Reservas
              </motion.button>
            </div>
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
              {editingDate ? 'Editar Fecha' : 'Nueva Fecha de Asesoría'}
            </h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Tipo de Asesoría</label>
                  <select
                    value={formData.advisoryType}
                    onChange={(e) => {
                      const newType = e.target.value as 'ConsultorioFinanciero';
                      setFormData({
                        ...formData,
                        advisoryType: newType,
                        title: `Consultorio de ${ADVISORY_TYPES[newType]}`
                      });
                    }}
                    required
                  >
                    <option value="ConsultorioFinanciero">Consultorio Financiero</option>
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
                  <label>Título de la Asesoría</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Ej: Consultorio General - Análisis de Portfolio"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Descripción (Opcional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Descripción detallada de la asesoría..."
                    rows={3}
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
              {advisoryDates.length === 0 ? (
                <div className={styles.emptyState}>
                  <Calendar size={48} />
                  <h3>No hay fechas configuradas</h3>
                  <p>Agrega la primera fecha de asesoría</p>
                </div>
              ) : (
                advisoryDates.map((advisoryDate) => (
                  <motion.div
                    key={advisoryDate._id}
                    className={styles.scheduleCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -5 }}
                  >
                    <div className={styles.scheduleHeader}>
                      <div className={styles.scheduleType}>
                        <BookOpen size={16} />
                        {ADVISORY_TYPES[advisoryDate.advisoryType]}
                      </div>
                      <div className={`${styles.scheduleStatus} ${
                        advisoryDate.isBooked ? styles.booked : 
                        advisoryDate.isActive ? styles.active : styles.inactive
                      }`}>
                        {advisoryDate.isBooked ? (
                          <>
                            <CheckCircle size={16} />
                            Reservado
                          </>
                        ) : advisoryDate.isActive ? (
                          <>
                            <CheckCircle size={16} />
                            Disponible
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
                        {formatDate(advisoryDate.date)}
                      </div>
                      <div className={styles.scheduleDetail}>
                        <Clock size={16} />
                        {formatTime(advisoryDate.time)}
                      </div>
                      <div className={styles.scheduleDetail}>
                        <AlertCircle size={16} />
                        {advisoryDate.title}
                      </div>
                      {advisoryDate.description && (
                        <div className={styles.scheduleDetail}>
                          <span>{advisoryDate.description}</span>
                        </div>
                      )}
                    </div>

                    <div className={styles.scheduleActions}>
                      <button
                        className={styles.editButton}
                        onClick={() => handleEdit(advisoryDate)}
                        disabled={advisoryDate.isBooked}
                      >
                        <Edit3 size={16} />
                        Editar
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDelete(advisoryDate._id, advisoryDate.advisoryType)}
                        disabled={advisoryDate.isBooked}
                        title={advisoryDate.isBooked ? 'No se puede eliminar una fecha reservada' : 'Eliminar fecha'}
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
