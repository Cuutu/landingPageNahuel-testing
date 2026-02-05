import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { toast } from 'react-hot-toast';
import styles from '@/styles/AdminDashboard.module.css';

interface ExpulsionResult {
  userId: string;
  email: string;
  telegramUserId: number;
  service: string;
  success: boolean;
  error?: string;
}

interface ExpulsionResponse {
  success: boolean;
  message: string;
  summary: {
    totalChecked: number;
    expelled: number;
    errors: number;
    dryRun: boolean;
    verbose: boolean;
  };
  results: ExpulsionResult[];
  executedAt: string;
}

interface TelegramExpulsionPageProps {
  user: any;
}

export default function TelegramExpulsionPage({ user }: TelegramExpulsionPageProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExpulsionResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'expelled' | 'errors' | 'active'>('all');
  const [dryRun, setDryRun] = useState(false);
  const [verbose, setVerbose] = useState(true);

  const runExpulsion = async () => {
    if (!dryRun && !confirm('¿Estás seguro de ejecutar la expulsión de usuarios? Esta acción expulsará usuarios reales de Telegram.')) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dryRun) params.append('dryRun', 'true');
      if (verbose) params.append('verbose', 'true');

      const response = await fetch(`/api/admin/telegram-expulsion?${params.toString()}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al ejecutar expulsión');
      }

      const result: ExpulsionResponse = await response.json();
      setData(result);
      
      if (dryRun) {
        toast.success(`Simulación completada: ${result.summary.expelled} usuarios serían expulsados`);
      } else {
        toast.success(`Expulsión completada: ${result.summary.expelled} usuarios expulsados`);
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al ejecutar expulsión');
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = data?.results.filter(result => {
    if (filter === 'expelled') return result.success && !result.error?.includes('NO expulsado') && !result.error?.includes('DRY-RUN');
    if (filter === 'errors') return !result.success;
    if (filter === 'active') return result.error?.includes('tiene suscripción activa');
    return true;
  }) || [];

  const getStatusBadge = (result: ExpulsionResult) => {
    if (!result.success) {
      return <span style={{ backgroundColor: '#dc3545', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>❌ Error</span>;
    }
    if (result.error?.includes('tiene suscripción activa')) {
      return <span style={{ backgroundColor: '#28a745', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>✅ Activo</span>;
    }
    if (result.error?.includes('DRY-RUN')) {
      return <span style={{ backgroundColor: '#ffc107', color: 'black', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>🧪 Simulado</span>;
    }
    return <span style={{ backgroundColor: '#17a2b8', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>🚫 Expulsado</span>;
  };

  return (
    <>
      <Head>
        <title>Expulsión de Telegram - Admin</title>
      </Head>
      <Navbar />
      <div className={styles.container}>
      <div className={styles.header}>
        <h1>Expulsión de Usuarios de Telegram</h1>
        <p>Gestiona la expulsión automática de usuarios con suscripciones expiradas</p>
      </div>

      <div className={styles.card}>
        <div style={{ marginBottom: '20px' }}>
          <h2>Configuración</h2>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              <span>Modo Dry-Run (simulación sin expulsar)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={verbose}
                onChange={(e) => setVerbose(e.target.checked)}
              />
              <span>Modo Verbose (ver todos los usuarios)</span>
            </label>
          </div>
          <button
            onClick={runExpulsion}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: dryRun ? '#ffc107' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Ejecutando...' : dryRun ? '🧪 Ejecutar Simulación' : '🚫 Ejecutar Expulsión'}
          </button>
        </div>

        {data && (
          <div style={{ marginTop: '30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>{data.summary.totalChecked}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>Usuarios Verificados</div>
              </div>
              <div style={{ padding: '15px', backgroundColor: '#d4edda', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#155724' }}>{data.summary.expelled}</div>
                <div style={{ fontSize: '14px', color: '#155724' }}>Expulsados</div>
              </div>
              <div style={{ padding: '15px', backgroundColor: '#f8d7da', borderRadius: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#721c24' }}>{data.summary.errors}</div>
                <div style={{ fontSize: '14px', color: '#721c24' }}>Errores</div>
              </div>
              <div style={{ padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '8px' }}>
                <div style={{ fontSize: '14px', color: '#0c5460' }}>
                  Ejecutado: {new Date(data.executedAt).toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            {data.results.length > 0 && (
              <div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setFilter('all')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: filter === 'all' ? '#007bff' : '#e9ecef',
                      color: filter === 'all' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Todos ({data.results.length})
                  </button>
                  <button
                    onClick={() => setFilter('expelled')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: filter === 'expelled' ? '#17a2b8' : '#e9ecef',
                      color: filter === 'expelled' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Expulsados ({data.results.filter(r => r.success && !r.error?.includes('NO expulsado') && !r.error?.includes('DRY-RUN')).length})
                  </button>
                  <button
                    onClick={() => setFilter('active')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: filter === 'active' ? '#28a745' : '#e9ecef',
                      color: filter === 'active' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Con Suscripción Activa ({data.results.filter(r => r.error?.includes('tiene suscripción activa')).length})
                  </button>
                  <button
                    onClick={() => setFilter('errors')}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: filter === 'errors' ? '#dc3545' : '#e9ecef',
                      color: filter === 'errors' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Errores ({data.summary.errors})
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Email</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Telegram ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Servicio</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Estado</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Detalles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((result, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '12px' }}>{result.email}</td>
                          <td style={{ padding: '12px' }}>{result.telegramUserId}</td>
                          <td style={{ padding: '12px' }}>{result.service}</td>
                          <td style={{ padding: '12px' }}>{getStatusBadge(result)}</td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>
                            {result.error || 'Expulsado exitosamente'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
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
      user: verification.user || verification.session?.user,
    },
  };
};
