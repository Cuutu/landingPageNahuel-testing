import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Copy } from 'lucide-react';
import styles from './CopyNotification.module.css';

interface CopyNotificationProps {
  isVisible: boolean;
  itemName: string;
  onClose: () => void;
}

const CopyNotification: React.FC<CopyNotificationProps> = ({
  isVisible,
  itemName,
  onClose
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Auto-cerrar después de 3 segundos

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={styles.notification}
        >
          <div className={styles.notificationContent}>
            <div className={styles.notificationIcon}>
              <CheckCircle size={24} />
            </div>
            <div className={styles.notificationText}>
              <div className={styles.notificationTitle}>¡Copiado!</div>
              <div className={styles.notificationSubtitle}>
                Has copiado <strong>{itemName}</strong>
              </div>
            </div>
            <button 
              className={styles.notificationClose}
              onClick={onClose}
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CopyNotification;
