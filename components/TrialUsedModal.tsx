import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import styles from './TrialUsedModal.module.css';

interface TrialUsedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  serviceName: string;
}

const TrialUsedModal: React.FC<TrialUsedModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  serviceName
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalCloseButton} onClick={onClose}>
          <X size={24} />
        </button>
        
        <div className={styles.modalIcon}>
          <div className={styles.iconCircle}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
        </div>

        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Prueba ya utilizada</h2>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            Ya usaste tu mes de prueba para el servicio <strong>{serviceName}</strong>.
            <br />
            Hacé click acá para pagar la suscripción mensual.
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.modalCancelButton} 
            onClick={onClose}
          >
            Cerrar
          </button>
          <button 
            className={styles.modalSubscribeButton} 
            onClick={() => {
              onSubscribe();
              onClose();
            }}
          >
            Suscribirme ahora
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialUsedModal;

