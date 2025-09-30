import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight } from 'lucide-react';
import styles from '../../styles/SwingTrading.module.css';

interface TrainingData {
  precio: number;
  metricas: {
    estudiantesActivos: string;
  };
}

interface CTASectionProps {
  training: TrainingData;
  isEnrolled: boolean;
  checkingEnrollment: boolean;
  onEnroll: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({
  training,
  isEnrolled,
  checkingEnrollment,
  onEnroll
}) => {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.container} style={{ position: 'relative', zIndex: 2 }}>
        <motion.div 
          className={styles.ctaContent}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className={styles.ctaTitle}>
            ¿Listo para Transformar tu Trading?
          </h2>
          <p className={styles.ctaDescription}>
            Únete a los {training.metricas.estudiantesActivos}+ estudiantes que ya están aplicando 
            estas estrategias exitosamente.
          </p>
          <div className={styles.ctaPrice}>
            <span className={styles.ctaPriceAmount}>${training.precio} ARS</span>
            <span className={styles.ctaPriceDescription}>
              Programa completo • Acceso de por vida • Certificación incluida
            </span>
          </div>
          <button 
            onClick={onEnroll}
            className={styles.ctaButton}
            disabled={checkingEnrollment}
          >
            <Users size={20} />
            {checkingEnrollment 
              ? 'Verificando...' 
              : isEnrolled 
                ? 'Entrar a la Reunión' 
                : 'Comenzar Ahora'
            }
            <ArrowRight size={20} />
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection; 