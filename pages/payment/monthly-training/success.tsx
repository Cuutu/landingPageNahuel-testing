import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle, Calendar, Users, DollarSign, ArrowRight, Home } from 'lucide-react';
import styles from '../../../styles/PaymentResult.module.css';

interface TrainingInfo {
  _id: string;
  title: string;
  monthName: string;
  year: number;
  price: number;
  classes: Array<{
    date: string;
    startTime: string;
    endTime: string;
    title: string;
  }>;
}

export default function MonthlyTrainingPaymentSuccess() {
  const router = useRouter();
  const { data: session } = useSession();
  const { training_id, payment_id, collection_status } = router.query;
  
  const [training, setTraining] = useState<TrainingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (training_id) {
      loadTrainingInfo();
    }
  }, [training_id]);

  const loadTrainingInfo = async () => {
    try {
      const response = await fetch(`/api/monthly-trainings?id=${training_id}`);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        setTraining(data.data[0]);
      } else {
        setError('No se pudo cargar la información del entrenamiento');
      }
    } catch (error) {
      console.error('Error cargando entrenamiento:', error);
      setError('Error cargando la información del entrenamiento');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner}></div>
          <p>Verificando tu pago...</p>
        </div>
      </div>
    );
  }

  if (error || !training) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h2>Error</h2>
          <p>{error || 'Información del entrenamiento no disponible'}</p>
          <Link href="/entrenamientos/swing-trading" className={styles.backButton}>
            Volver a Swing Trading
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>¡Pago Exitoso! - {training.title}</title>
      </Head>

      <div className={styles.successCard}>
        <div className={styles.successIcon}>
          <CheckCircle size={64} />
        </div>

        <h1>¡Pago Exitoso!</h1>
        <p className={styles.successMessage}>
          Te has inscrito exitosamente al entrenamiento mensual
        </p>

        <div className={styles.trainingInfo}>
          <h2>{training.title}</h2>
          <div className={styles.trainingDetails}>
            <div className={styles.detail}>
              <Calendar size={20} />
              <span>{training.monthName} {training.year}</span>
            </div>
            <div className={styles.detail}>
              <DollarSign size={20} />
              <span>${training.price} USD</span>
            </div>
            <div className={styles.detail}>
              <Users size={20} />
              <span>{training.classes.length} clases incluidas</span>
            </div>
          </div>
        </div>

        {payment_id && (
          <div className={styles.paymentInfo}>
            <h3>Información del Pago</h3>
            <div className={styles.paymentDetails}>
              <div className={styles.paymentDetail}>
                <span className={styles.label}>ID de Pago:</span>
                <span className={styles.value}>{payment_id}</span>
              </div>
              {collection_status && (
                <div className={styles.paymentDetail}>
                  <span className={styles.label}>Estado:</span>
                  <span className={styles.value}>
                    {collection_status === 'approved' ? 'Aprobado' : collection_status}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.nextSteps}>
          <h3>Próximos Pasos</h3>
          <div className={styles.stepsList}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h4>Confirmación por Email</h4>
                <p>Recibirás un email de confirmación con todos los detalles del entrenamiento</p>
              </div>
            </div>
            
            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h4>Grupo Privado</h4>
                <p>Te agregaremos al grupo privado donde compartiremos material y actualizaciones</p>
              </div>
            </div>
            
            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h4>Primera Clase</h4>
                <p>
                  La primera clase será el{' '}
                  {training.classes.length > 0 && (
                    <strong>
                      {new Date(training.classes[0].date).toLocaleDateString('es-AR')} 
                      {' '}a las {training.classes[0].startTime}
                    </strong>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.classesPreview}>
          <h3>Cronograma de Clases</h3>
          <div className={styles.classesList}>
            {training.classes.slice(0, 4).map((classItem, index) => (
              <div key={index} className={styles.classItem}>
                <div className={styles.classDate}>
                  {new Date(classItem.date).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </div>
                <div className={styles.classInfo}>
                  <span className={styles.classTitle}>{classItem.title}</span>
                  <span className={styles.classTime}>
                    {classItem.startTime} - {classItem.endTime}
                  </span>
                </div>
              </div>
            ))}
            
            {training.classes.length > 4 && (
              <div className={styles.moreClasses}>
                +{training.classes.length - 4} clases más
              </div>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/entrenamientos/swing-trading" className={styles.primaryButton}>
            <ArrowRight size={20} />
            Ver Más Entrenamientos
          </Link>
          
          <Link href="/" className={styles.secondaryButton}>
            <Home size={20} />
            Ir al Inicio
          </Link>
        </div>

        <div className={styles.supportInfo}>
          <p>
            ¿Tienes alguna pregunta? Contáctanos a{' '}
            <a href="mailto:soporte@lozanonahuel.com">soporte@lozanonahuel.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
