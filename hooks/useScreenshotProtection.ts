import { useState, useEffect, useCallback } from 'react';

interface ScreenshotProtectionState {
  isProtected: boolean;
  protectionCount: number;
  lastProtectionTime: number;
}

/**
 * Hook personalizado para manejar la protección contra screenshots
 * Detecta múltiples métodos de captura y activa protección automática
 */
export const useScreenshotProtection = () => {
  const [state, setState] = useState<ScreenshotProtectionState>({
    isProtected: false,
    protectionCount: 0,
    lastProtectionTime: 0
  });

  const activateProtection = useCallback((reason: string = 'unknown') => {
    const now = Date.now();
    
    setState(prev => ({
      isProtected: true,
      protectionCount: prev.protectionCount + 1,
      lastProtectionTime: now
    }));

    // Log para debugging (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🛡️ Screenshot protection activated: ${reason}`);
    }

    // Auto-desactivar después de 3 segundos
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isProtected: false
      }));
    }, 3000);
  }, []);

  const deactivateProtection = useCallback(() => {
    setState(prev => ({
      ...prev,
      isProtected: false
    }));
  }, []);

  useEffect(() => {
    let devToolsCheckInterval: NodeJS.Timeout;

    // Detectar teclas de screenshot
    const handleKeyDown = (event: KeyboardEvent) => {
      // PrintScreen
      if (event.key === 'PrintScreen') {
        activateProtection('printscreen_key');
        return;
      }

      // Alt + PrintScreen
      if (event.altKey && event.key === 'PrintScreen') {
        activateProtection('alt_printscreen');
        return;
      }

      // Ctrl/Cmd + Shift + S (screenshot en algunos sistemas)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
        activateProtection('ctrl_shift_s');
        return;
      }

      // F12 (herramientas de desarrollador)
      if (event.key === 'F12') {
        activateProtection('f12_devtools');
        return;
      }

      // Ctrl/Cmd + Shift + I (herramientas de desarrollador)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'I') {
        activateProtection('devtools_shortcut');
        return;
      }

      // Ctrl/Cmd + U (ver código fuente)
      if ((event.ctrlKey || event.metaKey) && event.key === 'u') {
        activateProtection('view_source');
        return;
      }
    };

    // Detectar cambios de visibilidad (posible screenshot)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        activateProtection('visibility_change');
      }
    };

    // Detectar herramientas de desarrollador
    const checkDevTools = () => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth;
      const heightThreshold = window.outerHeight - window.innerHeight;

      if (widthThreshold > threshold || heightThreshold > threshold) {
        activateProtection('devtools_detected');
      }
    };

    // Detectar selección de texto larga (posible screenshot)
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 100) {
        activateProtection('large_text_selection');
      }
    };

    // Detectar cambios de foco rápidos
    const handleFocusChange = () => {
      if (!document.hasFocus()) {
        // Verificar si se abrieron herramientas de desarrollador
        setTimeout(() => {
          checkDevTools();
        }, 100);
      }
    };

    // Detectar cambios de tamaño de ventana
    const handleResize = () => {
      checkDevTools();
    };

    // Detectar intentos de acceso al DOM
    const handleContextMenu = (event: MouseEvent) => {
      // Prevenir menú contextual en elementos sensibles
      const target = event.target as HTMLElement;
      if (target.closest('.sensitivePrice, .alertCard, .sensitiveTable')) {
        event.preventDefault();
        activateProtection('context_menu');
      }
    };

    // Detectar intentos de drag
    const handleDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.sensitivePrice, .alertCard, .sensitiveTable')) {
        event.preventDefault();
        activateProtection('drag_attempt');
      }
    };

    // Agregar event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('focus', handleFocusChange);
    document.addEventListener('blur', handleFocusChange);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', handleResize);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);

    // Verificar herramientas de desarrollador periódicamente
    devToolsCheckInterval = setInterval(checkDevTools, 1000);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('focus', handleFocusChange);
      document.removeEventListener('blur', handleFocusChange);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      clearInterval(devToolsCheckInterval);
    };
  }, [activateProtection]);

  return {
    isProtected: state.isProtected,
    protectionCount: state.protectionCount,
    lastProtectionTime: state.lastProtectionTime,
    activateProtection,
    deactivateProtection
  };
};
