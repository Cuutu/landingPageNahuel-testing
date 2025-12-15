import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface BackgroundVideoProps {
  videoSrc: string;
  posterSrc?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  showControls?: boolean;
  lazyLoad?: boolean; // ✅ NUEVO: Lazy loading
}

const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  videoSrc,
  posterSrc,
  className = '',
  autoPlay = true,
  muted = true,
  loop = true,
  showControls = false,
  lazyLoad = true // ✅ Por defecto activado
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazyLoad); // ✅ Cargar inmediatamente si no hay lazy loading
  const [isMobile, setIsMobile] = useState(false);

  // ✅ NUEVO: Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    };
    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // ✅ NUEVO: IntersectionObserver para lazy loading
  useEffect(() => {
    if (!lazyLoad || shouldLoad) return;
    if (typeof window === 'undefined') return;
    
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px'
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [lazyLoad, shouldLoad]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return; // ✅ Solo configurar si el video debe cargarse

    const handleLoadedData = () => setIsLoaded(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // ✅ OPTIMIZADO: En móvil, no autoplay para mejor rendimiento
    const shouldAutoplay = autoPlay && !isMobile;
    
    // Configurar reproducción automática
    if (shouldAutoplay) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // console.log('Autoplay prevented:', error);
          setIsPlaying(false);
        });
      }
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [autoPlay, shouldLoad, isMobile]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // ✅ Mostrar solo poster si no se debe cargar aún (lazy loading)
  if (!shouldLoad) {
    return (
      <div 
        ref={containerRef}
        className={`background-video-container ${className}`}
        style={{
          backgroundImage: posterSrc ? `url(${posterSrc})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className={`background-video-container ${className}`}>
      <video
        ref={videoRef}
        className="background-video"
        poster={posterSrc}
        autoPlay={autoPlay && !isMobile} // ✅ No autoplay en móvil
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata" // ✅ Solo precargar metadata
        disablePictureInPicture
        disableRemotePlayback
      >
        <source src={videoSrc} type="video/mp4" />
        Tu navegador no soporta videos HTML5.
      </video>
      
      {showControls && (
        <div className="video-controls">
          <button 
            onClick={togglePlayPause}
            className="control-button"
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button 
            onClick={toggleMute}
            className="control-button"
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      )}
      
      <style jsx>{`
        .background-video-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 0;
        }
        
        .background-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        
        .video-controls {
          position: absolute;
          bottom: 20px;
          right: 20px;
          display: flex;
          gap: 10px;
          z-index: 10;
        }
        
        .control-button {
          background: rgba(0, 0, 0, 0.6);
          border: none;
          color: white;
          padding: 8px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .control-button:hover {
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.1);
        }
        
        @media (max-width: 768px) {
          .video-controls {
            bottom: 10px;
            right: 10px;
          }
          
          .control-button {
            padding: 6px;
          }
        }
      `}</style>
    </div>
  );
};

export default BackgroundVideo; 