import React, { useState, useEffect, useRef } from 'react';
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
  fillContainer?: boolean; // Prop para indicar si debe llenar el contenedor padre
  volume?: number; // Volumen del video (0-100)
  lazyLoad?: boolean; // ✅ NUEVO: Cargar solo cuando está en viewport
  priority?: boolean; // ✅ NUEVO: Si es true, carga inmediatamente sin lazy loading
}

/**
 * Componente para reproducir videos de YouTube con lazy loading optimizado
 * @param videoId - ID del video de YouTube
 * @param title - Título del video
 * @param autoplay - Reproducir automáticamente
 * @param muted - Silenciar el video
 * @param loop - Repetir el video
 * @param controls - Mostrar controles
 * @param width - Ancho del reproductor
 * @param height - Alto del reproductor
 * @param className - Clase CSS adicional
 * @param lazyLoad - Cargar solo cuando está en viewport (por defecto: true)
 * @param priority - Si es true, carga inmediatamente sin lazy loading
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
  className = '',
  fillContainer = false, // Por defecto usar el comportamiento estándar con padding-bottom
  volume = 25, // Volumen por defecto 25%
  lazyLoad = true, // ✅ Por defecto lazy loading activado
  priority = false // ✅ Por defecto no es prioritario
}: YouTubePlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazyLoad || priority); // ✅ Cargar inmediatamente si no hay lazy loading o es prioritario
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ✅ NUEVO: IntersectionObserver para lazy loading
  useEffect(() => {
    // Si no hay lazy loading o ya se debe cargar, no hacer nada
    if (!lazyLoad || shouldLoad || priority) return;

    // Si estamos en servidor, no ejecutar
    if (typeof window === 'undefined') return;

    const container = containerRef.current;
    if (!container) return;

    // Crear IntersectionObserver para detectar cuando el componente está en viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Cuando el componente está visible o cerca (50% de margen)
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect(); // Desconectar después de cargar
          }
        });
      },
      {
        // ✅ Cargar cuando está a 100px de entrar al viewport (mejor UX)
        rootMargin: '100px'
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [lazyLoad, shouldLoad, priority]);

  // Construir la URL del video con parámetros
  const buildVideoUrl = () => {
    const params = new URLSearchParams({
      rel: '0', // No mostrar videos relacionados
      modestbranding: '1', // Marca de YouTube discreta
      showinfo: '0', // No mostrar información del video
      enablejsapi: '1', // Habilitar API de JavaScript
      origin: window.location.origin
    });

    // ✅ IMPORTANTE: Para que autoplay funcione, el video DEBE estar silenciado
    // Los navegadores modernos bloquean autoplay con sonido
    // ✅ OPTIMIZADO: En móvil, desactivar autoplay para mejor rendimiento
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const shouldAutoplay = autoplay && !isMobile; // No autoplay en móvil
    
    if (shouldAutoplay) {
      params.append('autoplay', '1');
      // Forzar muted si autoplay está activo (requisito de los navegadores)
      params.append('mute', '1');
    } else if (muted) {
      params.append('mute', '1');
    }
    
    if (loop) {
      params.append('loop', '1');
      params.append('playlist', videoId); // Necesario para el loop
    }
    
    if (!controls) params.append('controls', '0');

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  };

  // ✅ OPTIMIZADO: Lógica de volumen comentada porque videos siempre están muteados
  // Esto evita crear 3 timeouts innecesarios por cada iframe
  /*
  useEffect(() => {
    if (!iframeRef.current || isLoading || muted) return;
    const videoVolume = volume !== undefined ? volume : 25;
    const setVolume = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) return;
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [videoVolume] }),
          'https://www.youtube.com'
        );
      } catch (error) {}
    };
    const timers: NodeJS.Timeout[] = [];
    [500, 1000, 2000].forEach((delay) => {
      const timer = setTimeout(setVolume, delay);
      timers.push(timer);
    });
    return () => { timers.forEach(timer => clearTimeout(timer)); };
  }, [volume, isLoading, muted]);
  */

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

  // ✅ Mostrar placeholder si no se debe cargar aún (lazy loading)
  if (!shouldLoad) {
    return (
      <div 
        ref={containerRef}
        className={`${fillContainer ? styles.playerContainerInContainer : styles.playerContainer} ${className}`}
        style={{ minHeight: '315px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>▶️</div>
          <p style={{ fontSize: '14px', opacity: 0.7 }}>Video se cargará pronto...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`${fillContainer ? styles.playerContainerInContainer : styles.playerContainer} ${className}`}
    >
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando video...</p>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        src={buildVideoUrl()}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={handleLoad}
        onError={handleError}
        className={styles.iframe}
        loading="lazy"
        style={{
          display: isLoading ? 'none' : 'block'
        }}
      />
    </div>
  );
} 