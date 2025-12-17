import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * ✅ OPTIMIZADO: Protección ligera - Solo bloquea click derecho y copiar/pegar
 * Se activa SOLO en páginas con contenido sensible:
 * - /alertas/trader-call
 * - /alertas/smart-money
 */
const GlobalSecurityProtection: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // ✅ SOLO activar en páginas con información valiosa
    const protectedPaths = [
      '/alertas/trader-call', 
      '/alertas/smart-money',
    ];
    
    const isProtectedPage = protectedPaths.some(path => 
      router.pathname === path || router.pathname.startsWith(path + '/')
    );
    
    if (!isProtectedPage) {
      return;
    }

    /**
     * ✅ MEJORADO: Detectar elementos de navegación para permitir click derecho en ellos
     */
    const isNavigationElement = (element: HTMLElement): boolean => {
      let current: HTMLElement | null = element;
      for (let i = 0; i < 5 && current; i++) {
        const tagName = current.tagName.toLowerCase();
        const className = typeof current.className === 'string' ? current.className : '';
        const href = current.getAttribute('href');
        
        if (tagName === 'a' && href) return true;
        if (tagName === 'nav' || tagName === 'button') return true;
        if (className.includes('nav') || className.includes('menu') || className.includes('link')) return true;
        
        current = current.parentElement;
      }
      return false;
    };

    // ============================================
    // 1. BLOQUEAR CLICK DERECHO
    // ============================================
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Permitir en formularios
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.contentEditable;
      
      if (isFormElement) return;
      
      // ✅ Permitir en elementos de navegación
      if (isNavigationElement(target)) return;

      e.preventDefault();
      return false;
    };

    // ============================================
    // 2. BLOQUEAR COPIAR Y PEGAR (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A)
    // ============================================
    const preventCopyPaste = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Permitir en campos de formulario
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.contentEditable;

      if (isFormElement) {
        return; // Permitir copiar/pegar en formularios
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Bloquear: Ctrl+C (copiar), Ctrl+V (pegar), Ctrl+X (cortar), Ctrl+A (seleccionar todo)
      if (isCtrlOrCmd && (key === 'c' || key === 'v' || key === 'x' || key === 'a')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // ============================================
    // AGREGAR EVENT LISTENERS
    // ============================================
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventCopyPaste);

    // Limpiar event listeners al desmontar
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventCopyPaste);
    };
  }, [router.pathname]);

  // Este componente no renderiza nada
  return null;
};

export default GlobalSecurityProtection;
