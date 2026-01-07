import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';

interface EBAYAlert {
  _id: string;
  id?: string;
  symbol: string;
  action: string;
  sellRangeMin?: number;
  sellRangeMax?: number;
  sellPrice?: number;
  status: string;
  participationPercentage?: number;
  originalParticipationPercentage?: number;
  ventasParciales?: Array<{
    fecha: Date | string;
    precio: number;
    porcentajeVendido: number;
    gananciaRealizada: number;
  }>;
}

interface EditEBAYAlertProps {
  user: {
    email: string;
    name?: string;
  };
}

export default function EditEBAYAlert({ user }: EditEBAYAlertProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<EBAYAlert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [sellRangeMin, setSellRangeMin] = useState<string>('');
  const [sellRangeMax, setSellRangeMax] = useState<string>('');

  useEffect(() => {
    loadEBAYAlert();
  }, []);

  const loadEBAYAlert = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar en ambos tipos (TraderCall y SmartMoney) y sin restricción de estado
      const [responseTraderCall, responseSmartMoney] = await Promise.all([
        fetch('/api/alerts/list?status=ALL&tipo=TraderCall&limit=200', {
          credentials: 'same-origin'
        }),
        fetch('/api/alerts/list?status=ALL&tipo=SmartMoney&limit=200', {
          credentials: 'same-origin'
        })
      ]);
      
      const dataTraderCall = await responseTraderCall.json();
      const dataSmartMoney = await responseSmartMoney.json();
      
      // Combinar alertas de ambos tipos
      const allAlerts = [
        ...(dataTraderCall.success && dataTraderCall.alerts ? dataTraderCall.alerts : []),
        ...(dataSmartMoney.success && dataSmartMoney.alerts ? dataSmartMoney.alerts : [])
      ];
      
      // Filtrar alertas de EBAY de tipo SELL (sin importar el estado)
      const ebayAlerts = allAlerts.filter((a: any) => 
        a.symbol && a.symbol.toUpperCase() === 'EBAY' && a.action === 'SELL'
      );
      
      if (ebayAlerts.length > 0) {
        // Priorizar alertas activas, sino tomar la más reciente
        const activeAlert = ebayAlerts.find((a: any) => a.status === 'ACTIVE');
        const ebayAlert = activeAlert || ebayAlerts[0];
        
        setAlert(ebayAlert);
        setSellRangeMin(ebayAlert.sellRangeMin ? String(ebayAlert.sellRangeMin) : '');
        setSellRangeMax(ebayAlert.sellRangeMax ? String(ebayAlert.sellRangeMax) : '');
      } else {
        setError('No se encontró una alerta de venta para EBAY. Verifica que exista una alerta de tipo SELL para EBAY en el sistema.');
      }
    } catch (err) {
      console.error('Error cargando alerta:', err);
      setError('Error al cargar la alerta de EBAY: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alert) {
      setError('No hay alerta para editar');
      return;
    }

    // Validar campos
    if (!sellRangeMin || !sellRangeMax) {
      setError('Por favor completa ambos precios (mínimo y máximo)');
      return;
    }

    const min = parseFloat(sellRangeMin);
    const max = parseFloat(sellRangeMax);

    if (isNaN(min) || isNaN(max)) {
      setError('Los precios deben ser números válidos');
      return;
    }

    if (min < 0 || max < 0) {
      setError('Los precios no pueden ser negativos');
      return;
    }

    if (min > max) {
      setError('El precio mínimo no puede ser mayor al máximo');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const alertId = alert._id || alert.id;
      if (!alertId) {
        setError('No se pudo identificar la alerta');
        return;
      }

      const response = await fetch('/api/alerts/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          alertId: alertId,
          sellRangeMin: min,
          sellRangeMax: max,
          reason: 'Edición de precio de venta desde página de administración'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess(true);
        // Recargar la alerta para ver los cambios
        await loadEBAYAlert();
        
        // Limpiar mensaje de éxito después de 3 segundos
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Error al guardar los cambios');
      }
    } catch (err) {
      console.error('Error guardando:', err);
      setError('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Cargando...</div>
      </div>
    );
  }

  if (!alert) {
    return (
      <div style={{ 
        padding: '2rem',
        backgroundColor: '#0f172a',
        minHeight: '100vh',
        color: 'white'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ marginBottom: '1rem' }}>Editar Alerta EBAY</h1>
          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#dc2626',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}
          <button
            onClick={loadEBAYAlert}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Editar Alerta EBAY - Admin</title>
      </Head>
      <div style={{ 
        padding: '2rem',
        backgroundColor: '#0f172a',
        minHeight: '100vh',
        color: 'white'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ marginBottom: '1rem', color: '#8b5cf6' }}>
            📊 Editar Alerta de Venta - EBAY
          </h1>

            {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#dc2626',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              ❌ {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#10b981',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              ✅ ¡Precios actualizados exitosamente!
            </div>
          )}

        <div style={{
          backgroundColor: '#1e293b',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #334155'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '0.5rem', color: '#94a3b8' }}>Estado de la alerta:</div>
            <div style={{ 
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              backgroundColor: alert.status === 'ACTIVE' ? '#10b981' : '#dc2626',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {alert.status}
            </div>
          </div>

          {/* ✅ NUEVO: Mostrar porcentaje de venta */}
          <div style={{ 
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#334155',
            borderRadius: '8px'
          }}>
            <div style={{ color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '600' }}>
              📊 Porcentaje de Venta
            </div>
            {(() => {
              const participationPercentage = alert?.participationPercentage ?? 100;
              const originalParticipation = alert?.originalParticipationPercentage ?? 100;
              const porcentajeVendido = originalParticipation - participationPercentage;
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#e2e8f0' }}>Porcentaje vendido:</span>
                    <span style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      color: porcentajeVendido > 0 ? '#fbbf24' : '#94a3b8' 
                    }}>
                      {porcentajeVendido.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#e2e8f0' }}>Participación restante:</span>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: '600', 
                      color: participationPercentage > 0 ? '#10b981' : '#94a3b8' 
                    }}>
                      {participationPercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })()}
              {alert.ventasParciales && alert.ventasParciales.length > 0 && (
                <div style={{ 
                  marginTop: '0.75rem', 
                  paddingTop: '0.75rem', 
                  borderTop: '1px solid #475569',
                  fontSize: '14px',
                  color: '#94a3b8'
                }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>Ventas parciales:</div>
                  {alert.ventasParciales.map((venta: any, index: number) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem'
                    }}>
                      <span>
                        {new Date(venta.fecha).toLocaleDateString('es-AR')} - 
                        ${typeof venta.precio === 'number' ? venta.precio.toFixed(2) : venta.precio}
                      </span>
                      <span style={{ color: '#fbbf24', fontWeight: '600' }}>
                        {venta.porcentajeVendido?.toFixed(1) || '0'}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {alert.sellPrice && (
            <div style={{ 
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#334155',
              borderRadius: '8px'
            }}>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>Precio de venta fijo actual:</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fbbf24' }}>
                US$ {alert.sellPrice.toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '0.5rem' }}>
                (Si hay un precio fijo, el rango será ignorado)
              </div>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#e2e8f0'
              }}>
                Precio Mínimo de Venta (US$)
              </label>
              <input
                type="number"
                step="0.01"
                value={sellRangeMin}
                onChange={(e) => setSellRangeMin(e.target.value)}
                placeholder="Ej: 90.00"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#e2e8f0'
              }}>
                Precio Máximo de Venta (US$)
              </label>
              <input
                type="number"
                step="0.01"
                value={sellRangeMax}
                onChange={(e) => setSellRangeMax(e.target.value)}
                placeholder="Ej: 93.00"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '1rem',
              marginTop: '2rem'
            }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.5rem',
                  backgroundColor: saving ? '#64748b' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.backgroundColor = '#7c3aed';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.backgroundColor = '#8b5cf6';
                  }
                }}
              >
                {saving ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>

              <a
                href="/alertas/trader-call"
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#475569';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#334155';
                }}
              >
                ← Volver
              </a>
            </div>
          </form>
        </div>

        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#94a3b8'
        }}>
          <strong>ℹ️ Información:</strong>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>Esta página edita la alerta de venta activa de EBAY</li>
            <li>Los cambios se aplican inmediatamente a la alerta</li>
            <li>Si la alerta tiene un precio fijo (sellPrice), el rango será ignorado</li>
            <li>Al cierre de mercado, el sistema usará estos precios si no puede obtener el precio real</li>
          </ul>
        </div>
      </div>
    </>
  );
}

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
        user: verification.session?.user || verification.user,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};

