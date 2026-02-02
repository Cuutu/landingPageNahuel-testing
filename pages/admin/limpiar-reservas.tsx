import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { toast } from 'react-hot-toast';
import { Trash2, RefreshCw, AlertTriangle, Database, CheckCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/Admin.module.css';

interface Booking {
  index: number;
  id: string;
  userEmail: string;
  type: string;
  serviceType: string;
  status: string;
  startDate: string;
  startDateLocal: string;
  hasGoogleEventId: boolean;
  googleEventId: string;
}

interface LimpiarReservasPageProps {
  user: any;
}

const LimpiarReservasPage = ({ user }: LimpiarReservasPageProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/debug/reservas');
      const data = await response.json();

      if (response.ok) {
        setBookings(data.bookings || []);
        // console.log('📊 Resumen de reservas:', {
        //   total: data.total,
        //   consultorioFinanciero: data.consultorioFinanciero,
        //   active: data.active,
        //   ghostBookings: data.ghostBookings
        // });
      } else {
        toast.error('Error al cargar reservas: ' + data.error);
      }
    } catch (error) {
      console.error('Error al cargar reservas:', error);
      toast.error('Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  };

  const limpiarReservasFantasma = async () => {
    if (!confirm('¿Estás seguro de eliminar todas las reservas fantasma (sin Google Event ID)?')) {
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch('/api/debug/reservas', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cleanGhostBookings: true
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`✅ ${data.deletedCount} reservas fantasma eliminadas`);
        await loadBookings(); // Recargar datos
      } else {
        toast.error('Error al limpiar reservas: ' + data.error);
      }
    } catch (error) {
      console.error('Error al limpiar reservas:', error);
      toast.error('Error al limpiar reservas');
    } finally {
      setProcessing(false);
    }
  };

  const limpiarReservaUsuario = async (userEmail: string) => {
    if (!confirm(`¿Eliminar todas las reservas de ${userEmail}?`)) {
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch('/api/debug/reservas', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`✅ ${data.deletedCount} reservas de ${userEmail} eliminadas`);
        await loadBookings();
      } else {
        toast.error('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar reservas del usuario');
    } finally {
      setProcessing(false);
    }
  };

  const ghostBookings = bookings.filter(b => !b.hasGoogleEventId && b.serviceType === 'ConsultorioFinanciero');
  const consultorioBookings = bookings.filter(b => b.serviceType === 'ConsultorioFinanciero');

  return (
    <>
      <Head>
        <title>🧹 Limpiar Reservas - Admin | Nahuel Lozano</title>
        <meta name="description" content="Gestión y limpieza de reservas problemáticas" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Navbar />

      <div className={styles.adminPage}>
        <div className={styles.container}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 className={styles.title}>🧹 Limpieza de Reservas</h1>
            <p className={styles.subtitle}>
              Gestiona y limpia reservas problemáticas que bloquean el sistema. 
              Elimina reservas fantasma y soluciona conflictos de horarios.
            </p>
          </div>

          {/* Estadísticas */}
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>📊 Total Reservas</h3>
              <p className={styles.cardValue}>{bookings.length}</p>
            </div>
            
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>💼 Consultorio Financiero</h3>
              <p className={styles.cardValue}>{consultorioBookings.length}</p>
            </div>
            
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>👻 Reservas Fantasma</h3>
              <p className={styles.cardValue} style={{ color: ghostBookings.length > 0 ? '#ef4444' : '#10b981' }}>
                {ghostBookings.length}
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button 
              onClick={limpiarReservasFantasma}
              disabled={processing || ghostBookings.length === 0}
              className={`${styles.button} ${styles.buttonDanger} ${processing || ghostBookings.length === 0 ? styles.buttonDisabled : ''}`}
            >
              <Trash2 size={20} />
              {processing ? 'Procesando...' : `Limpiar ${ghostBookings.length} Reservas Fantasma`}
            </button>

            <button 
              onClick={loadBookings}
              disabled={processing}
              className={`${styles.button} ${styles.buttonSecondary} ${processing ? styles.buttonDisabled : ''}`}
            >
              <RefreshCw size={20} />
              Recargar
            </button>

            <a 
              href="/api/debug/reservas" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              <Database size={20} />
              Ver JSON Completo
            </a>

            <a 
              href="/api/admin/limpiar-reservas-rapido" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              <AlertTriangle size={20} />
              Limpieza Rápida (API)
            </a>
          </div>

          {/* Tabla de reservas */}
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Cargando reservas...</p>
            </div>
          ) : (
            <div>
              <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
                📋 Reservas de Consultorio Financiero ({consultorioBookings.length})
              </h2>
              
              {consultorioBookings.length === 0 ? (
                <div className={styles.success}>
                  <CheckCircle size={20} />
                  <span style={{ marginLeft: '0.5rem' }}>
                    ¡Excelente! No hay reservas de Consultorio Financiero en la base de datos.
                  </span>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead className={styles.tableHeader}>
                      <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Google Event</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultorioBookings.map((booking) => (
                        <tr 
                          key={booking.id}
                          className={styles.tableRow}
                          style={{ 
                            backgroundColor: !booking.hasGoogleEventId ? 'rgba(239, 68, 68, 0.1)' : 'transparent'
                          }}
                        >
                          <td className={styles.tableCell}>
                            <code style={{ fontSize: '0.8rem' }}>
                              {booking.id.substring(0, 8)}...
                            </code>
                          </td>
                          <td className={styles.tableCell}>
                            {booking.userEmail}
                          </td>
                          <td className={styles.tableCell}>
                            {booking.startDateLocal}
                          </td>
                          <td className={styles.tableCell}>
                            <span className={`${styles.badge} ${
                              booking.status === 'confirmed' ? styles.badgeSuccess : 
                              booking.status === 'pending' ? styles.badgeWarning : 
                              styles.badgeError
                            }`}>
                              {booking.status}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            {booking.hasGoogleEventId ? (
                              <span className={styles.badgeSuccess}>✅ Sí</span>
                            ) : (
                              <span className={styles.badgeError}>❌ No (Fantasma)</span>
                            )}
                          </td>
                          <td className={styles.tableCell}>
                            <button
                              onClick={() => limpiarReservaUsuario(booking.userEmail)}
                              disabled={processing}
                              className={`${styles.button} ${styles.buttonDanger} ${processing ? styles.buttonDisabled : ''}`}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            >
                              <Trash2 size={14} />
                              Usuario
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Información adicional */}
          {ghostBookings.length > 0 && (
            <div className={styles.warning} style={{ marginTop: '2rem' }}>
              <AlertTriangle size={20} />
              <div style={{ marginLeft: '0.5rem' }}>
                <strong>⚠️ Reservas fantasma detectadas:</strong>
                <p style={{ margin: '0.5rem 0 0 0' }}>
                  Las reservas fantasma son reservas que se crearon en la base de datos pero no tienen un evento correspondiente en Google Calendar. 
                  Estas reservas pueden bloquear horarios sin ser reales. Se recomienda eliminarlas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const verification = await verifyAdminAccess(context);
    
    if (!verification.isAdmin) {
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    return {
      props: {
        user: verification.session?.user || verification.user || null,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps:', error);
    
    const callbackUrl = encodeURIComponent(context.resolvedUrl || '/admin/dashboard');
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }
};

export default LimpiarReservasPage; 