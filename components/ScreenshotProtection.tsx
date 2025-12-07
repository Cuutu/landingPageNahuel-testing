import React, { useEffect, useState, useRef } from 'react';
import styles from './ScreenshotProtection.module.css';

interface ScreenshotProtectionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Componente que protege contra screenshots ocultando contenido sensible
 * cuando se detecta un intento de captura de pantalla
 */
const ScreenshotProtection: React.FC<ScreenshotProtectionProps> = ({ 
  children, 
  className = '' 
}) => {
  const [isProtected, setIsProtected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const protectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar intentos de screenshot usando múltiples métodos
  const detectScreenshotAttempt = (reason: string = 'unknown') => {
    // console.log('🛡️ Screenshot protection activated:', reason);
    setIsProtected(true);
    
    // Limpiar timeout anterior si existe
    if (protectionTimeoutRef.current) {
      clearTimeout(protectionTimeoutRef.current);
    }
    
    // Mostrar protección por 3 segundos
    protectionTimeoutRef.current = setTimeout(() => {
      setIsProtected(false);
      // console.log('🛡️ Screenshot protection deactivated');
    }, 3000);
  };

  useEffect(() => {

    // Método 1: Detectar teclas de screenshot
    const handleKeyDown = (event: KeyboardEvent) => {
      // console.log('🔍 Key pressed:', event.key, 'Code:', event.code, 'Alt:', event.altKey, 'Ctrl:', event.ctrlKey, 'KeyCode:', event.keyCode, 'Which:', event.which);
      
      // Detectar tecla ImpPnt / PrintScreen (tecla principal) - MÚLTIPLES VARIACIONES
      if (
        event.key === 'PrintScreen' || 
        event.key === 'Print' || 
        event.code === 'PrintScreen' ||
        event.code === 'Print' ||
        event.key === 'F13' ||
        event.key === 'F14' ||
        event.key === 'F15' ||
        event.keyCode === 44 || // Código ASCII de PrintScreen
        event.which === 44 ||
        event.key === 'Snapshot' ||
        event.key === 'ScreenShot' ||
        event.key === 'PrtSc' ||
        event.key === 'PrtScn' ||
        event.key === 'PrtScrn'
      ) {
        // console.log('🎯 PrintScreen detected!');
        detectScreenshotAttempt('printscreen_key');
        return;
      }
      
      // Detectar Alt + PrintScreen / Alt + ImpPnt
      if (event.altKey && (
        event.key === 'PrintScreen' || 
        event.key === 'Print' || 
        event.code === 'PrintScreen' ||
        event.code === 'Print' ||
        event.key === 'F13' ||
        event.keyCode === 44
      )) {
        // console.log('🎯 Alt + PrintScreen detected!');
        detectScreenshotAttempt('alt_printscreen');
        return;
      }
      
      // Detectar combinaciones con teclas modificadoras
      if (
        (event.ctrlKey || event.metaKey) && 
        (event.key === 'PrintScreen' || event.key === 'F12' || event.key === 'F13')
      ) {
        // console.log('🎯 Modifier + PrintScreen detected!');
        detectScreenshotAttempt('modifier_screenshot');
      }
    };

    // Método 2: Detectar cambios en el DOM que podrían indicar screenshot
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // La página se ocultó, posiblemente para screenshot
        detectScreenshotAttempt();
      }
    };

    // Método 3: Detectar herramientas de desarrollador (optimizado)
    const handleDevTools = () => {
      if (window.outerHeight - window.innerHeight > 200 || 
          window.outerWidth - window.innerWidth > 200) {
        detectScreenshotAttempt('devtools');
      }
    };

    // Método 4: Detectar cambios en el viewport
    const handleResize = () => {
      handleDevTools();
    };

    // ✅ OPTIMIZADO: Reducir event listeners para mejor rendimiento de navegación
    // Solo escuchar keydown (keyup y keypress son redundantes y afectan rendimiento)
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // ✅ OPTIMIZADO: Removidos focus/blur/selectionchange que causaban falsos positivos
    window.addEventListener('resize', handleResize);

    // ✅ OPTIMIZADO: Aumentar intervalo de 1000ms a 5000ms (menos intrusivo)
    const devToolsInterval = setInterval(() => {
      handleDevTools();
    }, 5000);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      clearInterval(devToolsInterval);
      if (protectionTimeoutRef.current) {
        clearTimeout(protectionTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`${styles.screenshotProtection} ${className} ${isProtected ? styles.protected : ''}`}
    >
      {/* Botón de prueba para verificar que funciona */}
      {process.env.NODE_ENV === 'development' && (
        <button 
          onClick={() => detectScreenshotAttempt('test_button')}
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 9999,
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🧪 Test Protection
        </button>
      )}
      
      {children}
      {isProtected && (
        <div className={styles.protectionOverlay}>
          <div className={styles.protectionMessage}>
            <div className={styles.protectionIcon}>🔒</div>
            <div className={styles.protectionText}>
              <strong>Contenido Protegido</strong>
              <span>Los precios sensibles han sido ocultados por seguridad</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenshotProtection;
