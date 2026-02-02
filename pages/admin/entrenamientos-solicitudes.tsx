import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Mail, 
  Phone, 
  Clock, 
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Calendar,
  DollarSign,
  TrendingUp,
  BookOpen
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminSolicitudes.module.css';

interface TrainingSolicitud {
  _id: string;
  nombre: string;
  email: string;
  telefono?: string;
  experienciaTrading?: string;
  objetivos: string;
  nivelExperiencia?: string;
  consulta?: string;
  fecha: string;
  estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
  fechaEntrenamiento?: string;
  metodoPago?: string;
  montoAbonado?: number;
  trainingId?: string;
  trainingTipo?: string;
  trainingNombre?: string;
  trainingPrecio?: number;
}

interface Training {
  _id: string;
  tipo: string;
  nombre: string;
  precio: number;
  solicitudes: TrainingSolicitud[];
  metricas: {
    rentabilidad: number;
    estudiantesActivos: number;
    entrenamientosRealizados: number;
    satisfaccion: number;
  };
}

export default function EntrenamientosSolicitudesPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraining, setSelectedTraining] = useState<string>('');
  const [selectedSolicitud, setSelectedSolicitud] = useState<TrainingSolicitud | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchTrainings = async () => {
    try {
      setLoading(true);
      // console.log('📊 Cargando entrenamientos y solicitudes...');
      
      const response = await fetch('/api/admin/entrenamientos/solicitudes');
      if (response.ok) {
        const data = await response.json();
        // console.log('✅ Datos cargados:', data);
        setTrainings(data.trainings || []);
      } else {
        console.error('❌ Error al cargar entrenamientos:', response.status);
      }
    } catch (error) {
      console.error('💥 Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainings();
  }, []);

  const handleViewSolicitud = (solicitud: TrainingSolicitud) => {
    setSelectedSolicitud(solicitud);
    setShowModal(true);
  };

  const handleUpdateEstado = async (trainingId: string, solicitudId: string, newEstado: string) => {
    try {
      const response = await fetch('/api/admin/entrenamientos/solicitudes/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trainingId,
          solicitudId,
          estado: newEstado
        })
      });

      if (response.ok) {
        // console.log('✅ Estado actualizado');
        fetchTrainings(); // Recargar datos
      } else {
        console.error('❌ Error al actualizar estado');
      }
    } catch (error) {
      console.error('💥 Error:', error);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return '#f59e0b';
      case 'confirmada': return '#3b82f6';
      case 'completada': return '#059669';
      case 'cancelada': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'pendiente': return <Clock size={16} />;
      case 'confirmada': return <CheckCircle size={16} />;
      case 'completada': return <CheckCircle size={16} />;
      case 'cancelada': return <XCircle size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const allSolicitudes = trainings.flatMap(training => 
    training.solicitudes.map(solicitud => ({
      ...solicitud,
      trainingId: training._id,
      trainingTipo: training.tipo,
      trainingNombre: training.nombre,
      trainingPrecio: training.precio
    }))
  );

  const filteredSolicitudes = selectedTraining 
    ? allSolicitudes.filter(s => s.trainingId === selectedTraining)
    : allSolicitudes;

  const totalSolicitudes = allSolicitudes.length;
  const solicitudesPendientes = allSolicitudes.filter(s => s.estado === 'pendiente').length;
  const solicitudesConfirmadas = allSolicitudes.filter(s => s.estado === 'confirmada').length;
  const solicitudesCompletadas = allSolicitudes.filter(s => s.estado === 'completada').length;

  return (
    <>
      <Head>
        <title>Solicitudes de Entrenamientos - Admin</title>
        <meta name="description" content="Gestión de solicitudes de entrenamientos" />
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
              <h1 className={styles.title}>Solicitudes de Entrenamientos</h1>
              <p className={styles.subtitle}>
                Gestiona las solicitudes de inscripción a entrenamientos
              </p>
              <Link href="/admin/dashboard" className={styles.backLink}>
                ← Volver al Dashboard
              </Link>
            </div>

            {/* Métricas Generales */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#3b82f6' }}>
                  <Users size={24} />
                </div>
                <div className={styles.metricInfo}>
                  <h3>{totalSolicitudes}</h3>
                  <p>Total Solicitudes</p>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#f59e0b' }}>
                  <Clock size={24} />
                </div>
                <div className={styles.metricInfo}>
                  <h3>{solicitudesPendientes}</h3>
                  <p>Pendientes</p>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#059669' }}>
                  <CheckCircle size={24} />
                </div>
                <div className={styles.metricInfo}>
                  <h3>{solicitudesConfirmadas}</h3>
                  <p>Confirmadas</p>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricIcon} style={{ background: '#8b5cf6' }}>
                  <TrendingUp size={24} />
                </div>
                <div className={styles.metricInfo}>
                  <h3>{solicitudesCompletadas}</h3>
                  <p>Completadas</p>
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className={styles.filters}>
              <div className={styles.filterGroup}>
                <label>Filtrar por entrenamiento:</label>
                <select
                  value={selectedTraining}
                  onChange={(e) => setSelectedTraining(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Todos los entrenamientos</option>
                  {trainings.map((training) => (
                    <option key={training._id} value={training._id}>
                      {training.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lista de Solicitudes */}
            <div className={styles.solicitudesContainer}>
              {loading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner} />
                  <p>Cargando solicitudes...</p>
                </div>
              ) : filteredSolicitudes.length === 0 ? (
                <div className={styles.empty}>
                  <BookOpen size={48} />
                  <h3>No hay solicitudes</h3>
                  <p>No se encontraron solicitudes de entrenamientos</p>
                </div>
              ) : (
                <div className={styles.solicitudesGrid}>
                  {filteredSolicitudes.map((solicitud, index) => (
                    <motion.div
                      key={solicitud._id}
                      className={styles.solicitudCard}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className={styles.solicitudHeader}>
                        <div className={styles.solicitudInfo}>
                          <h3>{solicitud.nombre}</h3>
                          <p className={styles.trainingType}>{solicitud.trainingNombre}</p>
                        </div>
                        <div 
                          className={styles.estadoBadge}
                          style={{ 
                            background: getEstadoColor(solicitud.estado),
                            color: 'white'
                          }}
                        >
                          {getEstadoIcon(solicitud.estado)}
                          {solicitud.estado}
                        </div>
                      </div>

                      <div className={styles.solicitudDetails}>
                        <div className={styles.detailItem}>
                          <Mail size={16} />
                          <span>{solicitud.email}</span>
                        </div>
                        {solicitud.telefono && (
                          <div className={styles.detailItem}>
                            <Phone size={16} />
                            <span>{solicitud.telefono}</span>
                          </div>
                        )}
                        <div className={styles.detailItem}>
                          <Calendar size={16} />
                          <span>
                            {new Date(solicitud.fecha).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <div className={styles.detailItem}>
                          <DollarSign size={16} />
                          <span>${solicitud.trainingPrecio} ARS</span>
                        </div>
                      </div>

                      <div className={styles.solicitudActions}>
                        <button
                          onClick={() => handleViewSolicitud(solicitud)}
                          className={styles.viewButton}
                        >
                          <Eye size={16} />
                          Ver Detalles
                        </button>
                        
                        {solicitud.estado === 'pendiente' && (
                          <button
                            onClick={() => solicitud.trainingId && handleUpdateEstado(solicitud.trainingId, solicitud._id, 'confirmada')}
                            className={styles.confirmButton}
                          >
                            <CheckCircle size={16} />
                            Confirmar
                          </button>
                        )}
                        
                        {solicitud.estado === 'confirmada' && (
                          <button
                            onClick={() => solicitud.trainingId && handleUpdateEstado(solicitud.trainingId, solicitud._id, 'completada')}
                            className={styles.completeButton}
                          >
                            <CheckCircle size={16} />
                            Completar
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Modal de Detalles */}
        {showModal && selectedSolicitud && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContainer}>
              <div className={styles.modalHeader}>
                <h3>Detalles de la Solicitud</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                <div className={styles.detailSection}>
                  <h4>Información Personal</h4>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailField}>
                      <label>Nombre:</label>
                      <span>{selectedSolicitud.nombre}</span>
                    </div>
                    <div className={styles.detailField}>
                      <label>Email:</label>
                      <span>{selectedSolicitud.email}</span>
                    </div>
                    {selectedSolicitud.telefono && (
                      <div className={styles.detailField}>
                        <label>Teléfono:</label>
                        <span>{selectedSolicitud.telefono}</span>
                      </div>
                    )}
                    <div className={styles.detailField}>
                      <label>Nivel de experiencia:</label>
                      <span>{selectedSolicitud.nivelExperiencia || 'No especificado'}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <h4>Objetivos</h4>
                  <p>{selectedSolicitud.objetivos}</p>
                </div>

                {selectedSolicitud.experienciaTrading && (
                  <div className={styles.detailSection}>
                    <h4>Experiencia en Trading</h4>
                    <p>{selectedSolicitud.experienciaTrading}</p>
                  </div>
                )}

                {selectedSolicitud.consulta && (
                  <div className={styles.detailSection}>
                    <h4>Consulta Adicional</h4>
                    <p>{selectedSolicitud.consulta}</p>
                  </div>
                )}

                <div className={styles.detailSection}>
                  <h4>Estado de la Solicitud</h4>
                  <div className={styles.estadoActions}>
                    {['pendiente', 'confirmada', 'completada', 'cancelada'].map((estado) => (
                      <button
                        key={estado}
                        onClick={() => {
                          if (selectedSolicitud.trainingId) {
                            handleUpdateEstado(
                              selectedSolicitud.trainingId, 
                              selectedSolicitud._id, 
                              estado
                            );
                            setShowModal(false);
                          }
                        }}
                        className={`${styles.estadoButton} ${
                          selectedSolicitud.estado === estado ? styles.active : ''
                        }`}
                        style={{
                          background: selectedSolicitud.estado === estado 
                            ? getEstadoColor(estado) 
                            : '#f3f4f6',
                          color: selectedSolicitud.estado === estado ? 'white' : '#374151'
                        }}
                      >
                        {getEstadoIcon(estado)}
                        {estado}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // console.log('🔍 [ENTRENAMIENTOS-SOLICITUDES] Verificando acceso de admin...');
  
  try {
    const verification = await verifyAdminAccess(context);
    
    if (!verification.isAdmin) {
      // console.log('❌ [ENTRENAMIENTOS-SOLICITUDES] Acceso denegado');
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [ENTRENAMIENTOS-SOLICITUDES] Acceso confirmado');
    
    return {
      props: {
        user: verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [ENTRENAMIENTOS-SOLICITUDES] Error:', error);
    
    const callbackUrl = encodeURIComponent(context.resolvedUrl || '/admin/dashboard');
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }
}; 