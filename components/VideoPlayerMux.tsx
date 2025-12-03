import React, { useEffect, useRef } from 'react';
import { isValidPlaybackId } from '@/lib/mux';

interface VideoPlayerMuxProps {
  /** @param playbackId - ID de reproducción de MUX */
  playbackId: string;
  /** @param autoplay - Reproducción automática */
  autoplay?: boolean;
  /** @param muted - Silenciado por defecto */
  muted?: boolean;
  /** @param controls - Mostrar controles */
  controls?: boolean;
  /** @param className - Clases CSS adicionales */
  className?: string;
  /** @param onError - Callback cuando hay error */
  onError?: (error: string) => void;
}

/**
 * Componente reproductor de video MUX
 * Utiliza el player oficial de MUX para reproducir videos
 */
const VideoPlayerMux: React.FC<VideoPlayerMuxProps> = ({
  playbackId,
  autoplay = false,
  muted = true,
  controls = true,
  className = '',
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Validar playback ID
    if (!isValidPlaybackId(playbackId)) {
      const errorMessage = 'PlaybackId inválido o no proporcionado';
      console.error('❌ Error en VideoPlayerMux:', errorMessage);
      onError?.(errorMessage);
      return;
    }

    // Importar dinámicamente el player de MUX
    const loadMuxPlayer = async () => {
      try {
        // Importar el elemento personalizado de MUX
        await import('@mux/mux-player');
        
        // console.log('✅ Player MUX cargado para playback ID:', playbackId);
      } catch (error) {
        const errorMessage = 'Error cargando el player de MUX';
        console.error('❌ Error cargando MUX player:', error);
        onError?.(errorMessage);
      }
    };

    loadMuxPlayer();
  }, [playbackId, onError]);

  // Si no hay playback ID válido, mostrar placeholder
  if (!isValidPlaybackId(playbackId)) {
    return (
      <div className={`video-placeholder ${className}`}>
        <div className="placeholder-content">
          <div className="placeholder-icon">🎥</div>
          <p>Video no disponible</p>
          <p className="placeholder-error">PlaybackId inválido</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-container ${className}`}>
      {/* Usamos el elemento personalizado mux-player */}
      <mux-player
        stream-type="on-demand"
        playback-id={playbackId}
        autoplay={autoplay}
        muted={muted}
        controls={controls}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
        }}
        onError={(e: any) => {
          console.error('❌ Error en reproductor MUX:', e);
          onError?.('Error reproduciendo el video');
        }}
        onLoadedMetadata={() => {
          // console.log('✅ Video MUX cargado correctamente');
        }}
      />

      <style jsx>{`
        .video-container {
          position: relative;
          width: 100%;
          height: 100%;
          background: #000;
          border-radius: var(--border-radius);
          overflow: hidden;
        }

        .video-placeholder {
          position: relative;
          width: 100%;
          height: 300px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .placeholder-content {
          text-align: center;
          color: var(--text-secondary);
        }

        .placeholder-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .placeholder-error {
          font-size: 0.875rem;
          color: var(--error-color);
          margin-top: 0.5rem;
        }

        /* Responsivo */
        @media (max-width: 768px) {
          .video-placeholder {
            height: 200px;
          }
          
          .placeholder-icon {
            font-size: 2rem;
          }
        }
      `}</style>
    </div>
  );
};

export default VideoPlayerMux; 