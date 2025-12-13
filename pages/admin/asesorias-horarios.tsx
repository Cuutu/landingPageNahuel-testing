import React, { useState, useEffect } from 'react';
import { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Calendar,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DateRangePicker from '@/components/DateRangePicker';
import TimeSlotManager from '@/components/TimeSlotManager';
import styles from '@/styles/AdminHorarios.module.css';

interface AdvisorySchedule {
  _id: string;
  date: string;
  time: string;
  isAvailable: boolean;
  isBooked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TimeSlot {
  id: string;
  time: string;
}

const AdminAsesoriasHorariosPage = () => {
  // Estados del componente
  const [schedules, setSchedules] = useState<AdvisorySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFixingIndexes, setIsFixingIndexes] = useState(false);
  
  // Estado para modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  
  // Estados para modales de confirmación de limpiar índices y sincronizar
  const [showFixIndexesModal, setShowFixIndexesModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Logs para debug
  useEffect(() => {
    // console.log('🔄 Estado actualizado:');
    // console.log('📅 startDate:', startDate);
    // console.log('📅 endDate:', endDate);
    // console.log('⏰ timeSlots:', timeSlots);
    // console.log('🚫 isCreating:', isCreating);
  }, [startDate, endDate, timeSlots, isCreating]);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      // console.log('🔄 [LOAD] Iniciando carga de horarios...');
      setLoading(true);
      
      const response = await fetch('/api/asesorias/schedule');
      // console.log('📡 [LOAD] Respuesta recibida:', response.status, response.statusText);
      
      const data = await response.json();
      // console.log('📋 [LOAD] Datos recibidos:', data);
      
      if (response.ok) {
        const schedulesList = data.schedules || [];
        // console.log('✅ [LOAD] Horarios cargados exitosamente:', schedulesList.length, 'horarios');
        setSchedules(schedulesList);
      } else {
        // console.error('❌ [LOAD] Error en respuesta:', data);
        toast.error('Error al cargar horarios de asesorías');
      }
    } catch (error) {
      // console.error('💥 [LOAD] Error de red:', error);
      toast.error('Error de conexión al cargar horarios');
    } finally {
      setLoading(false);
      // console.log('🔄 [LOAD] Carga completada');
    }
  };

  const handleCreateSchedules = async () => {
    // console.log('🔥 Botón clickeado - handleCreateSchedules');
    // console.log('📅 startDate:', startDate);
    // console.log('📅 endDate:', endDate);
    // console.log('⏰ timeSlots:', timeSlots);
    
    if (!startDate || !endDate || timeSlots.length === 0) {
      // console.log('❌ Validación fallida');
      toast.error('Por favor selecciona un rango de fechas y al menos un horario');
      return;
    }

    // console.log('✅ Validación pasada, comenzando creación...');
    setIsCreating(true);
    let createdCount = 0;
    let errorCount = 0;

    try {
      // Generar todas las fechas en el rango
      const dates = [];
      const currentDate = new Date(startDate);
      const lastDate = new Date(endDate);

      // console.log('📅 Generando fechas entre:', currentDate.toISOString(), 'y', lastDate.toISOString());

      while (currentDate <= lastDate) {
        // Incluir días de domingo a sábado (0-6) - todos los días de la semana
        const dayOfWeek = currentDate.getDay();
        // console.log(`📅 Procesando fecha: ${currentDate.toISOString().split('T')[0]}, día de la semana: ${dayOfWeek}`);
        
        // Incluir todos los días (0=domingo, 1=lunes, ..., 6=sábado)
        dates.push(new Date(currentDate));
        // console.log(`✅ Fecha agregada: ${currentDate.toISOString().split('T')[0]} (día ${dayOfWeek})`);
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // console.log('📅 Fechas laborables generadas:', dates.length, 'fechas');
      // console.log('📅 Fechas:', dates.map(d => d.toISOString().split('T')[0]));

      if (dates.length === 0) {
        // console.log('❌ No hay fechas laborables en el rango seleccionado');
        toast.error('No hay fechas laborables en el rango seleccionado');
        setIsCreating(false);
        return;
      }

      // Crear horarios para cada fecha y cada slot de tiempo
      // console.log('🚀 Comenzando creación de horarios...');
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        // console.log(`📅 Procesando fecha ${i + 1}/${dates.length}: ${date.toISOString().split('T')[0]}`);
        
        for (let j = 0; j < timeSlots.length; j++) {
          const timeSlot = timeSlots[j];
          // console.log(`⏰ Procesando horario ${j + 1}/${timeSlots.length}: ${timeSlot.time}`);
          
          try {
            const scheduleData = {
              // CORREGIDO: Usar fecha local en lugar de UTC para evitar el desfase de un día
              date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
              time: timeSlot.time,
              isAvailable: true,
              isBooked: false
            };

            // console.log('📝 Intentando crear horario:', scheduleData);
            // console.log('📅 Fecha original del calendario:', date.toLocaleDateString('es-ES'));
            // console.log('📅 Fecha enviada a la API:', scheduleData.date);

            const response = await fetch('/api/asesorias/schedule', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(scheduleData),
            });

            // console.log('📡 Respuesta de la API:', response.status, response.statusText);

            if (response.ok) {
              const responseData = await response.json();
              // console.log('✅ Horario creado exitosamente:', responseData);
              createdCount++;
            } else {
              const data = await response.json();
              // console.log('❌ Error en la respuesta:', data);
              if (response.status === 409) {
                // Horario ya existe, no es un error
                // console.log(`ℹ️ Horario ya existe para ${date.toDateString()} a las ${timeSlot.time}`);
              } else {
                errorCount++;
                console.error('❌ Error al crear horario:', data.error);
              }
            }
          } catch (error) {
            errorCount++;
            console.error('❌ Error de red al crear horario:', error);
          }
        }
      }

      // console.log('📊 Resumen final - Creados:', createdCount, 'Errores:', errorCount);

      if (createdCount > 0) {
        toast.success(`Se crearon ${createdCount} horarios exitosamente`);
        if (errorCount > 0) {
          toast.error(`${errorCount} horarios no se pudieron crear`);
        }
        await loadSchedules();
        resetForm();
      } else if (errorCount > 0) {
        toast.error('No se pudo crear ningún horario');
      } else {
        toast.success('Los horarios ya existían para las fechas seleccionadas');
      }

    } catch (error) {
      console.error('❌ Error general:', error);
      toast.error('Error al crear los horarios');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    // console.log('🗑️ [DELETE] Iniciando eliminación de horario:', id);
    
    // En lugar de usar confirm(), abrir modal personalizado
    setScheduleToDelete(id);
    setShowDeleteModal(true);
  };

  // Nueva función para confirmar la eliminación
  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    
    // console.log('✅ [DELETE] Usuario confirmó la eliminación de:', scheduleToDelete);

    try {
      // console.log('📡 [DELETE] Enviando request DELETE a:', `/api/asesorias/schedule/${scheduleToDelete}`);
      
      const response = await fetch(`/api/asesorias/schedule/${scheduleToDelete}`, {
        method: 'DELETE',
      });

      // console.log('📡 [DELETE] Respuesta recibida:', response.status, response.statusText);

      if (response.ok) {
        const responseData = await response.json();
        // console.log('✅ [DELETE] Horario eliminado exitosamente:', responseData);
        toast.success('Horario eliminado exitosamente');
        
        // console.log('🔄 [DELETE] Recargando lista de horarios...');
        await loadSchedules();
        // console.log('✅ [DELETE] Lista de horarios recargada');
      } else {
        const errorData = await response.json();
        console.error('❌ [DELETE] Error en respuesta:', errorData);
        toast.error(errorData.error || `Error al eliminar horario: ${response.status}`);
      }
    } catch (error) {
      console.error('💥 [DELETE] Error de red:', error);
      toast.error('Error de conexión al eliminar horario');
    } finally {
      // Cerrar modal
      setShowDeleteModal(false);
      setScheduleToDelete(null);
    }
  };

  // Función para cancelar la eliminación
  const cancelDelete = () => {
    // console.log('❌ [DELETE] Usuario canceló la eliminación');
    setShowDeleteModal(false);
    setScheduleToDelete(null);
  };

  const handleSyncSchedules = async () => {
    // En lugar de usar confirm(), abrir modal personalizado
    setShowSyncModal(true);
  };

  // Nueva función para confirmar la sincronización
  const confirmSync = async () => {
    try {
      setIsSyncing(true);
      // console.log('🔄 Iniciando sincronización...');

      const response = await fetch('/api/admin/sync-advisory-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        // console.log('✅ Sincronización exitosa:', data);
        toast.success(`Sincronización completada: ${data.stats.created} creados, ${data.stats.updated} actualizados`);
      } else {
        console.error('❌ Error en sincronización:', data);
        toast.error(data.error || 'Error en la sincronización');
      }
    } catch (error) {
      console.error('❌ Error de red en sincronización:', error);
      toast.error('Error de conexión durante la sincronización');
    } finally {
      setIsSyncing(false);
      // Cerrar modal
      setShowSyncModal(false);
    }
  };

  // Función para cancelar la sincronización
  const cancelSync = () => {
    // console.log('❌ [SYNC] Usuario canceló la sincronización');
    setShowSyncModal(false);
  };

  const handleFixIndexes = async () => {
    // En lugar de usar confirm(), abrir modal personalizado
    setShowFixIndexesModal(true);
  };

  // Nueva función para confirmar la limpieza de índices
  const confirmFixIndexes = async () => {
    try {
      setIsFixingIndexes(true);
      // console.log('🔧 Iniciando limpieza de índices...');

      const response = await fetch('/api/admin/fix-advisory-indexes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        // console.log('✅ Limpieza de índices exitosa:', data);
        toast.success(`Índices limpiados: ${data.details.droppedIndexes.length} eliminados, ${data.details.createdIndexes.length} creados`);
      } else {
        console.error('❌ Error en limpieza de índices:', data);
        toast.error(data.error || 'Error al limpiar índices');
      }
    } catch (error) {
      console.error('❌ Error de red en limpieza de índices:', error);
      toast.error('Error de conexión durante la limpieza');
    } finally {
      setIsFixingIndexes(false);
      // Cerrar modal
      setShowFixIndexesModal(false);
    }
  };

  // Función para cancelar la limpieza de índices
  const cancelFixIndexes = () => {
    // console.log('❌ [FIX INDEXES] Usuario canceló la limpieza de índices');
    setShowFixIndexesModal(false);
  };

  const resetForm = () => {
    setStartDate(null);
    setEndDate(null);
    setTimeSlots([]);
    setShowForm(false);
  };

  const formatDate = (dateString: string) => {
    // CORREGIDO: Usar la fecha local directamente sin conversión UTC
    // console.log('🔍 formatDate - dateString recibido:', dateString);
    
    // Parsear la fecha directamente
    const date = new Date(dateString);
    
    // console.log('🔍 formatDate - fecha parseada:', date);
    // console.log('🔍 formatDate - getDate():', date.getDate());
    // console.log('🔍 formatDate - getDay():', date.getDay());
    // console.log('🔍 formatDate - fecha local:', date.toLocaleDateString('es-ES'));
    
    // Usar la fecha local directamente para evitar problemas de zona horaria
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDuration = () => {
    return '1 hora';
  };

  return (
    <>
      <Head>
        <title>Gestión de Horarios de Asesorías - Panel Admin</title>
        <meta name="description" content="Panel de administración para gestionar horarios de asesorías" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={styles.header}
          >
            <div className={styles.headerContent}>
              <h1 className={styles.title}>
                <Calendar size={32} />
                Gestión de Horarios de Asesorías
              </h1>
              <p className={styles.subtitle}>
                Configura horarios disponibles para consultoría financiera
              </p>
            </div>
            <div className={styles.headerActions}>
              <button
                onClick={handleFixIndexes}
                disabled={isFixingIndexes}
                className={styles.fixButton}
                title="Limpiar índices problemáticos de MongoDB (soluciona errores de duplicados)"
              >
                <RefreshCw size={20} className={isFixingIndexes ? styles.spinning : ''} />
                {isFixingIndexes ? 'Limpiando...' : 'Limpiar Índices'}
              </button>
              <button
                onClick={handleSyncSchedules}
                disabled={isSyncing}
                className={styles.syncButton}
                title="Sincronizar horarios existentes con el sistema de visualización"
              >
                <RefreshCw size={20} className={isSyncing ? styles.spinning : ''} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button
                onClick={() => {
                  // console.log('🔥 Abriendo formulario');
                  setShowForm(true);
                }}
                className={styles.createButton}
              >
                <Plus size={20} />
                Crear Horarios
              </button>
            </div>
          </motion.div>

          {/* Formulario de Creación */}
          {showForm && (
            <div className={styles.formOverlay}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={styles.formContainer}
              >
                <div className={styles.formHeader}>
                  <h3>Crear Horarios de Asesoría</h3>
                  <button onClick={resetForm} className={styles.closeButton}>
                    <X size={20} />
                  </button>
                </div>

                <div className={styles.formContent}>
                  {/* Selección de Rango de Fechas */}
                  <div className={styles.section}>
                    <h4>1. Selecciona el Rango de Fechas</h4>
                    <p className={styles.sectionDescription}>
                      Se crearán horarios para todos los días del rango seleccionado
                    </p>
                    <DateRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      onStartDateChange={setStartDate}
                      onEndDateChange={setEndDate}
                      minDate={new Date()}
                      maxDate={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)}
                    />
                  </div>

                  {/* Gestión de Horarios */}
                  <div className={styles.section}>
                    <h4>2. Configura los Horarios</h4>
                    <p className={styles.sectionDescription}>
                      Agrega los horarios específicos que estarán disponibles cada día
                    </p>
                    <TimeSlotManager
                      timeSlots={timeSlots}
                      onTimeSlotsChange={setTimeSlots}
                    />
                  </div>

                  {/* Resumen */}
                  {startDate && endDate && timeSlots.length > 0 && (
                    <div className={styles.summary}>
                      <h4>Resumen de la Configuración</h4>
                      <div className={styles.summaryContent}>
                        <div className={styles.summaryItem}>
                          <span>Rango de fechas:</span>
                          <span>{startDate.toLocaleDateString('es-ES')} - {endDate.toLocaleDateString('es-ES')}</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span>Días laborables:</span>
                          <span>{timeSlots.length * Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) / 7 * 5)} horarios</span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span>Horarios por día:</span>
                          <span>{timeSlots.length} slots</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={resetForm} className={styles.cancelButton}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      // console.log('🔥 Botón clickeado directamente');
                      // console.log('📅 startDate:', startDate);
                      // console.log('📅 endDate:', endDate);
                      // console.log('⏰ timeSlots:', timeSlots);
                      // console.log('🚫 isCreating:', isCreating);
                      // console.log('🔒 Botón deshabilitado:', !startDate || !endDate || timeSlots.length === 0 || isCreating);
                      handleCreateSchedules();
                    }}
                    disabled={!startDate || !endDate || timeSlots.length === 0 || isCreating}
                    className={styles.saveButton}
                  >
                    <Save size={16} />
                    {isCreating ? 'Creando...' : 'Crear Horarios'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Lista de Horarios Existentes */}
          <div className={styles.schedulesContainer}>
            <div className={styles.schedulesHeader}>
              <h2>Horarios Existentes</h2>
              <button 
                onClick={loadSchedules}
                className={styles.refreshButton}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? styles.spinning : ''} />
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className={styles.loading}>Cargando horarios...</div>
            ) : schedules.length === 0 ? (
              <div className={styles.empty}>
                <AlertCircle size={48} />
                <h3>No hay horarios configurados</h3>
                <p>Usa el botón "Crear Horarios" para agregar el primer conjunto de horarios</p>
              </div>
            ) : (
              <div className={styles.schedulesGrid}>
                {schedules.map((schedule) => (
                  <motion.div
                    key={schedule._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${styles.scheduleCard} ${!schedule.isAvailable ? styles.unavailable : ''} ${schedule.isBooked ? styles.booked : ''}`}
                  >
                    <div className={styles.scheduleHeader}>
                      <div className={styles.scheduleDate}>
                        <Calendar size={20} />
                        {formatDate(schedule.date)}
                      </div>
                      <div className={styles.scheduleStatus}>
                        {schedule.isBooked ? (
                          <span className={styles.statusBooked}>
                            <CheckCircle size={16} />
                            Reservado
                          </span>
                        ) : schedule.isAvailable ? (
                          <span className={styles.statusAvailable}>
                            <Clock size={16} />
                            Disponible
                          </span>
                        ) : (
                          <span className={styles.statusUnavailable}>
                            <XCircle size={16} />
                            No disponible
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.scheduleDetails}>
                      <div className={styles.scheduleTime}>
                        <Clock size={16} />
                        {formatTime(schedule.time)}
                      </div>
                      <div className={styles.scheduleDuration}>
                        Duración: {formatDuration()}
                      </div>
                    </div>

                    <div className={styles.scheduleActions}>
                      <button
                        onClick={() => {
                          // console.log('🗑️ Botón eliminar clickeado para:', schedule._id);
                          handleDelete(schedule._id);
                        }}
                        className={styles.deleteButton}
                        disabled={schedule.isBooked}
                        title={schedule.isBooked ? 'No se puede eliminar un horario reservado' : 'Eliminar horario'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3>Confirmar Eliminación</h3>
            </div>
            <div className={styles.modalContent}>
              <p>¿Estás seguro de que quieres eliminar este horario?</p>
              <p className={styles.modalWarning}>Esta acción no se puede deshacer.</p>
            </div>
            <div className={styles.modalActions}>
              <button 
                onClick={cancelDelete}
                className={styles.modalCancelButton}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className={styles.modalConfirmButton}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Sincronización */}
      {showSyncModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3>Confirmar Sincronización</h3>
            </div>
            <div className={styles.modalContent}>
              <p>¿Estás seguro de que quieres sincronizar todos los horarios existentes con el sistema de visualización?</p>
              <p className={styles.modalWarning}>Esta acción no se puede deshacer.</p>
            </div>
            <div className={styles.modalActions}>
              <button 
                onClick={cancelSync}
                className={styles.modalCancelButton}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmSync}
                className={styles.modalConfirmButton}
              >
                Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Limpieza de Índices */}
      {showFixIndexesModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3>Confirmar Limpieza de Índices</h3>
            </div>
            <div className={styles.modalContent}>
              <p>¿Estás seguro de que quieres limpiar los índices problemáticos de MongoDB? Esto solucionará errores de duplicados.</p>
              <p className={styles.modalWarning}>Esta acción no se puede deshacer.</p>
            </div>
            <div className={styles.modalActions}>
              <button 
                onClick={cancelFixIndexes}
                className={styles.modalCancelButton}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmFixIndexes}
                className={styles.modalConfirmButton}
              >
                Limpiar Índices
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context: GetServerSidePropsContext) => {
  const adminCheck = await verifyAdminAccess(context);
  
  if (!adminCheck.isAdmin) {
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default AdminAsesoriasHorariosPage; 