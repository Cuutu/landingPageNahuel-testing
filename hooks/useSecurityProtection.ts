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
    // ✅ SOLO activar en páginas con información valiosa (smart-money y trader-call)
    const protectedPaths = [
      '/alertas/trader-call',
      '/alertas/smart-money',
    ];
    
    const isProtectedPage = protectedPaths.some(path => 
      router.pathname === path || router.pathname.startsWith(path + '/')
    );
    
    // Si NO es página protegida o es admin, no aplicar protecciones
    if (!isProtectedPage || router.pathname.startsWith('/admin')) {
      return;
    }

    /**
     * ✅ MEJORADO: Detección robusta de elementos de navegación
     * Incluye detección de Links de Next.js y elementos interactivos
     */
    const isNavigationElement = (element: HTMLElement): boolean => {
      let currentElement: HTMLElement | null = element;

      // Verificar el elemento actual y hasta 7 niveles hacia arriba (aumentado de 5)
      for (let i = 0; i < 7 && currentElement; i++) {
        const tagName = currentElement.tagName.toLowerCase();
        const className = typeof currentElement.className === 'string' 
          ? currentElement.className 
          : '';
        const role = currentElement.getAttribute('role') || '';
        const href = currentElement.getAttribute('href');
        const onClick = currentElement.getAttribute('onclick') || 
                       (currentElement as any).onclick;

        // ✅ 1. Detectar Links de Next.js (tienen href y están dentro de contenedores de navegación)
        if (tagName === 'a' && href) {
          // Cualquier <a> con href es navegación
          return true;
        }

        // ✅ 2. Detectar elementos dentro de <nav> o con clases de navegación
        if (tagName === 'nav' ||
            className.includes('nav') ||
            className.includes('navbar') ||
            className.includes('menu') ||
            className.includes('dropdown') ||
            className.includes('link') ||
            className.includes('button') ||
            className.includes('chevron') ||
            className.includes('user') ||
            className.includes('footer')) {
          return true;
        }

        // ✅ 3. Detectar botones y elementos interactivos
        if (tagName === 'button' ||
            role === 'button' ||
            role === 'link' ||
            role === 'menu' ||
            role === 'menuitem' ||
            role === 'navigation' ||
            onClick) {
          return true;
        }

        // ✅ 4. Detectar elementos con data-attributes de navegación
        if (currentElement.hasAttribute('data-navigation') ||
            currentElement.hasAttribute('data-link') ||
            currentElement.hasAttribute('data-router-link')) {
          return true;
        }

        // ✅ 5. Verificar si está dentro de un contenedor con clase de navegación
        const parent = currentElement.parentElement;
        if (parent) {
          const parentClass = typeof parent.className === 'string' ? parent.className : '';
          if (parentClass.includes('nav') || 
              parentClass.includes('menu') || 
              parentClass.includes('dropdown') ||
              parent.tagName === 'NAV') {
            return true;
          }
        }

        currentElement = currentElement.parentElement;
      }

      return false;
    };

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

    // ✅ OPTIMIZADO: Aplicar protecciones globales de forma menos intrusiva
    // Removido 'mousedown' que bloqueaba clics de navegación
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeyCombinations);
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('selectstart', preventSelect);
    // ✅ REMOVIDO: document.addEventListener('mousedown', preventSelect) - causaba problemas de navegación

    /**
     * ✅ MEJORADO: Proteger imágenes pero NO bloquear si están dentro de Links
     * Esto permite que los Links con imágenes funcionen correctamente
     */
    const protectImages = () => {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        // ✅ Verificar si la imagen está dentro de un Link o elemento de navegación
        const isInLink = img.closest('a') !== null || 
                        img.closest('button') !== null ||
                        isNavigationElement(img as HTMLElement);
        
        // Si está en un Link, solo proteger contra click derecho y drag, pero permitir clics
        if (isInLink) {
          img.addEventListener('contextmenu', preventContextMenu);
          img.addEventListener('dragstart', preventDrag);
          img.style.userSelect = 'none';
          (img.style as any).webkitUserSelect = 'none';
          (img.style as any).mozUserSelect = 'none';
          (img.style as any).msUserSelect = 'none';
          // ✅ NO aplicar pointer-events: none si está en un Link
        } else {
          // Si NO está en un Link, aplicar protección completa
          img.addEventListener('contextmenu', preventContextMenu);
          img.addEventListener('dragstart', preventDrag);
          img.style.userSelect = 'none';
          (img.style as any).webkitUserSelect = 'none';
          (img.style as any).mozUserSelect = 'none';
          (img.style as any).msUserSelect = 'none';
          img.style.pointerEvents = 'none';
        }
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
                // ✅ Verificar si la imagen está dentro de un Link
                const isInLink = img.closest('a') !== null || 
                                img.closest('button') !== null ||
                                isNavigationElement(img as HTMLElement);
                
                if (isInLink) {
                  img.addEventListener('contextmenu', preventContextMenu);
                  img.addEventListener('dragstart', preventDrag);
                  img.style.userSelect = 'none';
                  (img.style as any).webkitUserSelect = 'none';
                  (img.style as any).mozUserSelect = 'none';
                  (img.style as any).msUserSelect = 'none';
                  // ✅ NO aplicar pointer-events: none
                } else {
                  img.addEventListener('contextmenu', preventContextMenu);
                  img.addEventListener('dragstart', preventDrag);
                  img.style.userSelect = 'none';
                  (img.style as any).webkitUserSelect = 'none';
                  (img.style as any).mozUserSelect = 'none';
                  (img.style as any).msUserSelect = 'none';
                  img.style.pointerEvents = 'none';
                }
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
      if (isProtectedPage) {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('keydown', preventKeyCombinations);
        document.removeEventListener('dragstart', preventDrag);
        document.removeEventListener('selectstart', preventSelect);
        observer.disconnect();
      }
    };
  }, [router.pathname]);
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