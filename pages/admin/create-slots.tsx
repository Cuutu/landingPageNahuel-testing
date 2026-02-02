import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, Plus, Settings, CheckCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/Admin.module.css';

interface CreateSlotsPageProps {
  user: any;
}

const CreateSlotsPage = ({ user }: CreateSlotsPageProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    serviceType: 'ConsultorioFinanciero',
    startDate: '',
    endDate: '',
    timeSlots: ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    price: 199,
    duration: 60,
    skipWeekends: false,
    skipExisting: true
  });

  const [result, setResult] = useState<any>(null);

  // Función para convertir de DD/MM/YYYY a YYYY-MM-DD (formato HTML5)
  const formatDateForInput = (dateStr: string): string => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Función para convertir de YYYY-MM-DD a DD/MM/YYYY (formato esperado por API)
  const formatDateForAPI = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Obtener fecha mínima (hoy) en formato YYYY-MM-DD
  const getMinDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Función para obtener el día de la semana de una fecha DD/MM/YYYY
  const getDayOfWeek = (dateStr: string): string => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  };

  // Función para verificar si es fin de semana
  const isWeekend = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDay() === 0 || date.getDay() === 6; // 0 = domingo, 6 = sábado
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startDate || !formData.endDate) {
      toast.error('Por favor completa las fechas de inicio y fin');
      return;
    }

    if (formData.timeSlots.length === 0) {
      toast.error('Por favor agrega al menos un horario');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const response = await fetch('/api/admin/create-available-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast.success(`✅ ${data.created} horarios creados exitosamente`);
        
        // Opcional: limpiar formulario
        setFormData(prev => ({
          ...prev,
          startDate: '',
          endDate: ''
        }));
      } else {
        toast.error('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error creating slots:', error);
      toast.error('Error al crear horarios');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const htmlDate = e.target.value;
    const apiDate = formatDateForAPI(htmlDate);
    
    setFormData(prev => ({
      ...prev,
      startDate: apiDate,
      // Siempre establecer fecha de fin igual a fecha de inicio para facilitar selección de un solo día
      endDate: apiDate
    }));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const htmlDate = e.target.value;
    const apiDate = formatDateForAPI(htmlDate);
    
    setFormData(prev => ({
      ...prev,
      endDate: apiDate
    }));
  };

  const handleTimeSlotChange = (index: number, value: string) => {
    const newTimeSlots = [...formData.timeSlots];
    newTimeSlots[index] = value;
    setFormData(prev => ({ ...prev, timeSlots: newTimeSlots }));
  };

  const addTimeSlot = () => {
    setFormData(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, '20:00']
    }));
  };

  const removeTimeSlot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index)
    }));
  };

  return (
    <>
      <Head>
        <title>Crear Horarios Disponibles - Admin | Nahuel Lozano</title>
        <meta name="description" content="Crear horarios disponibles para servicios" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Navbar />

      <div className={styles.adminPage}>
        <div className={styles.container}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 className={styles.title}>📅 Crear Horarios Disponibles</h1>
            <p className={styles.subtitle}>
              Crea horarios disponibles para que los usuarios puedan reservar. 
              Los horarios se crean automáticamente para el rango de fechas seleccionado.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Tipo de Servicio */}
            <div>
              <label htmlFor="serviceType" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Tipo de Servicio
              </label>
              <select
                id="serviceType"
                value={formData.serviceType}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceType: e.target.value }))}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="ConsultorioFinanciero">Consultorio Financiero</option>
                <option value="CuentaAsesorada">Cuenta Asesorada</option>
                <option value="TradingAvanzado">Trading Avanzado</option>
                <option value="TradingBasico">Trading Básico</option>
              </select>
            </div>

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  📅 Fecha de Inicio
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={formatDateForInput(formData.startDate)}
                  onChange={handleStartDateChange}
                  min={getMinDate()}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)'
                  }}
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  Primer día para crear horarios
                </small>
              </div>
              <div>
                <label htmlFor="endDate" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  📅 Fecha de Fin
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={formatDateForInput(formData.endDate)}
                  onChange={handleEndDateChange}
                  min={formData.startDate ? formatDateForInput(formData.startDate) : getMinDate()}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)'
                  }}
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  Último día para crear horarios
                </small>
              </div>
            </div>
            
            {/* Información adicional sobre el rango de fechas */}
            {formData.startDate && formData.endDate && (
              <div style={{ 
                padding: '1rem', 
                background: 'rgba(0, 255, 136, 0.1)', 
                borderRadius: 'var(--border-radius)',
                border: '1px solid rgba(0, 255, 136, 0.3)'
              }}>
                <p style={{ color: 'var(--primary-color)', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                  ℹ️ Se crearán horarios desde <strong>{formData.startDate}</strong> hasta <strong>{formData.endDate}</strong>
                  {formData.startDate === formData.endDate && (
                    <span style={{ color: 'var(--text-secondary)' }}> (un solo día)</span>
                  )}
                </p>
                
                {/* Mostrar día de la semana */}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  {formData.startDate && (
                    <p style={{ margin: '0.25rem 0' }}>
                      📅 <strong>{formData.startDate}</strong> es {getDayOfWeek(formData.startDate)}
                      {isWeekend(formData.startDate) && (
                        <span style={{ color: '#f59e0b', fontWeight: 'bold' }}> (fin de semana)</span>
                      )}
                    </p>
                  )}
                  {formData.endDate && formData.startDate !== formData.endDate && (
                    <p style={{ margin: '0.25rem 0' }}>
                      📅 <strong>{formData.endDate}</strong> es {getDayOfWeek(formData.endDate)}
                      {isWeekend(formData.endDate) && (
                        <span style={{ color: '#f59e0b', fontWeight: 'bold' }}> (fin de semana)</span>
                      )}
                    </p>
                  )}
                </div>
                
                {/* Alerta si es fin de semana y skip weekends está activado */}
                {(isWeekend(formData.startDate) || isWeekend(formData.endDate)) && formData.skipWeekends && (
                  <div style={{ 
                    marginTop: '0.75rem', 
                    padding: '0.75rem', 
                    background: 'rgba(255, 193, 7, 0.1)', 
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255, 193, 7, 0.3)'
                  }}>
                    <p style={{ color: '#f59e0b', margin: 0, fontSize: '0.85rem' }}>
                      ⚠️ <strong>Atención:</strong> Tienes activado "Saltar fines de semana" y has seleccionado fecha(s) de fin de semana. 
                      Estos días serán saltados automáticamente.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Horarios */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Horarios Disponibles
              </label>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {formData.timeSlots.map((slot, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="time"
                      value={slot}
                      onChange={(e) => handleTimeSlotChange(index, e.target.value)}
                      style={{ 
                        flex: 1,
                        padding: '0.5rem', 
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid var(--border-color)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)'
                      }}
                    />
                    {formData.timeSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeSlot(index)}
                        className={`${styles.button} ${styles.buttonDanger}`}
                        style={{ padding: '0.5rem' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTimeSlot}
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  style={{ justifySelf: 'start' }}
                >
                  <Plus size={16} />
                  Agregar Horario
                </button>
              </div>
            </div>

            {/* Precio y Duración */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="price" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Precio (ARS)
                </label>
                <input
                  type="number"
                  id="price"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) }))}
                  min="0"
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
              <div>
                <label htmlFor="duration" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Duración (minutos)
                </label>
                <input
                  type="number"
                  id="duration"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  min="15"
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Opciones */}
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={formData.skipWeekends}
                  onChange={(e) => setFormData(prev => ({ ...prev, skipWeekends: e.target.checked }))}
                />
                Saltar fines de semana
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={formData.skipExisting}
                  onChange={(e) => setFormData(prev => ({ ...prev, skipExisting: e.target.checked }))}
                />
                Saltar horarios existentes
              </label>
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={loading}
              className={`${styles.button} ${styles.buttonPrimary} ${loading ? styles.buttonDisabled : ''}`}
            >
              {loading ? 'Creando...' : 'Crear Horarios'}
              {!loading && <Calendar size={20} />}
            </button>
          </form>

          {/* Resultado */}
          {result && (
            <div className={styles.success} style={{ marginTop: '2rem' }}>
              <CheckCircle size={20} />
              <div style={{ marginLeft: '0.5rem' }}>
                <h3>✅ Proceso completado</h3>
                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                  <p><strong>✅ Creados:</strong> {result.created}</p>
                  <p><strong>⏭️ Saltados:</strong> {result.skipped}</p>
                  <p><strong>❌ Errores:</strong> {result.errors}</p>
                </div>
                
                {/* Información adicional cuando no se crearon horarios */}
                {result.created === 0 && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    background: 'rgba(255, 193, 7, 0.1)', 
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid rgba(255, 193, 7, 0.3)'
                  }}>
                    <h4 style={{ color: '#ffc107', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                      ⚠️ No se crearon horarios
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Posibles razones:
                    </p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {result.config.skipWeekends && (
                        <li>La fecha seleccionada es fin de semana y tienes activado "Saltar fines de semana"</li>
                      )}
                      {result.config.skipExisting && (
                        <li>Los horarios ya existen y tienes activado "Saltar horarios existentes"</li>
                      )}
                      <li>La fecha seleccionada no cumple con los criterios configurados</li>
                    </ul>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      💡 <strong>Sugerencia:</strong> Desactiva "Saltar fines de semana" si quieres crear horarios en sábado/domingo
                    </p>
                  </div>
                )}
                
                {result.details.createdSlots.length > 0 && (
                  <details style={{ marginTop: '1rem' }}>
                    <summary>Ver horarios creados ({result.details.createdSlots.length})</summary>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                      {result.details.createdSlots.slice(0, 10).map((slot: string, index: number) => (
                        <div key={index}>• {slot}</div>
                      ))}
                      {result.details.createdSlots.length > 10 && (
                        <div>... y {result.details.createdSlots.length - 10} más</div>
                      )}
                    </div>
                  </details>
                )}
                
                {result.details.skippedSlots.length > 0 && (
                  <details style={{ marginTop: '1rem' }}>
                    <summary>Ver horarios saltados ({result.details.skippedSlots.length})</summary>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {result.details.skippedSlots.slice(0, 10).map((slot: string, index: number) => (
                        <div key={index}>• {slot}</div>
                      ))}
                      {result.details.skippedSlots.length > 10 && (
                        <div>... y {result.details.skippedSlots.length - 10} más</div>
                      )}
                    </div>
                  </details>
                )}
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

export default CreateSlotsPage; 