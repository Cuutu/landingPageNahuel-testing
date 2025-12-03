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

    // Método 3: Detectar herramientas de desarrollador
    const handleDevTools = () => {
      if (window.outerHeight - window.innerHeight > 200 || 
          window.outerWidth - window.innerWidth > 200) {
        detectScreenshotAttempt();
      }
    };

    // Método 4: Detectar cambios de foco rápidos
    let focusTimeout: NodeJS.Timeout;
    const handleFocusChange = () => {
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        if (document.hasFocus()) {
          // Verificar si hay herramientas de desarrollador abiertas
          handleDevTools();
        }
      }, 100);
    };

    // Método 5: Detectar intentos de selección de texto (posible screenshot)
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 50) {
        // Selección larga de texto podría ser para screenshot
        detectScreenshotAttempt();
      }
    };

    // Método 6: Detectar cambios en el viewport
    const handleResize = () => {
      handleDevTools();
    };

    // Método adicional: Detectar cualquier tecla que pueda ser PrintScreen
    const handleAnyKey = (event: KeyboardEvent) => {
      // Log detallado para debugging
      // console.log('🔍 ANY KEY:', {
      //   key: event.key,
      //   code: event.code,
      //   keyCode: event.keyCode,
      //   which: event.which,
      //   type: event.type,
      //   altKey: event.altKey,
      //   ctrlKey: event.ctrlKey,
      //   shiftKey: event.shiftKey,
      //   metaKey: event.metaKey
      // });
      
      // Detectar por código de tecla (más confiable)
      if (event.keyCode === 44 || event.which === 44) {
        // console.log('🎯 PrintScreen detected by keyCode!');
        detectScreenshotAttempt('printscreen_keycode');
        return;
      }
    };

    // Agregar event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyDown); // También escuchar keyup
    document.addEventListener('keypress', handleKeyDown); // También escuchar keypress
    document.addEventListener('keydown', handleAnyKey); // Listener adicional
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('focus', handleFocusChange);
    document.addEventListener('blur', handleFocusChange);
    document.addEventListener('selectionchange', handleSelection);
    window.addEventListener('resize', handleResize);

    // Detectar herramientas de desarrollador periódicamente
    const devToolsInterval = setInterval(() => {
      handleDevTools();
    }, 1000);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyDown);
      document.removeEventListener('keypress', handleKeyDown);
      document.removeEventListener('keydown', handleAnyKey);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('focus', handleFocusChange);
      document.removeEventListener('blur', handleFocusChange);
      document.removeEventListener('selectionchange', handleSelection);
      window.removeEventListener('resize', handleResize);
      clearInterval(devToolsInterval);
      if (protectionTimeoutRef.current) {
        clearTimeout(protectionTimeoutRef.current);
      }
      clearTimeout(focusTimeout);
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
