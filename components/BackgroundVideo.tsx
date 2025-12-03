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
}

const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  videoSrc,
  posterSrc,
  className = '',
  autoPlay = true,
  muted = true,
  loop = true,
  showControls = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => setIsLoaded(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Configurar reproducción automática
    if (autoPlay) {
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
  }, [autoPlay]);

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

  return (
    <div className={`background-video-container ${className}`}>
      <video
        ref={videoRef}
        className="background-video"
        poster={posterSrc}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
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