import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { Trash2, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import styles from '@/styles/Admin.module.css';

interface CleanSlotsPageProps {
  user: any;
}

export default function CleanSlotsPage({ user }: CleanSlotsPageProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleCleanSlots = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los horarios disponibles? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsCleaning(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/admin/clean-available-slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Error al limpiar los horarios');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <>
      <Head>
        <title>Limpiar Horarios - Admin</title>
      </Head>

      <div className={styles.adminContainer}>
        <div className={styles.adminHeader}>
          <h1 className={styles.adminTitle}>
            <Trash2 size={32} />
            Limpiar Horarios Disponibles
          </h1>
          <p className={styles.adminSubtitle}>
            Eliminar todos los horarios hardcodeados de la base de datos
          </p>
        </div>

        <div className={styles.adminContent}>
          <div className={styles.warningCard}>
            <AlertTriangle size={48} className={styles.warningIcon} />
            <h2>⚠️ ADVERTENCIA CRÍTICA</h2>
            <p>
              Esta acción eliminará <strong>TODOS</strong> los horarios disponibles de la base de datos.
            </p>
            <ul>
              <li>✅ Se eliminarán todos los horarios hardcodeados</li>
              <li>✅ Podrás crear nuevos horarios manualmente</li>
              <li>❌ Esta acción NO se puede deshacer</li>
              <li>❌ Se perderán todas las reservas existentes</li>
            </ul>
          </div>

          <div className={styles.actionSection}>
            <button
              onClick={handleCleanSlots}
              disabled={isCleaning}
              className={`${styles.dangerButton} ${isCleaning ? styles.disabled : ''}`}
            >
              {isCleaning ? (
                <>
                  <Loader size={20} className={styles.spinner} />
                  Limpiando...
                </>
              ) : (
                <>
                  <Trash2 size={20} />
                  LIMPIAR TODOS LOS HORARIOS
                </>
              )}
            </button>
          </div>

          {error && (
            <div className={styles.errorCard}>
              <h3>❌ Error</h3>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className={styles.successCard}>
              <CheckCircle size={48} className={styles.successIcon} />
              <h3>✅ Limpieza Completada</h3>
              <p><strong>{result.message}</strong></p>
              <div className={styles.resultDetails}>
                <p><strong>Documentos eliminados:</strong> {result.deletedCount}</p>
                <p><strong>Documentos restantes:</strong> {result.remainingCount}</p>
              </div>
              {result.sampleDeleted && result.sampleDeleted.length > 0 && (
                <div className={styles.sampleData}>
                  <h4>Ejemplos de datos eliminados:</h4>
                  <ul>
                    {result.sampleDeleted.map((doc: any, index: number) => (
                      <li key={index}>
                        {doc.date} {doc.time} - {doc.serviceType} 
                        ({doc.available ? 'Disponible' : 'Reservado'})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className={styles.infoSection}>
            <h3>📝 Próximos Pasos</h3>
            <p>Después de limpiar la base de datos:</p>
            <ol>
              <li>Ve a la página de consultoría financiera</li>
              <li>Verifica que no aparezcan horarios</li>
              <li>Crea nuevos horarios manualmente desde el admin</li>
              <li>Prueba el calendario con los nuevos horarios</li>
            </ol>
          </div>
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