import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useRouter } from 'next/router';

interface MigrateReportsPageProps {
  user: any;
}

const MigrateReportsPage = ({ user }: MigrateReportsPageProps) => {
  const router = useRouter();
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const executeMigration = async () => {
    setMigrating(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/reports/migrate-categories', {
        method: 'POST',
        credentials: 'same-origin',
      });

      const data = await response.json();
      setResult(data);

      if (response.ok) {
        alert(`✅ Migración exitosa: ${data.data.totalMigrated} informes actualizados`);
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error ejecutando migración:', error);
      alert('❌ Error ejecutando migración');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>🔄 Migración de Categorías de Informes</h1>
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '1rem', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h3>ℹ️ ¿Qué hace esta migración?</h3>
        <ul>
          <li>📊 Encuentra informes sin categoría</li>
          <li>🏷️ Les asigna categorías basándose en título/contenido:</li>
          <ul>
            <li><strong>smart-money</strong>: "smart money", "flujo", "institucional"</li>
            <li><strong>trader-call</strong>: "trader call", "señal", "trade"</li>
            <li><strong>cash-flow</strong>: "cash flow", "flujo de caja"</li>
            <li><strong>general</strong>: otros informes</li>
          </ul>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <button 
          onClick={executeMigration}
          disabled={migrating}
          style={{
            background: migrating ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '1rem 2rem',
            borderRadius: '8px',
            fontSize: '1.1rem',
            cursor: migrating ? 'not-allowed' : 'pointer'
          }}
        >
          {migrating ? '🔄 Ejecutando Migración...' : '🚀 Ejecutar Migración'}
        </button>
      </div>

      {result && (
        <div style={{ 
          background: result.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
          color: result.success ? '#155724' : '#721c24',
          padding: '1rem',
          borderRadius: '8px',
          marginTop: '2rem'
        }}>
          <h3>{result.success ? '✅ Migración Exitosa' : '❌ Error en Migración'}</h3>
          <p><strong>Mensaje:</strong> {result.message}</p>
          
          {result.data && (
            <div>
              <p><strong>📊 Informes encontrados:</strong> {result.data.totalFound}</p>
              <p><strong>✅ Informes migrados:</strong> {result.data.totalMigrated}</p>
              
              {result.data.results && result.data.results.length > 0 && (
                <details style={{ marginTop: '1rem' }}>
                  <summary>📋 Ver detalles de migración</summary>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflow: 'auto', 
                    marginTop: '1rem',
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '4px'
                  }}>
                    {result.data.results.map((item: any, index: number) => (
                      <div key={index} style={{ 
                        borderBottom: '1px solid #eee', 
                        padding: '0.5rem 0' 
                      }}>
                        <strong>{item.title}</strong>
                        <br />
                        <small>
                          {item.error ? (
                            <span style={{ color: '#dc3545' }}>❌ Error: {item.error}</span>
                          ) : (
                            <span>
                              {item.oldCategory} → <strong>{item.newCategory}</strong>
                            </span>
                          )}
                        </small>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button 
          onClick={() => router.push('/alertas/smart-money')}
          style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          🎯 Ir a Smart Money
        </button>
      </div>
    </div>
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
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};

export default MigrateReportsPage; 