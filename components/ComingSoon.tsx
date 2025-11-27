import React from 'react';
import Link from 'next/link';
import { Home, Clock } from 'lucide-react';
import styles from './ComingSoon.module.css';

interface ComingSoonProps {
  title?: string;
  message?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ 
  title = 'Próximamente',
  message = 'Estamos trabajando en esta sección. Muy pronto estará disponible.'
}) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconContainer}>
          <Clock size={48} className={styles.icon} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttonContainer}>
          <Link href="/" className={styles.homeButton}>
            <Home size={20} />
            <span>Volver al Inicio</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;

