import React, { useState } from 'react';
import styles from '@/styles/YouTubePlayer.module.css';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  width?: string;
  height?: string;
  className?: string;
}

/**
 * Componente para reproducir videos de YouTube
 * @param videoId - ID del video de YouTube
 * @param title - Título del video
 * @param autoplay - Reproducir automáticamente
 * @param muted - Silenciar el video
 * @param loop - Repetir el video
 * @param controls - Mostrar controles
 * @param width - Ancho del reproductor
 * @param height - Alto del reproductor
 * @param className - Clase CSS adicional
 */
export default function YouTubePlayer({
  videoId,
  title = 'Video de YouTube',
  autoplay = false,
  muted = false,
  loop = false,
  controls = true,
  width = '100%',
  height = '100%',
  className = ''
}: YouTubePlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Detectar si está dentro de un videoContainer (por la className)
  // Si tiene className con "videoPlayer" o "video", asumimos que está en un videoContainer
  const isInVideoContainer = Boolean(className && (className.includes('videoPlayer') || className.includes('video')));

  // Construir la URL del video con parámetros
  const buildVideoUrl = () => {
    const params = new URLSearchParams({
      rel: '0', // No mostrar videos relacionados
      modestbranding: '1', // Marca de YouTube discreta
      showinfo: '0', // No mostrar información del video
      enablejsapi: '1', // Habilitar API de JavaScript
      origin: window.location.origin
    });

    if (autoplay) params.append('autoplay', '1');
    if (muted) params.append('mute', '1');
    if (loop) params.append('loop', '1');
    if (loop) params.append('playlist', videoId); // Necesario para el loop
    if (!controls) params.append('controls', '0');

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className={`${styles.errorContainer} ${className}`}>
        <div className={styles.errorContent}>
          <div className={styles.errorIcon}>📺</div>
          <h3>Error al cargar el video</h3>
          <p>No se pudo cargar el video de YouTube. Por favor, intenta nuevamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${isInVideoContainer ? styles.playerContainerInContainer : styles.playerContainer} ${className}`}
    >
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando video...</p>
        </div>
      )}
      
      <iframe
        src={buildVideoUrl()}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={handleLoad}
        onError={handleError}
        className={styles.iframe}
        style={{
          display: isLoading ? 'none' : 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          margin: 0,
          padding: 0
        }}
      />
    </div>
  );
} 