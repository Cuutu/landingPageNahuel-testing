import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Hook personalizado para aplicar protecciones de seguridad
 * - Deshabilita click derecho
 * - Previene combinaciones de teclas no deseadas
 * - Protege imágenes contra descarga
 * - Previene arrastrar elementos
 * - Desactiva protecciones en páginas administrativas
 */
export const useSecurityProtection = () => {
  const router = useRouter();

  useEffect(() => {
    // Verificar si estamos en una página administrativa
    const isAdminPage = router.pathname.startsWith('/admin');
    
    // Si es página administrativa, no aplicar protecciones
    if (isAdminPage) {
      console.log('🔓 Página administrativa detectada - Protecciones de seguridad desactivadas');
      return;
    }

    const preventContextMenu = (e: MouseEvent) => {
      // Permitir menú contextual en elementos de navegación
      const target = e.target as HTMLElement;
      if (isNavigationElement(target)) {
        return;
      }

      e.preventDefault();
      return false;
    };

    const preventKeyCombinations = (e: KeyboardEvent) => {
      // Verificar si el usuario está escribiendo en un campo de formulario
      const target = e.target as HTMLElement;

      // Permitir escritura normal en inputs, textareas, contenteditable
      if (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true' ||
          target.isContentEditable) {
        return;
      }

      // Prevenir combinaciones de teclas que podrían usarse para descargar o inspeccionar
      if (
        (e.ctrlKey && e.key === 's') || // Ctrl+S (guardar)
        (e.ctrlKey && e.key === 'p') || // Ctrl+P (imprimir)
        e.key === 'F12' || // F12 (dev tools)
        (e.ctrlKey && e.key === 'u') || // Ctrl+U (ver código fuente)
        (e.ctrlKey && e.shiftKey && e.key === 'I') || // Ctrl+Shift+I (dev tools)
        (e.ctrlKey && e.shiftKey && e.key === 'C') || // Ctrl+Shift+C (inspector)
        (e.ctrlKey && e.key === 'F5') || // Ctrl+F5 (recargar)
        (e.ctrlKey && e.key === 'r') // Ctrl+R (recargar)
      ) {
        e.preventDefault();
        return false;
      }
    };

    const isNavigationElement = (element: HTMLElement): boolean => {
      // Verificar si el elemento o sus padres son parte de la navegación
      const navSelectors = [
        'nav', '.navbar', '.nav', '.dropdown', '.menu',
        '[class*="nav"]', '[class*="menu"]', '[class*="dropdown"]',
        'button', 'a', '[role="button"]', '[role="menu"]', '[role="menuitem"]'
      ];

      let currentElement: HTMLElement | null = element;

      // Verificar el elemento actual y hasta 5 niveles hacia arriba
      for (let i = 0; i < 5 && currentElement; i++) {
        const tagName = currentElement.tagName.toLowerCase();
        const className = currentElement.className || '';
        const role = currentElement.getAttribute('role') || '';

        // Verificar si es un elemento de navegación
        if (tagName === 'nav' ||
            tagName === 'button' ||
            tagName === 'a' ||
            role === 'button' ||
            role === 'menu' ||
            role === 'menuitem' ||
            className.includes('nav') ||
            className.includes('menu') ||
            className.includes('dropdown') ||
            className.includes('chevron') ||
            className.includes('user')) {
          return true;
        }

        currentElement = currentElement.parentElement;
      }

      return false;
    };

    const preventDrag = (e: DragEvent) => {
      // Permitir drag en elementos de navegación
      const target = e.target as HTMLElement;
      if (isNavigationElement(target)) {
        return;
      }

      e.preventDefault();
      return false;
    };

    const preventSelect = (e: Event) => {
      // Verificar si el usuario está interactuando con un campo de formulario
      const target = e.target as HTMLElement;

      // Permitir selección en inputs, textareas, contenteditable
      if (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true' ||
          target.isContentEditable) {
        return;
      }

      // Permitir interacciones con elementos de navegación
      if (isNavigationElement(target)) {
        return;
      }

      e.preventDefault();
      return false;
    };

    // Aplicar protecciones globales solo si no es página administrativa
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeyCombinations);
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('selectstart', preventSelect);
    document.addEventListener('mousedown', preventSelect);

    // Proteger todas las imágenes existentes
    const protectImages = () => {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        img.addEventListener('contextmenu', preventContextMenu);
        img.addEventListener('dragstart', preventDrag);
        img.style.userSelect = 'none';
        (img.style as any).webkitUserSelect = 'none';
        (img.style as any).mozUserSelect = 'none';
        (img.style as any).msUserSelect = 'none';
        img.style.pointerEvents = 'none';
      });
    };

    // Proteger imágenes iniciales
    protectImages();

    // Observar cambios en el DOM para proteger nuevas imágenes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              const images = element.querySelectorAll('img');
              images.forEach(img => {
                img.addEventListener('contextmenu', preventContextMenu);
                img.addEventListener('dragstart', preventDrag);
                img.style.userSelect = 'none';
                (img.style as any).webkitUserSelect = 'none';
                (img.style as any).mozUserSelect = 'none';
                (img.style as any).msUserSelect = 'none';
                img.style.pointerEvents = 'none';
              });
            }
          });
        }
      });
    });

    // Observar cambios en el body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Limpiar event listeners al desmontar solo si se aplicaron
    return () => {
      if (!isAdminPage) {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('keydown', preventKeyCombinations);
        document.removeEventListener('dragstart', preventDrag);
        document.removeEventListener('selectstart', preventSelect);
        document.removeEventListener('mousedown', preventSelect);
        observer.disconnect();
      }
    };
  }, []);
};

/**
 * Hook para proteger elementos específicos
 */
export const useElementProtection = (elementRef: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    element.addEventListener('contextmenu', preventContextMenu);
    element.addEventListener('dragstart', preventDrag);

    return () => {
      element.removeEventListener('contextmenu', preventContextMenu);
      element.removeEventListener('dragstart', preventDrag);
    };
  }, [elementRef]);
}; 