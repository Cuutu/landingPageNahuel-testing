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
    console.log('🛡️ Screenshot protection activated:', reason);
    setIsProtected(true);
    
    // Limpiar timeout anterior si existe
    if (protectionTimeoutRef.current) {
      clearTimeout(protectionTimeoutRef.current);
    }
    
    // Mostrar protección por 3 segundos
    protectionTimeoutRef.current = setTimeout(() => {
      setIsProtected(false);
      console.log('🛡️ Screenshot protection deactivated');
    }, 3000);
  };

  useEffect(() => {

    // Método 1: Detectar teclas de screenshot
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('🔍 Key pressed:', event.key, 'Code:', event.code, 'Alt:', event.altKey, 'Ctrl:', event.ctrlKey);
      
      // Detectar tecla ImpPnt / PrintScreen (tecla principal)
      if (event.key === 'PrintScreen' || event.key === 'Print' || event.code === 'PrintScreen') {
        detectScreenshotAttempt('printscreen_key');
        return;
      }
      
      // Detectar Alt + PrintScreen / Alt + ImpPnt
      if (event.altKey && (event.key === 'PrintScreen' || event.key === 'Print' || event.code === 'PrintScreen')) {
        detectScreenshotAttempt('alt_printscreen');
        return;
      }
      
      // Detectar combinaciones con teclas modificadoras
      if (
        (event.ctrlKey || event.metaKey) && 
        (event.key === 'PrintScreen' || event.key === 'F12' || event.key === 'F13')
      ) {
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

    // Agregar event listeners
    document.addEventListener('keydown', handleKeyDown);
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
