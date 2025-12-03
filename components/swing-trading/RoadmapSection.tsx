import React from 'react';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';
import TrainingRoadmap from '../TrainingRoadmap';
import styles from '../../styles/SwingTrading.module.css';

interface RoadmapModule {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  lecciones: number;
  temas: Array<{
    titulo: string;
    descripcion?: string;
  }>;
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: number;
  orden: number;
  activo: boolean;
}

interface RoadmapSectionProps {
  roadmapModules: RoadmapModule[];
  loadingRoadmap: boolean;
  roadmapError: string;
  onRetry: () => void;
}

const RoadmapSection: React.FC<RoadmapSectionProps> = ({
  roadmapModules,
  loadingRoadmap,
  roadmapError,
  onRetry
}) => {
  const handleModuleClick = (moduleId: number) => {
    // console.log(`Accediendo al módulo ${moduleId}`);
    // Aquí se implementaría la navegación al módulo específico
  };

  return (
    <section className={styles.roadmapSection}>
      <div className={styles.container}>
        {loadingRoadmap ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.loadingContainer}>
              <Loader size={40} className={styles.loadingSpinner} />
              <p>Cargando roadmap de aprendizaje...</p>
            </div>
          </motion.div>
        ) : roadmapError ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>{roadmapError}</p>
              <button onClick={onRetry} className={styles.retryButton}>
                Reintentar
              </button>
            </div>
          </motion.div>
        ) : roadmapModules.length > 0 ? (
          <TrainingRoadmap
            modules={roadmapModules}
            onModuleClick={handleModuleClick}
            title="Roadmap de Zero 2 Trader"
            description="Progresión estructurada diseñada para llevarte de cero a operar con independencia total"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.noRoadmapContainer}>
              <p>No hay roadmap disponible para este entrenamiento.</p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default RoadmapSection; 