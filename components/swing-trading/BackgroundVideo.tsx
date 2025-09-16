import React from 'react';
import styles from '../../styles/SwingTrading.module.css';

interface BackgroundVideoProps {
  videoSrc: string;
}

const BackgroundVideo: React.FC<BackgroundVideoProps> = ({ videoSrc }) => {
  return (
    <div className={styles.backgroundVideoContainer}>
      <video
        className={styles.backgroundVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={videoSrc} type="video/mp4" />
        Tu navegador no soporta videos HTML5.
      </video>
      <div className={styles.videoOverlay} />
    </div>
  );
};

export default BackgroundVideo;
