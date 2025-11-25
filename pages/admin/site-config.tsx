import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Save, Eye, EyeOff, Settings, List, Grid, BarChart3, Layout, Trash2, Plus, Bell, MessageCircle, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from '@/styles/admin/SiteConfig.module.css';
import ImageUploader from '@/components/ImageUploader';

interface SiteConfig {
  _id?: string;
  statistics: {
    visible: boolean;
    backgroundColor: string;
    textColor: string;
    stats: Array<{
      id: string;
      number: string;
      label: string;
      color: string;
      icon?: string;
      order: number;
    }>;
  };
  // Nueva sección para fechas de inicio de entrenamientos
  trainingStartDates: {
    swingTrading: {
      startDate: Date;
      startTime: string;
      enabled: boolean;
    };
    dowJones: {
      startDate: Date;
      startTime: string;
      enabled: boolean;
    };
  };
  // Configuración de precios de entrenamientos
  trainingPrices: {
    swingTrading: number;
    dowJones: number;
  };
  // Configuración de features
  features: {
    mentoring: {
      enabled: boolean;
      updatedAt?: Date;
      updatedBy?: string;
    };
  };
}

interface AdminSiteConfigProps {
  session: any;
  initialConfig: SiteConfig;
}

export default function AdminSiteConfig({ session, initialConfig }: AdminSiteConfigProps) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const configToSend = {
        ...config
      };

      console.log('Enviando configuración:', JSON.stringify(configToSend, null, 2));

      // Guardar configuración del sitio
      const siteConfigResponse = await fetch('/api/site-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSend),
      });

      // Guardar precios de entrenamientos
      const trainingPricesResponse = await fetch('/api/admin/training-prices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          swingTrading: config.trainingPrices?.swingTrading || 10,
          dowJones: config.trainingPrices?.dowJones || 20
        }),
      });

      if (siteConfigResponse.ok && trainingPricesResponse.ok) {
        toast.success('Configuración actualizada correctamente');
      } else {
        const siteConfigError = await siteConfigResponse.json().catch(() => null);
        const trainingPricesError = await trainingPricesResponse.json().catch(() => null);
        
        console.error('Error responses:', { siteConfigError, trainingPricesError });
        
        if (!siteConfigResponse.ok) {
          toast.error(`Error al actualizar configuración del sitio: ${siteConfigError?.error || 'Error desconocido'}`);
        }
        if (!trainingPricesResponse.ok) {
          toast.error(`Error al actualizar precios de entrenamientos: ${trainingPricesError?.error || 'Error desconocido'}`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar la configuración');
    } finally {
      setIsLoading(false);
    }
  };



  const handleStatisticsChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        [field]: value
      }
    }));
  };

  const handleStatChange = (statId: string, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        stats: prev.statistics.stats.map(stat => 
          stat.id === statId ? { ...stat, [field]: value } : stat
        )
      }
    }));
  };

  const addStat = () => {
    const newStat = {
      id: `stat-${Date.now()}`,
      number: '+100',
      label: 'Nueva Métrica',
      color: '#ffffff',
      icon: '📊',
      order: config.statistics.stats.length + 1
    };
    
    setConfig(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        stats: [...prev.statistics.stats, newStat]
      }
    }));
  };

  const removeStat = (statId: string) => {
    setConfig(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        stats: prev.statistics.stats.filter(stat => stat.id !== statId)
      }
    }));
  };

  const handleAutoUpdateMetrics = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔄 Calculando métricas automáticas...');
      
      const response = await fetch('/api/admin/calculate-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Actualizar las métricas con los datos calculados
    setConfig(prev => ({
      ...prev,
          statistics: {
            ...prev.statistics,
            stats: data.metrics
      }
    }));
        
        toast.success('Métricas actualizadas con datos reales de la base de datos');
        console.log('📊 Resumen de métricas:', data.summary);
      } else {
        toast.error(data.error || 'Error al calcular métricas automáticas');
      }
    } catch (error) {
      console.error('Error al calcular métricas:', error);
      toast.error('Error al calcular métricas automáticas');
    } finally {
      setIsLoading(false);
    }
  };

  // Funciones para manejar fechas de inicio de entrenamientos
  const handleTrainingStartDateChange = (trainingType: 'swingTrading' | 'dowJones', field: 'startDate' | 'startTime' | 'enabled', value: any) => {
    setConfig(prev => ({
      ...prev,
      trainingStartDates: {
        ...prev.trainingStartDates,
        [trainingType]: {
          ...prev.trainingStartDates[trainingType],
          [field]: value
        }
      }
    }));
  };

  const handleTrainingPriceChange = (trainingType: 'swingTrading' | 'dowJones', price: number) => {
    setConfig(prev => ({
      ...prev,
      trainingPrices: {
        ...prev.trainingPrices,
        [trainingType]: price
      }
    }));
  };

  // Función para formatear fecha para input de tipo date
  const formatDateForInput = (date: Date): string => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <>
      <Head>
        <title>Configuración del Sitio Web - Admin</title>
        <meta name="description" content="Configurar elementos del sitio web" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
                    <Link href="/admin/dashboard" className={styles.backButton}>
          <ArrowLeft size={20} />
          Volver al Dashboard
        </Link>
            <h1>Configuración del Sitio Web</h1>
            <p>Administra los elementos principales del landing page</p>
          </div>
        </div>

        <div className={styles.content}>
          <form onSubmit={handleSubmit} className={styles.form}>
            






            {/* Configuración de Features */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Settings size={24} />
                <h2>Gestión de Features</h2>
              </div>
              
              <div className={styles.featuresGrid}>
                <div className={styles.featureCard}>
                  <div className={styles.featureHeader}>
                    <div className={styles.featureInfo}>
                      <h3>Mentoring</h3>
                      <p>Plataforma de cursos y mentoring. Incluye logos en navbar y secciones en la landing page.</p>
                    </div>
                    <div className={`${styles.featureStatus} ${config.features?.mentoring?.enabled ? styles.enabled : styles.disabled}`}>
                      {config.features?.mentoring?.enabled ? (
                        <>
                          <Eye size={16} />
                          Activo
                        </>
                      ) : (
                        <>
                          <EyeOff size={16} />
                          Inactivo
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.featureControls}>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={config.features?.mentoring?.enabled || false}
                        onChange={(e) => setConfig({
                          ...config,
                          features: {
                            ...config.features,
                            mentoring: {
                              ...config.features?.mentoring,
                              enabled: e.target.checked,
                              updatedAt: new Date(),
                              updatedBy: session?.user?.email || 'admin'
                            }
                          }
                        })}
                      />
                      <span className={styles.slider}></span>
                    </label>
                    <span className={styles.toggleLabel}>
                      {config.features?.mentoring?.enabled ? 'Desactivar' : 'Activar'}
                    </span>
                  </div>

                  {config.features?.mentoring?.updatedAt && (
                    <div className={styles.featureMeta}>
                      <small>
                        Última actualización: {new Date(config.features.mentoring.updatedAt).toLocaleString('es-AR')} 
                        {config.features.mentoring.updatedBy && ` por ${config.features.mentoring.updatedBy}`}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Configuración de Estadísticas */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <BarChart3 size={24} />
                <h2>Estadísticas/Métricas</h2>
              </div>
              
              <div className={styles.grid}>
                <div className={styles.formGroup}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={config.statistics.visible}
                      onChange={(e) => handleStatisticsChange('visible', e.target.checked)}
                    />
                    <span>Mostrar sección de estadísticas</span>
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="statsBackgroundColor">Color de fondo</label>
                  <input
                    type="color"
                    id="statsBackgroundColor"
                    value={config.statistics.backgroundColor}
                    onChange={(e) => handleStatisticsChange('backgroundColor', e.target.value)}
                    className={styles.colorInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="statsTextColor">Color del texto</label>
                  <input
                    type="color"
                    id="statsTextColor"
                    value={config.statistics.textColor}
                    onChange={(e) => handleStatisticsChange('textColor', e.target.value)}
                    className={styles.colorInput}
                  />
                </div>
              </div>

              <div className={styles.statsSection}>
                <div className={styles.statsList}>
                  <div className={styles.statsHeader}>
                  <h3>Métricas Configuradas</h3>
                    <button
                      type="button"
                      onClick={handleAutoUpdateMetrics}
                      disabled={isLoading}
                      className={styles.autoUpdateButton}
                    >
                      <BarChart3 size={16} />
                      {isLoading ? 'Calculando...' : 'Actualizar con Datos Reales'}
                    </button>
                  </div>
                  {config.statistics.stats.sort((a, b) => a.order - b.order).map((stat, index) => (
                    <div key={stat.id} className={styles.statItem}>
                      <div className={styles.statHeader}>
                        <span className={styles.statNumber}>#{stat.order}</span>
                        <button
                          type="button"
                          onClick={() => removeStat(stat.id)}
                          className={styles.removeStat}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className={styles.statFields}>
                        <div className={styles.formGroup}>
                          <label>Número/Valor</label>
                          <input
                            type="text"
                            value={stat.number}
                            onChange={(e) => handleStatChange(stat.id, 'number', e.target.value)}
                            placeholder="+2900"
                            className={styles.input}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Etiqueta</label>
                          <input
                            type="text"
                            value={stat.label}
                            onChange={(e) => handleStatChange(stat.id, 'label', e.target.value)}
                            placeholder="Estudiantes"
                            className={styles.input}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Icono (opcional)</label>
                          <input
                            type="text"
                            value={stat.icon || ''}
                            onChange={(e) => handleStatChange(stat.id, 'icon', e.target.value)}
                            placeholder="📊"
                            className={styles.input}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Color</label>
                          <input
                            type="color"
                            value={stat.color}
                            onChange={(e) => handleStatChange(stat.id, 'color', e.target.value)}
                            className={styles.colorInput}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label>Orden</label>
                          <input
                            type="number"
                            value={stat.order}
                            onChange={(e) => handleStatChange(stat.id, 'order', parseInt(e.target.value))}
                            className={styles.input}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addStat}
                  className={styles.addStatButton}
                >
                  <Plus size={16} />
                  Agregar Métrica
                </button>
              </div>
            </div>

            {/* Fechas de Inicio de Entrenamientos */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <Calendar size={24} />
                <h2>Fechas de Inicio de Entrenamientos</h2>
                <p>Configura las fechas de inicio y countdown para cada entrenamiento</p>
              </div>

              {/* Zero 2 Trader */}
              <div className={styles.trainingDateGroup}>
                <h3>🎯 Zero 2 Trader</h3>
                <div className={styles.trainingDateForm}>
                  <div className={styles.formGroup}>
                    <label>
                      <input
                        type="checkbox"
                        checked={config.trainingStartDates?.swingTrading?.enabled ?? true}
                        onChange={(e) => handleTrainingStartDateChange('swingTrading', 'enabled', e.target.checked)}
                      />
                      Habilitar countdown
                    </label>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Fecha de Inicio</label>
                    <input
                      type="date"
                      value={formatDateForInput(config.trainingStartDates?.swingTrading?.startDate ?? new Date())}
                      onChange={(e) => {
                        const date = new Date(e.target.value);
                        handleTrainingStartDateChange('swingTrading', 'startDate', date);
                      }}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Hora de Inicio</label>
                    <input
                      type="time"
                      value={config.trainingStartDates?.swingTrading?.startTime ?? '13:00'}
                      onChange={(e) => handleTrainingStartDateChange('swingTrading', 'startTime', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Dow Jones */}
              <div className={styles.trainingDateGroup}>
                <h3>📈 Dow Jones</h3>
                <div className={styles.trainingDateForm}>
                  <div className={styles.formGroup}>
                    <label>
                      <input
                        type="checkbox"
                        checked={config.trainingStartDates?.dowJones?.enabled ?? true}
                        onChange={(e) => handleTrainingStartDateChange('dowJones', 'enabled', e.target.checked)}
                      />
                      Habilitar countdown
                    </label>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Fecha de Inicio</label>
                    <input
                      type="date"
                      value={formatDateForInput(config.trainingStartDates?.dowJones?.startDate ?? new Date())}
                      onChange={(e) => {
                        const date = new Date(e.target.value);
                        handleTrainingStartDateChange('dowJones', 'startDate', date);
                      }}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Hora de Inicio</label>
                    <input
                      type="time"
                      value={config.trainingStartDates?.dowJones?.startTime ?? '14:00'}
                      onChange={(e) => handleTrainingStartDateChange('dowJones', 'startTime', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Configuración de Precios de Entrenamientos */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <BarChart3 size={24} />
                <h2>Precios de Entrenamientos</h2>
                <p>Configura los precios en pesos argentinos para cada entrenamiento</p>
              </div>

              {/* Zero 2 Trader */}
              <div className={styles.trainingPriceGroup}>
                <h3>🎯 Zero 2 Trader</h3>
                <div className={styles.trainingPriceForm}>
                  <div className={styles.formGroup}>
                    <label>Precio (ARS)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={config.trainingPrices?.swingTrading ?? 10}
                      onChange={(e) => handleTrainingPriceChange('swingTrading', Number(e.target.value))}
                      className={styles.input}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>

              {/* Dow Jones */}
              <div className={styles.trainingPriceGroup}>
                <h3>📈 Dow Jones</h3>
                <div className={styles.trainingPriceForm}>
                  <div className={styles.formGroup}>
                    <label>Precio (ARS)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={config.trainingPrices?.dowJones ?? 20}
                      onChange={(e) => handleTrainingPriceChange('dowJones', Number(e.target.value))}
                      className={styles.input}
                      placeholder="20"
                    />
                  </div>
                </div>
              </div>
            </div>

            

            {/* Botones de Acción */}
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className={styles.previewButton}
              >
                {previewMode ? <EyeOff size={20} /> : <Eye size={20} />}
                {previewMode ? 'Ocultar Vista Previa' : 'Vista Previa'}
              </button>
              
              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              >
                <Save size={20} />
                {isLoading ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminCheck = await verifyAdminAccess(context);
  
  if (!adminCheck.isAdmin) {
    return {
      redirect: {
        destination: adminCheck.redirectTo || '/',
        permanent: false,
      },
    };
  }

  try {
    // Obtener configuración del sitio
    const siteConfigResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/site-config`);
    const siteConfig = siteConfigResponse.ok ? await siteConfigResponse.json() : {
      statistics: {
        visible: true,
        backgroundColor: '#7c3aed',
        textColor: '#ffffff',
        stats: [
          { id: 'estudiantes', number: '+2900', label: 'Estudiantes', color: '#ffffff', order: 1 },
          { id: 'formaciones', number: '+15', label: 'Formaciones', color: '#ffffff', order: 2 },
          { id: 'horas', number: '+70', label: 'Horas de contenido', color: '#ffffff', order: 3 },
          { id: 'satisfaccion', number: '98%', label: 'Satisfacción', color: '#ffffff', order: 4 }
        ]
      },
      trainingStartDates: {
        swingTrading: {
          startDate: new Date('2024-10-11T13:00:00.000Z'),
          startTime: '13:00',
          enabled: true
        },
        dowJones: {
          startDate: new Date('2024-11-01T14:00:00.000Z'),
          startTime: '14:00',
          enabled: true
        }
      },
      trainingPrices: {
        swingTrading: 10,
        dowJones: 20
      }
    };

    // Obtener precios actuales de entrenamientos
    const trainingPricesResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/training-prices`);
    const trainingPrices = trainingPricesResponse.ok ? await trainingPricesResponse.json() : { prices: { swingTrading: 10, dowJones: 20 } };

    // Combinar configuración con precios actuales
    const finalConfig = {
      ...siteConfig,
      trainingPrices: trainingPrices.prices
    };

    return {
      props: {
        session: adminCheck.user,
        initialConfig: finalConfig
      },
    };
  } catch (error) {
    console.error('Error al obtener datos:', error);
    return {
      props: {
        session: adminCheck.user,
        initialConfig: {
          statistics: {
            visible: true,
            backgroundColor: '#7c3aed',
            textColor: '#ffffff',
            stats: [
              { id: 'estudiantes', number: '+2900', label: 'Estudiantes', color: '#ffffff', order: 1 },
              { id: 'formaciones', number: '+15', label: 'Formaciones', color: '#ffffff', order: 2 },
              { id: 'horas', number: '+70', label: 'Horas de contenido', color: '#ffffff', order: 3 },
              { id: 'satisfaccion', number: '98%', label: 'Satisfacción', color: '#ffffff', order: 4 }
            ]
          },
          trainingStartDates: {
            swingTrading: {
              startDate: new Date('2024-10-11T13:00:00.000Z'),
              startTime: '13:00',
              enabled: true
            },
            dowJones: {
              startDate: new Date('2024-11-01T14:00:00.000Z'),
              startTime: '14:00',
              enabled: true
            }
          }
        }
      },
    };
  }
}; 