import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Trash2, Search, AlertTriangle, X, CheckCircle } from 'lucide-react';

interface Report {
  _id: string;
  title: string;
  category: 'smart-money' | 'trader-call' | 'general';
  author: string | { name?: string; email?: string };
  views: number;
  createdAt: string;
  isPublished: boolean;
}

const DeleteReportsPage: React.FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cargar informes
  useEffect(() => {
    if (status === 'authenticated') {
      fetchReports();
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/reports?limit=100&sortBy=createdAt&sortOrder=desc', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (data.success && data.data?.reports) {
        // Normalizar los datos para asegurar que tengan _id
        const normalizedReports = data.data.reports.map((report: any) => ({
          _id: report._id || report.id,
          title: report.title || 'Sin título',
          category: report.category || 'general',
          author: report.author || 'Desconocido',
          views: report.views || 0,
          createdAt: report.createdAt || report.publishedAt || new Date().toISOString(),
          isPublished: report.isPublished !== undefined ? report.isPublished : true
        }));
        setReports(normalizedReports);
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al cargar informes' });
      }
    } catch (error) {
      console.error('Error cargando informes:', error);
      setMessage({ type: 'error', text: 'Error al cargar informes' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string, reportTitle: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar el informe "${reportTitle}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setDeleting(reportId);
      setMessage(null);

      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `Informe "${reportTitle}" eliminado exitosamente` });
        // Recargar la lista
        await fetchReports();
      } else {
        setMessage({ type: 'error', text: data.message || 'Error al eliminar el informe' });
      }
    } catch (error) {
      console.error('Error eliminando informe:', error);
      setMessage({ type: 'error', text: 'Error al eliminar el informe' });
    } finally {
      setDeleting(null);
    }
  };

  // Filtrar informes por término de búsqueda
  const filteredReports = reports.filter(report =>
    report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report._id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'smart-money':
        return 'SmartMoney';
      case 'trader-call':
        return 'TraderCall';
      default:
        return 'General';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'smart-money':
        return '#10b981'; // green
      case 'trader-call':
        return '#3b82f6'; // blue
      default:
        return '#6b7280'; // gray
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#1f2937',
        color: '#f9fafb'
      }}>
        <div>Cargando...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Eliminar Informes - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main style={{
        minHeight: '100vh',
        background: '#1f2937',
        color: '#f9fafb',
        padding: '2rem',
        paddingTop: '6rem'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: '#111827',
            borderRadius: '0.5rem',
            border: '1px solid #374151'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <Trash2 size={32} color="#ef4444" />
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
                Eliminar Informes
              </h1>
            </div>
            <p style={{ color: '#9ca3af', margin: 0 }}>
              Busca y elimina informes de los servicios de alerta. Esta acción no se puede deshacer.
            </p>
          </div>

          {/* Mensaje de estado */}
          {message && (
            <div style={{
              padding: '1rem',
              marginBottom: '1.5rem',
              borderRadius: '0.5rem',
              background: message.type === 'success' ? '#065f46' : '#7f1d1d',
              border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {message.type === 'success' ? (
                <CheckCircle size={20} color="#10b981" />
              ) : (
                <AlertTriangle size={20} color="#ef4444" />
              )}
              <span>{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Buscador */}
          <div style={{
            marginBottom: '1.5rem',
            position: 'relative'
          }}>
            <Search 
              size={20} 
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6b7280'
              }}
            />
            <input
              type="text"
              placeholder="Buscar por título o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 3rem',
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: '0.5rem',
                color: '#f9fafb',
                fontSize: '1rem'
              }}
            />
          </div>

          {/* Lista de informes */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              Cargando informes...
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              {searchTerm ? 'No se encontraron informes con ese término' : 'No hay informes disponibles'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredReports.map((report) => (
                <div
                  key={report._id}
                  style={{
                    padding: '1.5rem',
                    background: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
                        {report.title}
                      </h3>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: getCategoryColor(report.category),
                          color: '#fff'
                        }}
                      >
                        {getCategoryLabel(report.category)}
                      </span>
                      {!report.isPublished && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          background: '#6b7280',
                          color: '#fff'
                        }}>
                          Borrador
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                      <span>ID: {report._id}</span>
                      <span>•</span>
                      <span>Vistas: {report.views}</span>
                      <span>•</span>
                      <span>
                        {new Date(report.createdAt).toLocaleDateString('es-AR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(report._id, report.title)}
                    disabled={deleting === report._id}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: deleting === report._id ? '#6b7280' : '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: deleting === report._id ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (deleting !== report._id) {
                        e.currentTarget.style.background = '#dc2626';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (deleting !== report._id) {
                        e.currentTarget.style.background = '#ef4444';
                      }
                    }}
                  >
                    <Trash2 size={18} />
                    {deleting === report._id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Info */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: '0.5rem',
            color: '#9ca3af',
            fontSize: '0.875rem'
          }}>
            <strong>⚠️ Advertencia:</strong> Al eliminar un informe, también se eliminarán las notificaciones relacionadas. Esta acción es permanente y no se puede deshacer.
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const verification = await verifyAdminAccess(context);
  
  if (!verification.isAdmin) {
    return {
      redirect: {
        destination: verification.redirectTo || '/',
        permanent: false
      }
    };
  }

  return {
    props: {
      user: verification.user || null
    }
  };
};

export default DeleteReportsPage;

