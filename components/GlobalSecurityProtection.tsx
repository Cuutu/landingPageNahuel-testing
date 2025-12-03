import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Componente de protección de seguridad global
 * - Deshabilita la consola del navegador
 * - Deshabilita click derecho
 * - Bloquea teclas de desarrollador (F12, Ctrl+Shift+I, etc.)
 * - Previene inspección de elementos
 * - Se desactiva automáticamente en páginas administrativas
 */
const GlobalSecurityProtection: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // Verificar si estamos en una página administrativa
    const isAdminPage = router.pathname.startsWith('/admin');
    
    // Si es página administrativa, no aplicar protecciones
    if (isAdminPage) {
      return;
    }

    // ============================================
    // 1. DESHABILITAR CONSOLA DEL NAVEGADOR
    // ============================================
    const disableConsole = () => {
      // Sobrescribir métodos de console
      const noop = () => {};
      const methods = [
        'log', 'debug', 'info', 'warn', 'error', 'table', 'trace',
        'group', 'groupCollapsed', 'groupEnd', 'clear', 'count',
        'countReset', 'assert', 'profile', 'profileEnd', 'time',
        'timeEnd', 'timeLog', 'dir', 'dirxml', 'exception'
      ];

      methods.forEach(method => {
        try {
          (window.console as any)[method] = noop;
        } catch (e) {
          // Ignorar errores
        }
      });

      // Bloquear acceso a console
      Object.defineProperty(window, 'console', {
        value: {},
        writable: false,
        configurable: false
      });
    };

    // Intentar deshabilitar consola (puede no funcionar en todos los navegadores)
    try {
      disableConsole();
    } catch (e) {
      // Si falla, intentar método alternativo
      try {
        const noop = () => {};
        (window as any).console = {
          log: noop,
          debug: noop,
          info: noop,
          warn: noop,
          error: noop,
          table: noop,
          trace: noop,
          group: noop,
          groupCollapsed: noop,
          groupEnd: noop,
          clear: noop,
          count: noop,
          countReset: noop,
          assert: noop,
          profile: noop,
          profileEnd: noop,
          time: noop,
          timeEnd: noop,
          timeLog: noop,
          dir: noop,
          dirxml: noop,
          exception: noop
        };
      } catch (e2) {
        // Si ambos métodos fallan, continuar sin deshabilitar consola
      }
    }

    // ============================================
    // 2. DESHABILITAR CLICK DERECHO
    // ============================================
    const preventContextMenu = (e: MouseEvent) => {
      // Permitir click derecho solo en campos de formulario
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable;

      if (!isFormElement) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // ============================================
    // 3. BLOQUEAR TECLAS DE DESARROLLADOR
    // ============================================
    const preventDevTools = (e: KeyboardEvent) => {
      // Permitir escritura normal en campos de formulario
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable;

      if (isFormElement) {
        return;
      }

      // Bloquear teclas de desarrollador
      const blockedKeys = [
        'F12', // DevTools
        'F8',  // Debugger
        'F5',  // Refresh (con Ctrl)
      ];

      const blockedCombinations = [
        // Ctrl+Shift+I (DevTools)
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')),
        // Ctrl+Shift+J (Console)
        (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')),
        // Ctrl+Shift+C (Inspector)
        (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')),
        // Ctrl+U (Ver código fuente)
        (e.ctrlKey && (e.key === 'U' || e.key === 'u')),
        // Ctrl+S (Guardar página)
        (e.ctrlKey && (e.key === 'S' || e.key === 's')),
        // Ctrl+P (Imprimir)
        (e.ctrlKey && (e.key === 'P' || e.key === 'p')),
        // Ctrl+Shift+P (Command Palette en DevTools)
        (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')),
        // Ctrl+Shift+K (Network en Firefox)
        (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')),
        // Alt+F4 (Cerrar ventana)
        (e.altKey && e.key === 'F4'),
        // Cmd+Option+I (Mac DevTools)
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i')),
        // Cmd+Option+J (Mac Console)
        (e.metaKey && e.altKey && (e.key === 'J' || e.key === 'j')),
        // Cmd+Option+C (Mac Inspector)
        (e.metaKey && e.altKey && (e.key === 'C' || e.key === 'c')),
      ];

      if (blockedKeys.includes(e.key) || blockedCombinations.some(blocked => blocked)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Forzar detección inmediata de DevTools
        setTimeout(() => {
          detectDevTools();
        }, 50);
        
        return false;
      }
    };
    
    // También capturar eventos a nivel de window para iframes
    const preventDevToolsWindow = (e: KeyboardEvent) => {
      // Bloquear F12 incluso si el foco está en un iframe
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Forzar blur del iframe si es posible
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'IFRAME') {
          (activeElement as HTMLElement).blur();
          document.body.focus();
        }
        
        // Detectar DevTools inmediatamente
        setTimeout(() => {
          detectDevTools();
        }, 50);
        
        return false;
      }
    };

    // ============================================
    // 4. PREVENIR INSPECCIÓN DE ELEMENTOS
    // ============================================
    const preventInspect = (e: MouseEvent) => {
      // Bloquear selección de texto (excepto en formularios)
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable;

      if (!isFormElement && e.button === 2) {
        // Click derecho
        e.preventDefault();
        return false;
      }
    };

    // ============================================
    // 5. DETECTAR Y BLOQUEAR DEVTOOLS ABIERTOS
    // ============================================
    let devToolsDetected = false;
    let devToolsCheckCount = 0;
    
    const detectDevTools = () => {
      const threshold = 160; // Diferencia en píxeles que indica DevTools abierto
      
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;
      
      // Detectar por tamaño de ventana
      const sizeDetected = widthThreshold || heightThreshold;
      
      // Detectar por console (si está disponible)
      let consoleDetected = false;
      try {
        const start = performance.now();
        (window as any).console.log('%c', '');
        const end = performance.now();
        // Si console.log tarda mucho, puede indicar DevTools abiertos
        consoleDetected = end - start > 100;
      } catch (e) {
        // Ignorar errores
      }
      
      // Detectar por debugger
      let debuggerDetected = false;
      try {
        // Intentar detectar si hay un debugger activo
        const start = Date.now();
        // eslint-disable-next-line no-debugger
        debugger;
        const end = Date.now();
        debuggerDetected = end - start > 100;
      } catch (e) {
        // Ignorar errores
      }

      if (sizeDetected || consoleDetected || debuggerDetected) {
        devToolsDetected = true;
        devToolsCheckCount++;
        
        // Si DevTools se detecta múltiples veces, tomar acción más agresiva
        if (devToolsCheckCount > 3) {
          // Método 1: Ocultar contenido
          document.body.style.display = 'none';
          document.body.style.visibility = 'hidden';
          
          // Método 2: Mostrar mensaje de advertencia
          const warning = document.createElement('div');
          warning.id = 'devtools-warning';
          warning.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
          `;
          warning.innerHTML = `
            <div>
              <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #ff4444;">⚠️ Herramientas de Desarrollador Detectadas</h1>
              <p style="font-size: 1.2rem; margin-bottom: 2rem;">Por razones de seguridad, las herramientas de desarrollador no están permitidas en este sitio.</p>
              <p style="font-size: 1rem; color: #aaa;">Por favor, cierra las herramientas de desarrollador para continuar.</p>
            </div>
          `;
          
          // Remover warning anterior si existe
          const existingWarning = document.getElementById('devtools-warning');
          if (existingWarning) {
            existingWarning.remove();
          }
          
          document.body.appendChild(warning);
          
          // Intentar cerrar DevTools forzando un blur
          window.blur();
          document.body.focus();
          
          // Redirigir después de 5 segundos si aún están abiertos
          setTimeout(() => {
            if (devToolsDetected) {
              window.location.href = '/';
            }
          }, 5000);
        } else {
          // Método suave: solo ocultar brevemente
          document.body.style.display = 'none';
          setTimeout(() => {
            document.body.style.display = '';
            document.body.style.visibility = '';
          }, 100);
        }
      } else {
        // Si no se detectan DevTools, resetear contador
        if (devToolsDetected) {
          devToolsDetected = false;
          devToolsCheckCount = 0;
          const warning = document.getElementById('devtools-warning');
          if (warning) {
            warning.remove();
          }
          document.body.style.display = '';
          document.body.style.visibility = '';
        }
      }
    };

    // ============================================
    // 6. PREVENIR ARRASTRAR ELEMENTOS
    // ============================================
    const preventDrag = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA';

      if (!isFormElement) {
        e.preventDefault();
        return false;
      }
    };

    // ============================================
    // 7. PREVENIR SELECCIÓN DE TEXTO
    // ============================================
    const preventSelect = (e: Event) => {
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.isContentEditable;

      if (!isFormElement) {
        e.preventDefault();
        return false;
      }
    };

    // ============================================
    // AGREGAR EVENT LISTENERS
    // ============================================
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventDevTools);
    document.addEventListener('keydown', preventDevToolsWindow, true); // Captura en fase de captura para iframes
    window.addEventListener('keydown', preventDevToolsWindow, true); // También a nivel de window
    document.addEventListener('mousedown', preventInspect);
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('selectstart', preventSelect);

    // Detectar DevTools periódicamente (más frecuente para detectar desde iframes)
    const devToolsInterval = setInterval(detectDevTools, 200);
    
    // También detectar cuando cambia el foco (cuando salen del iframe)
    const handleFocus = () => {
      detectDevTools();
    };
    
    const handleBlur = () => {
      // Cuando pierden el foco, verificar si abrieron DevTools
      setTimeout(() => {
        detectDevTools();
      }, 100);
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    // Detectar cuando el mouse sale del iframe
    const handleMouseLeave = () => {
      detectDevTools();
    };
    
    document.addEventListener('mouseleave', handleMouseLeave);
    
    // Detectar cambios en el tamaño de la ventana (puede indicar DevTools)
    const handleResize = () => {
      detectDevTools();
    };
    
    window.addEventListener('resize', handleResize);

    // Limpiar event listeners al desmontar
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventDevTools);
      document.removeEventListener('keydown', preventDevToolsWindow, true);
      window.removeEventListener('keydown', preventDevToolsWindow, true);
      document.removeEventListener('mousedown', preventInspect);
      document.removeEventListener('dragstart', preventDrag);
      document.removeEventListener('selectstart', preventSelect);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      clearInterval(devToolsInterval);
      
      // Limpiar warning si existe
      const warning = document.getElementById('devtools-warning');
      if (warning) {
        warning.remove();
      }
    };
  }, [router.pathname]);

  // Este componente no renderiza nada
  return null;
};

export default GlobalSecurityProtection;

