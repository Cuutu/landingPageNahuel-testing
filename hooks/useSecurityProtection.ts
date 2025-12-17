import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

/**
 * ✅ OPTIMIZADO: Hook para protecciones de seguridad
 * Responsabilidades:
 * - CSS user-select: Aplica clase .no-select solo a contenedores de contenido específicos
 * - dragstart: Previene arrastrar elementos
 * - Protección de imágenes: Protege imágenes pero permite Links
 * 
 * NOTA: 
 * - contextmenu y keydown (copiar/pegar) son manejados por GlobalSecurityProtection
 * - Usa clases CSS en lugar de estilos inline para no interferir con navegación
 * - Pausa MutationObserver durante navegación de Next.js
 */
export const useSecurityProtection = () => {
  const router = useRouter();
  const isNavigatingRef = useRef(false);
  const observerRef = useRef<MutationObserver | null>(null);

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

      // Verificar el elemento actual y hasta 7 niveles hacia arriba
      for (let i = 0; i < 7 && currentElement; i++) {
        const tagName = currentElement.tagName.toLowerCase();
        const className = typeof currentElement.className === 'string' 
          ? currentElement.className 
          : '';
        const role = currentElement.getAttribute('role') || '';
        const href = currentElement.getAttribute('href');
        const onClick = currentElement.getAttribute('onclick') || 
                       (currentElement as any).onclick;

        // ✅ 1. Detectar Links de Next.js (tienen href)
        if (tagName === 'a' && href) {
          return true;
        }

        // ✅ 1.5. Detectar elementos con cursor pointer (indica que son clickeables)
        try {
          const computedStyle = window.getComputedStyle(currentElement);
          if (computedStyle.cursor === 'pointer' || computedStyle.cursor === 'grab') {
            return true;
          }
        } catch (e) {
          // Ignorar errores de computedStyle
        }

        // ✅ 1.6. Verificar si tiene event listeners de click
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
     * ✅ OPTIMIZADO: Aplicar clase CSS .no-select solo a contenedores específicos
     * En lugar de aplicar estilos inline a todos los elementos, usamos clases CSS
     * y solo las aplicamos a contenedores de contenido conocidos
     */
    const applyUserSelectProtection = () => {
      // Si estamos navegando, no aplicar protección
      if (isNavigatingRef.current) {
        return;
      }

      // ✅ Aplicar solo a contenedores específicos de contenido
      // Usar selectores que funcionen con CSS Modules (clases como "TraderCall_subscriberView__abc123")
      const contentContainers = [
        '[class*="subscriberView"]',
        '[class*="nonSubscriberView"]',
        '[class*="mainContent"]',
        // También buscar por ID o data-attributes si existen
        '[id*="subscriber"]',
        '[id*="content"]',
      ];

      contentContainers.forEach((selector) => {
        try {
          const containers = document.querySelectorAll(selector);
          containers.forEach((container) => {
            const el = container as HTMLElement;
            
            // Verificar que no sea elemento de navegación
            if (!isNavigationElement(el) && !el.classList.contains('no-select')) {
              el.classList.add('no-select');
            }
          });
        } catch (e) {
          // Ignorar errores de querySelector
        }
      });
    };

    // ✅ CONSOLIDADO: Solo manejar dragstart y protección de imágenes
    // contextmenu y keydown son manejados por GlobalSecurityProtection
    document.addEventListener('dragstart', preventDrag);
    
    // Aplicar protección CSS inicial (con delay para asegurar que el DOM esté listo)
    setTimeout(() => {
      applyUserSelectProtection();
    }, 100);

    /**
     * ✅ MEJORADO: Proteger imágenes pero NO bloquear si están dentro de Links
     */
    const protectImages = () => {
      if (isNavigatingRef.current) {
        return;
      }

      const images = document.querySelectorAll('img');
      images.forEach(img => {
        const isInLink = img.closest('a') !== null || 
                        img.closest('button') !== null ||
                        isNavigationElement(img as HTMLElement);
        
        if (isInLink) {
          img.addEventListener('dragstart', preventDrag);
          // ✅ NO aplicar pointer-events: none si está en un Link
        } else {
          img.addEventListener('dragstart', preventDrag);
          img.style.pointerEvents = 'none';
        }
      });
    };

    // Proteger imágenes iniciales
    setTimeout(() => {
      protectImages();
    }, 100);

    // ✅ OPTIMIZADO: MutationObserver más inteligente - pausa durante navegación
    const observer = new MutationObserver((mutations) => {
      // Si estamos navegando, no procesar mutaciones
      if (isNavigatingRef.current) {
        return;
      }

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Proteger nuevas imágenes
              const images = element.querySelectorAll('img');
              images.forEach(img => {
                const isInLink = img.closest('a') !== null || 
                                img.closest('button') !== null ||
                                isNavigationElement(img as HTMLElement);
                
                if (isInLink) {
                  img.addEventListener('dragstart', preventDrag);
                } else {
                  img.addEventListener('dragstart', preventDrag);
                  img.style.pointerEvents = 'none';
                }
              });
              
              // ✅ Aplicar clase .no-select solo a contenedores de contenido
              const contentContainers = [
                '.subscriberView',
                '.nonSubscriberView',
                '.mainContent',
              ];
              
              contentContainers.forEach((selector) => {
                try {
                  const containers = element.querySelectorAll(selector);
                  containers.forEach((container) => {
                    const el = container as HTMLElement;
                    if (!isNavigationElement(el) && !el.classList.contains('no-select')) {
                      el.classList.add('no-select');
                    }
                  });
                } catch (e) {
                  // Ignorar errores
                }
              });
            }
          });
        }
      });
    });

    observerRef.current = observer;

    // Observar cambios en el body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // ✅ DETECTAR NAVEGACIÓN: Pausar observer durante navegación de Next.js
    const handleRouteChangeStart = () => {
      isNavigatingRef.current = true;
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };

    const handleRouteChangeComplete = () => {
      isNavigatingRef.current = false;
      // Reconectar observer después de la navegación
      if (observerRef.current) {
        observerRef.current.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      // Re-aplicar protección después de la navegación
      setTimeout(() => {
        applyUserSelectProtection();
        protectImages();
      }, 200);
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    // Limpiar event listeners al desmontar
    return () => {
      if (isProtectedPage) {
        document.removeEventListener('dragstart', preventDrag);
        router.events.off('routeChangeStart', handleRouteChangeStart);
        router.events.off('routeChangeComplete', handleRouteChangeComplete);
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      }
    };
  }, [router.pathname, router.events]);
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
