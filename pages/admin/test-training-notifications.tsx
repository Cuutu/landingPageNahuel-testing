import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { 
  Bell, 
  GraduationCap, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  ArrowLeft
} from 'lucide-react';
import styles from '../../styles/Admin.module.css';

interface TestResult {
  success: boolean;
  message: string;
  testType: string;
  details?: any;
}

interface TestTrainingNotificationsProps {
  user: any;
}

const TestTrainingNotifications: React.FC<TestTrainingNotificationsProps> = ({ user }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');

  const runTest = async (testType: 'enrollment' | 'schedule') => {
    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/test-training-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType,
          userEmail: testEmail || undefined,
          userName: testName || undefined
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: result.message,
          testType: result.testType,
          details: result.details
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Error desconocido',
          testType: testType
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Error de conexión',
        testType: testType
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.adminContainer}>
      <div className={styles.header}>
        <button 
                      onClick={() => router.push('/admin/dashboard')}
          className={styles.backButton}
        >
          <ArrowLeft size={20} />
          Volver al Admin
        </button>
        <h1 className={styles.title}>
          <Bell size={32} />
          Pruebas de Notificaciones de Entrenamientos
        </h1>
        <p className={styles.subtitle}>
          Verifica que el sistema de notificaciones funcione correctamente
        </p>
      </div>

      <div className={styles.content}>
        {/* Configuración de prueba */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className={styles.sectionTitle}>
            <GraduationCap size={24} />
            Configuración de Prueba
          </h2>
          
          <div className={styles.formGroup}>
            <label htmlFor="testEmail">Email de prueba (opcional):</label>
            <input
              id="testEmail"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className={styles.input}
            />
            <small>Si no se especifica, se usará un email de prueba por defecto</small>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="testName">Nombre de prueba (opcional):</label>
            <input
              id="testName"
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Usuario de Prueba"
              className={styles.input}
            />
            <small>Si no se especifica, se usará un nombre por defecto</small>
          </div>
        </motion.div>

        {/* Pruebas disponibles */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className={styles.sectionTitle}>
            <CheckCircle size={24} />
            Pruebas Disponibles
          </h2>

          <div className={styles.testGrid}>
            {/* Prueba de inscripción */}
            <div className={styles.testCard}>
              <div className={styles.testHeader}>
                <GraduationCap size={32} color="#8B0000" />
                <h3>Prueba de Inscripción</h3>
              </div>
              <p>Simula la inscripción de un usuario a un entrenamiento y verifica que se creen las notificaciones correspondientes.</p>
              
              <div className={styles.testDetails}>
                <h4>Lo que se prueba:</h4>
                <ul>
                  <li>✅ Notificación para el usuario</li>
                  <li>✅ Email de bienvenida</li>
                  <li>✅ Notificación para el admin</li>
                  <li>✅ Email de notificación al admin</li>
                </ul>
              </div>

              <button
                onClick={() => runTest('enrollment')}
                disabled={isLoading}
                className={`${styles.primaryButton} ${styles.fullWidth}`}
              >
                {isLoading ? (
                  <>
                    <Loader size={20} className={styles.spinner} />
                    Probando...
                  </>
                ) : (
                  <>
                    <GraduationCap size={20} />
                    Probar Inscripción
                  </>
                )}
              </button>
            </div>

            {/* Prueba de horario */}
            <div className={styles.testCard}>
              <div className={styles.testHeader}>
                <Calendar size={32} color="#059669" />
                <h3>Prueba de Nuevo Horario</h3>
              </div>
              <p>Simula la creación de un nuevo horario de entrenamiento y verifica que se notifique a los usuarios inscritos.</p>
              
              <div className={styles.testDetails}>
                <h4>Lo que se prueba:</h4>
                <ul>
                  <li>✅ Notificación global para usuarios</li>
                  <li>✅ Emails a usuarios inscritos</li>
                  <li>✅ Detalles del horario</li>
                  <li>✅ Enlaces de reserva</li>
                </ul>
              </div>

              <button
                onClick={() => runTest('schedule')}
                disabled={isLoading}
                className={`${styles.primaryButton} ${styles.fullWidth}`}
              >
                {isLoading ? (
                  <>
                    <Loader size={20} className={styles.spinner} />
                    Probando...
                  </>
                ) : (
                  <>
                    <Calendar size={20} />
                    Probar Horario
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Resultados */}
        {testResult && (
          <motion.div 
            className={`${styles.section} ${testResult.success ? styles.successSection : styles.errorSection}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className={styles.sectionTitle}>
              {testResult.success ? (
                <CheckCircle size={24} color="#059669" />
              ) : (
                <AlertCircle size={24} color="#ef4444" />
              )}
              Resultado de la Prueba
            </h2>

            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <span className={styles.resultType}>
                  {testResult.testType === 'enrollment' ? 'Inscripción' : 'Horario'}
                </span>
                <span className={`${styles.resultStatus} ${testResult.success ? styles.success : styles.error}`}>
                  {testResult.success ? 'Éxito' : 'Error'}
                </span>
              </div>

              <p className={styles.resultMessage}>{testResult.message}</p>

              {testResult.details && (
                <div className={styles.resultDetails}>
                  <h4>Detalles:</h4>
                  <pre className={styles.resultJson}>
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Información adicional */}
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className={styles.sectionTitle}>
            <AlertCircle size={24} />
            Información Importante
          </h2>

          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <h4>📧 Emails</h4>
              <p>Los emails se envían a las direcciones configuradas en las variables de entorno. Verifica que SMTP_USER y ADMIN_EMAIL estén configurados.</p>
            </div>

            <div className={styles.infoCard}>
              <h4>🔔 Notificaciones</h4>
              <p>Las notificaciones se crean en la base de datos y aparecerán en el panel de notificaciones de los usuarios correspondientes.</p>
            </div>

            <div className={styles.infoCard}>
              <h4>👥 Usuarios</h4>
              <p>Para la prueba de horarios, se notificará a todos los usuarios que tengan entrenamientos activos en la base de datos.</p>
            </div>

            <div className={styles.infoCard}>
              <h4>🧪 Pruebas</h4>
              <p>Estas pruebas son seguras y no afectan el funcionamiento normal del sistema. Solo crean notificaciones de prueba.</p>
            </div>
          </div>
        </motion.div>
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

export default TestTrainingNotifications; 