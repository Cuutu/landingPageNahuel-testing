import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '@/styles/YouTubeAutoCarousel.module.css';

interface Video {
  id: string;
  title: string;
}

interface YouTubeAutoCarouselProps {
  videos?: Video[];
  autoplayInterval?: number;
  className?: string;
}

/**
 * ✅ OPTIMIZADO: Componente reutilizable para carousel de YouTube
 * Extraído para evitar duplicación en múltiples páginas
 */
const YouTubeAutoCarousel: React.FC<YouTubeAutoCarouselProps> = ({
  videos = [
    { id: '0NpdClGWaY8', title: 'Video 1' },
    { id: 'jl3lUCIluAs', title: 'Video 2' },
    { id: '_AMDVmj9_jw', title: 'Video 3' },
    { id: 'sUktp76givU', title: 'Video 4' }
  ],
  autoplayInterval = 5000,
  className = ''
}) => {
  const [currentVideo, setCurrentVideo] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideo((prev) => (prev + 1) % videos.length);
    }, autoplayInterval);

    return () => clearInterval(interval);
  }, [videos.length, autoplayInterval]);

  const goToPrevious = () => {
    setCurrentVideo((prev) => (prev - 1 + videos.length) % videos.length);
  };

  const goToNext = () => {
    setCurrentVideo((prev) => (prev + 1) % videos.length);
  };

  // ✅ OPTIMIZADO: Construir URL del video actual con parámetros optimizados
  const buildVideoUrl = (videoId: string) => {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1',
      origin: typeof window !== 'undefined' ? window.location.origin : ''
    });
    // ✅ No autoplay en móvil para mejor rendimiento
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (!isMobile) {
      params.append('autoplay', '1');
      params.append('mute', '1');
    }
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  };

  return (
    <div className={`${styles.youtubeAutoCarousel} ${className}`}>
      <button 
        onClick={goToPrevious}
        className={styles.youtubeArrowLeft}
        aria-label="Video anterior"
      >
        <ChevronLeft size={24} />
      </button>
      
      <div className={styles.youtubeVideoFrame}>
        {/* ✅ OPTIMIZADO: Solo renderizar iframe del video activo */}
        <iframe
          key={currentVideo} // ✅ Key force re-render cuando cambia el video
          src={buildVideoUrl(videos[currentVideo].id)}
          title={videos[currentVideo].title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={styles.youtubeVideoPlayer}
          loading="lazy"
        />
      </div>
      
      <button 
        onClick={goToNext}
        className={styles.youtubeArrowRight}
        aria-label="Siguiente video"
      >
        <ChevronRight size={24} />
      </button>

      <div className={styles.youtubeIndicators}>
        {videos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentVideo(index)}
            className={`${styles.youtubeIndicator} ${
              index === currentVideo ? styles.youtubeIndicatorActive : ''
            }`}
            aria-label={`Ver video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(YouTubeAutoCarousel);

