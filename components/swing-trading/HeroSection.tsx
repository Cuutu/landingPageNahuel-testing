import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, Loader } from 'lucide-react';
import YouTubePlayer from '../YouTubePlayer';
import BackgroundVideo from './BackgroundVideo';
import styles from '../../styles/SwingTrading.module.css';

interface TrainingData {
  tipo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion: number;
  metricas: {
    rentabilidad: string;
    estudiantesActivos: string;
    entrenamientosRealizados: string;
    satisfaccion: string;
  };
  contenido: {
    modulos: number;
    lecciones: number;
    certificacion: boolean;
    nivelAcceso: string;
  };
}

interface HeroSectionProps {
  training: TrainingData;
  countdown: {
    days: number;
    hours: number;
    minutes: number;
  };
  startDateText: string;
  isEnrolled: boolean;
  checkingEnrollment: boolean;
  isProcessingPayment: boolean;
  onEnroll: () => void;
  heroVideo?: {
    youtubeId: string;
    title: string;
    description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
}

const HeroSection: React.FC<HeroSectionProps> = ({
  training,
  countdown,
  startDateText,
  isEnrolled,
  checkingEnrollment,
  isProcessingPayment,
  onEnroll,
  heroVideo
}) => {
  return (
    <section className={styles.heroSection}>
      <BackgroundVideo videoSrc="/logos/Diseño Web-LozanoNahuel-Entrenamientos-SwingTrading.mp4" />
      <div className={styles.container}>
        <motion.div 
          className={styles.heroContent}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>
              Swing Trading
            </h1>
            <p className={styles.heroDescription}>
              {training.descripcion}
            </p>
            
            <div className={styles.startDate}>
              Fecha de inicio: {startDateText}
            </div>
            
            <div className={styles.countdownContainer}>
              <div className={styles.countdownBox}>
                <span className={styles.countdownNumber}>{countdown.days}</span>
                <span className={styles.countdownLabel}>Días</span>
              </div>
              <div className={styles.countdownBox}>
                <span className={styles.countdownNumber}>{countdown.hours}</span>
                <span className={styles.countdownLabel}>Horas</span>
              </div>
              <div className={styles.countdownBox}>
                <span className={styles.countdownNumber}>{countdown.minutes}</span>
                <span className={styles.countdownLabel}>Minutos</span>
              </div>
            </div>
            <button 
              onClick={onEnroll}
              className={styles.enrollButton}
              disabled={checkingEnrollment || isProcessingPayment}
            >
              {isProcessingPayment ? (
                <>
                  <Loader size={20} className={styles.spinner} />
                  Procesando...
                </>
              ) : (
                <>
                  Inscribirme Ahora &gt;
                </>
              )}
            </button>
          </div>
          <div className={styles.heroVideo}>
            <div className={styles.videoContainer}>
              {heroVideo && heroVideo.youtubeId ? (
                <YouTubePlayer
                  videoId={heroVideo.youtubeId}
                  title={heroVideo.title || 'Swing Trading - Video Promocional'}
                  autoplay={heroVideo.autoplay || false}
                  muted={heroVideo.muted || true}
                  loop={heroVideo.loop || false}
                  className={styles.videoPlayer}
                />
              ) : (
                <YouTubePlayer
                  videoId="dQw4w9WgXcQ"
                  title="Swing Trading - Video Promocional"
                  autoplay={false}
                  muted={true}
                  loop={false}
                  className={styles.videoPlayer}
                />
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection; 