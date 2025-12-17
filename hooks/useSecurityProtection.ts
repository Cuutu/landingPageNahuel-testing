import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * ✅ CONSOLIDADO: Hook para protecciones de seguridad
 * Responsabilidades:
 * - CSS user-select: Aplica user-select: none solo a contenido (no navegación)
 * - dragstart: Previene arrastrar elementos
 * - Protección de imágenes: Protege imágenes pero permite Links
 * 
 * NOTA: 
 * - contextmenu y keydown (copiar/pegar) son manejados por GlobalSecurityProtection
 * - selectstart fue REMOVIDO para evitar interferir con navegación de Next.js
 * - En su lugar, usamos CSS user-select: none aplicado directamente a elementos de contenido
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

        // ✅ 1.5. Detectar elementos con cursor pointer (indica que son clickeables)
        const computedStyle = window.getComputedStyle(currentElement);
        if (computedStyle.cursor === 'pointer' || computedStyle.cursor === 'grab') {
          return true;
        }

        // ✅ 1.6. Verificar si tiene event listeners de click (elemento interactivo)
        const hasClickHandler = (currentElement as any).onclick !== null ||
                                currentElement.getAttribute('onclick') !== null ||
                                currentElement.hasAttribute('data-clickable');
        
        if (hasClickHandler) {
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

    /**
     * ✅ REMOVIDO: preventContextMenu y preventKeyCombinations
     * Ahora son manejados por GlobalSecurityProtection para evitar duplicación
     */

    const preventDrag = (e: DragEvent) => {
      // Permitir drag en elementos de navegación
      const target = e.target as HTMLElement;
      if (isNavigationElement(target)) {
        return;
      }

      e.preventDefault();
      return false;
    };

    /**
     * ✅ OPCIÓN 1 + 2: Aplicar user-select: none con CSS solo a elementos de contenido
     * En lugar de prevenir selectstart (que interfiere con navegación), aplicamos CSS directamente
     */
    const applyUserSelectProtection = () => {
      // Seleccionar todos los elementos del body excepto navegación y formularios
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach((element) => {
        const el = element as HTMLElement;
        
        // Saltar si es elemento de navegación
        if (isNavigationElement(el)) {
          return;
        }
        
        // Saltar si es formulario
        if (el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            el.contentEditable === 'true' ||
            el.isContentEditable) {
          return;
        }
        
        // Saltar si ya tiene user-select definido
        if (el.style.userSelect || (el.style as any).webkitUserSelect) {
          return;
        }
        
        // Aplicar user-select: none solo a contenido
        el.style.userSelect = 'none';
        (el.style as any).webkitUserSelect = 'none';
        (el.style as any).mozUserSelect = 'none';
        (el.style as any).msUserSelect = 'none';
      });
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

    // ✅ CONSOLIDADO: Solo manejar dragstart y protección de imágenes
    // contextmenu y keydown son manejados por GlobalSecurityProtection
    // selectstart fue REMOVIDO - usamos CSS user-select en su lugar
    document.addEventListener('dragstart', preventDrag);
    
    // Aplicar protección CSS inicial
    applyUserSelectProtection();

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
        
        // Si está en un Link, solo proteger contra drag, pero permitir clics
        // (contextmenu es manejado por GlobalSecurityProtection)
        if (isInLink) {
          img.addEventListener('dragstart', preventDrag);
          img.style.userSelect = 'none';
          (img.style as any).webkitUserSelect = 'none';
          (img.style as any).mozUserSelect = 'none';
          (img.style as any).msUserSelect = 'none';
          // ✅ NO aplicar pointer-events: none si está en un Link
        } else {
          // Si NO está en un Link, aplicar protección completa
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

    // Observar cambios en el DOM para proteger nuevas imágenes y aplicar user-select
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Proteger nuevas imágenes
              const images = element.querySelectorAll('img');
              images.forEach(img => {
                // ✅ Verificar si la imagen está dentro de un Link
                const isInLink = img.closest('a') !== null || 
                                img.closest('button') !== null ||
                                isNavigationElement(img as HTMLElement);
                
                // (contextmenu es manejado por GlobalSecurityProtection)
                if (isInLink) {
                  img.addEventListener('dragstart', preventDrag);
                  img.style.userSelect = 'none';
                  (img.style as any).webkitUserSelect = 'none';
                  (img.style as any).mozUserSelect = 'none';
                  (img.style as any).msUserSelect = 'none';
                  // ✅ NO aplicar pointer-events: none
                } else {
                  img.addEventListener('dragstart', preventDrag);
                  img.style.userSelect = 'none';
                  (img.style as any).webkitUserSelect = 'none';
                  (img.style as any).mozUserSelect = 'none';
                  (img.style as any).msUserSelect = 'none';
                  img.style.pointerEvents = 'none';
                }
              });
              
              // ✅ Aplicar user-select a nuevos elementos de contenido (solo si no son navegación)
              const newElements = element.querySelectorAll('*');
              newElements.forEach((el) => {
                const htmlEl = el as HTMLElement;
                if (!isNavigationElement(htmlEl) &&
                    htmlEl.tagName !== 'INPUT' &&
                    htmlEl.tagName !== 'TEXTAREA' &&
                    htmlEl.contentEditable !== 'true' &&
                    !htmlEl.isContentEditable &&
                    !htmlEl.style.userSelect &&
                    !(htmlEl.style as any).webkitUserSelect) {
                  htmlEl.style.userSelect = 'none';
                  (htmlEl.style as any).webkitUserSelect = 'none';
                  (htmlEl.style as any).mozUserSelect = 'none';
                  (htmlEl.style as any).msUserSelect = 'none';
                }
              });
              
              // También aplicar al elemento mismo si no es navegación
              if (element.nodeType === Node.ELEMENT_NODE) {
                const htmlElement = element as HTMLElement;
                if (!isNavigationElement(htmlElement) &&
                    htmlElement.tagName !== 'INPUT' &&
                    htmlElement.tagName !== 'TEXTAREA' &&
                    htmlElement.contentEditable !== 'true' &&
                    !htmlElement.isContentEditable &&
                    !htmlElement.style.userSelect &&
                    !(htmlElement.style as any).webkitUserSelect) {
                  htmlElement.style.userSelect = 'none';
                  (htmlElement.style as any).webkitUserSelect = 'none';
                  (htmlElement.style as any).mozUserSelect = 'none';
                  (htmlElement.style as any).msUserSelect = 'none';
                }
              }
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
        document.removeEventListener('dragstart', preventDrag);
        // ✅ selectstart ya no se usa - removido para evitar interferir con navegación
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