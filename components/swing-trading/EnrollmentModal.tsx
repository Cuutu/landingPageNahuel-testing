import React from 'react';
import styles from '../../styles/SwingTrading.module.css';

interface FormData {
  nombre: string;
  email: string;
  telefono: string;
  experienciaTrading: string;
  objetivos: string;
  nivelExperiencia: string;
  consulta: string;
}

interface EnrollmentModalProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  isEnrolling: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  formData,
  setFormData,
  isEnrolling,
  onSubmit,
  onClose
}) => {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h3>Inscripción a Zero 2 Trader</h3>
          <button 
            onClick={onClose}
            className={styles.closeButton}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={onSubmit} className={styles.enrollForm}>
          <div className={styles.formGroup}>
            <label>Nombre completo</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Teléfono</label>
            <input
              type="tel"
              value={formData.telefono}
              onChange={(e) => setFormData({...formData, telefono: e.target.value})}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Nivel de experiencia en trading</label>
            <select
              value={formData.nivelExperiencia}
              onChange={(e) => setFormData({...formData, nivelExperiencia: e.target.value})}
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label>¿Cuáles son tus objetivos con el trading?</label>
            <textarea
              value={formData.objetivos}
              onChange={(e) => setFormData({...formData, objetivos: e.target.value})}
              placeholder="Describe qué esperas lograr con este entrenamiento..."
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Experiencia previa (opcional)</label>
            <textarea
              value={formData.experienciaTrading}
              onChange={(e) => setFormData({...formData, experienciaTrading: e.target.value})}
              placeholder="Cuéntanos sobre tu experiencia previa en trading..."
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Consulta adicional (opcional)</label>
            <textarea
              value={formData.consulta}
              onChange={(e) => setFormData({...formData, consulta: e.target.value})}
              placeholder="¿Tienes alguna pregunta específica?"
            />
          </div>
          
          <div className={styles.formActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isEnrolling}
              className={styles.submitButton}
            >
              {isEnrolling ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnrollmentModal; 