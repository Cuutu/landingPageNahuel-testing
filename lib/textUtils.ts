/**
 * Utilidades para convertir entre texto plano y HTML
 */

/**
 * Convierte HTML básico a texto plano
 * Convierte <br>, <p>, y otros elementos básicos a saltos de línea
 */
export function htmlToText(html: string): string {
  if (!html) return '';

  // Método 1: Usar DOMParser en el cliente (más robusto)
  if (typeof window !== 'undefined') {
    try {
      // Crear un elemento temporal en el DOM
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Obtener el texto sin etiquetas HTML
      let text = tempDiv.textContent || tempDiv.innerText || '';
      
      // Limpiar espacios y saltos de línea múltiples
      text = text
        .replace(/\n\s*\n\s*\n+/g, '\n\n') // Máximo 2 saltos consecutivos
        .replace(/[ \t]+/g, ' ') // Múltiples espacios a uno solo
        .replace(/^\s+|\s+$/gm, '') // Trim cada línea
        .trim();
      
      // Limpiar el elemento temporal
      tempDiv.remove();
      
      return text;
    } catch (error) {
      console.warn('Error parsing HTML with DOM, falling back to regex:', error);
    }
  }

  // Método 2: Fallback usando regex (para SSR o si falla el método 1)
  let text = html
    // Primero convertir saltos de línea HTML a saltos de línea reales
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    // Remover TODAS las etiquetas HTML restantes
    .replace(/<[^>]+>/g, '')
    // Decodificar entidades HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'")
    // Limpiar espacios y saltos de línea múltiples
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Máximo 2 saltos consecutivos
    .replace(/[ \t]+/g, ' ') // Múltiples espacios a uno solo
    .replace(/^\s+|\s+$/gm, '') // Trim cada línea
    .trim();
  
  return text;
}

/**
 * Convierte texto plano a HTML básico
 * Convierte saltos de línea dobles a párrafos y simples a <br>
 */
export function textToHtml(text: string): string {
  if (!text) return '';

  return text
    // Codificar entidades HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Convertir saltos de línea dobles a párrafos
    .replace(/\n\n+/g, '</p><p>')
    // Convertir saltos de línea simples a <br>
    .replace(/\n/g, '<br>')
    // Envolver en etiquetas <p> si no están ya
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Limpiar párrafos vacíos
    .replace(/<p><\/p>/g, '')
    .replace(/<p><br><\/p>/g, '')
    // Limpiar etiquetas <p> vacías al final
    .replace(/<p>$/, '')
    .replace(/^<\/p>/, '');
}

/**
 * Limpia HTML manteniendo solo etiquetas básicas permitidas
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return html
    // Permitir solo etiquetas básicas
    .replace(/<\/?[^>]+(>|$)/g, (tag) => {
      const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span'];
      const tagName = tag.replace(/<\/?([a-zA-Z]+)[^>]*>/, '$1').toLowerCase();

      if (allowedTags.includes(tagName)) {
        return tag;
      }

      // Para <br>, asegurar que sea <br>
      if (tagName === 'br') {
        return '<br>';
      }

      return '';
    })
    .trim();
}
