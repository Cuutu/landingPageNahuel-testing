import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Book, Target } from 'lucide-react';
import styles from './TrainingRoadmap.module.css';

interface RoadmapTopic {
  titulo: string;
  descripcion?: string;
}

interface RoadmapModule {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  lecciones: number;
  temas: RoadmapTopic[];
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: number;
  orden: number;
  activo: boolean;
}

interface TrainingRoadmapProps {
  modules: RoadmapModule[];
  onModuleClick?: (moduleId: number) => void;
  title?: string;
  description?: string;
}

const TrainingRoadmap: React.FC<TrainingRoadmapProps> = ({
  modules,
  onModuleClick,
  title = "Roadmap de Aprendizaje",
  description = "Progresión estructurada diseñada para llevarte de principiante a trader avanzado"
}) => {
  const [expandedModule, setExpandedModule] = useState<number | null>(null);

  const toggleModule = (moduleId: number) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Básico':
        return '#10b981';
      case 'Intermedio':
        return '#f59e0b';
      case 'Avanzado':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className={styles.roadmapContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.modulesList}>
        {modules.map((module, index) => {
          const isExpanded = expandedModule === module.id;
          
          return (
            <div 
              key={module.id} 
              className={styles.moduleCard}
            >
              <div 
                className={styles.moduleHeader}
                onClick={() => toggleModule(module.id)}
              >
                <div className={styles.moduleLeft}>
                  <div className={styles.expandIcon}>
                    {isExpanded ? (
                      <ChevronDown size={20} className={styles.chevronIcon} />
                    ) : (
                      <ChevronRight size={20} className={styles.chevronIcon} />
                    )}
                  </div>
                  
                  <div className={styles.moduleInfo}>
                    <div className={styles.moduleTitleRow}>
                      <h3 className={styles.moduleTitle}>
                        Módulo {module.orden}: {module.titulo}
                      </h3>
                      <span 
                        className={styles.difficultyBadge}
                        style={{ backgroundColor: getDifficultyColor(module.dificultad) }}
                      >
                        {module.dificultad}
                      </span>
                    </div>
                    <p className={styles.moduleDescription}>
                      {module.descripcion}
                    </p>
                  </div>
                </div>

                <div className={styles.moduleRight}>
                  <div className={styles.moduleStats}>
                    <div className={styles.statItem}>
                      <Clock size={16} />
                      <span>{module.duracion}</span>
                    </div>
                    <div className={styles.statItem}>
                      <Book size={16} />
                      <span>{module.lecciones} lecciones</span>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className={styles.moduleContent}>
                  <div className={styles.topicsSection}>
                    <h4 className={styles.topicsTitle}>
                      <Target size={18} />
                      Temas a cubrir:
                    </h4>
                    <div className={styles.topicsList}>
                      {module.temas.map((tema, topicIndex) => (
                        <div key={topicIndex} className={styles.topicItem}>
                          <span className={styles.topicBullet}>•</span>
                          <div className={styles.topicContent}>
                            <span className={styles.topicText}>{tema.titulo}</span>
                            {tema.descripcion && (
                              <span className={styles.topicDescription}>{tema.descripcion}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {module.prerequisito && (
                    <div className={styles.prerequisiteSection}>
                      <p className={styles.prerequisiteText}>
                        <strong>Prerequisito:</strong> Completar módulo anterior
                      </p>
                    </div>
                  )}

                  {onModuleClick && (
                    <div className={styles.actionSection} style={{ display: 'none' }}>
                      <button 
                        className={styles.actionButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          onModuleClick(module.id);
                        }}
                      >
                        Ver Módulo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.footerStats}>
        <p className={styles.statsText}>
          {(() => {
            const totalWeeks = modules.reduce((acc, module) => {
              const str = (module.duracion || '').toLowerCase();
              const match = str.match(/(\d+)\s*semana/);
              const weeks = match ? parseInt(match[1], 10) : 0;
              return acc + (isNaN(weeks) ? 0 : weeks);
            }, 0);
            return `Total: ${totalWeeks} semanas`;
          })()}
        </p>
      </div>
    </div>
  );
};

export default TrainingRoadmap; 