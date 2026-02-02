import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../../styles/AdminReports.module.css';

interface Article {
  _id: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
  createdAt: string;
}

interface Report {
  id: string;
  title: string;
  type: 'informe' | 'video' | 'analisis';
  summary: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  author: string | { name?: string; email?: string; _id?: string };
  views: number;
  isFeature: boolean;
  publishedAt?: string;
  createdAt: string;
  articles?: Article[];
}

interface AdminReportsPageProps {
  user: any;
}

const AdminReportsPage: React.FC<AdminReportsPageProps> = ({ user }) => {
  const router = useRouter();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showArticlesForm, setShowArticlesForm] = useState(false);
  const [managingArticles, setManagingArticles] = useState(false);
  
  const [newReport, setNewReport] = useState({
    title: '',
    type: 'informe' as 'informe' | 'video' | 'analisis',
    summary: '',
    content: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    isFeature: false,
    articles: [] as Article[]
  });

  const [newArticle, setNewArticle] = useState({
    title: '',
    content: '',
    order: 1,
    isPublished: true
  });

  // Cargar reportes al montar el componente
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/reports?limit=50');
      if (response.ok) {
        const data = await response.json();
        setReports(data.data?.reports || []);
      }
    } catch (error) {
      console.error('Error al cargar informes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateReports = async () => {
    if (!confirm('¿Estás seguro de que quieres migrar los informes existentes al nuevo esquema de Cloudinary?')) {
      return;
    }

    setMigrating(true);
    try {
      const response = await fetch('/api/admin/reports/migrate', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Migración completada: ${data.data.migrados} informes migrados, ${data.data.errores} errores`);
        // Recargar informes después de la migración
        loadReports();
      } else {
        const errorData = await response.json();
        alert(`Error en migración: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error en migración:', error);
      alert('Error al ejecutar migración');
    } finally {
      setMigrating(false);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch('/api/admin/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...newReport
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReports(prev => [data.data.report, ...prev]);
        setNewReport({
          title: '',
          type: 'informe',
          summary: '',
          content: '',
          status: 'draft',
          isFeature: false,
          articles: []
        });
        setShowCreateForm(false);
        alert('Informe creado exitosamente');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error al crear informe:', error);
      alert('Error al crear informe');
    } finally {
      setCreating(false);
    }
  };

  const handleManageArticles = (report: Report) => {
    setSelectedReport(report);
    setShowArticlesForm(true);
  };

  const handleAddArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newArticle.title.trim() || !newArticle.content.trim()) {
      alert('Título y contenido son requeridos');
      return;
    }

    const articleToAdd = {
      ...newArticle,
      _id: Date.now().toString(), // ID temporal
      createdAt: new Date().toISOString()
    };

    setNewReport(prev => ({
      ...prev,
      articles: [...prev.articles, articleToAdd]
    }));
    
    setNewArticle({
      title: '',
      content: '',
      order: newReport.articles.length + 1,
      isPublished: true
    });
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!selectedReport || !confirm('¿Estás seguro de que quieres eliminar este artículo?')) return;

    try {
      const response = await fetch(`/api/admin/reports/${selectedReport.id}/articles`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ articleId }),
      });

      if (response.ok) {
        // Actualizar el informe local eliminando el artículo
        setReports(prev => prev.map(report => 
          report.id === selectedReport.id 
            ? { ...report, articles: report.articles?.filter(article => article._id !== articleId) || [] }
            : report
        ));
        
        alert('Artículo eliminado exitosamente');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
      alert('Error al eliminar artículo');
    }
  };

  // Funciones para gestionar artículos en el formulario de creación
  const addArticleToForm = () => {
    if (newArticle.title && newArticle.content) {
      const articleToAdd = {
        ...newArticle,
        _id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      
      setNewReport(prev => ({
        ...prev,
        articles: [...prev.articles, articleToAdd]
      }));
      
      // Resetear el formulario de artículo
      setNewArticle({
        title: '',
        content: '',
        order: newReport.articles.length + 1,
        isPublished: true
      });
    } else {
      alert('Por favor completa el título y contenido del artículo');
    }
  };

  const removeArticleFromForm = (index: number) => {
    setNewReport(prev => ({
      ...prev,
      articles: prev.articles.filter((_, i) => i !== index)
    }));
    
    // Reordenar artículos restantes
    setNewReport(prev => ({
      ...prev,
      articles: prev.articles.map((article, i) => ({
        ...article,
        order: i + 1
      }))
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return '#10b981';
      case 'draft': return '#f59e0b';
      case 'archived': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎥';
      case 'analisis': return '📊';
      default: return '📄';
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <h2>Cargando...</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin - Gestión de Informes</title>
        <meta name="description" content="Panel de administración para gestión de informes" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>📄 Gestión de Informes</h1>
            <p className={styles.subtitle}>
              {reports.length} informe{reports.length !== 1 ? 's' : ''} en total
            </p>
          </div>
          
          <div className={styles.headerActions}>
            <button 
              className={styles.migrateButton}
              onClick={handleMigrateReports}
              disabled={migrating}
              style={{
                background: migrating ? '#6b7280' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: migrating ? 'not-allowed' : 'pointer',
                marginRight: '1rem'
              }}
            >
              {migrating ? '⏳ Migrando...' : '🔄 Migrar Informes'}
            </button>
            
            <button 
              className={styles.createButton}
              onClick={() => setShowCreateForm(true)}
            >
              + Crear Informe
            </button>
          </div>
        </div>

        {/* Mensaje de ayuda sobre migración */}
        {reports.length === 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '2rem',
            color: '#d97706'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#d97706' }}>
              ⚠️ No se encontraron informes
            </h3>
            <p style={{ margin: 0 }}>
              Si tenías informes creados anteriormente, es posible que necesites ejecutar la migración 
              para actualizar el esquema de base de datos al nuevo sistema de Cloudinary.
            </p>
          </div>
        )}

        {/* Modal de creación de informe */}
        {showCreateForm && (
          <div className={styles.modal}>
            <div className={styles.modalContent} style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className={styles.modalHeader}>
                <h2>Crear Nuevo Informe</h2>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowCreateForm(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateReport} className={styles.form}>
                {/* Información básica del informe */}
                <div className={styles.formSection}>
                  <h3>📋 Información Básica del Informe</h3>
                  
                  <div className={styles.formGroup}>
                    <label>Título del Informe *</label>
                    <input
                      type="text"
                      value={newReport.title}
                      onChange={(e) => setNewReport(prev => ({...prev, title: e.target.value}))}
                      required
                      maxLength={200}
                      placeholder="Ej: Análisis del Mercado Q4 2024"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Tipo *</label>
                      <select
                        value={newReport.type}
                        onChange={(e) => setNewReport(prev => ({...prev, type: e.target.value as any}))}
                      >
                        <option value="informe">📄 Informe</option>
                        <option value="video">🎥 Video</option>
                        <option value="analisis">📊 Análisis</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Estado</label>
                      <select
                        value={newReport.status}
                        onChange={(e) => setNewReport(prev => ({...prev, status: e.target.value as any}))}
                      >
                        <option value="draft">Borrador</option>
                        <option value="published">Publicado</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Resumen *</label>
                    <textarea
                      value={newReport.summary}
                      onChange={(e) => setNewReport(prev => ({...prev, summary: e.target.value}))}
                      required
                      rows={3}
                      maxLength={500}
                      placeholder="Breve descripción del contenido del informe..."
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Contenido</label>
                    <textarea
                      value={newReport.content}
                      onChange={(e) => setNewReport(prev => ({...prev, content: e.target.value}))}
                      placeholder="Contenido del informe..."
                      rows={6}
                      required
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Estado</label>
                      <select
                        value={newReport.status}
                        onChange={(e) => setNewReport(prev => ({...prev, status: e.target.value as 'draft' | 'published' | 'archived'}))}
                      >
                        <option value="draft">Borrador</option>
                        <option value="published">Publicado</option>
                        <option value="archived">Archivado</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>
                        <input
                          type="checkbox"
                          checked={newReport.isFeature}
                          onChange={(e) => setNewReport(prev => ({...prev, isFeature: e.target.checked}))}
                        />
                        Destacado
                      </label>
                    </div>
                  </div>
                </div>

                {/* Sección de artículos */}
                <div className={styles.formSection}>
                  <h3>📚 Artículos del Informe (Opcional)</h3>
                  <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    Puedes dividir el informe en artículos más pequeños para mejor organización. 
                    Máximo 10 artículos permitidos.
                  </p>

                  {/* Formulario para agregar artículo */}
                  <div style={{
                    background: 'rgba(102, 126, 234, 0.05)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#667eea' }}>➕ Agregar Nuevo Artículo</h4>
                    
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Título del Artículo *</label>
                        <input
                          type="text"
                          value={newArticle.title}
                          onChange={(e) => setNewArticle(prev => ({...prev, title: e.target.value}))}
                          placeholder="Ej: Introducción al Mercado"
                          maxLength={200}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Orden *</label>
                        <input
                          type="number"
                          value={newArticle.order}
                          onChange={(e) => setNewArticle(prev => ({...prev, order: parseInt(e.target.value)}))}
                          min={1}
                          max={10}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Contenido del Artículo *</label>
                      <textarea
                        value={newArticle.content}
                        onChange={(e) => setNewArticle(prev => ({...prev, content: e.target.value}))}
                        rows={4}
                        placeholder="Contenido del artículo (puede incluir HTML)..."
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={newArticle.isPublished}
                          onChange={(e) => setNewArticle(prev => ({...prev, isPublished: e.target.checked}))}
                        />
                        Publicar inmediatamente
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={addArticleToForm}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      + Agregar Artículo al Informe
                    </button>
                  </div>

                  {/* Lista de artículos agregados */}
                  {newReport.articles.length > 0 && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '1.5rem'
                    }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#ffffff' }}>
                        📋 Artículos Agregados ({newReport.articles.length})
                      </h4>
                      
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {newReport.articles
                          .sort((a, b) => a.order - b.order)
                          .map((article, index) => (
                            <div key={article._id} style={{
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              padding: '1rem',
                              marginBottom: '0.75rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#ffffff', marginBottom: '0.25rem' }}>
                                  Artículo {article.order}: {article.title}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#a0a0a0' }}>
                                  {article.content.substring(0, 100)}...
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#667eea', marginTop: '0.25rem' }}>
                                  Estado: {article.isPublished ? 'Publicado' : 'Borrador'}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeArticleFromForm(index)}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.5rem',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem'
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button type="button" onClick={() => setShowCreateForm(false)}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating}>
                    {creating ? 'Creando...' : 'Crear Informe'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de gestión de artículos */}
        {showArticlesForm && selectedReport && (
          <div className={styles.modal}>
            <div className={styles.modalContent} style={{ maxWidth: '800px' }}>
              <div className={styles.modalHeader}>
                <h2>Gestionar Artículos: {selectedReport.title}</h2>
                <button 
                  className={styles.closeButton}
                  onClick={() => {
                    setShowArticlesForm(false);
                    setSelectedReport(null);
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h3>Agregar Nuevo Artículo</h3>
                <form onSubmit={handleAddArticle} className={styles.form}>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Título del Artículo *</label>
                      <input
                        type="text"
                        value={newArticle.title}
                        onChange={(e) => setNewArticle(prev => ({...prev, title: e.target.value}))}
                        required
                        maxLength={200}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Orden *</label>
                      <input
                        type="number"
                        value={newArticle.order}
                        onChange={(e) => setNewArticle(prev => ({...prev, order: parseInt(e.target.value)}))}
                        required
                        min={1}
                        max={10}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Contenido del Artículo *</label>
                    <textarea
                      value={newArticle.content}
                      onChange={(e) => setNewArticle(prev => ({...prev, content: e.target.value}))}
                      required
                      rows={6}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={newArticle.isPublished}
                        onChange={(e) => setNewArticle(prev => ({...prev, isPublished: e.target.checked}))}
                      />
                      Publicar inmediatamente
                    </label>
                  </div>

                  <div className={styles.formActions}>
                    <button type="submit" disabled={managingArticles}>
                      {managingArticles ? 'Agregando...' : 'Agregar Artículo'}
                    </button>
                  </div>
                </form>
              </div>

              <div>
                <h3>Artículos Existentes ({selectedReport.articles?.length || 0})</h3>
                {selectedReport.articles && selectedReport.articles.length > 0 ? (
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {selectedReport.articles
                      .sort((a, b) => a.order - b.order)
                      .map((article) => (
                        <div key={article._id} style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '1rem',
                          marginBottom: '1rem',
                          background: '#f9fafb'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0 }}>Artículo {article.order}: {article.title}</h4>
                            <div>
                              <span style={{
                                background: article.isPublished ? '#10b981' : '#6b7280',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                marginRight: '0.5rem'
                              }}>
                                {article.isPublished ? 'Publicado' : 'Borrador'}
                              </span>
                              <button
                                onClick={() => handleDeleteArticle(article._id!)}
                                style={{
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                          <p style={{ margin: '0.5rem 0', color: '#6b7280' }}>
                            {article.content.substring(0, 150)}...
                          </p>
                          <small style={{ color: '#9ca3af' }}>
                            Creado: {new Date(article.createdAt).toLocaleDateString('es-ES')}
                          </small>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    Este informe no tiene artículos aún. Agrega el primero arriba.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de informes */}
        <div className={styles.reportsList}>
          {reports.length > 0 ? (
            reports.map((report) => (
              <div key={report.id} className={styles.reportCard}>
                <div className={styles.reportHeader}>
                  <div className={styles.reportTitle}>
                    <span className={styles.typeIcon}>{getTypeIcon(report.type)}</span>
                    <h3>{report.title}</h3>
                    {report.isFeature && <span className={styles.featuredBadge}>⭐</span>}
                  </div>
                  <div 
                    className={styles.statusBadge}
                    style={{ backgroundColor: getStatusColor(report.status) }}
                  >
                    {report.status}
                  </div>
                </div>

                <p className={styles.reportSummary}>{report.summary}</p>

                <div className={styles.reportMeta}>
                  <span>Por {typeof report.author === 'object' ? report.author?.name : report.author || 'Autor desconocido'}</span>
                  <span>👁️ {report.views} vistas</span>
                  <span>📅 {new Date(report.createdAt).toLocaleDateString('es-ES')}</span>
                  {report.articles && report.articles.length > 0 && (
                    <span>📚 {report.articles.length} artículo{report.articles.length !== 1 ? 's' : ''}</span>
                  )}
                </div>

                <div className={styles.reportActions}>
                  <button
                    onClick={() => handleManageArticles(report)}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      marginRight: '0.5rem'
                    }}
                  >
                    📚 Gestionar Artículos
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <h3>No hay informes disponibles</h3>
              <p>Comienza creando tu primer informe o ejecuta la migración si tenías informes anteriores.</p>
            </div>
          )}
        </div>
      </div>
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

export default AdminReportsPage; 